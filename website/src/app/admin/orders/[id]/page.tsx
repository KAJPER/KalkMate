"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import AdminShell from "@/components/admin/AdminShell";
import OrderStatusBadge from "@/components/admin/OrderStatusBadge";

interface OrderDetail {
  id: string;
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
  personalized_code: string | null;
  personalized_name: string | null;
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

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/admin/orders/${id}`);
        if (res.ok) {
          const data = await res.json();
          setOrder(data.order);
          setFulfillment(data.order.fulfillment_status);
          setTracking(data.order.tracking_number);
          setNotes(data.order.admin_notes);
          setFurgonetkaPackageId(data.order.furgonetka_package_id || "");
          setFurgonetkaStatus(data.order.furgonetka_status || "");
        }
      } catch (error) {
        console.error("Failed to load order:", error);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  // Sledzenie InPost (automat + przycisk "Sprawdz status InPost")
  const [trackingSyncing, setTrackingSyncing] = useState(false);
  const [trackingInfo, setTrackingInfo] = useState<{
    status: string;
    targetMachineId: string | null;
    updatedAt: string | null;
    events: { status: string; datetime: string }[];
  } | null>(null);
  const [trackingMsg, setTrackingMsg] = useState("");

  const applyTrackingSync = (sync: { changed?: boolean; newStatus?: string; emailSent?: boolean; note?: string } | null) => {
    if (!sync) return;
    if (sync.changed && sync.newStatus) {
      setFulfillment(sync.newStatus);
      setTrackingMsg(`Status zamówienia zmieniony na „${sync.newStatus}"${sync.emailSent ? " — mail do klienta wysłany" : ""}`);
    } else if (sync.note === "inpost_unavailable") {
      setTrackingMsg("InPost nie odpowiada / numer nieznany");
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
    receiver: { name: string; email: string; phone: string; lockerCode: string; street?: string; postal?: string; city?: string };
    // Krajowe (Paczkomat) — jedna cena.
    valuation?: { price: { value: string; netto: string; vat: string } | null };
    // Zagraniczne (DE, US, ...) — kilku kurierow prubowanych na raz, tylko
    // szacunek; nadanie z panelu zostaje ograniczone do Polski.
    quotes?: { courierCode: string; courierName: string; price: { value: string; netto: string; vat: string } }[];
  } | null>(null);

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
      });
    } catch {
      setBcMsg("Błąd sieci");
    } finally {
      setBcLoading(false);
    }
  };

  const handleBcCreate = async () => {
    const price = bcPreview?.valuation?.price?.value;
    if (
      !confirm(
        `Nadać przesyłkę InPost Paczkomat przez Base Courier?\n\n` +
          `Odbiorca: ${bcPreview?.receiver.name || order?.customer_name}\n` +
          `Paczkomat: ${bcPreview?.receiver.lockerCode || order?.pickup_point}\n` +
          `Koszt: ${price ? price + " zł brutto" : "wg cennika"} — pobierany z Twojego konta Base Courier.\n\n` +
          `Tej operacji nie da się cofnąć z panelu.`
      )
    )
      return;
    setBcLoading(true);
    setBcMsg("");
    try {
      const res = await fetch(`/api/admin/orders/${id}/basecourier`, { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setBcMsg(data.error || "Błąd nadania");
        return;
      }
      setFurgonetkaStatus("basecourier");
      if (data.basecourierOrderId) setFurgonetkaPackageId(String(data.basecourierOrderId));
      if (data.trackingNumber) setTracking(data.trackingNumber);
      applyTrackingSync(data.trackingSync);
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
    setSaving(true);
    setSaveMsg("");

    try {
      const res = await fetch(`/api/admin/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fulfillment_status: fulfillment,
          tracking_number: tracking,
          notes,
        }),
      });

      if (res.ok) {
        setSaveMsg("Zapisano");
        setTimeout(() => setSaveMsg(""), 3000);
        // Nowy numer InPost -> serwer od razu sprawdzil status
        const data = await res.json().catch(() => null);
        if (data?.trackingSync) applyTrackingSync(data.trackingSync);
      } else {
        setSaveMsg("Błąd zapisu");
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

  // Rozdziela "Marszalkowska 1/2" -> { street: "Marszalkowska", number: "1/2" }.
  // Furgonetka chce numer budynku w osobnej kolumnie, a u nas to jedno pole.
  function splitStreetAndNumber(full: string): { street: string; number: string } {
    const trimmed = (full || "").trim();
    const m = trimmed.match(/^(.*?)[\s,]+(\d+[a-zA-Z]?(?:\/\d+[a-zA-Z]?)?)$/);
    if (m) return { street: m[1].trim(), number: m[2].trim() };
    return { street: trimmed, number: "" };
  }

  // CSV-escapuje pole: cudzyslowia jesli zawiera srednik/cudzyslow/nowa linie.
  function csvField(v: string): string {
    const s = v ?? "";
    if (/[;"\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  }

  const handleExportFurgonetkaCsv = () => {
    if (!order) return;
    const { street: recvStreet, number: recvNumber } = splitStreetAndNumber(order.customer_address_street);
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
      order.customer_name,                                         // imie i nazwisko odbiorcy *
      "",                                                          // nazwa firmy odbiorcy
      recvStreet,                                                  // ulica odbiorcy *
      recvNumber,                                                  // numer budynku odbiorcy *
      "",                                                          // numer mieszkania odbiorcy
      order.customer_country || "PL",                              // kraj odbiorcy *
      order.customer_address_postcode,                             // kod pocztowy odbiorcy *
      order.customer_address_city,                                 // miasto odbiorcy *
      order.customer_email,                                        // adres e-mail odbiorcy *
      order.customer_phone,                                        // numer telefonu odbiorcy *
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

  const formatDate = (ts: number) =>
    new Date(ts * 1000).toLocaleString("pl-PL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

  const formatAmount = (amount: number, currency: string) => {
    const value = (amount / 100).toFixed(2);
    const symbol = currency?.toLowerCase() === "eur" ? "€" : "zł";
    return `${value} ${symbol}`;
  };

  const inputClass =
    "w-full px-3 py-2 rounded-lg border border-[#3F4147] bg-[#2B2D31] text-[#E0E0E0] text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6]";

  return (
    <AdminShell>
      <div className="mb-6">
        <Link
          href="/admin/orders"
          className="text-sm text-[#3B82F6] hover:underline"
        >
          &larr; Zamówienia
        </Link>
      </div>

      {loading ? (
        <div className="text-[#E0E0E0]/50 text-sm">Ładowanie...</div>
      ) : !order ? (
        <div className="text-red-400 text-sm">Nie znaleziono zamówienia.</div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Order info */}
          <div className="bg-[#313338] rounded-lg border border-[#3F4147] p-6 space-y-4">
            <h2 className="text-lg font-bold text-[#E0E0E0]">
              Szczegóły zamówienia
            </h2>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-[#E0E0E0]/50">ID</span>
                <span className="text-[#E0E0E0] font-mono text-xs">
                  {order.id}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#E0E0E0]/50">Data</span>
                <span className="text-[#E0E0E0]">
                  {formatDate(order.created)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#E0E0E0]/50">Kwota</span>
                <span className="text-[#E0E0E0] font-bold">
                  {formatAmount(order.amount, order.currency)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#E0E0E0]/50">Status płatności</span>
                <OrderStatusBadge status={order.status} type="payment" />
              </div>
              <div className="flex justify-between">
                <span className="text-[#E0E0E0]/50">Produkt</span>
                <span className="text-[#E0E0E0]">{order.product}</span>
              </div>

              {/* Customer data */}
              <div className="border-t border-[#3F4147] pt-3">
                <p className="text-xs text-[#E0E0E0]/40 uppercase tracking-wider font-medium mb-2">
                  Dane klienta
                </p>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-[#E0E0E0]/50">Imię</span>
                    <span className="text-[#E0E0E0]">
                      {order.customer_name}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#E0E0E0]/50">Email</span>
                    <a
                      href={`mailto:${order.customer_email}`}
                      className="text-[#3B82F6] hover:underline"
                    >
                      {order.customer_email}
                    </a>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#E0E0E0]/50">Telefon</span>
                    <span className="text-[#E0E0E0]">
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
              {order.personalized_code && (
                <div className="border-t border-[#3F4147] pt-3">
                  <p className="text-xs text-amber-400 uppercase tracking-wider font-medium mb-2">
                    ⚠ Personalizacja — zrób przed wysyłką
                  </p>
                  <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 space-y-1">
                    <p className="text-[#E0E0E0]">
                      Kod odblokowania AI: <span className="font-mono font-bold">{order.personalized_code}</span>
                    </p>
                    <p className="text-[#E0E0E0]">
                      Imię na etykietę: <span className="font-bold">{order.personalized_name}</span>
                    </p>
                  </div>
                </div>
              )}

              {/* Furgonetka info if exists */}
              {furgonetkaPackageId && (
                <div className="border-t border-[#3F4147] pt-3">
                  <p className="text-xs text-[#E0E0E0]/40 uppercase tracking-wider font-medium mb-2">
                    Furgonetka
                  </p>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-[#E0E0E0]/50">ID Przesyłki</span>
                      <span className="text-green-400 font-mono">{furgonetkaPackageId}</span>
                    </div>
                    {furgonetkaStatus && (
                      <div className="flex justify-between">
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
                Płatność Przelewy24 (BLIK) — sprawdź w panelu p24.online, sesja: {order.id}
              </p>
            ) : (
              <a
                href={`https://dashboard.stripe.com/payments/${order.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-center text-xs text-[#3B82F6] hover:underline mt-4"
              >
                Otwórz w Stripe Dashboard &rarr;
              </a>
            )}
          </div>

          {/* Right column: Fulfillment + Furgonetka */}
          <div className="space-y-6">
            {/* Fulfillment management */}
            <div className="bg-[#313338] rounded-lg border border-[#3F4147] p-6 space-y-4">
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
                    title={order.tracking_number ? "Odpytaj InPost i zaktualizuj status zamówienia" : "Najpierw zapisz numer przesyłki"}
                    className="shrink-0 px-3 py-2 rounded-lg text-xs font-medium border border-amber-500/40 text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {trackingSyncing ? "Sprawdzam…" : "Sprawdź status InPost"}
                  </button>
                </div>
                <p className="mt-1 text-[11px] text-[#E0E0E0]/40">
                  Numery InPost są sprawdzane automatycznie co godzinę — status „Wysłane" po odbiorze przez kuriera, „Zrealizowane" gdy paczka jest w Paczkomacie.
                </p>
                {trackingMsg && (
                  <p className="mt-1 text-xs text-amber-300">{trackingMsg}</p>
                )}
                {trackingInfo && (
                  <div className="mt-2 rounded-lg border border-[#3F4147] bg-[#2B2D31] p-3 text-xs">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono text-[#E0E0E0]">
                        InPost: <span className="text-amber-300">{trackingInfo.status}</span>
                        {trackingInfo.targetMachineId && (
                          <span className="text-[#E0E0E0]/50"> · {trackingInfo.targetMachineId}</span>
                        )}
                      </span>
                      {trackingInfo.updatedAt && (
                        <span className="text-[#E0E0E0]/40">
                          {new Date(trackingInfo.updatedAt).toLocaleString("pl-PL")}
                        </span>
                      )}
                    </div>
                    <ul className="space-y-0.5 max-h-40 overflow-y-auto">
                      {trackingInfo.events.map((ev, i) => (
                        <li key={i} className="flex gap-3 text-[#E0E0E0]/70">
                          <span className="text-[#E0E0E0]/40 shrink-0 font-mono">
                            {new Date(ev.datetime).toLocaleString("pl-PL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                          </span>
                          <span>{ev.status}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
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
              </div>

              {order.shipped_at && (
                <p className="text-xs text-[#E0E0E0]/40">
                  Wysłano: {new Date(order.shipped_at).toLocaleString("pl-PL")}
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
                      saveMsg === "Zapisano" ? "text-green-400" : "text-red-400"
                    }`}
                  >
                    {saveMsg}
                  </span>
                )}
              </div>
            </div>

            {/* Base Courier — nadanie InPost Paczkomat przez API (basecourier.com) */}
            <div className="bg-[#313338] rounded-lg border border-[#3F4147] p-6 space-y-4">
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
                  <p className="text-xs text-[#E0E0E0]/50">InPost Paczkomat przez API basecourier.com · pudełko 18×12×4 cm, 1 kg · nadanie w Paczkomacie (bez kuriera)</p>
                </div>
              </div>

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
                    <p><span className="text-[#E0E0E0]/50">Odbiorca:</span> {bcPreview.receiver.name} · {bcPreview.receiver.phone} · {bcPreview.receiver.email}</p>
                    <p><span className="text-[#E0E0E0]/50">Kraj:</span> <span className="font-mono text-amber-300">{bcPreview.country}</span> — poza Polską, bez Paczkomatów</p>
                    {bcPreview.quotes && bcPreview.quotes.length > 0 ? (
                      <div className="space-y-1 pt-1">
                        <p className="text-[#E0E0E0]/50">Szacowany koszt (kilku kurierów naraz, ceny brutto):</p>
                        {bcPreview.quotes.map((q) => (
                          <div key={q.courierCode} className="flex items-center justify-between bg-[#1E1F22] rounded px-2 py-1">
                            <span>{q.courierName}</span>
                            <span className="font-mono text-[#E0E0E0]">{q.price.value} zł <span className="text-[#E0E0E0]/40">({q.price.netto} netto)</span></span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-red-400">Żaden kurier Base Courier nie zwrócił ceny dla tej paczki (1kg, 18×12×4cm) do tego kraju.</p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={handleBcPreview}
                      disabled={bcLoading}
                      className="px-4 py-2 rounded-lg bg-[#3F4147] hover:bg-[#4a4d55] text-[#E0E0E0] text-xs font-medium transition-colors disabled:opacity-50"
                    >
                      {bcLoading ? "Wyceniam…" : "Odśwież wycenę"}
                    </button>
                  </div>
                  <p className="text-[11px] text-[#E0E0E0]/40">
                    To tylko orientacyjna wycena — nadanie zagranicznej przesyłki z tego panelu nie jest obsługiwane (wymaga danych celnych/innej integracji). Nadaj ręcznie w panelu basecourier.com wybranym kurierem, potem wklej numer śledzenia w sekcji „Śledzenie" niżej.
                  </p>
                </>
              ) : (
                <>
                  {bcPreview && (
                    <div className="rounded-lg border border-[#3F4147] bg-[#2B2D31] p-3 text-xs text-[#E0E0E0]/80 space-y-1">
                      <p><span className="text-[#E0E0E0]/50">Odbiorca:</span> {bcPreview.receiver.name} · {bcPreview.receiver.phone} · {bcPreview.receiver.email}</p>
                      <p><span className="text-[#E0E0E0]/50">Paczkomat:</span> <span className="font-mono text-amber-300">{bcPreview.receiver.lockerCode || "— BRAK —"}</span></p>
                      <p>
                        <span className="text-[#E0E0E0]/50">Koszt nadania:</span>{" "}
                        {bcPreview.valuation?.price
                          ? <span className="text-[#E0E0E0]">{bcPreview.valuation.price.value} zł brutto ({bcPreview.valuation.price.netto} netto)</span>
                          : "brak wyceny"}
                      </p>
                    </div>
                  )}
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
                      disabled={bcLoading || !bcPreview || !bcPreview.receiver.lockerCode}
                      title={!bcPreview ? "Najpierw sprawdź dane i wycenę" : ""}
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
              {bcMsg && (
                <p className={`text-xs ${bcMsg.startsWith("Nadano") ? "text-green-400" : "text-red-400"}`}>{bcMsg}</p>
              )}
            </div>

            {/* Eksport CSV — alternatywa dla API Furgonetka powyzej, do recznego wgrania */}
            <div className="bg-[#313338] rounded-lg border border-[#3F4147] p-6 space-y-4">
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

            {/* Invoice section */}
            <div className="bg-[#313338] rounded-lg border border-[#3F4147] p-6 space-y-4">
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
                    ✓ Wysłano: {new Date(order.invoice_sent_at).toLocaleString("pl-PL")}
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
          </div>
        </div>
      )}
    </AdminShell>
  );
}
