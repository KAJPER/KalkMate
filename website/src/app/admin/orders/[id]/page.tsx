"use client";

import { useState, useEffect, useCallback, useRef, use } from "react";
import Link from "next/link";
import AdminShell from "@/components/admin/AdminShell";
import OrderStatusBadge from "@/components/admin/OrderStatusBadge";
import OrderFiscalCard from "@/components/admin/OrderFiscalCard";
import { fmtDateTime, formatAmount as fmtAmount } from "@/components/admin/format";
import { splitAddress, splitCityState, needsStateCode } from "@/lib/address";

interface OrderDetail {
  id: string;
  order_number: string;
  amount: number;
  currency: string;
  status: string;
  created: number;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  customer_address_street: string;
  customer_address_postcode: string;
  customer_address_city: string;
  customer_country: string;
  pickup_point: string;
  pickup_point_address: string;
  product: string;
  fulfillment_status: string;
  shipped_at: string | null;
  tracking_number: string;
  admin_notes: string;
  furgonetka_package_id: string;
  furgonetka_order_uuid: string;
  furgonetka_status: string;
  invoice_sent_at: string | null;
  invoice_filename: string;
  metadata: Record<string, string>;
  payment_provider: "stripe" | "p24";
  stripe_payment_intent_id: string | null;
  p24_session_id: string | null;
  personalized_code: string | null;
  personalized_name: string | null;
  // Wiele sztuk w zamowieniu (nowsze API) — brak = 1 szt. / stara para pol.
  quantity?: number;
  personalizations?: { code: string; name: string }[];
  attribution: {
    method: string;
    first: AttributionTouch | null;
    last: AttributionTouch | null;
  } | null;
  // Opcjonalne (nowsze API): nadanie Base Courier o niepewnym wyniku.
  shipment_uncertain?: boolean;
}

interface AttributionTouch { channel: string; source: string | null; campaign: string | null; landing: string | null; at: string | null }

// Sztuki zamowienia z kodem AI i imieniem — lista z API albo stara para pol.
function orderUnits(o: { quantity?: number; personalizations?: { code: string; name: string }[]; personalized_code: string | null; personalized_name: string | null }) {
  const qty = Math.max(1, Math.floor(Number(o.quantity) || 1));
  const list = o.personalizations?.length
    ? o.personalizations
    : o.personalized_code || o.personalized_name
      ? [{ code: o.personalized_code || "", name: o.personalized_name || "" }]
      : [];
  if (!list.length) return [];
  return Array.from({ length: Math.max(qty, list.length) }, (_, i) => list[i] ?? { code: "", name: "" });
}

const FULFILLMENT_PL: Record<string, string> = {
  unfulfilled: "Niezrealizowane",
  in_progress: "W realizacji",
  shipped: "Wysłane",
  fulfilled: "Zrealizowane",
  cancelled: "Anulowane",
};

// Niepewne nadanie (timeout / 502 Base Courier — paczka mogla zostac utworzona
// i oplacona mimo bledu). Tolerancyjnie: flaga z API albo status przesylki
// "basecourier_pending" (ustawiany przez serwer przed wywolaniem API kuriera).
const isShipmentUncertain = (o: OrderDetail | null) =>
  !!o && (!!o.shipment_uncertain || o.furgonetka_status === "basecourier_pending");

// "Wyszukiwarka · google · kampania · /en"
function describeTouch(t: AttributionTouch | null): string {
  if (!t) return "—";
  return [t.channel, t.source, t.campaign, t.landing].filter(Boolean).join(" · ");
}


export default function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fulfillment, setFulfillment] = useState("unfulfilled");
  const [tracking, setTracking] = useState("");
  const [notes, setNotes] = useState("");
  const [saveMsg, setSaveMsg] = useState("");

  // Identyfikator przesylki kurierskiej — kolumny furgonetka* w bazie sa
  // reuzywane przez Base Courier (furgonetkaStatus === "basecourier").
  const [furgonetkaPackageId, setFurgonetkaPackageId] = useState("");
  const [furgonetkaStatus, setFurgonetkaStatus] = useState("");

  // Invoice state
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [invoiceSending, setInvoiceSending] = useState(false);
  const [invoiceMsg, setInvoiceMsg] = useState("");

  // Mail do klienta — jak w /admin/mailbox, ale wysylany z inicjatywy admina
  // (nie jest to odpowiedz na wiadomosc). Ten sam mechanizm (kontakt@kalkmate.pl).
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [emailInstruction, setEmailInstruction] = useState("");
  const [emailGenerating, setEmailGenerating] = useState(false);
  const [emailGenError, setEmailGenError] = useState("");
  const [emailSending, setEmailSending] = useState(false);
  const [emailMsg, setEmailMsg] = useState("");

  // Wartosci pol formularza z chwili zaladowania z serwera. Na ich podstawie:
  // wysylamy tylko to, co admin zmienil (zapis notatki nie cofa statusu
  // zmienionego w miedzyczasie przez automat sledzenia), expected_fulfillment_status
  // do kontroli wyscigu (409) i nie nadpisujemy pol, ktore admin wlasnie edytuje.
  type FormVals = { fulfillment: string; tracking: string; notes: string };
  const loadedRef = useRef<FormVals | null>(null);
  const formRef = useRef<FormVals>({ fulfillment, tracking, notes });
  useEffect(() => {
    formRef.current = { fulfillment, tracking, notes };
  }, [fulfillment, tracking, notes]);
  // Notatki zmienione na serwerze (np. automatyczna notatka o niepewnym
  // nadaniu / zwrocie), gdy admin ma niezapisana wlasna wersje.
  const [serverNotes, setServerNotes] = useState<string | null>(null);

  const applyOrder = useCallback((o: OrderDetail, opts: { resetForm?: boolean; resetFulfillment?: boolean } = {}) => {
    setOrder(o);
    setFurgonetkaPackageId(o.furgonetka_package_id || "");
    setFurgonetkaStatus(o.furgonetka_status || "");
    const server: FormVals = {
      fulfillment: o.fulfillment_status || "unfulfilled",
      tracking: o.tracking_number || "",
      notes: o.admin_notes || "",
    };
    const prev = loadedRef.current;
    const cur = formRef.current;
    const isDirty = (k: keyof FormVals) => !opts.resetForm && !!prev && cur[k] !== prev[k];
    const fulfillmentDirty = !opts.resetFulfillment && isDirty("fulfillment");
    const trackingDirty = isDirty("tracking");
    const notesDirty = isDirty("notes");
    if (!fulfillmentDirty) setFulfillment(server.fulfillment);
    if (!trackingDirty) setTracking(server.tracking);
    if (!notesDirty) setNotes(server.notes);
    setServerNotes(notesDirty && prev && server.notes !== prev.notes ? server.notes : null);
    loadedRef.current = {
      // Pole w edycji zachowuje "baze" z chwili rozpoczecia edycji — zapis
      // zmienionego statusu dostanie wtedy 409, zamiast po cichu nadpisac zmiane.
      fulfillment: fulfillmentDirty && prev ? prev.fulfillment : server.fulfillment,
      tracking: trackingDirty && prev ? prev.tracking : server.tracking,
      notes: notesDirty && prev ? prev.notes : server.notes,
    };
  }, []);

  // Numer przesylki zapisany przez serwer (nadanie / powiazanie) — to nie jest
  // edycja admina, wiec przesuwamy tez "baze" (inaczej zapis notatki wyslalby
  // numer jako zmieniony).
  const setServerTracking = (t: string) => {
    setTracking(t);
    if (loadedRef.current) loadedRef.current = { ...loadedRef.current, tracking: t };
  };

  // Swieze dane zamowienia z serwera (po zapisie, nadaniu, zmianie ze sledzenia).
  const refreshOrder = useCallback(async (opts: { resetForm?: boolean; resetFulfillment?: boolean } = {}) => {
    try {
      const res = await fetch(`/api/admin/orders/${id}`, { cache: "no-store" });
      if (!res.ok) return false;
      const data = await res.json();
      if (data?.order) applyOrder(data.order, opts);
      return true;
    } catch (error) {
      console.error("Failed to refresh order:", error);
      return false;
    }
  }, [id, applyOrder]);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/admin/orders/${id}`);
        if (res.ok) {
          const data = await res.json();
          loadedRef.current = null;
          applyOrder(data.order, { resetForm: true });
          setEmailSubject(`Zamówienie #${data.order.order_number} - KalkMate`);
        }
      } catch (error) {
        console.error("Failed to load order:", error);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id, applyOrder]);

  // Sledzenie przesylki — InPost (Paczkomat) LUB inny kurier nadany przez
  // Base Courier (DPD, GLS, UPS...); serwer sam wybiera zrodlo po numerze/
  // furgonetkaStatus (patrz /api/admin/orders/[id]/tracking-sync).
  const [trackingSyncing, setTrackingSyncing] = useState(false);
  const [trackingCourier, setTrackingCourier] = useState<"inpost" | "basecourier" | null>(null);
  const [trackingInfo, setTrackingInfo] = useState<{
    status?: string;                 // InPost: kod statusu
    targetMachineId?: string | null; // InPost: id Paczkomatu
    updatedAt?: string | null;       // InPost
    courierName?: string | null;     // Base Courier: nazwa uslugi (np. "DPD Export Standard")
    events: Array<{
      status?: string;               // InPost: kod
      datetime?: string;             // InPost: znacznik czasu
      statusDesc?: string | null;    // Base Courier: opis PL
      eventTime?: string | null;     // Base Courier: znacznik czasu
    }>;
  } | null>(null);
  const [trackingMsg, setTrackingMsg] = useState("");

  const applyTrackingSync = (sync: { changed?: boolean; newStatus?: string; emailSent?: boolean; note?: string } | null, refresh = true) => {
    if (!sync) return;
    if (sync.changed && sync.newStatus) {
      // Status zmienil serwer — pobierz zamowienie (odznaka, pole statusu,
      // baza do expected_fulfillment_status), zamiast tylko podmieniac pole.
      if (refresh) void refreshOrder();
      setTrackingMsg(`Status zamówienia zmieniony na „${sync.newStatus}"${sync.emailSent ? " — mail do klienta wysłany" : ""}`);
    } else if (sync.note === "inpost_unavailable") {
      setTrackingMsg("InPost nie odpowiada / numer nieznany");
    } else if (sync.note === "basecourier_unavailable") {
      setTrackingMsg("Base Courier nie odpowiada");
    } else if (sync.note === "return_flagged") {
      setTrackingMsg("⚠ Zwrot/awizo — zobacz notatki, wymaga ręcznej decyzji");
    } else {
      setTrackingMsg("Bez zmian statusu");
    }
  };

  const handleTrackingSync = async () => {
    setTrackingSyncing(true);
    setTrackingMsg("");
    try {
      const res = await fetch(`/api/admin/orders/${id}/tracking-sync`, { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setTrackingMsg(data.error || "Błąd sprawdzania");
        return;
      }
      setTrackingInfo(data.tracking);
      setTrackingCourier(data.courier ?? null);
      applyTrackingSync(data.sync);
    } catch {
      setTrackingMsg("Błąd sieci");
    } finally {
      setTrackingSyncing(false);
    }
  };

  // Base Courier — nadanie InPost Paczkomat przez API (basecourier.com)
  const [bcLoading, setBcLoading] = useState(false);
  const [bcMsg, setBcMsg] = useState("");
  const [bcPreview, setBcPreview] = useState<{
    international: boolean;
    country?: string;
    receiver: { name: string; email: string; phone: string; lockerCode: string; street?: string; postal?: string; city?: string; state?: string };
    // USA/Kanada: UPS wymaga kodu stanu/prowincji (np. NY).
    needsState?: boolean;
    // Krajowe (Paczkomat) — jedna cena.
    valuation?: { price: { value: string; netto: string; vat: string } | null };
    // Zagraniczne (DE, US, ...) — kilku kurierow prubowanych na raz, tylko
    // szacunek; nadanie z panelu zostaje ograniczone do Polski.
    quotes?: { courierCode: string; courierName: string; price: { value: string; netto: string; vat: string } }[];
    // Podjazd kuriera: adresy do wyboru + daty (min = dzisiaj, domyslna = nast. dzien roboczy).
    pickup?: { addresses: { key: string; label: string }[]; minDate: string; defaultDate: string };
    // Poza UE — wymagane dokumenty celne (wersja papierowa + faktura do wydruku).
    needsCustomsDocs?: boolean;
    customsDefaults?: { value: number; quantity?: number; currency: string; hsCode: string; origin: string };
    // Liczba sztuk i parametry paczki (waga/wymiary rosna z iloscia).
    quantity?: number;
    parcel?: { weight: number; side_x: number; side_y: number; side_z: number; content: string };
  } | null>(null);

  // Odbior przesylki: samodzielne nadanie albo podjazd kuriera z wybranego adresu.
  const [bcPickupMode, setBcPickupMode] = useState<"self" | "courier">("self");
  const [bcPickupAddr, setBcPickupAddr] = useState("");
  const [bcPickupDate, setBcPickupDate] = useState("");
  const [bcPickupFrom, setBcPickupFrom] = useState("10:00");
  const [bcPickupTo, setBcPickupTo] = useState("16:00");

  // Faktura celna (PDF) — dane do deklaracji, podpowiedzi z zamowienia.
  const [customsValue, setCustomsValue] = useState("");
  const [customsHs, setCustomsHs] = useState("8470.10");
  const [customsOrigin, setCustomsOrigin] = useState("PL");

  // Dane odbiorcy do poprawy przed nadaniem (np. klient podal ucięty numer telefonu).
  // Inicjalizowane raz z wyceny, potem edytowalne; opcjonalnie zapisywane tez w zamowieniu.
  type BcRecvEdit = { name: string; phone: string; email: string; street: string; postal: string; city: string; state: string };
  const [bcRecv, setBcRecv] = useState<BcRecvEdit | null>(null);
  const [bcSaveToOrder, setBcSaveToOrder] = useState(true);

  // Powiazanie przesylki nadanej recznie w panelu Base Courier (np. do USA — API nie przyjmuje stanu dla UPS).
  const [linkId, setLinkId] = useState("");
  const [linking, setLinking] = useState(false);
  const [linkMsg, setLinkMsg] = useState("");
  const handleLinkBc = async () => {
    setLinking(true);
    setLinkMsg("");
    try {
      const res = await fetch(`/api/admin/orders/${id}/basecourier/link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ basecourierOrderId: linkId }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setLinkMsg(data.error || "Błąd powiązania");
        return;
      }
      setFurgonetkaStatus("basecourier");
      setFurgonetkaPackageId(String(data.basecourierOrderId));
      if (data.trackingNumber) setServerTracking(data.trackingNumber);
      setBcUncertain("");
      void refreshOrder();
      setBcMsg(
        `Nadano — powiązano zlecenie ${data.basecourierOrderId}${data.courierName ? ` (${data.courierName})` : ""}` +
          `${data.trackingNumber ? `, numer przesyłki: ${data.trackingNumber}` : ". API nie podaje numeru przesyłki — wpisz go ręcznie w polu „Numer przesyłki” (np. 1Z…) i zapisz"}.` +
          `${data.warning ? ` ${data.warning}` : ""}`
      );
    } catch {
      setLinkMsg("Błąd sieci");
    } finally {
      setLinking(false);
    }
  };

  // Te same reguly co w API Base Courier: telefon min. 9 cyfr, opcjonalny + na poczatku.
  const recvPhoneClean = (bcRecv?.phone || "").replace(/[\s\-().]/g, "");
  const recvError = (() => {
    if (!bcRecv || !bcPreview) return "";
    if (!bcRecv.name.trim()) return "Podaj imię i nazwisko odbiorcy.";
    if (!/^\+?\d{9,15}$/.test(recvPhoneClean)) return "Telefon odbiorcy: min. 9 cyfr, opcjonalny + tylko na początku (bez innych znaków).";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(bcRecv.email.trim())) return "Nieprawidłowy e-mail odbiorcy.";
    if (bcPreview.international && (!bcRecv.street.trim() || !bcRecv.postal.trim() || !bcRecv.city.trim()))
      return "Uzupełnij adres odbiorcy (ulica, kod pocztowy, miasto).";
    if (bcPreview.international && bcPreview.needsState && !/^[A-Za-z]{2}$/.test(bcRecv.state.trim()))
      return "Podaj 2-literowy kod stanu (USA: np. NY, CA, TX; Kanada: ON, QC…) — UPS go wymaga.";
    return "";
  })();
  const recvChanged = (() => {
    if (!bcRecv || !bcPreview) return false;
    const o = bcPreview.receiver;
    const same = (a: string, b: string | undefined) => a.trim().replace(/\s+/g, " ") === (b || "").trim().replace(/\s+/g, " ");
    return (
      !same(bcRecv.name, o.name) ||
      recvPhoneClean !== (o.phone || "").replace(/[\s\-().]/g, "") ||
      !same(bcRecv.email, o.email) ||
      (bcPreview.international && (!same(bcRecv.street, o.street) || !same(bcRecv.postal, o.postal) || !same(bcRecv.city, o.city) || !same(bcRecv.state, o.state)))
    );
  })();
  const receiverPayload = () => ({ receiver: bcRecv, saveToOrder: bcSaveToOrder && recvChanged });
  // Po udanym nadaniu z zapisem — odswiez dane klienta widoczne na stronie zamowienia.
  const applySavedReceiver = (saved?: Partial<Record<"name" | "email" | "phone" | "street" | "postal" | "city", string>>) => {
    if (!saved || Object.keys(saved).length === 0) return;
    setOrder((o) =>
      o
        ? {
            ...o,
            ...(saved.name !== undefined ? { customer_name: saved.name } : {}),
            ...(saved.email !== undefined ? { customer_email: saved.email } : {}),
            ...(saved.phone !== undefined ? { customer_phone: saved.phone } : {}),
            ...(saved.street !== undefined ? { customer_address_street: saved.street } : {}),
            ...(saved.postal !== undefined ? { customer_address_postcode: saved.postal } : {}),
            ...(saved.city !== undefined ? { customer_address_city: saved.city } : {}),
          }
        : o
    );
  };

  // Zapisz poprawki odbiorcy od razu, bez nadawania przesylki (np. zeby nie
  // stracic poprawek przy przerwie w pracy — nadanie i tak kosztuje realne
  // pieniadze, wiec admin moze chciec to zrobic pozniej).
  const [savingRecv, setSavingRecv] = useState(false);
  const [savingRecvMsg, setSavingRecvMsg] = useState("");
  const handleSaveReceiver = async () => {
    if (recvError) {
      setSavingRecvMsg(recvError);
      return;
    }
    setSavingRecv(true);
    setSavingRecvMsg("");
    try {
      const res = await fetch(`/api/admin/orders/${id}/basecourier/save-receiver`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receiver: bcRecv }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setSavingRecvMsg(data.error || "Błąd zapisu");
        return;
      }
      applySavedReceiver(data.saved);
      setBcPreview((p) => (p ? { ...p, receiver: { ...p.receiver, ...bcRecv } } : p));
      setSavingRecvMsg("Zapisano.");
    } catch {
      setSavingRecvMsg("Błąd sieci");
    } finally {
      setSavingRecv(false);
    }
  };

  const pickupError = (() => {
    if (bcPickupMode !== "courier") return "";
    if (!bcPickupDate) return "Wybierz dzień odbioru.";
    if (bcPreview?.pickup && bcPickupDate < bcPreview.pickup.minDate) return "Dzień odbioru nie może być w przeszłości.";
    const mins = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
    if (!bcPickupFrom || !bcPickupTo) return "Podaj godziny podjazdu (od – do).";
    if (mins(bcPickupTo) - mins(bcPickupFrom) < 120) return "Okno podjazdu musi trwać co najmniej 2 godziny.";
    return "";
  })();
  const pickupIsWeekend = (() => {
    if (bcPickupMode !== "courier" || !bcPickupDate) return false;
    const day = new Date(`${bcPickupDate}T12:00:00`).getDay();
    return day === 0 || day === 6;
  })();
  const pickupAddrLabel = bcPreview?.pickup?.addresses.find((a) => a.key === bcPickupAddr)?.label || "";

  // Cialo POST: pickup tylko gdy zamawiasz podjazd.
  const pickupPayload = () =>
    bcPickupMode === "courier"
      ? { pickup: { addressKey: bcPickupAddr, date: bcPickupDate, from: bcPickupFrom, to: bcPickupTo } }
      : {};
  const pickupConfirmLine = () =>
    bcPickupMode === "courier"
      ? `Podjazd kuriera: ${bcPickupDate}, ${bcPickupFrom}–${bcPickupTo}\nAdres odbioru: ${pickupAddrLabel}\n`
      : `Odbiór: nadajesz sam (bez podjazdu kuriera)\n`;

  const smallInput =
    "rounded bg-[#1E1F22] border border-[#3F4147] px-2 py-1 text-xs text-[#E0E0E0] focus:outline-none focus:border-amber-500/50";

  const pickupSection = bcPreview?.pickup ? (
    <div className="rounded-lg border border-[#3F4147] bg-[#2B2D31] p-3 text-xs text-[#E0E0E0]/80 space-y-2">
      <p className="text-[#E0E0E0]/50">Odbiór paczki:</p>
      <label className="flex items-center gap-2 cursor-pointer">
        <input type="radio" name="bc-pickup-mode" checked={bcPickupMode === "self"} onChange={() => setBcPickupMode("self")} />
        Nadam sam ({bcPreview.international ? "w punkcie kuriera" : "w Paczkomacie"}) — bez kuriera
      </label>
      <label className="flex items-center gap-2 cursor-pointer">
        <input type="radio" name="bc-pickup-mode" checked={bcPickupMode === "courier"} onChange={() => setBcPickupMode("courier")} />
        Zamów podjazd kuriera
      </label>
      {bcPickupMode === "courier" && (
        <div className="space-y-2 pl-5">
          <div className="space-y-1">
            <p className="text-[#E0E0E0]/50">Adres odbioru:</p>
            {bcPreview.pickup.addresses.map((a) => (
              <label
                key={a.key}
                className={`flex items-center gap-2 rounded px-2 py-1.5 cursor-pointer border transition-colors ${
                  bcPickupAddr === a.key ? "bg-amber-500/10 border-amber-500/50" : "bg-[#1E1F22] border-transparent hover:border-[#3F4147]"
                }`}
              >
                <input type="radio" name="bc-pickup-addr" checked={bcPickupAddr === a.key} onChange={() => setBcPickupAddr(a.key)} />
                {a.label}
              </label>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-1.5">
              Dzień
              <input
                type="date"
                min={bcPreview.pickup.minDate}
                value={bcPickupDate}
                onChange={(e) => setBcPickupDate(e.target.value)}
                className={smallInput}
              />
            </label>
            <label className="flex items-center gap-1.5">
              od
              <input type="time" value={bcPickupFrom} onChange={(e) => setBcPickupFrom(e.target.value)} className={smallInput} />
            </label>
            <label className="flex items-center gap-1.5">
              do
              <input type="time" value={bcPickupTo} onChange={(e) => setBcPickupTo(e.target.value)} className={smallInput} />
            </label>
          </div>
          {pickupError && <p className="text-red-400">{pickupError}</p>}
          {!pickupError && pickupIsWeekend && (
            <p className="text-amber-400">Uwaga: to weekend — kurierzy zwykle nie odbierają paczek w soboty i niedziele.</p>
          )}
          <p className="text-[11px] text-[#E0E0E0]/40">Okno podjazdu musi trwać co najmniej 2 godziny. Adres nadawcy w zleceniu = wybrany adres odbioru.</p>
        </div>
      )}
    </div>
  ) : null;

  // Faktura celna bierze tez poprawione dane odbiorcy (jeszcze niezapisane w zamowieniu).
  const customsRecvQuery = bcRecv
    ? (Object.entries(bcRecv) as [string, string][]).map(([k, v]) => `&${k}=${encodeURIComponent(v)}`).join("")
    : "";
  const customsHref = `/api/admin/orders/${id}/customs-invoice?value=${encodeURIComponent(customsValue)}&hs=${encodeURIComponent(customsHs)}&origin=${encodeURIComponent(customsOrigin)}&from=${bcPickupMode === "courier" && bcPickupAddr ? bcPickupAddr : "choroszcz"}${customsRecvQuery}`;

  // Karta odprawy celnej UPS (formularz z Base Courier) — wypelniona danymi zamowienia.
  const customsCardHref = `/api/admin/orders/${id}/customs-card?value=${encodeURIComponent(customsValue)}`;
  // Prog z Karty: do 1000 EUR i 1000 kg nie trzeba upowaznienia celnego (przyblizone przeliczenie na EUR).
  const customsValueEur = (parseFloat(customsValue.replace(",", ".")) || 0) * (({ EUR: 1, PLN: 1 / 4.3, USD: 1 / 1.1 } as Record<string, number>)[bcPreview?.customsDefaults?.currency || "EUR"] ?? 1);

  const receiverEditor =
    bcPreview && bcRecv ? (
      <div className="space-y-2">
        <p className="text-[#E0E0E0]/50">Odbiorca — możesz poprawić dane przed nadaniem:</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <label className="flex flex-col gap-1">
            Imię i nazwisko
            <input type="text" value={bcRecv.name} onChange={(e) => setBcRecv({ ...bcRecv, name: e.target.value })} className={smallInput} />
          </label>
          <label className="flex flex-col gap-1">
            Telefon
            <input
              type="tel"
              value={bcRecv.phone}
              onChange={(e) => setBcRecv({ ...bcRecv, phone: e.target.value })}
              placeholder={bcPreview.international ? "+36 30 123 4567" : "600 123 456"}
              className={smallInput}
            />
          </label>
          <label className="flex flex-col gap-1">
            E-mail
            <input type="email" value={bcRecv.email} onChange={(e) => setBcRecv({ ...bcRecv, email: e.target.value })} className={smallInput} />
          </label>
        </div>
        {bcPreview.international && (
          <div className={`grid grid-cols-1 gap-2 ${bcPreview.needsState ? "sm:grid-cols-2" : "sm:grid-cols-3"}`}>
            <label className="flex flex-col gap-1">
              Ulica i numer
              <input type="text" value={bcRecv.street} onChange={(e) => setBcRecv({ ...bcRecv, street: e.target.value })} className={smallInput} />
            </label>
            <label className="flex flex-col gap-1">
              Kod pocztowy
              <input type="text" value={bcRecv.postal} onChange={(e) => setBcRecv({ ...bcRecv, postal: e.target.value })} className={smallInput} />
            </label>
            <label className="flex flex-col gap-1">
              Miasto
              <input type="text" value={bcRecv.city} onChange={(e) => setBcRecv({ ...bcRecv, city: e.target.value })} className={smallInput} />
            </label>
            {bcPreview.needsState && (
              <label className="flex flex-col gap-1">
                Stan / prowincja (kod)
                <input
                  type="text"
                  value={bcRecv.state}
                  maxLength={2}
                  autoCapitalize="characters"
                  placeholder="np. NY"
                  onChange={(e) => setBcRecv({ ...bcRecv, state: e.target.value.toUpperCase() })}
                  className={`${smallInput} w-24`}
                />
              </label>
            )}
          </div>
        )}
        {recvError ? (
          <p className="text-red-400">{recvError}</p>
        ) : (
          bcPreview.international &&
          !recvPhoneClean.startsWith("+") && (
            <p className="text-amber-400">Do zagranicy numer najlepiej z kodem kraju, np. +36 30 123 4567.</p>
          )
        )}
        {recvChanged && (
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={bcSaveToOrder} onChange={(e) => setBcSaveToOrder(e.target.checked)} />
              Zapisz poprawione dane także w zamówieniu (po udanym nadaniu)
            </label>
            <button
              type="button"
              onClick={handleSaveReceiver}
              disabled={savingRecv || !!recvError}
              className="px-4 py-2 rounded-lg bg-[#3F4147] hover:bg-[#4a4d55] text-[#E0E0E0] text-xs font-medium transition-colors disabled:opacity-50"
            >
              {savingRecv ? "Zapisuję…" : "Zapisz teraz (bez nadawania)"}
            </button>
          </div>
        )}
        {savingRecvMsg && (
          <p className={`text-xs ${savingRecvMsg === "Zapisano." ? "text-green-400" : "text-red-400"}`}>{savingRecvMsg}</p>
        )}
      </div>
    ) : null;

  const customsSection = bcPreview?.needsCustomsDocs ? (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-[#E0E0E0]/80 space-y-2">
      <p className="text-amber-300 font-medium">Dokumenty celne (kraj poza UE)</p>
      <p>
        Przesyłka zostanie nadana z opcją „wersja papierowa” dokumentów celnych. Wydrukuj fakturę celną w{" "}
        <strong>3 egzemplarzach</strong> i włóż do foliowej kieszeni na paczce.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          Wartość ({bcPreview.customsDefaults?.currency || ""})
          <input type="number" step="0.01" min="0" value={customsValue} onChange={(e) => setCustomsValue(e.target.value)} className={`${smallInput} w-28`} />
        </label>
        <label className="flex flex-col gap-1">
          Kod HS
          <input type="text" value={customsHs} onChange={(e) => setCustomsHs(e.target.value)} className={`${smallInput} w-24`} />
        </label>
        <label className="flex flex-col gap-1">
          Kraj pochodzenia
          <input type="text" maxLength={2} value={customsOrigin} onChange={(e) => setCustomsOrigin(e.target.value.toUpperCase())} className={`${smallInput} w-16`} />
        </label>
        <a
          href={customsHref}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold text-[#1a1a1a] bg-gradient-to-r from-yellow-400 to-amber-500 hover:from-yellow-300 hover:to-amber-400"
        >
          Pobierz fakturę celną (PDF)
        </a>
        <a
          href={customsCardHref}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold text-[#1a1a1a] bg-gradient-to-r from-yellow-400 to-amber-500 hover:from-yellow-300 hover:to-amber-400"
        >
          Pobierz kartę odprawy celnej UPS (PDF)
        </a>
      </div>
      <p className="text-[11px] text-[#E0E0E0]/40">
        Kod HS, kraj pochodzenia i wartość to Twoja deklaracja celna — sprawdź je przed wydrukiem (podpowiedzi: kalkulator 8470.10, kraj PL, kwota zamówienia).
        Do paczki: faktura celna w 3 egz. + Karta odprawy celnej UPS (data i podpis wklejane automatycznie, jeśli zapisałeś podpis w ustawieniach panelu).
      </p>
      {customsValueEur > 1000 ? (
        <div className="space-y-2">
          <p className="text-amber-400">
            Wartość przekracza 1000 EUR — Karta nie zaznacza wtedy „IE599 nie jest wymagane”, a UPS wymaga upoważnienia celnego dla agencji celnej.
            Pobierz i dołącz podpisane upoważnienie (jednorazowe, tylko do tej przesyłki):
          </p>
          <a
            href={`/api/admin/orders/${id}/customs-authorization`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold text-[#1a1a1a] bg-gradient-to-r from-yellow-400 to-amber-500 hover:from-yellow-300 hover:to-amber-400"
          >
            Pobierz upoważnienie celne UPS (PDF)
          </a>
          <p className="text-[11px] text-[#E0E0E0]/40">
            Wypełnia PESEL (z konfiguracji serwera, nigdy w repo) i zaznacza „WYRAŻAM zgodę na dalsze upoważnienie” — jeśli to się zmieni, popraw ręcznie przed podpisem.
          </p>
        </div>
      ) : (
        <p className="text-[11px] text-[#E0E0E0]/40">
          Do 1000 EUR i 1000 kg upoważnienie celne dla agencji UPS nie jest wymagane (warunek z samej Karty).
        </p>
      )}
    </div>
  ) : null;

  const handleBcPreview = async () => {
    setBcLoading(true);
    setBcMsg("");
    try {
      const res = await fetch(`/api/admin/orders/${id}/basecourier`);
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setBcMsg(data.error || "Błąd wyceny");
        return;
      }
      setBcPreview({
        international: !!data.international,
        country: data.country,
        receiver: data.receiver,
        valuation: data.valuation,
        quotes: data.quotes,
        pickup: data.pickup,
        needsCustomsDocs: data.needsCustomsDocs,
        customsDefaults: data.customsDefaults,
        needsState: data.needsState,
        quantity: data.quantity,
        parcel: data.parcel,
      });
      setBcRecv(
        (prev) =>
          prev ?? {
            name: data.receiver.name || "",
            phone: data.receiver.phone || "",
            email: data.receiver.email || "",
            street: data.receiver.street || "",
            postal: data.receiver.postal || "",
            city: data.receiver.city || "",
            state: data.receiver.state || "",
          }
      );
      if (data.pickup) {
        setBcPickupAddr((prev) => prev || data.pickup.addresses[0]?.key || "");
        setBcPickupDate((prev) => prev || data.pickup.defaultDate);
      }
      if (data.customsDefaults) {
        setCustomsValue((prev) => prev || String(data.customsDefaults.value));
      }
      // Serwer: poprzednie nadanie w toku / niepewne (basecourier_pending).
      if (data.pending) setBcUncertain((prev) => prev || "poprzednie nadanie jest w toku albo zakończyło się niepewnie (szczegóły w notatkach zamówienia)");
    } catch {
      setBcMsg("Błąd sieci");
    } finally {
      setBcLoading(false);
    }
  };

  // Kurier wybrany do nadania zagranicznego (jeden z bcPreview.quotes).
  const [selectedCourier, setSelectedCourier] = useState<string>("");

  // Niepewne nadanie (502 / timeout po stronie Base Courier albo flaga z
  // serwera) — paczka MOGLA zostac utworzona i oplacona. Ponowienie tylko po
  // swiadomym potwierdzeniu (inaczej dwie oplacone paczki).
  const [bcUncertain, setBcUncertain] = useState("");
  const uncertainNote =
    bcUncertain || (isShipmentUncertain(order) ? "nadanie w toku albo zakończone błędem po wysłaniu zlecenia (szczegóły w notatkach zamówienia)" : "");
  // Ponowienie po niepewnym nadaniu tylko po swiadomym potwierdzeniu — wtedy
  // serwer dostaje confirmUncertainRetry (bez tego odpowiada 409).
  // null = admin anulowal; obiekt = dopisz do body POST.
  const uncertainRetryPayload = (): Record<string, boolean> | null => {
    if (!uncertainNote) return {};
    return confirm(
      `Poprzednia próba nadania zakończyła się NIEPEWNIE:\n${uncertainNote}\n\n` +
        `Paczka mogła zostać utworzona i opłacona mimo błędu. Sprawdź panel Base Courier (lista zleceń, saldo Skarbonki) i notatki zamówienia. ` +
        `Jeśli zlecenie tam jest — użyj „Powiąż zlecenie” zamiast nadawać ponownie.\n\n` +
        `Na pewno nadać PONOWNIE (kolejna płatna paczka)?`
    )
      ? { confirmUncertainRetry: true }
      : null;
  };

  // Wspolna obsluga nieudanego POST nadania (krajowe i zagraniczne).
  const handleBcFailure = (status: number, data: { error?: string; adminNotes?: string; uncertain?: boolean }) => {
    if (status === 409) {
      // Serwer odmowil: anulowane (zwrot) / juz wyslane / niepewne nadanie — bez kosztu.
      setBcMsg(`Serwer odmówił nadania: ${data.error || "zamówienie anulowane, już wysłane albo z niepewnym nadaniem"}`);
      if (data.uncertain) setBcUncertain(data.error || "niepewne nadanie");
      void refreshOrder();
      return;
    }
    if (status === 502 || status === 504 || data.uncertain) {
      // adminNotes w odpowiedzi to CALE notatki zamowienia — pokazujemy je
      // w polu "Notatki" (refreshOrder), a tu tylko blad.
      const m = data.error || `HTTP ${status}`;
      setBcUncertain(m);
      setBcMsg(`NIEPEWNE nadanie: ${m}. Paczka mogła zostać utworzona — sprawdź panel Base Courier, zanim spróbujesz ponownie.`);
      void refreshOrder();
      return;
    }
    setBcMsg(data.error || "Błąd nadania");
  };

  const handleBcCreate = async () => {
    const price = bcPreview?.valuation?.price?.value;
    if (recvError || pickupError) {
      setBcMsg(recvError || pickupError);
      return;
    }
    if (
      !confirm(
        `Nadać przesyłkę InPost Paczkomat przez Base Courier?\n\n` +
          `Odbiorca: ${bcRecv?.name || bcPreview?.receiver.name || order?.customer_name} · ${bcRecv?.phone || ""}\n` +
          `Paczkomat: ${bcPreview?.receiver.lockerCode || order?.pickup_point}\n` +
          pickupConfirmLine() +
          `Koszt: ${price ? price + " zł brutto" : "wg cennika"} — pobierany z Twojego konta Base Courier.\n\n` +
          `Tej operacji nie da się cofnąć z panelu.`
      )
    )
      return;
    const retry = uncertainRetryPayload();
    if (!retry) return;
    setBcLoading(true);
    setBcMsg("");
    try {
      const res = await fetch(`/api/admin/orders/${id}/basecourier`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...pickupPayload(), ...receiverPayload(), ...retry }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        handleBcFailure(res.status, data);
        return;
      }
      applySavedReceiver(data.saved);
      setFurgonetkaStatus("basecourier");
      if (data.basecourierOrderId) setFurgonetkaPackageId(String(data.basecourierOrderId));
      if (data.trackingNumber) setServerTracking(data.trackingNumber);
      setBcUncertain("");
      applyTrackingSync(data.trackingSync, false);
      void refreshOrder();
      setBcMsg(
        data.trackingNumber
          ? `Nadano. Numer przesyłki: ${data.trackingNumber}`
          : "Nadano — numer przesyłki nie wrócił w odpowiedzi, sprawdź w panelu Base Courier"
      );
    } catch {
      setBcMsg("Błąd sieci");
    } finally {
      setBcLoading(false);
    }
  };

  const handleBcCreateIntl = async () => {
    if (!selectedCourier || !bcPreview?.quotes) return;
    const q = bcPreview.quotes.find((x) => x.courierCode === selectedCourier);
    if (recvError || pickupError) {
      setBcMsg(recvError || pickupError);
      return;
    }
    if (
      !confirm(
        `Nadać przesyłkę zagraniczną przez Base Courier?\n\n` +
          `Kurier: ${q?.courierName || selectedCourier}\n` +
          `Kraj: ${bcPreview.country}\n` +
          `Odbiorca: ${bcRecv?.name || bcPreview.receiver.name} · ${bcRecv?.phone || ""}\n` +
          pickupConfirmLine() +
          (bcPreview.needsCustomsDocs
            ? `Dokumenty celne: wersja papierowa — wydrukuj fakturę celną w 3 egz. i dołącz do paczki.\n`
            : ``) +
          `Koszt: ${q ? q.price.value + " zł brutto" : "wg cennika"} — pobierany z Twojego konta Base Courier.\n\n` +
          `Tej operacji nie da się cofnąć z panelu.`
      )
    )
      return;
    const retry = uncertainRetryPayload();
    if (!retry) return;
    setBcLoading(true);
    setBcMsg("");
    try {
      const res = await fetch(`/api/admin/orders/${id}/basecourier`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courierCode: selectedCourier, ...pickupPayload(), ...receiverPayload(), ...retry }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        handleBcFailure(res.status, data);
        return;
      }
      applySavedReceiver(data.saved);
      setFurgonetkaStatus("basecourier");
      if (data.basecourierOrderId) setFurgonetkaPackageId(String(data.basecourierOrderId));
      if (data.trackingNumber) setServerTracking(data.trackingNumber);
      setBcUncertain("");
      applyTrackingSync(data.trackingSync, false);
      void refreshOrder();
      setBcMsg(
        data.trackingNumber
          ? `Nadano. Numer przesyłki: ${data.trackingNumber}`
          : "Nadano — numer przesyłki nie wrócił w odpowiedzi, sprawdź w panelu Base Courier"
      );
    } catch {
      setBcMsg("Błąd sieci");
    } finally {
      setBcLoading(false);
    }
  };

  // Cichy druk etykiety — tylko w aplikacji desktopowej (window.kalkmateDesktop
  // z preload.js). Aplikacja pobiera PDF swoja sesja i drukuje bez okna dialogu
  // z ustawieniami: drukarka etykiet, pionowo, 1 kopia, monochromatycznie.
  const [canPrintLabel, setCanPrintLabel] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [printMsg, setPrintMsg] = useState("");
  useEffect(() => {
    setCanPrintLabel(typeof window.kalkmateDesktop?.printLabel === "function");
  }, []);

  const handlePrintLabel = async () => {
    const bridge = window.kalkmateDesktop;
    if (!bridge?.printLabel) return;
    setPrinting(true);
    setPrintMsg("");
    try {
      const r = await bridge.printLabel(`/api/admin/orders/${id}/basecourier/label`);
      setPrintMsg(r.ok ? `Wysłano do druku (${r.printer || "drukarka etykiet"})` : r.error || "Błąd drukowania");
    } catch (e) {
      setPrintMsg(`Błąd drukowania: ${(e as Error).message}`);
    } finally {
      setPrinting(false);
    }
  };

  const handleSave = async () => {
    const base = loadedRef.current;
    if (!base) return;
    // Wysylamy TYLKO pola zmienione przez admina — zapis samej notatki nie
    // moze cofnac statusu, ktory w miedzyczasie zmienil automat sledzenia.
    const body: Record<string, string> = {};
    if (fulfillment !== base.fulfillment) {
      if (
        fulfillment === "cancelled" &&
        !confirm("Anulować zamówienie? Zwrot pieniędzy wykonany? Klient dostanie maila o anulowaniu.")
      )
        return;
      body.fulfillment_status = fulfillment;
      body.expected_fulfillment_status = base.fulfillment;
    }
    if (tracking.trim() !== base.tracking.trim()) {
      // Pusty numer = usuniecie numeru przesylki z zamowienia.
      if (!tracking.trim() && !confirm(`Usunąć numer przesyłki ${base.tracking} z zamówienia?`)) return;
      body.tracking_number = tracking.trim();
    }
    if (notes !== base.notes) body.notes = notes;
    if (!Object.keys(body).length) {
      setSaveMsg("Brak zmian do zapisania");
      setTimeout(() => setSaveMsg(""), 3000);
      return;
    }

    setSaving(true);
    setSaveMsg("");

    try {
      const res = await fetch(`/api/admin/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => null);

      if (res.ok) {
        setSaveMsg("Zapisano");
        setTimeout(() => setSaveMsg(""), 3000);
        // Swieze dane z serwera: odznaka statusu, numer przesylki (przycisk
        // "Sprawdz status"), nowa baza do kolejnych zmian.
        await refreshOrder({ resetForm: true });
        // Nowy numer InPost -> serwer od razu sprawdzil status (zamowienie
        // pobrane wyzej juz go uwzglednia — tylko komunikat).
        if (data?.trackingSync) applyTrackingSync(data.trackingSync, false);
      } else if (res.status === 409) {
        const current = data?.current ? FULFILLMENT_PL[data.current] || data.current : "?";
        setSaveMsg(`Status zmienił się w międzyczasie (teraz: ${current}) — odśwież`);
        await refreshOrder({ resetFulfillment: true });
      } else {
        setSaveMsg(data?.error ? `Błąd zapisu: ${data.error}` : "Błąd zapisu");
      }
    } catch {
      setSaveMsg("Błąd zapisu");
    } finally {
      setSaving(false);
    }
  };

  const handleSendInvoice = async () => {
    if (!invoiceFile) return;
    setInvoiceSending(true);
    setInvoiceMsg("");
    try {
      const form = new FormData();
      form.append("invoice", invoiceFile);
      const res = await fetch(`/api/admin/orders/${id}/invoice`, { method: "POST", body: form });
      const data = await res.json();
      if (res.ok) {
        setInvoiceMsg(`✓ Wysłano na ${data.sentTo}`);
        setInvoiceFile(null);
      } else {
        setInvoiceMsg(`Błąd: ${data.error}`);
      }
    } catch (e) {
      setInvoiceMsg(`Błąd: ${(e as Error).message}`);
    } finally {
      setInvoiceSending(false);
    }
  };

  const handleGenerateEmail = async () => {
    // Wynik AI zastepuje tresc — nie kasujemy po cichu tego, co admin wpisal.
    if (emailBody.trim() && !confirm("Zastąpić wpisaną treść maila tekstem wygenerowanym przez AI?")) return;
    setEmailGenerating(true);
    setEmailGenError("");
    try {
      const res = await fetch(`/api/admin/orders/${id}/email-draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instruction: emailInstruction }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setEmailGenError(data.error || "Błąd generowania");
        return;
      }
      setEmailBody(data.draft);
    } catch {
      setEmailGenError("Błąd sieci");
    } finally {
      setEmailGenerating(false);
    }
  };

  const handleSendEmail = async () => {
    if (!emailSubject.trim() || !emailBody.trim()) return;
    if (!confirm(`Wysłać maila do klienta?\n\nDo: ${order?.customer_email || "—"}\nTemat: ${emailSubject.trim()}\n\nTego nie da się cofnąć.`)) return;
    setEmailSending(true);
    setEmailMsg("");
    try {
      const html = `<div style="font-family:sans-serif;font-size:14px;white-space:pre-wrap;">${emailBody
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")}</div>`;
      const res = await fetch(`/api/admin/orders/${id}/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: emailSubject, html }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setEmailMsg(data.error || "Błąd wysyłki");
        return;
      }
      setEmailMsg("✓ Wysłano.");
      setEmailBody("");
    } catch {
      setEmailMsg("Błąd sieci");
    } finally {
      setEmailSending(false);
    }
  };

  // ---------------------------------------------------------------------
  // Eksport CSV do masowego wgrania w panelu kuriera ("Importuj zamowienia
  // z pliku CSV") — alternatywa dla nadania przez API Base Courier,
  // przydatne gdy wolisz wgrac przesylke recznie.
  //
  // Wartosci ponizej sa zgodne z dokladnymi opcjami z tooltipow "wiecej
  // informacji" na ich formularzu (potwierdzone przez uzytkownika):
  //   rodzaj przesylki: paczka | koperta | paleta | niestandardowa
  //   ksztalt i rodzaj opakowania: standardowa | niestandardowa
  //   sposob nadania: odbior przez kuriera | dostarcz przesylke do punktu
  //   sposob doreczenia: kurier | punkt odbioru
  const FURGONETKA_CSV = {
    // --- Paczka (te same dla kazdego zamowienia — jeden model, jedno pudelko) ---
    dlugosc: "18",
    szerokosc: "12",
    wysokosc: "4",
    waga: "1", // kg
    rodzajPrzesylki: "paczka",
    ksztaltOpakowania: "standardowa",
    zawartosc: "Kalkulator elektroniczny",
    sposobNadania: "dostarcze przesylke do punktu",
    // --- Nadawca (stale dane firmy — z CLAUDE.md / stopki strony) ---
    nadawcaImie: "Kacper Popko",
    nadawcaFirma: "KAJPA Kacper Popko",
    nadawcaUlica: "ul. Zastawie I",
    nadawcaNumer: "37",
    nadawcaKod: "16-070",
    nadawcaMiasto: "Choroszcz",
    nadawcaEmail: "kacper@kajpa.pl",
    nadawcaTelefon: "600580888",
  };

  // CSV-escapuje pole: cudzyslowia jesli zawiera srednik/cudzyslow/nowa linie.
  function csvField(v: string): string {
    const s = v ?? "";
    if (/[;"\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  }

  const handleExportFurgonetkaCsv = () => {
    if (!order) return;
    const country = order.customer_country || "PL";
    // Dane odbiorcy: poprawione w edytorze Base Courier (jesli otwarty), inaczej z zamowienia.
    const r = bcRecv ?? {
      name: order.customer_name,
      phone: order.customer_phone,
      email: order.customer_email,
      street: order.customer_address_street,
      postal: order.customer_address_postcode,
      city: order.customer_address_city,
      state: "",
    };
    // Furgonetka chce ulice / numer budynku / numer mieszkania w osobnych kolumnach
    // ("217 Manhattan Avenue, unit 5B-3" -> Manhattan Avenue | 217 | 5B-3), a u nas to jedno pole.
    const addr = splitAddress(r.street, country);
    // Miasto bez dopisanego stanu ("New York, new york" -> "New York"); stanu w szablonie CSV nie ma.
    const recvCity = splitCityState(r.city, country).city;
    const isPaczkomat = !!order.pickup_point;

    // Kolejnosc/liczba kolumn (40) zweryfikowana 1:1 z przyklad-import-zamowien-v2.csv
    // pobranym z panelu — TAM jest zrodlo prawdy, nie z listy pol na stronie
    // formularza (ktora zawierala dodatkowe pole "zniesienie" nieobecne w CSV).
    const headers = [
      "rodzaj przesylki", "dlugosc", "szerokosc", "wysokosc", "waga",
      "ksztalt i rodzaj opakowania", "zawartosc przesylki", "sposob nadania", "sposob doreczenia",
      "imie i nazwisko odbiorcy", "nazwa firmy odbiorcy", "ulica odbiorcy", "numer budynku odbiorcy",
      "numer mieszkania odbiorcy", "kraj odbiorcy", "kod pocztowy odbiorcy", "miasto odbiorcy",
      "adres e-mail odbiorcy", "numer telefonu odbiorcy", "kurier",
      "imie i nazwisko nadawcy", "nazwa firmy nadawcy", "ulica nadawcy", "numer budynku nadawcy",
      "numer mieszkania nadawcy", "kod pocztowy nadawcy", "miasto nadawcy", "adres e-mail nadawcy",
      "numer telefonu nadawcy", "data odbioru", "godzina odbioru od", "godzina odbioru do",
      "kod punktu odbioru", "ubezpieczenie", "pobranie", "paczka w weekend", "ostroznie",
      "wniesienie", "wniesienie i rozpakowanie", "zwrot palet",
    ];

    const row = [
      FURGONETKA_CSV.rodzajPrzesylki,                              // rodzaj przesylki *
      FURGONETKA_CSV.dlugosc,                                      // dlugosc *
      FURGONETKA_CSV.szerokosc,                                    // szerokosc *
      FURGONETKA_CSV.wysokosc,                                     // wysokosc *
      FURGONETKA_CSV.waga,                                         // waga *
      FURGONETKA_CSV.ksztaltOpakowania,                            // ksztalt i rodzaj opakowania *
      FURGONETKA_CSV.zawartosc,                                    // zawartosc przesylki *
      FURGONETKA_CSV.sposobNadania,                                // sposob nadania *
      isPaczkomat ? "punkt odbioru" : "kurier",                    // sposob doreczenia *
      r.name,                                                      // imie i nazwisko odbiorcy *
      "",                                                          // nazwa firmy odbiorcy
      addr.street,                                                 // ulica odbiorcy *
      addr.building,                                               // numer budynku odbiorcy *
      addr.apartment,                                              // numer mieszkania odbiorcy
      country,                                                     // kraj odbiorcy *
      r.postal,                                                    // kod pocztowy odbiorcy *
      recvCity,                                                    // miasto odbiorcy *
      r.email,                                                     // adres e-mail odbiorcy *
      r.phone.replace(/[\s\-().]/g, ""),                           // numer telefonu odbiorcy * (bez spacji/myslnikow)
      isPaczkomat ? "paczkomaty" : "",                             // kurier
      FURGONETKA_CSV.nadawcaImie,                                  // imie i nazwisko nadawcy
      FURGONETKA_CSV.nadawcaFirma,                                 // nazwa firmy nadawcy
      FURGONETKA_CSV.nadawcaUlica,                                 // ulica nadawcy
      FURGONETKA_CSV.nadawcaNumer,                                 // numer budynku nadawcy
      "",                                                          // numer mieszkania nadawcy
      FURGONETKA_CSV.nadawcaKod,                                   // kod pocztowy nadawcy
      FURGONETKA_CSV.nadawcaMiasto,                                // miasto nadawcy
      FURGONETKA_CSV.nadawcaEmail,                                 // adres e-mail nadawcy
      FURGONETKA_CSV.nadawcaTelefon,                               // numer telefonu nadawcy
      "", "", "",                                                  // data/godziny odbioru
      isPaczkomat ? order.pickup_point : "",                       // kod punktu odbioru
      "", "", "", "",                                              // ubezpieczenie/pobranie/weekend/ostroznie
      "", "", "",                                                  // wniesienie/wniesienie i rozpakowanie/zwrot palet
    ];

    // BEZ BOM — realny szablon platformy nie toleruje BOM przed pierwszym
    // naglowkiem (psuje rozpoznanie kolumny "rodzaj przesylki"). Polskie
    // znaki i tak dojda poprawnie, bo Blob ma charset=utf-8.
    const csv = [headers, row].map((r) => r.map(csvField).join(";")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `furgonetka-${order.id.slice(-8)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Czas polski niezaleznie od strefy komputera (np. aplikacja Electron).
  const formatDate = (ts: number) => fmtDateTime(ts, { seconds: true });
  const formatAmount = fmtAmount;

  const inputClass =
    "w-full px-3 py-2 rounded-lg border border-[#3F4147] bg-[#2B2D31] text-[#E0E0E0] text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6]";

  return (
    <AdminShell>
      <div className="mb-6 space-y-2">
        <Link
          href="/admin/orders"
          className="text-sm text-[#3B82F6] hover:underline"
        >
          &larr; Zamówienia
        </Link>
        {order && (
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-[#E0E0E0] font-mono">{order.order_number}</h1>
            <CopyButton text={order.order_number} />
            <OrderStatusBadge status={order.status} type="payment" />
            <OrderStatusBadge status={order.fulfillment_status} type="fulfillment" />
          </div>
        )}
      </div>

      {loading ? (
        <div className="text-[#E0E0E0]/50 text-sm">Ładowanie...</div>
      ) : !order ? (
        <div className="text-red-400 text-sm">Nie znaleziono zamówienia.</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Order info */}
          <div className="bg-[#313338] rounded-lg border border-[#3F4147] p-4 sm:p-6 space-y-4">
            <h2 className="text-lg font-bold text-[#E0E0E0]">
              Szczegóły zamówienia
            </h2>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-[#E0E0E0]/50">Numer</span>
                <span className="text-[#E0E0E0] font-mono font-semibold break-all text-right min-w-0">
                  {order.order_number}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-[#E0E0E0]/50">ID</span>
                <span className="text-[#E0E0E0]/60 font-mono text-xs break-all text-right min-w-0">
                  {order.id}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-[#E0E0E0]/50">Data</span>
                <span className="text-[#E0E0E0] break-words text-right min-w-0">
                  {formatDate(order.created)}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-[#E0E0E0]/50">Kwota</span>
                <span className="text-[#E0E0E0] font-bold">
                  {formatAmount(order.amount, order.currency)}
                </span>
              </div>
              <div className="flex justify-between items-center gap-3">
                <span className="text-[#E0E0E0]/50">Status płatności</span>
                <OrderStatusBadge status={order.status} type="payment" />
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-[#E0E0E0]/50">Produkt</span>
                <span className="text-[#E0E0E0] break-words text-right min-w-0">
                  {order.product}
                  {(order.quantity ?? 1) > 1 && <span className="ml-1.5 font-bold text-[#D8FF3D]">×{order.quantity}</span>}
                </span>
              </div>

              {/* Customer data */}
              <div className="border-t border-[#3F4147] pt-3">
                <p className="text-xs text-[#E0E0E0]/40 uppercase tracking-wider font-medium mb-2">
                  Dane klienta
                </p>
                <div className="space-y-2">
                  <div className="flex justify-between gap-3">
                    <span className="text-[#E0E0E0]/50">Imię</span>
                    <span className="text-[#E0E0E0] break-words text-right min-w-0">
                      {order.customer_name}
                    </span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-[#E0E0E0]/50">Email</span>
                    <a
                      href={`mailto:${order.customer_email}`}
                      className="text-[#3B82F6] hover:underline break-all text-right min-w-0"
                    >
                      {order.customer_email}
                    </a>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-[#E0E0E0]/50">Telefon</span>
                    <span className="text-[#E0E0E0] break-words text-right min-w-0">
                      {order.customer_phone}
                    </span>
                  </div>
                  {/* Invoice address */}
                  {(order.customer_address_street || order.customer_address_city) && (
                    <div className="mt-2 bg-[#2B2D31] rounded-lg p-3 border border-[#3F4147]/50">
                      <p className="text-xs text-[#E0E0E0]/40 mb-1">Adres faktury</p>
                      <p className="text-sm text-[#E0E0E0]">{order.customer_address_street}</p>
                      <p className="text-sm text-[#E0E0E0]">
                        {order.customer_address_postcode} {order.customer_address_city}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Pickup point */}
              <div className="border-t border-[#3F4147] pt-3">
                <p className="text-xs text-[#E0E0E0]/40 uppercase tracking-wider font-medium mb-2">
                  Punkt odbioru
                </p>
                <p className="text-[#E0E0E0] font-medium">
                  {order.pickup_point}
                </p>
                <p className="text-[#E0E0E0]/50 text-xs">
                  {order.pickup_point_address}
                </p>
              </div>

              {/* Personalizacja — kod AI do wgrania + imie na etykiete, PRZED wyslka.
                  To podstawa wylaczenia prawa odstapienia (art. 38 pkt 3),
                  wiec musi byc realnie wykonana na tej konkretnej sztuce. */}
              {orderUnits(order).length > 0 && (
                <div className="border-t border-[#3F4147] pt-3">
                  <p className="text-xs text-amber-400 uppercase tracking-wider font-medium mb-2">
                    ⚠ Personalizacja — zrób przed wysyłką
                    {orderUnits(order).length > 1 && ` (${orderUnits(order).length} szt. — każda ma własny kod)`}
                  </p>
                  {orderUnits(order).length === 1 ? (
                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 space-y-1">
                      <p className="text-[#E0E0E0]">
                        Kod odblokowania AI: <span className="font-mono font-bold">{orderUnits(order)[0].code || "—"}</span>
                      </p>
                      <p className="text-[#E0E0E0]">
                        Imię na etykietę: <span className="font-bold">{orderUnits(order)[0].name || "—"}</span>
                      </p>
                    </div>
                  ) : (
                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-xs text-[#E0E0E0]/50 border-b border-amber-500/30">
                            <th className="px-3 py-2 font-medium">Sztuka</th>
                            <th className="px-3 py-2 font-medium">Kod AI</th>
                            <th className="px-3 py-2 font-medium">Imię na etykietę</th>
                          </tr>
                        </thead>
                        <tbody>
                          {orderUnits(order).map((u, i) => (
                            <tr key={i} className="border-b border-amber-500/10 last:border-0">
                              <td className="px-3 py-1.5 text-[#E0E0E0]/60 whitespace-nowrap">Sztuka {i + 1}</td>
                              <td className="px-3 py-1.5 font-mono font-bold text-[#E0E0E0]">{u.code || "—"}</td>
                              <td className="px-3 py-1.5 font-bold text-[#E0E0E0] break-words">{u.name || "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Furgonetka info if exists */}
              {furgonetkaPackageId && (
                <div className="border-t border-[#3F4147] pt-3">
                  <p className="text-xs text-[#E0E0E0]/40 uppercase tracking-wider font-medium mb-2">
                    Furgonetka
                  </p>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between gap-3">
                      <span className="text-[#E0E0E0]/50">ID Przesyłki</span>
                      <span className="text-green-400 font-mono break-all text-right min-w-0">{furgonetkaPackageId}</span>
                    </div>
                    {furgonetkaStatus && (
                      <div className="flex justify-between gap-3">
                        <span className="text-[#E0E0E0]/50">Status</span>
                        <span className={`font-medium ${furgonetkaStatus === "done" || furgonetkaStatus === "completed" ? "text-green-400" : "text-amber-400"}`}>
                          {furgonetkaStatus}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {order.payment_provider === "p24" ? (
              <p className="text-center text-xs text-[#E0E0E0]/40 mt-4">
                Płatność Przelewy24 (BLIK) — sprawdź w panelu p24.online, sesja: {order.p24_session_id || "—"}
              </p>
            ) : order.stripe_payment_intent_id ? (
              <a
                href={`https://dashboard.stripe.com/payments/${order.stripe_payment_intent_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-center text-xs text-[#3B82F6] hover:underline mt-4"
              >
                Otwórz w Stripe Dashboard &rarr;
              </a>
            ) : null}
          </div>

          {/* Right column: Fulfillment + Furgonetka */}
          <div className="space-y-6">
            {/* Fulfillment management */}
            <div className="bg-[#313338] rounded-lg border border-[#3F4147] p-4 sm:p-6 space-y-4">
              <h2 className="text-lg font-bold text-[#E0E0E0]">Realizacja</h2>

              <div>
                <label className="block text-sm text-[#E0E0E0]/70 mb-1">
                  Status realizacji
                </label>
                <select
                  value={fulfillment}
                  onChange={(e) => setFulfillment(e.target.value)}
                  className={inputClass}
                >
                  <option value="unfulfilled">Niezrealizowane</option>
                  <option value="in_progress">W realizacji</option>
                  <option value="shipped">Wysłane</option>
                  <option value="fulfilled">Zrealizowane</option>
                  <option value="cancelled">Anulowane</option>
                </select>
              </div>

              <div>
                <label className="block text-sm text-[#E0E0E0]/70 mb-1">
                  Numer przesyłki
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={tracking}
                    onChange={(e) => setTracking(e.target.value)}
                    className={inputClass}
                    placeholder="np. 620012345678901234"
                  />
                  <button
                    type="button"
                    onClick={handleTrackingSync}
                    disabled={trackingSyncing || !order.tracking_number}
                    title={order.tracking_number ? "Sprawdź status u przewoźnika (InPost albo Base Courier) i zaktualizuj status zamówienia" : "Najpierw zapisz numer przesyłki"}
                    className="shrink-0 px-3 py-2 rounded-lg text-xs font-medium border border-amber-500/40 text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {trackingSyncing ? "Sprawdzam…" : "Sprawdź status przesyłki"}
                  </button>
                </div>
                <p className="mt-1 text-[11px] text-[#E0E0E0]/40">
                  Numery InPost są sprawdzane automatycznie co godzinę (status „Wysłane" po odbiorze przez kuriera, „Zrealizowane" gdy paczka jest w Paczkomacie) — tak samo przesyłki zagraniczne (DPD, GLS, UPS) nadane przez Base Courier.
                </p>
                {trackingMsg && (
                  <p className="mt-1 text-xs text-amber-300">{trackingMsg}</p>
                )}
                {trackingInfo && (
                  <div className="mt-2 rounded-lg border border-[#3F4147] bg-[#2B2D31] p-3 text-xs">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono text-[#E0E0E0]">
                        {trackingCourier === "basecourier" ? (
                          <>{trackingInfo.courierName || "Base Courier"}</>
                        ) : (
                          <>
                            InPost: <span className="text-amber-300">{trackingInfo.status}</span>
                            {trackingInfo.targetMachineId && (
                              <span className="text-[#E0E0E0]/50"> · {trackingInfo.targetMachineId}</span>
                            )}
                          </>
                        )}
                      </span>
                      {trackingInfo.updatedAt && (
                        <span className="text-[#E0E0E0]/40">
                          {fmtDateTime(trackingInfo.updatedAt)}
                        </span>
                      )}
                    </div>
                    <ul className="space-y-0.5 max-h-40 overflow-y-auto">
                      {trackingInfo.events.map((ev, i) => {
                        // Base Courier zwraca "YYYY-MM-DD HH:MM:SS" (spacja, nie
                        // "T") — Date.parse tego formalnie nie gwarantuje, wiec
                        // normalizujemy do ISO przed sparsowaniem.
                        const raw = ev.datetime || ev.eventTime;
                        const when = raw && raw.includes(" ") && !raw.includes("T") ? raw.replace(" ", "T") : raw;
                        return (
                          <li key={i} className="flex gap-3 text-[#E0E0E0]/70">
                            <span className="text-[#E0E0E0]/40 shrink-0 font-mono">
                              {when ? new Date(when).toLocaleString("pl-PL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—"}
                            </span>
                            <span>{ev.statusDesc || ev.status}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </div>

              <div className="rounded-lg border border-[#3F4147] bg-[#2B2D31] p-3 text-xs space-y-1">
                <p className="text-[#E0E0E0]/50 uppercase tracking-wide text-[10px]">Skąd przyszedł klient</p>
                {order.attribution ? (
                  <>
                    <p className="text-[#E0E0E0]/90">
                      <span className="text-[#E0E0E0]/50">Przed zakupem: </span>{describeTouch(order.attribution.last)}
                    </p>
                    {describeTouch(order.attribution.first) !== describeTouch(order.attribution.last) && (
                      <p className="text-[#E0E0E0]/70">
                        <span className="text-[#E0E0E0]/50">Pierwsze wejście: </span>{describeTouch(order.attribution.first)}
                      </p>
                    )}
                    <p className="text-[#E0E0E0]/35">
                      {order.attribution.method === "browser" ? "Dane z przeglądarki (zgoda na cookies)" : "Dopasowane po adresie IP — przybliżone"}
                    </p>
                  </>
                ) : (
                  <p className="text-[#E0E0E0]/40">Brak danych (zamówienie sprzed śledzenia źródeł albo brak wizyty z tego IP).</p>
                )}
              </div>

              <div>
                <label className="block text-sm text-[#E0E0E0]/70 mb-1">
                  Notatki
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className={inputClass + " resize-none"}
                  placeholder="Notatki wewnętrzne..."
                />
                {serverNotes !== null && (
                  <div className="mt-1 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300 space-y-1">
                    <p>⚠ Notatki zmieniły się na serwerze, gdy je edytowałeś — zapis nadpisze tę zmianę:</p>
                    <pre className="whitespace-pre-wrap break-words font-sans text-[#E0E0E0]/70 max-h-32 overflow-y-auto">{serverNotes || "(puste)"}</pre>
                    <button
                      type="button"
                      onClick={() => {
                        setNotes(serverNotes);
                        if (loadedRef.current) loadedRef.current = { ...loadedRef.current, notes: serverNotes };
                        setServerNotes(null);
                      }}
                      className="text-[#3B82F6] hover:underline"
                    >
                      Wczytaj wersję z serwera (porzuć moje zmiany)
                    </button>
                  </div>
                )}
              </div>

              {order.shipped_at && (
                <p className="text-xs text-[#E0E0E0]/40">
                  Wysłano: {fmtDateTime(order.shipped_at)}
                </p>
              )}

              <div className="flex items-center gap-3">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className={`px-6 py-2 font-medium rounded-lg text-white text-sm transition-colors ${
                    saving
                      ? "bg-[#3B82F6]/60 cursor-not-allowed"
                      : "bg-[#3B82F6] hover:bg-[#2563EB]"
                  }`}
                >
                  {saving ? "Zapisywanie..." : "Zapisz"}
                </button>
                {saveMsg && (
                  <span
                    className={`text-sm ${
                      saveMsg === "Zapisano" ? "text-green-400" : saveMsg.startsWith("Brak zmian") ? "text-[#E0E0E0]/50" : "text-red-400"
                    }`}
                  >
                    {saveMsg}
                  </span>
                )}
              </div>
            </div>

            {/* Base Courier — nadanie InPost Paczkomat przez API (basecourier.com) */}
            <div className="bg-[#313338] rounded-lg border border-[#3F4147] p-4 sm:p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-400 to-amber-600 flex items-center justify-center flex-shrink-0">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                    <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
                    <line x1="12" y1="22.08" x2="12" y2="12"/>
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-[#E0E0E0]">Base Courier — nadaj przesyłkę</h2>
                  <p className="text-xs text-[#E0E0E0]/50">InPost Paczkomat / kurier zagraniczny przez API basecourier.com · {bcPreview?.parcel
                    ? `${(bcPreview.quantity ?? 1) > 1 ? `${bcPreview.quantity} szt. w jednej paczce · ` : ""}${bcPreview.parcel.side_x}×${bcPreview.parcel.side_y}×${bcPreview.parcel.side_z} cm, ${bcPreview.parcel.weight} kg`
                    : `pudełko 18×12×4 cm, 1 kg${(order?.quantity ?? 1) > 1 ? ` × ${order?.quantity} szt.` : ""}`} · nadanie samodzielne lub z podjazdem kuriera</p>
                </div>
              </div>

              {uncertainNote && furgonetkaStatus !== "basecourier" && (
                <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-xs text-red-300 space-y-1">
                  <p className="font-semibold">⚠ Niepewne nadanie — paczka mogła zostać utworzona i opłacona</p>
                  <p className="break-words">{uncertainNote}</p>
                  <p className="text-red-300/70">Sprawdź panel Base Courier. Jeśli zlecenie istnieje — powiąż je niżej („Powiąż zlecenie”), zamiast nadawać ponownie.</p>
                </div>
              )}
              {order.fulfillment_status === "cancelled" && furgonetkaStatus !== "basecourier" && (
                <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs text-amber-300">
                  Zamówienie anulowane (pieniądze zwrócone) — nie nadawaj przesyłki.
                </p>
              )}
              {furgonetkaStatus === "basecourier" ? (
                <div className="bg-green-500/10 border border-green-500/30 rounded-lg px-4 py-3 space-y-2">
                  <p className="text-sm text-green-400 font-medium">✓ Przesyłka nadana przez Base Courier</p>
                  {furgonetkaPackageId && (
                    <p className="text-xs text-green-400/70 font-mono">ID zlecenia: {furgonetkaPackageId}</p>
                  )}
                  {tracking && <p className="text-xs text-green-400/70 font-mono">Numer: {tracking}</p>}
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    {canPrintLabel && (
                      <button
                        type="button"
                        onClick={handlePrintLabel}
                        disabled={printing}
                        title="Drukuje od razu na drukarce etykiet (pionowo, 1 kopia, mono) — bez okna wyboru"
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold text-[#1a1a1a] bg-gradient-to-r from-yellow-400 to-amber-500 hover:from-yellow-300 hover:to-amber-400 shadow-lg shadow-amber-500/20 transition-all disabled:opacity-50"
                      >
                        🖨 {printing ? "Drukuję…" : "Drukuj etykietę"}
                      </button>
                    )}
                    <a
                      href={`/api/admin/orders/${id}/basecourier/label`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium bg-green-500/20 hover:bg-green-500/30 text-green-300 transition-colors"
                    >
                      Pobierz etykietę PDF
                    </a>
                  </div>
                  {printMsg && (
                    <p className={`text-xs ${printMsg.startsWith("Wysłano") ? "text-green-400" : "text-red-400"}`}>{printMsg}</p>
                  )}
                </div>
              ) : bcPreview?.international ? (
                <>
                  <div className="rounded-lg border border-[#3F4147] bg-[#2B2D31] p-3 text-xs text-[#E0E0E0]/80 space-y-2">
                    {receiverEditor}
                    <p><span className="text-[#E0E0E0]/50">Kraj:</span> <span className="font-mono text-amber-300">{bcPreview.country}</span> — poza Polską, bez Paczkomatów</p>
                    {bcPreview.quotes && bcPreview.quotes.length > 0 ? (
                      <div className="space-y-1 pt-1">
                        <p className="text-[#E0E0E0]/50">Wybierz kuriera (ceny brutto):</p>
                        {bcPreview.quotes.map((q) => (
                          <label
                            key={q.courierCode}
                            className={`flex items-center justify-between rounded px-2 py-1.5 cursor-pointer border transition-colors ${
                              selectedCourier === q.courierCode
                                ? "bg-amber-500/10 border-amber-500/50"
                                : "bg-[#1E1F22] border-transparent hover:border-[#3F4147]"
                            }`}
                          >
                            <span className="flex items-center gap-2">
                              <input
                                type="radio"
                                name="intl-courier"
                                checked={selectedCourier === q.courierCode}
                                onChange={() => setSelectedCourier(q.courierCode)}
                              />
                              {q.courierName}
                            </span>
                            <span className="font-mono text-[#E0E0E0]">{q.price.value} zł <span className="text-[#E0E0E0]/40">({q.price.netto} netto)</span></span>
                          </label>
                        ))}
                      </div>
                    ) : (
                      <p className="text-red-400">Żaden kurier Base Courier nie zwrócił ceny dla tej paczki ({bcPreview.parcel ? `${bcPreview.parcel.weight}kg, ${bcPreview.parcel.side_x}×${bcPreview.parcel.side_y}×${bcPreview.parcel.side_z}cm` : "1kg, 18×12×4cm"}) do tego kraju.</p>
                    )}
                  </div>
                  {pickupSection}
                  {customsSection}
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={handleBcPreview}
                      disabled={bcLoading}
                      className="px-4 py-2 rounded-lg bg-[#3F4147] hover:bg-[#4a4d55] text-[#E0E0E0] text-xs font-medium transition-colors disabled:opacity-50"
                    >
                      {bcLoading ? "Wyceniam…" : "Odśwież wycenę"}
                    </button>
                    <button
                      onClick={handleBcCreateIntl}
                      disabled={bcLoading || !selectedCourier || !!pickupError || !!recvError}
                      title={!selectedCourier ? "Najpierw wybierz kuriera" : recvError || pickupError}
                      className="px-5 py-2 rounded-lg font-medium text-sm text-[#1a1a1a] bg-gradient-to-r from-yellow-400 to-amber-500 hover:from-yellow-300 hover:to-amber-400 shadow-lg shadow-amber-500/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {bcLoading ? "Nadaję…" : "Nadaj przesyłkę (płatne)"}
                    </button>
                  </div>
                  <p className="text-[11px] text-[#E0E0E0]/40">
                    Adres drzwi-drzwi z zamówienia (bez Paczkomatu). Koszt pobierany ze Skarbonki na koncie Base Courier.
                  </p>
                </>
              ) : (
                <>
                  {bcPreview && (
                    <div className="rounded-lg border border-[#3F4147] bg-[#2B2D31] p-3 text-xs text-[#E0E0E0]/80 space-y-2">
                      {receiverEditor}
                      <p><span className="text-[#E0E0E0]/50">Paczkomat:</span> <span className="font-mono text-amber-300">{bcPreview.receiver.lockerCode || "— BRAK —"}</span></p>
                      <p>
                        <span className="text-[#E0E0E0]/50">Koszt nadania:</span>{" "}
                        {bcPreview.valuation?.price
                          ? <span className="text-[#E0E0E0]">{bcPreview.valuation.price.value} zł brutto ({bcPreview.valuation.price.netto} netto)</span>
                          : "brak wyceny"}
                      </p>
                    </div>
                  )}
                  {pickupSection}
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={handleBcPreview}
                      disabled={bcLoading}
                      className="px-4 py-2 rounded-lg bg-[#3F4147] hover:bg-[#4a4d55] text-[#E0E0E0] text-xs font-medium transition-colors disabled:opacity-50"
                    >
                      {bcLoading && !bcPreview ? "Wyceniam…" : "Sprawdź dane i wycenę"}
                    </button>
                    <button
                      onClick={handleBcCreate}
                      disabled={bcLoading || !bcPreview || !bcPreview.receiver.lockerCode || !!pickupError || !!recvError}
                      title={!bcPreview ? "Najpierw sprawdź dane i wycenę" : recvError || pickupError}
                      className="px-5 py-2 rounded-lg font-medium text-sm text-[#1a1a1a] bg-gradient-to-r from-yellow-400 to-amber-500 hover:from-yellow-300 hover:to-amber-400 shadow-lg shadow-amber-500/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {bcLoading && bcPreview ? "Nadaję…" : "Nadaj przesyłkę (płatne)"}
                    </button>
                  </div>
                  <p className="text-[11px] text-[#E0E0E0]/40">
                    Koszt pobierany ze Skarbonki na koncie Base Courier — pilnuj salda. Po nadaniu numer przesyłki zapisuje się w zamówieniu i status aktualizuje się automatycznie ze śledzenia InPost.
                  </p>
                </>
              )}
              {furgonetkaStatus !== "basecourier" && (
                <details className="rounded-lg border border-[#3F4147] bg-[#2B2D31] p-3 text-xs text-[#E0E0E0]/80">
                  <summary className="cursor-pointer text-[#E0E0E0]/70">Nadałeś paczkę ręcznie w panelu Base Courier? Powiąż ją z tym zamówieniem</summary>
                  <div className="mt-3 space-y-2">
                    <p className="text-[#E0E0E0]/50">
                      Podaj „Numer zamówienia” z panelu Base Courier (ten widoczny na górze strony zamówienia, np. 23729913). Potem działają tu: etykieta, śledzenie i automatyczne statusy (bez ponownego nadawania i bez kosztów).
                    </p>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={linkId}
                        onChange={(e) => setLinkId(e.target.value.replace(/\D/g, ""))}
                        placeholder="np. 23729913"
                        className={`${smallInput} sm:w-48 text-base sm:text-xs`}
                      />
                      <button
                        type="button"
                        onClick={handleLinkBc}
                        disabled={linking || linkId.length < 4}
                        className="px-4 py-2 rounded-lg bg-[#3F4147] hover:bg-[#4a4d55] text-[#E0E0E0] text-xs font-medium transition-colors disabled:opacity-50"
                      >
                        {linking ? "Łączę…" : "Powiąż zlecenie"}
                      </button>
                    </div>
                    {linkMsg && <p className="text-red-400">{linkMsg}</p>}
                  </div>
                </details>
              )}
              {bcMsg && (
                <p className={`text-xs ${bcMsg.startsWith("Nadano") ? "text-green-400" : "text-red-400"}`}>{bcMsg}</p>
              )}
            </div>

            {/* Eksport CSV — alternatywa dla API Furgonetka powyzej, do recznego wgrania */}
            <div className="bg-[#313338] rounded-lg border border-[#3F4147] p-4 sm:p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-teal-700 flex items-center justify-center flex-shrink-0">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="12" y1="18" x2="12" y2="12"/>
                    <line x1="9" y1="15" x2="15" y2="15"/>
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-[#E0E0E0]">Eksport CSV (kurier)</h2>
                  <p className="text-xs text-[#E0E0E0]/50">Do ręcznego wgrania przez "Importuj zamówienia z pliku CSV"</p>
                </div>
              </div>

              <div className="bg-green-500/10 border border-green-500/30 rounded-lg px-4 py-3">
                <p className="text-xs text-green-400 leading-relaxed">
                  ✓ Wszystkie pola (rodzaj przesyłki, opakowanie, sposób nadania/doręczenia, waga,
                  wymiary, dane nadawcy) zweryfikowane z formularzem importu.
                </p>
              </div>

              {needsStateCode(order.customer_country || "PL") && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-3">
                  <p className="text-xs text-amber-300 leading-relaxed">
                    Szablon CSV nie ma kolumny na stan/prowincję — po imporcie wybierz w formularzu Furgonetki pole
                    „Stan/Prowincja”:{" "}
                    <strong>
                      {bcRecv?.state ||
                        splitCityState(order.customer_address_city, order.customer_country || "").state ||
                        "(nie wykryto w adresie — sprawdź kod stanu odbiorcy)"}
                    </strong>
                    . Miasto, ulica, numer budynku i mieszkania są rozdzielone automatycznie.
                  </p>
                </div>
              )}

              <button
                onClick={handleExportFurgonetkaCsv}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium text-sm text-white bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 shadow-lg shadow-teal-500/20 transition-all"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Pobierz CSV
              </button>
            </div>

            {/* Paragon fiskalny — lib/fiscal.ts + fiscal-agent/ */}
            <OrderFiscalCard orderId={order.id} paid={order.status === "succeeded"} />

            {/* Invoice section */}
            <div className="bg-[#313338] rounded-lg border border-[#3F4147] p-4 sm:p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center flex-shrink-0">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="16" y1="13" x2="8" y2="13"/>
                    <line x1="16" y1="17" x2="8" y2="17"/>
                    <polyline points="10 9 9 9 8 9"/>
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-[#E0E0E0]">Faktura</h2>
                  <p className="text-xs text-[#E0E0E0]/50">Wyślij PDF faktury na email klienta</p>
                </div>
              </div>

              {order.invoice_sent_at && (
                <div className="bg-green-500/10 border border-green-500/30 rounded-lg px-4 py-3">
                  <p className="text-sm text-green-400">
                    ✓ Wysłano: {fmtDateTime(order.invoice_sent_at)}
                    {order.invoice_filename && (
                      <span className="block text-xs text-green-400/70 font-mono mt-0.5">{order.invoice_filename}</span>
                    )}
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm text-[#E0E0E0]/70 mb-2">Plik faktury (PDF)</label>
                <label className="flex items-center gap-3 w-full px-4 py-3 rounded-lg border border-dashed border-[#3F4147] bg-[#2B2D31] hover:border-purple-500/50 hover:bg-purple-500/5 cursor-pointer transition-colors">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[#E0E0E0]/40 shrink-0">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="17 8 12 3 7 8"/>
                    <line x1="12" y1="3" x2="12" y2="15"/>
                  </svg>
                  <span className="text-sm text-[#E0E0E0]/60 truncate">
                    {invoiceFile ? invoiceFile.name : "Kliknij aby wybrać plik PDF…"}
                  </span>
                  <input
                    type="file"
                    accept=".pdf,application/pdf"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0] || null;
                      setInvoiceFile(f);
                      setInvoiceMsg("");
                    }}
                  />
                </label>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={handleSendInvoice}
                  disabled={!invoiceFile || invoiceSending}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium text-sm text-white transition-all ${
                    !invoiceFile || invoiceSending
                      ? "bg-purple-500/30 cursor-not-allowed"
                      : "bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 shadow-lg shadow-purple-500/20"
                  }`}
                >
                  {invoiceSending ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Wysyłanie…
                    </>
                  ) : (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="22" y1="2" x2="11" y2="13"/>
                        <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                      </svg>
                      Wyślij fakturę
                    </>
                  )}
                </button>
                {invoiceMsg && (
                  <span className={`text-sm ${invoiceMsg.startsWith("✓") ? "text-green-400" : "text-red-400"}`}>
                    {invoiceMsg}
                  </span>
                )}
              </div>

              <p className="text-xs text-[#E0E0E0]/30">
                Email zostanie wysłany na: <span className="text-[#E0E0E0]/60">{order.customer_email}</span>
              </p>
            </div>

            {/* Compose email — jak w /admin/mailbox, ale wysylane z inicjatywy
                admina (nie odpowiedz), przez to samo konto kontakt@kalkmate.pl. */}
            <div className="bg-[#313338] rounded-lg border border-[#3F4147] p-4 sm:p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center flex-shrink-0">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 4h16v16H4z" opacity="0"/>
                    <path d="M22 6l-10 7L2 6"/>
                    <rect x="2" y="4" width="20" height="16" rx="2"/>
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-[#E0E0E0]">Napisz maila do klienta</h2>
                  <p className="text-xs text-[#E0E0E0]/50">Wysyłane z kontakt@kalkmate.pl, tak jak w Poczcie</p>
                </div>
              </div>

              <div>
                <label className="block text-sm text-[#E0E0E0]/70 mb-2">Temat</label>
                <input
                  type="text"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg bg-[#2B2D31] border border-[#3F4147] text-base sm:text-sm text-[#E0E0E0] focus:outline-none focus:border-blue-500/50"
                />
              </div>

              <div className="flex flex-col sm:flex-row sm:items-end gap-2">
                <div className="flex-1 min-w-0">
                  <label className="block text-sm text-[#E0E0E0]/70 mb-2">Instrukcja dla AI (opcjonalnie)</label>
                  <input
                    type="text"
                    value={emailInstruction}
                    onChange={(e) => setEmailInstruction(e.target.value)}
                    placeholder="np. poinformuj o opóźnieniu wysyłki…"
                    className="w-full px-4 py-2.5 rounded-lg bg-[#2B2D31] border border-[#3F4147] text-base sm:text-sm text-[#E0E0E0] placeholder:text-[#E0E0E0]/30 focus:outline-none focus:border-blue-500/50"
                  />
                </div>
                <button
                  onClick={handleGenerateEmail}
                  disabled={emailGenerating}
                  className="px-4 py-3 sm:py-2.5 rounded-lg font-medium text-sm text-white bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap shadow-lg shadow-indigo-500/20"
                >
                  {emailGenerating ? "Generuję…" : "✨ Wygeneruj AI"}
                </button>
              </div>
              {emailGenError && <p className="text-sm text-red-400">{emailGenError}</p>}

              <div>
                <label className="block text-sm text-[#E0E0E0]/70 mb-2">Treść</label>
                <textarea
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  // W trakcie generowania AI — zeby wynik nie nadpisal tego, co dopisujesz.
                  readOnly={emailGenerating}
                  rows={8}
                  placeholder="Treść wiadomości…"
                  className="w-full px-4 py-3 rounded-lg bg-[#2B2D31] border border-[#3F4147] text-base sm:text-sm text-[#E0E0E0] placeholder:text-[#E0E0E0]/30 focus:outline-none focus:border-blue-500/50 resize-y min-h-[200px]"
                />
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={handleSendEmail}
                  disabled={!emailSubject.trim() || !emailBody.trim() || emailSending}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium text-sm text-white transition-all ${
                    !emailSubject.trim() || !emailBody.trim() || emailSending
                      ? "bg-blue-500/30 cursor-not-allowed"
                      : "bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow-lg shadow-blue-500/20"
                  }`}
                >
                  {emailSending ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Wysyłanie…
                    </>
                  ) : (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="22" y1="2" x2="11" y2="13"/>
                        <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                      </svg>
                      Wyślij
                    </>
                  )}
                </button>
                {emailMsg && (
                  <span className={`text-sm ${emailMsg.startsWith("✓") ? "text-green-400" : "text-red-400"}`}>
                    {emailMsg}
                  </span>
                )}
              </div>

              <p className="text-xs text-[#E0E0E0]/30">
                Odbiorca: <span className="text-[#E0E0E0]/60">{order.customer_email}</span>
              </p>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => navigator.clipboard?.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); })}
      className="px-2.5 py-1 rounded-md text-xs bg-[#2B2D31] border border-[#3F4147] text-[#E0E0E0]/70 hover:bg-[#3F4147]"
      title="Kopiuj numer zamówienia"
    >
      {copied ? "Skopiowano ✓" : "Kopiuj"}
    </button>
  );
}
