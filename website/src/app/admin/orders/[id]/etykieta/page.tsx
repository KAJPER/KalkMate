"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ProductLabelBack, ProductLabelFront, PRODUCT_LABEL_CSS } from "@/components/admin/ProductLabel";

// Etykieta produktowa 100x150 mm na drukarke termiczna VEVOR — dla KAZDEJ
// sztuki zamowienia: tyl + przod, jedno zadanie druku na cale zamowienie.
// Bez AdminShell (jak /admin/orders/packing) — czysta strona pod drukarke;
// pasek sterowania (.kmpl-noprint) nie drukuje sie.
// SN: przydzielane z globalnego licznika na serwerze przy pierwszym otwarciu
// (lib/productSerial.ts), ponowny druk pokazuje te same numery.

interface OrderData {
  id: string;
  order_number: string;
  customer_name: string;
  fulfillment_status: string;
  quantity?: number;
  personalized_code: string | null;
  personalized_name: string | null;
  personalizations?: { code: string; name: string }[];
}

interface UnitSerial { unitIndex: number; serial: number }
interface SerialState { last: number; maxAssigned: number | null; serials: UnitSerial[] }

const fmtSn = (n: number) => String(n).padStart(2, "0");

// Sztuki zamowienia: lista z API (wiele sztuk) albo stara para pol (1 szt.).
function unitNames(o: OrderData): string[] {
  const qty = Math.max(1, Math.floor(Number(o.quantity) || 1));
  const list = o.personalizations?.length
    ? o.personalizations
    : o.personalized_code || o.personalized_name
      ? [{ code: o.personalized_code || "", name: o.personalized_name || "" }]
      : [];
  return Array.from({ length: Math.max(qty, list.length) }, (_, i) => list[i]?.name ?? "");
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, init);
  const d = await r.json().catch(() => null);
  if (!r.ok || !d) {
    throw new Error(`${d?.error || `HTTP ${r.status}`}${r.status === 401 ? " — zaloguj się ponownie" : ""}`);
  }
  return d as T;
}

// Aplikacja desktopowa (Electron) drukuje te strone po cichu: laduje ja w
// ukrytym oknie i czeka na window.__kalkLabelReady (zamowienie + SN gotowe)
// albo window.__kalkLabelError. ?units=0,2 = tylko wybrane sztuki.
type LabelWindow = Window & {
  __kalkLabelReady?: boolean;
  __kalkLabelError?: string;
  kalkmateDesktop?: { printProductLabel?: (orderId: string, units: number[]) => Promise<{ ok: boolean; printer?: string; error?: string }> };
};

function unitsFromQuery(count: number): boolean[] {
  if (typeof window === "undefined") return Array.from({ length: count }, () => true);
  const raw = new URLSearchParams(window.location.search).get("units");
  if (!raw) return Array.from({ length: count }, () => true);
  const set = new Set(raw.split(",").map((x) => Number(x)).filter((x) => Number.isInteger(x)));
  return Array.from({ length: count }, (_, i) => set.has(i));
}

export default function ProductLabelPage() {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<OrderData | null>(null);
  const [loadErr, setLoadErr] = useState("");
  const [names, setNames] = useState<string[]>([]);
  const [include, setInclude] = useState<boolean[]>([]);
  const [saved, setSaved] = useState<Record<number, number>>({}); // unitIndex -> SN z serwera
  const [snDraft, setSnDraft] = useState<string[]>([]);
  const [counter, setCounterState] = useState<{ last: number; maxAssigned: number | null } | null>(null);
  const [counterDraft, setCounterDraft] = useState("");
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const applySerials = useCallback((s: SerialState, count: number) => {
    const map: Record<number, number> = {};
    for (const u of s.serials) map[u.unitIndex] = u.serial;
    setSaved(map);
    setSnDraft(Array.from({ length: count }, (_, i) => (map[i] != null ? fmtSn(map[i]) : "")));
    setCounterState({ last: s.last, maxAssigned: s.maxAssigned });
    setCounterDraft(String(s.last));
  }, []);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        const { order: o } = await api<{ order: OrderData }>(`/api/admin/orders/${encodeURIComponent(id)}`);
        if (cancelled) return;
        const n = unitNames(o);
        setOrder(o);
        setNames(n);
        setInclude(unitsFromQuery(n.length));
        document.title = `Etykieta produktowa ${o.order_number}`;
        // Przydziel brakujace SN (idempotentne — ponowne otwarcie = te same numery).
        try {
          const s = await api<SerialState>("/api/admin/product-serials", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "assign", orderId: o.id }),
          });
          if (!cancelled) {
            applySerials(s, n.length);
            // Po wyrenderowaniu etykiet z numerami (nastepna klatka).
            requestAnimationFrame(() => requestAnimationFrame(() => { (window as LabelWindow).__kalkLabelReady = true; }));
          }
        } catch (e) {
          if (cancelled) return;
          setSnDraft(n.map(() => ""));
          setMsg({ kind: "err", text: `Numery seryjne: ${(e as Error).message}` });
          (window as LabelWindow).__kalkLabelError = `numery seryjne: ${(e as Error).message}`;
        }
      } catch (e) {
        if (!cancelled) {
          setLoadErr(`Błąd ładowania zamówienia: ${(e as Error).message}`);
          (window as LabelWindow).__kalkLabelError = (e as Error).message;
        }
      }
    })();
    return () => { cancelled = true; };
  }, [id, applySerials]);

  const count = names.length;
  const dirty = useMemo(
    () => snDraft.map((d, i) => d.trim() !== (saved[i] != null ? fmtSn(saved[i]) : "")),
    [snDraft, saved]
  );
  const toPrint = names.map((_, i) => i).filter((i) => include[i]);

  const saveUnit = async (i: number) => {
    if (!order) return;
    setBusy(true);
    setMsg(null);
    try {
      const s = await api<SerialState>("/api/admin/product-serials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set", orderId: order.id, unitIndex: i, serial: snDraft[i] }),
      });
      // Zachowaj niezapisane zmiany pozostalych sztuk.
      const keep = snDraft.slice();
      applySerials(s, count);
      const fresh = s.serials.find((u) => u.unitIndex === i);
      setSnDraft((prev) => prev.map((v, j) => (j === i ? (fresh ? fmtSn(fresh.serial) : v) : dirty[j] ? keep[j] : v)));
      setMsg({ kind: "ok", text: `Sztuka ${i + 1}: zapisano SN ${fresh ? fmtSn(fresh.serial) : snDraft[i]}` });
    } catch (e) {
      setMsg({ kind: "err", text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const saveCounter = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const s = await api<{ last: number; maxAssigned: number | null }>("/api/admin/product-serials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "setCounter", last: counterDraft }),
      });
      setCounterState(s);
      setCounterDraft(String(s.last));
      setMsg({ kind: "ok", text: `Ostatni wydany SN = ${fmtSn(s.last)} — następna nowa sztuka dostanie ${fmtSn(s.last + 1)} (lub kolejny wolny).` });
    } catch (e) {
      setMsg({ kind: "err", text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const print = () => {
    if (!toPrint.length) return;
    const unsaved = toPrint.filter((i) => dirty[i]);
    if (unsaved.length && !window.confirm(
      `Sztuka ${unsaved.map((i) => i + 1).join(", ")}: numer seryjny nie jest zapisany na serwerze.\n\nDrukować mimo to?`
    )) return;
    const bridge = (window as LabelWindow).kalkmateDesktop;
    if (bridge?.printProductLabel && order) {
      setBusy(true);
      setMsg(null);
      bridge.printProductLabel(order.id, toPrint)
        .then((r) => setMsg(r.ok
          ? { kind: "ok", text: `Wysłano do drukarki ${r.printer ?? ""} (${toPrint.length} szt.)` }
          : { kind: "err", text: r.error || "Błąd drukowania" }))
        .catch((e) => setMsg({ kind: "err", text: (e as Error).message }))
        .finally(() => setBusy(false));
      return;
    }
    window.print();
  };

  const inputCls = "rounded border border-gray-300 bg-white px-2 py-1 text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500";
  const btnCls = "rounded bg-black px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-40";

  return (
    <div className="kmpl">
      <style>{PRODUCT_LABEL_CSS}</style>

      <div className="kmpl-noprint mx-auto mb-[6mm] max-w-3xl rounded-lg border border-[#e0c94a] bg-[#fffbe6] p-4 text-sm text-black">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <Link href={`/admin/orders/${id}`} className="text-blue-700 underline">← Zamówienie</Link>
          <span className="font-mono font-bold">{order?.order_number ?? "…"}</span>
          {order && <span className="text-gray-700">{order.customer_name}</span>}
          {order?.fulfillment_status === "cancelled" && (
            <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-bold text-red-800">Anulowane</span>
          )}
          <button onClick={print} disabled={!order || !toPrint.length || busy} className={`${btnCls} ml-auto`}>
            🖨 Drukuj ({toPrint.length} szt. = {toPrint.length * 2} etykiet)
          </button>
        </div>

        {loadErr && <p className="mb-2 font-semibold text-red-700">{loadErr}</p>}
        {!order && !loadErr && <p className="text-gray-700">Ładowanie…</p>}

        {order && (
          <table className="mb-3 w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-600">
                <th className="py-1 pr-2 font-medium">Druk</th>
                <th className="py-1 pr-2 font-medium">Sztuka</th>
                <th className="py-1 pr-2 font-medium">Numer seryjny (SN)</th>
                <th className="py-1 font-medium">Personalizacja (imię/nick)</th>
              </tr>
            </thead>
            <tbody>
              {names.map((name, i) => (
                <tr key={i} className="align-middle">
                  <td className="py-1 pr-2">
                    <input
                      type="checkbox"
                      checked={!!include[i]}
                      onChange={(e) => setInclude((p) => p.map((v, j) => (j === i ? e.target.checked : v)))}
                      aria-label={`Drukuj sztukę ${i + 1}`}
                    />
                  </td>
                  <td className="whitespace-nowrap py-1 pr-2 text-gray-700">{i + 1} / {count}</td>
                  <td className="py-1 pr-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={snDraft[i] ?? ""}
                        onChange={(e) => setSnDraft((p) => p.map((v, j) => (j === i ? e.target.value : v)))}
                        className={`${inputCls} w-24 font-mono`}
                        aria-label={`SN sztuki ${i + 1}`}
                      />
                      <button
                        onClick={() => saveUnit(i)}
                        disabled={busy || !dirty[i] || !snDraft[i]?.trim()}
                        className="rounded border border-black px-2 py-1 text-xs font-semibold disabled:opacity-30"
                      >
                        Zapisz
                      </button>
                      {dirty[i] && <span className="text-xs font-semibold text-amber-700">niezapisany</span>}
                    </div>
                  </td>
                  <td className="py-1">
                    <input
                      type="text"
                      value={name}
                      maxLength={40}
                      onChange={(e) => setNames((p) => p.map((v, j) => (j === i ? e.target.value : v)))}
                      className={`${inputCls} w-full`}
                      placeholder="(bez personalizacji)"
                      aria-label={`Imię na etykiecie sztuki ${i + 1}`}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {counter && (
          <div className="mb-3 flex flex-wrap items-center gap-2 border-t border-[#e0c94a] pt-3">
            <label htmlFor="km-sn-last" className="font-medium">Ostatni wydany numer seryjny:</label>
            <input
              id="km-sn-last"
              type="text"
              inputMode="numeric"
              value={counterDraft}
              onChange={(e) => setCounterDraft(e.target.value)}
              className={`${inputCls} w-24 font-mono`}
            />
            <button
              onClick={saveCounter}
              disabled={busy || counterDraft.trim() === String(counter.last)}
              className="rounded border border-black px-2 py-1 text-xs font-semibold disabled:opacity-30"
            >
              Zapisz
            </button>
            <span className="text-xs text-gray-700">
              następna nowa sztuka: {fmtSn(counter.last + 1)}
              {counter.maxAssigned != null && ` · najwyższy przypisany: ${fmtSn(counter.maxAssigned)}`}
            </span>
          </div>
        )}

        {msg && (
          <p className={`mb-2 text-sm font-semibold ${msg.kind === "ok" ? "text-green-800" : "text-red-700"}`}>{msg.text}</p>
        )}

        <p className="text-xs leading-relaxed text-gray-800">
          <b>Druk na VEVOR:</b> w oknie drukowania wybierz drukarkę <b>VEVOR</b>, rozmiar papieru <b>100×150 mm</b>{" "}
          (4×6&quot;), skala <b>100%</b> / „Rzeczywisty rozmiar” (nie „Dopasuj”), marginesy <b>Brak</b>, nagłówki i stopki
          wyłączone. Każda sztuka = 2 etykiety (tył, potem przód). SN i imię możesz poprawić powyżej — ten pasek się nie drukuje.
        </p>
      </div>

      {order && (
        <div className="kmpl-pages">
          {toPrint.flatMap((i) => [
            <ProductLabelBack key={`b${i}`} sn={snDraft[i]?.trim() ?? ""} name={names[i] ?? ""} />,
            <ProductLabelFront key={`f${i}`} name={names[i] ?? ""} />,
          ])}
        </div>
      )}
    </div>
  );
}
