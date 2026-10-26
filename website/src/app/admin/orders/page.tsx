"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import AdminShell from "@/components/admin/AdminShell";
import OrderStatusBadge from "@/components/admin/OrderStatusBadge";
import ProductLabelLink from "@/components/admin/ProductLabelLink";
import { csvCell, downloadBlob, fmtDateTime, fmtIsoLocal, formatAmount } from "@/components/admin/format";

interface Order {
  id: string;
  order_number: string;
  amount: number;
  currency: string;
  status: string;
  created: number;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  pickup_point: string;
  fulfillment_status: string;
  personalized_code: string | null;
  personalized_name: string | null;
  // Wiele sztuk w zamowieniu (nowsze API) — brak = 1 szt. / stara para pol.
  quantity?: number;
  personalizations?: { code: string; name: string }[];
  customer_country: string;
  customer_address: string;
  tracking_number: string;
  has_shipment: boolean;
  // Opcjonalne (nowsze API): nadanie Base Courier o niepewnym wyniku (timeout
  // / 502 — paczka mogla zostac utworzona i oplacona mimo bledu).
  shipment_uncertain?: boolean;
  furgonetka_status?: string;
}

function qtyOf(o: { quantity?: number }): number {
  return Math.max(1, Math.floor(Number(o.quantity) || 1));
}

// Kody AI / imiona wszystkich sztuk (stare zamowienia: para pol personalized_*).
function unitsOf(o: { personalizations?: { code: string; name: string }[]; personalized_code: string | null; personalized_name: string | null }) {
  if (o.personalizations?.length) return o.personalizations;
  return o.personalized_code || o.personalized_name
    ? [{ code: o.personalized_code || "", name: o.personalized_name || "" }]
    : [];
}

const FULFILLMENT_LABEL: Record<string, string> = {
  in_progress: "W realizacji",
  shipped: "Wysłane",
  fulfilled: "Zrealizowane",
};

// Statusy, przy ktorych NIE nadajemy paczki hurtem: anulowane = pieniadze juz
// zwrocone klientowi, wyslane/zrealizowane = paczka juz poszla.
const NO_SHIP_FULFILLMENT = new Set(["cancelled", "shipped", "fulfilled"]);

// Niepewne nadanie — tolerancyjnie: flaga z API albo status przesylki
// "basecourier_pending" (nadanie w toku / zakonczone bledem po wyslaniu).
const isShipmentUncertain = (o: Order) =>
  !!o.shipment_uncertain || o.furgonetka_status === "basecourier_pending";

// Przerywa akcje zbiorcza (np. niepewne nadanie — dalsze proby moglyby
// nadawac i oplacac kolejne paczki, mimo ze Base Courier ma problem).
class StopBulk extends Error {}

type View = "to_ship" | "unpaid" | "shipped" | "all";
const VIEWS: { id: View; label: string }[] = [
  { id: "to_ship", label: "Do wysłania" },
  { id: "unpaid", label: "Nieopłacone" },
  { id: "shipped", label: "W drodze" },
  { id: "all", label: "Wszystkie" },
];

export default function OrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [nextOffset, setNextOffset] = useState(0);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState(""); // search z opoznieniem (zapytanie do serwera)
  const [view, setView] = useState<View>("all");
  // ?view=to_ship (np. z kafelka "Do wysylki" na dashboardzie) — po zamontowaniu,
  // zeby render serwera i przegladarki sie zgadzal.
  useEffect(() => {
    const v = new URLSearchParams(window.location.search).get("view");
    if (VIEWS.some((x) => x.id === v)) setView(v as View);
  }, []);
  const [counts, setCounts] = useState<Partial<Record<View, number>>>({});

  // === Zaznaczanie + akcje zbiorcze ===
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulk, setBulk] = useState<{ label: string; done: number; total: number } | null>(null);
  const [report, setReport] = useState<{ title: string; ok: string[]; errors: string[] } | null>(null);
  const [statusTarget, setStatusTarget] = useState("shipped");

  // Licznik zapytan: odpowiedz starszego zapytania (inna zakladka / fraza,
  // wolne "Zaladuj wiecej") nie nadpisuje ani nie dokleja sie do nowej listy.
  const reqIdRef = useRef(0);
  const [loadErr, setLoadErr] = useState("");

  const fetchOrders = useCallback(async (offset = 0) => {
    const reqId = ++reqIdRef.current;
    const stale = () => reqId !== reqIdRef.current;
    setLoading(true);
    setLoadErr("");
    try {
      const url = new URL("/api/admin/orders", window.location.origin);
      url.searchParams.set("limit", "50");
      url.searchParams.set("offset", String(offset));
      url.searchParams.set("view", view);
      if (query.trim()) url.searchParams.set("q", query.trim());

      const res = await fetch(url);
      if (stale()) return;
      if (res.ok) {
        const data = await res.json();
        if (stale()) return;
        if (offset > 0) {
          setOrders((prev) => [...prev, ...data.orders]);
        } else {
          setOrders(data.orders);
        }
        setHasMore(data.has_more);
        if (data.counts) setCounts(data.counts);
        setNextOffset(data.next_offset);
      } else {
        setLoadErr(`Nie udało się pobrać zamówień (HTTP ${res.status})`);
      }
    } catch (error) {
      console.error("Failed to fetch orders:", error);
      if (!stale()) setLoadErr("Błąd sieci przy pobieraniu zamówień");
    } finally {
      if (!stale()) setLoading(false);
    }
  }, [view, query]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Numery seryjne z etykiet produktowych (lib/productSerial.ts) — zbiorczo
  // dla zaladowanych zamowien, paczkami po 100 id (dlugosc URL). Blad = brak SN.
  const [serialsByOrder, setSerialsByOrder] = useState<Record<string, number[]>>({});
  useEffect(() => {
    if (!orders.length) return;
    let cancelled = false;
    const ids = orders.map((o) => o.id);
    const chunks: string[][] = [];
    for (let i = 0; i < ids.length; i += 100) chunks.push(ids.slice(i, i + 100));
    Promise.all(
      chunks.map((c) =>
        fetch(`/api/admin/product-serials?orderIds=${encodeURIComponent(c.join(","))}`).then((r) => (r.ok ? r.json() : null))
      )
    )
      .then((rs: ({ serials?: Record<string, { serial: number }[]> } | null)[]) => {
        if (cancelled) return;
        const map: Record<string, number[]> = {};
        for (const r of rs) for (const [k, v] of Object.entries(r?.serials || {})) map[k] = v.map((u) => u.serial);
        setSerialsByOrder(map);
      })
      .catch(() => { /* SN to tylko podglad */ });
    return () => { cancelled = true; };
  }, [orders]);

  // Inny widok / fraza = inna lista: zaznaczenie z poprzedniej nie moze
  // przejsc na akcje zbiorcze (i "Zaladuj wiecej" ze starej listy znika).
  useEffect(() => {
    setSelected(new Set());
    setHasMore(false);
  }, [view, query]);

  // Szukanie po stronie serwera (wszystkie zamowienia), 300 ms po ostatnim znaku.
  useEffect(() => {
    const t = setTimeout(() => setQuery(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const filtered = orders;
  const selectedOrders = orders.filter((o) => selected.has(o.id));
  const allVisibleSelected = filtered.length > 0 && filtered.every((o) => selected.has(o.id));
  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  const toggleAll = () =>
    setSelected(allVisibleSelected ? new Set() : new Set(filtered.map((o) => o.id)));

  // Akcje ida po kolei przez TE SAME endpointy co pojedyncze zamowienie
  // (sprawdzona logika, logi, maile) — z postepem i raportem bledow.
  const runBulk = async (title: string, items: Order[], fn: (o: Order) => Promise<string | null>) => {
    const ok: string[] = [];
    const errors: string[] = [];
    setReport(null);
    for (let i = 0; i < items.length; i++) {
      setBulk({ label: title, done: i, total: items.length });
      try {
        const err = await fn(items[i]);
        if (err) errors.push(`${items[i].order_number}: ${err}`); else ok.push(items[i].order_number);
      } catch (e) {
        errors.push(`${items[i].order_number}: ${(e as Error).message}`);
        if (e instanceof StopBulk) {
          const rest = items.slice(i + 1).map((o) => o.order_number);
          if (rest.length) errors.push(`Przerwano — nie wysłano: ${rest.join(", ")}`);
          break;
        }
      }
    }
    setBulk(null);
    setReport({ title, ok, errors });
    setSelected(new Set());
    fetchOrders();
  };

  // Dlaczego zamowienie NIE nadaje sie do platnego nadania hurtem (null = OK).
  const shipBlockReason = (o: Order): string | null => {
    if (o.fulfillment_status === "cancelled") return "anulowane (zwrot)";
    if (NO_SHIP_FULFILLMENT.has(o.fulfillment_status)) return "już wysłane";
    if (isShipmentUncertain(o)) return "niepewne nadanie — sprawdź w Base Courier";
    if (o.has_shipment) return "już nadane";
    if ((o.tracking_number || "").trim()) return "ma już numer przesyłki";
    if (o.status !== "succeeded") return "nieopłacone";
    if ((o.customer_country || "PL").toUpperCase() !== "PL") return "zagraniczne — nadaj ręcznie z wyborem kuriera";
    if (!o.pickup_point) return "brak paczkomatu";
    return null;
  };

  const bulkShipInpost = async () => {
    const eligible = selectedOrders.filter((o) => shipBlockReason(o) === null);
    const skipped = selectedOrders
      .filter((o) => shipBlockReason(o) !== null)
      .map((o) => `${o.order_number} (${shipBlockReason(o)})`);
    if (!eligible.length) {
      setReport({
        title: "Nadanie InPost",
        ok: [],
        errors: ["Żadne z zaznaczonych nie nadaje się do nadania hurtem (musi być opłacone, z Polski, z paczkomatem, jeszcze nienadane i nieanulowane).", ...skipped],
      });
      return;
    }
    const list = eligible.map((o) => o.order_number);
    if (!confirm(
      `Nadać ${eligible.length} ${eligible.length === 1 ? "paczkę" : "paczek"} InPost Paczkomat przez Base Courier?\n\n` +
      `${list.slice(0, 30).join(", ")}${list.length > 30 ? ` … (+${list.length - 30})` : ""}\n\n` +
      `To PŁATNE nadanie (jak przycisk w zamówieniu), bez zamawiania kuriera — paczki nadajesz sam w paczkomacie.` +
      (skipped.length ? `\n\nPominięte (${skipped.length}):\n${skipped.slice(0, 15).join("\n")}${skipped.length > 15 ? "\n…" : ""}` : "")
    )) return;
    await runBulk("Nadanie InPost", eligible, async (o) => {
      const res = await fetch(`/api/admin/orders/${o.id}/basecourier`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) return null;
      // 409 = serwer odmowil (anulowane / juz wyslane / niepewne nadanie) — bez kosztu.
      if (res.status === 409) return `pominięte przez serwer — ${data.error || "zamówienie nie nadaje się do nadania"}`;
      // 502 = blad po stronie Base Courier; paczka MOGLA zostac utworzona. Nie
      // nadajemy dalej hurtem — kazde kolejne nadanie to realny koszt.
      if (res.status === 502 || res.status === 504) {
        throw new StopBulk(
          `NIEPEWNE nadanie (HTTP ${res.status}) — ${data.error || "błąd Base Courier"}. Sprawdź panel Base Courier i notatki zamówienia, NIE ponawiaj bez sprawdzenia.`
        );
      }
      return data.error || `HTTP ${res.status}`;
    });
  };

  const bulkLabels = async () => {
    setBulk({ label: "Pobieranie etykiet", done: 0, total: selectedOrders.length });
    try {
      const res = await fetch("/api/admin/orders/labels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedOrders.map((o) => o.id) }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setReport({ title: "Etykiety", ok: [], errors: [data.error || `HTTP ${res.status}`, ...(data.skipped || [])] });
        return;
      }
      let skipped: string[] = [];
      try {
        skipped = JSON.parse(decodeURIComponent(res.headers.get("X-Skipped") || "%5B%5D"));
      } catch {
        /* uszkodzony naglowek — po prostu bez listy pominietych */
      }
      // <a download> zamiast window.open(blob:) — w aplikacji Electron
      // window.open trafia do shell.openExternal (nic sie nie otwiera),
      // a w przegladarce bywa blokowane jako popup.
      downloadBlob(await res.blob(), `etykiety-${fmtIsoLocal(Date.now(), false)}.pdf`);
      setReport({ title: "Etykiety (pobrano 1 PDF)", ok: selectedOrders.filter((o) => !skipped.some((s) => s.startsWith(o.order_number))).map((o) => o.order_number), errors: skipped });
    } catch (e) {
      setReport({ title: "Etykiety", ok: [], errors: [`Błąd sieci: ${(e as Error).message}`] });
    } finally {
      setBulk(null);
    }
  };

  const bulkStatus = async () => {
    const label = FULFILLMENT_LABEL[statusTarget];
    // Anulowane = pieniadze zwrocone klientowi — zmiana statusu hurtem (i mail
    // "wyslane") bylaby pomylka; takie zamowienia zmieniasz recznie.
    const targets = selectedOrders.filter((o) => o.fulfillment_status !== "cancelled");
    const skippedCancelled = selectedOrders.length - targets.length;
    if (!targets.length) {
      setReport({ title: `Status: ${label}`, ok: [], errors: ["Zaznaczone zamówienia są anulowane (zwrot) — zmień status ręcznie w zamówieniu, jeśli to celowe."] });
      return;
    }
    if (!confirm(
      `Zmienić status realizacji ${targets.length} zamówień na „${label}”?\n\nKażdy klient dostanie maila o zmianie statusu (tak jak przy zmianie ręcznej).` +
      (skippedCancelled ? `\n\nPominięte: ${skippedCancelled} anulowanych (zwrot).` : "")
    )) return;
    await runBulk(`Status: ${label}`, targets, async (o) => {
      const res = await fetch(`/api/admin/orders/${o.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        // expected_* — serwer odrzuci (409), jesli status zmienil sie od zaladowania listy.
        body: JSON.stringify({ fulfillment_status: statusTarget, expected_fulfillment_status: o.fulfillment_status }),
      });
      if (res.ok) return null;
      const data = await res.json().catch(() => ({}));
      if (res.status === 409) return `status zmienił się w międzyczasie (teraz: ${data.current || "?"}) — odśwież`;
      return data.error || `HTTP ${res.status}`;
    });
  };

  const openPacking = () => window.open(`/admin/orders/packing?ids=${selectedOrders.map((o) => o.id).join(",")}`, "_blank");

  const exportCsv = () => {
    const head = ["Numer", "Data", "Klient", "E-mail", "Telefon", "Kraj", "Paczkomat", "Adres", "Kwota", "Waluta", "Płatność", "Realizacja", "Nr przesyłki", "Ilość", "Kod AI", "Imię na etykietę"];
    // csvCell: ochrona przed formula injection + numery/kody jako tekst;
    // daty w czasie polskim (nie UTC).
    const rows = selectedOrders.map((o) => [
      csvCell(o.order_number, { text: true }), csvCell(fmtIsoLocal(o.created)), csvCell(o.customer_name), csvCell(o.customer_email),
      csvCell(o.customer_phone, { text: true }), csvCell(o.customer_country), csvCell(o.pickup_point), csvCell(o.customer_address),
      csvCell((o.amount / 100).toFixed(2).replace(".", ",")), csvCell((o.currency || "pln").toUpperCase()), csvCell(o.status),
      csvCell(o.fulfillment_status), csvCell(o.tracking_number, { text: true }), csvCell(qtyOf(o)),
      // Kilka sztuk: kody/imiona w kolejnosci sztuk, rozdzielone " | ".
      csvCell(unitsOf(o).map((u) => u.code).join(" | "), { text: true }), csvCell(unitsOf(o).map((u) => u.name).join(" | ")),
    ]);
    // Srednik + BOM — Excel w polskich ustawieniach otwiera to poprawnie.
    const csv = "\uFEFF" + [head, ...rows].map((r) => r.join(";")).join("\n");
    downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), `zamowienia-${fmtIsoLocal(Date.now(), false)}.csv`);
  };

  // Czas polski niezaleznie od strefy komputera (np. aplikacja Electron).
  const formatDate = (ts: number) => fmtDateTime(ts);

  return (
    <AdminShell>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
        <h1 className="text-xl font-bold text-[#E0E0E0]">Zamówienia</h1>
        <input
          type="text"
          placeholder="Szukaj: KM-…, nazwisko, e-mail, telefon, nr przesyłki"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:w-72 px-3 py-2 rounded-lg border border-[#3F4147] bg-[#2B2D31] text-[#E0E0E0] text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6] placeholder:text-[#E0E0E0]/30"
        />
      </div>

      <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => setView(v.id)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              view === v.id ? "bg-[#3B82F6] text-white" : "bg-[#313338] border border-[#3F4147] text-[#E0E0E0]/70 hover:text-[#E0E0E0]"
            }`}
          >
            {v.label}
            {counts[v.id] !== undefined && (
              <span className={`ml-1.5 ${view === v.id ? "text-white/80" : v.id === "to_ship" && counts[v.id] ? "text-[#D8FF3D]" : "text-[#E0E0E0]/40"}`}>
                {counts[v.id]}
              </span>
            )}
          </button>
        ))}
      </div>

      {(selected.size > 0 || bulk || report) && (
        <div className="mb-3 sticky top-2 z-20 rounded-lg border border-[#3B82F6]/40 bg-[#1E1F22]/95 backdrop-blur p-3 space-y-2">
          {selected.size > 0 && !bulk && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-[#E0E0E0] font-medium mr-1">Zaznaczono: {selected.size}</span>
              <button onClick={bulkShipInpost} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[#3B82F6] hover:bg-[#2f6fd6] text-white">📦 Nadaj InPost</button>
              <button onClick={bulkLabels} className="px-3 py-1.5 rounded-lg text-xs bg-[#2B2D31] border border-[#3F4147] text-[#E0E0E0] hover:bg-[#3F4147]">🏷 Etykiety (1 PDF)</button>
              <button onClick={openPacking} className="px-3 py-1.5 rounded-lg text-xs bg-[#2B2D31] border border-[#3F4147] text-[#E0E0E0] hover:bg-[#3F4147]">📋 Lista kompletacji</button>
              <span className="flex items-center gap-1">
                <select value={statusTarget} onChange={(e) => setStatusTarget(e.target.value)} className="px-2 py-1.5 rounded-lg text-xs bg-[#2B2D31] border border-[#3F4147] text-[#E0E0E0]">
                  {Object.entries(FULFILLMENT_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <button onClick={bulkStatus} className="px-3 py-1.5 rounded-lg text-xs bg-[#2B2D31] border border-[#3F4147] text-[#E0E0E0] hover:bg-[#3F4147]">Ustaw status</button>
              </span>
              <button onClick={exportCsv} className="px-3 py-1.5 rounded-lg text-xs bg-[#2B2D31] border border-[#3F4147] text-[#E0E0E0] hover:bg-[#3F4147]">⬇ CSV</button>
              <button onClick={() => setSelected(new Set())} className="ml-auto text-xs text-[#E0E0E0]/50 hover:text-[#E0E0E0]">Odznacz</button>
            </div>
          )}
          {bulk && (
            <div>
              <p className="text-sm text-[#E0E0E0]">{bulk.label}… {bulk.done}/{bulk.total}</p>
              <div className="mt-1.5 h-1.5 rounded bg-[#3F4147] overflow-hidden">
                <div className="h-full bg-[#3B82F6] transition-all" style={{ width: `${bulk.total ? (bulk.done / bulk.total) * 100 : 0}%` }} />
              </div>
            </div>
          )}
          {report && !bulk && (
            <div className="text-xs space-y-1">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[#E0E0E0] font-medium">{report.title}: {report.ok.length} OK{report.errors.length ? `, ${report.errors.length} problemów` : ""}</p>
                <button onClick={() => setReport(null)} className="text-[#E0E0E0]/50 hover:text-[#E0E0E0]">✕</button>
              </div>
              {report.ok.length > 0 && <p className="text-green-400 break-words">✓ {report.ok.join(", ")}</p>}
              {report.errors.map((e) => <p key={e} className="text-red-400 break-words">✗ {e}</p>)}
            </div>
          )}
        </div>
      )}

      <div className="bg-[#313338] rounded-lg border border-[#3F4147] overflow-hidden">
        {/* Telefon: karty zamiast tabeli (tabela nie miescila sie w szerokosci ekranu). */}
        <div className="md:hidden divide-y divide-[#3F4147]">
          {filtered.length > 0 && (
            <label className="flex items-center gap-2 px-4 py-2.5 text-xs text-[#E0E0E0]/60">
              <input type="checkbox" checked={allVisibleSelected} onChange={toggleAll} className="w-4 h-4" /> Zaznacz wszystkie widoczne
            </label>
          )}
          {filtered.map((order) => (
            <div key={order.id} className={`flex items-stretch ${selected.has(order.id) ? "bg-[#3B82F6]/10" : ""}`}>
            <label className="flex items-start pl-4 pt-4" onClick={(e) => e.stopPropagation()}>
              <input type="checkbox" checked={selected.has(order.id)} onChange={() => toggle(order.id)} className="w-5 h-5" aria-label={`Zaznacz ${order.order_number}`} />
            </label>
            <div className="flex-1 min-w-0">
            <button
              type="button"
              onClick={() => router.push(`/admin/orders/${order.id}`)}
              className="block w-full text-left px-3 pt-3.5 pb-2 space-y-2 active:bg-[#3F4147]/30"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[#E0E0E0] font-medium truncate">{order.customer_name || "—"}</p>
                  <p className="text-xs text-[#E0E0E0]/40 truncate">{order.order_number} · {order.customer_email || "—"}</p>
                </div>
                <p className="text-[#E0E0E0] font-semibold whitespace-nowrap">
                  {qtyOf(order) > 1 && <span className="mr-1.5 text-xs font-bold text-[#D8FF3D]">×{qtyOf(order)}</span>}
                  {formatAmount(order.amount, order.currency)}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <OrderStatusBadge status={order.status} type="payment" />
                <OrderStatusBadge status={order.fulfillment_status} type="fulfillment" />
                <span className="ml-auto text-xs text-[#E0E0E0]/40">{formatDate(order.created)}</span>
              </div>
              {(order.pickup_point || unitsOf(order).length > 0) && (
                <p className="text-xs text-[#E0E0E0]/50 break-words">
                  {order.pickup_point ? `Paczkomat: ${order.pickup_point}` : ""}
                  {order.pickup_point && unitsOf(order).length > 0 ? " · " : ""}
                  {unitsOf(order).length > 0
                    ? `${unitsOf(order).length > 1 ? "Kody" : "Kod"}: ${unitsOf(order).map((u) => `${u.code || "—"}${u.name ? ` (${u.name})` : ""}`).join(", ")}`
                    : ""}
                </p>
              )}
            </button>
            <div className="px-3 pb-3">
              <ProductLabelLink orderId={order.id} serials={serialsByOrder[order.id] ?? []} compact />
            </div>
            </div>
            </div>
          ))}
          {filtered.length === 0 && !loading && (
            <div className="px-4 py-8 text-center text-[#E0E0E0]/40 text-sm">Brak zamówień</div>
          )}
        </div>

        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#3F4147] text-left">
                <th className="pl-4 py-3 w-8">
                  <input type="checkbox" checked={allVisibleSelected} onChange={toggleAll} aria-label="Zaznacz wszystkie widoczne" />
                </th>
                <th className="px-4 py-3 text-xs font-medium text-[#E0E0E0]/50 uppercase tracking-wider">
                  Data
                </th>
                <th className="px-4 py-3 text-xs font-medium text-[#E0E0E0]/50 uppercase tracking-wider">
                  Klient
                </th>
                <th className="px-4 py-3 text-xs font-medium text-[#E0E0E0]/50 uppercase tracking-wider hidden md:table-cell">
                  Paczkomat
                </th>
                <th className="px-4 py-3 text-xs font-medium text-[#E0E0E0]/50 uppercase tracking-wider hidden lg:table-cell">
                  Personalizacja
                </th>
                <th className="px-4 py-3 text-xs font-medium text-[#E0E0E0]/50 uppercase tracking-wider">
                  Kwota
                </th>
                <th className="px-4 py-3 text-xs font-medium text-[#E0E0E0]/50 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-xs font-medium text-[#E0E0E0]/50 uppercase tracking-wider hidden sm:table-cell">
                  Realizacja
                </th>
                <th className="px-4 py-3 text-xs font-medium text-[#E0E0E0]/50 uppercase tracking-wider">
                  Etykieta
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#3F4147]">
              {filtered.map((order) => (
                <tr
                  key={order.id}
                  onClick={() => router.push(`/admin/orders/${order.id}`)}
                  className={`cursor-pointer hover:bg-[#3F4147]/30 transition-colors ${selected.has(order.id) ? "bg-[#3B82F6]/10" : ""}`}
                >
                  <td className="pl-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={selected.has(order.id)} onChange={() => toggle(order.id)} aria-label={`Zaznacz ${order.order_number}`} />
                  </td>
                  <td className="px-4 py-3 text-[#E0E0E0]/70 whitespace-nowrap">
                    {formatDate(order.created)}
                    <p className="text-xs font-mono text-[#E0E0E0]/40">{order.order_number}</p>
                  </td>
                  <td className="px-4 py-3">
                    <div>
                      <p className="text-[#E0E0E0] font-medium">
                        {order.customer_name || "—"}
                      </p>
                      <p className="text-xs text-[#E0E0E0]/40">
                        {order.customer_email || "—"}
                      </p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[#E0E0E0]/60 hidden md:table-cell">
                    {order.pickup_point || "—"}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    {unitsOf(order).length > 0 ? (
                      <div className="text-xs space-y-0.5">
                        {unitsOf(order).map((u, i) => (
                          <p key={i} className="whitespace-nowrap">
                            <span className="text-[#E0E0E0] font-mono">Kod: {u.code || "—"}</span>
                            {u.name && <span className="ml-1.5 text-[#E0E0E0]/50">{u.name}</span>}
                          </p>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-[#E0E0E0]/30">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[#E0E0E0] font-medium whitespace-nowrap">
                    {formatAmount(order.amount, order.currency)}
                    {qtyOf(order) > 1 && (
                      <span className="ml-1.5 rounded bg-[#D8FF3D]/15 px-1.5 py-0.5 text-xs font-bold text-[#D8FF3D]">×{qtyOf(order)}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <OrderStatusBadge status={order.status} type="payment" />
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <OrderStatusBadge
                      status={order.fulfillment_status}
                      type="fulfillment"
                    />
                  </td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <ProductLabelLink orderId={order.id} serials={serialsByOrder[order.id] ?? []} compact />
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && !loading && (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-8 text-center text-[#E0E0E0]/40 text-sm"
                  >
                    Brak zamówień
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {loading && (
          <div className="px-4 py-6 text-center text-[#E0E0E0]/40 text-sm">
            Ładowanie...
          </div>
        )}

        {loadErr && !loading && (
          <div className="px-4 py-3 border-t border-[#3F4147] text-sm text-red-400 flex items-center gap-3">
            {loadErr}
            <button onClick={() => fetchOrders()} className="text-[#3B82F6] hover:underline">Spróbuj ponownie</button>
          </div>
        )}

        {hasMore && !loading && (
          <div className="px-4 py-3 border-t border-[#3F4147]">
            <button
              onClick={() => fetchOrders(nextOffset)}
              className="text-sm text-[#3B82F6] hover:underline"
            >
              Załaduj więcej
            </button>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
