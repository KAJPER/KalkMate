"use client";

import { useEffect, useState } from "react";

// Przycisk "Etykieta produktowa" (nowa karta: /admin/orders/[id]/etykieta)
// + przydzielone numery seryjne sztuk ("SN 43–44"). W szczegolach zamowienia
// komponent sam pobiera SN; na liscie zamowien dostaje je z jednego zbiorczego
// zapytania (prop serials).

type DesktopWindow = Window & {
  kalkmateDesktop?: {
    printProductLabel?: (orderId: string, units: number[]) => Promise<{ ok: boolean; printer?: string; error?: string }>;
    // Etykieta na tyl kalkulatora 50x30 (Niimbot): copies razy TEN SAM SN.
    printNiimbotBack?: (sn: string, copies: number) => Promise<{ ok: boolean; printer?: string; copies?: number; error?: string }>;
  };
};

export function formatSerialRange(serials: number[]): string {
  if (!serials.length) return "";
  const s = [...serials].sort((a, b) => a - b);
  const fmt = (n: number) => String(n).padStart(2, "0");
  const contiguous = s.every((n, i) => i === 0 || n === s[i - 1] + 1);
  if (s.length === 1) return `SN ${fmt(s[0])}`;
  return contiguous ? `SN ${fmt(s[0])}–${fmt(s[s.length - 1])}` : `SN ${s.map(fmt).join(", ")}`;
}

export default function ProductLabelLink({
  orderId,
  serials,
  compact = false,
}: {
  orderId: string;
  /** Podane = bez wlasnego zapytania (lista zamowien). */
  serials?: number[];
  compact?: boolean;
}) {
  const [own, setOwn] = useState<number[] | null>(null);
  // Aplikacja desktopowa: cichy druk na drukarce etykiet (jak etykieta wysylkowa).
  const [canPrint, setCanPrint] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [printMsg, setPrintMsg] = useState<{ ok: boolean; text: string } | null>(null);
  // Etykieta na tyl (Niimbot 50x30): numer z pola SN, 1 albo 5 kopii tego samego numeru.
  const [canNiimbot, setCanNiimbot] = useState(false);
  const [backSn, setBackSn] = useState("");
  const [backSnEdited, setBackSnEdited] = useState(false);
  const [backBusy, setBackBusy] = useState(false);
  useEffect(() => {
    const bridge = (window as DesktopWindow).kalkmateDesktop;
    setCanPrint(typeof bridge?.printProductLabel === "function");
    setCanNiimbot(typeof bridge?.printNiimbotBack === "function");
  }, []);

  const printBack = async (copies: number) => {
    const bridge = (window as DesktopWindow).kalkmateDesktop;
    const sn = backSn.trim();
    if (!bridge?.printNiimbotBack || backBusy) return;
    if (!/^[A-Za-z0-9-]{1,12}$/.test(sn)) {
      setPrintMsg({ ok: false, text: "Wpisz numer SN" });
      return;
    }
    setBackBusy(true);
    setPrintMsg(null);
    try {
      const r = await bridge.printNiimbotBack(sn, copies);
      setPrintMsg(r.ok ? { ok: true, text: `Tył SN ${sn} ×${copies} wydrukowany (Niimbot)` } : { ok: false, text: r.error || "Błąd drukowania" });
    } catch (e) {
      setPrintMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBackBusy(false);
    }
  };

  const printNow = async () => {
    const bridge = (window as DesktopWindow).kalkmateDesktop;
    if (!bridge?.printProductLabel || printing) return;
    setPrinting(true);
    setPrintMsg(null);
    try {
      const r = await bridge.printProductLabel(orderId, []);
      setPrintMsg(r.ok ? { ok: true, text: `Wydrukowano (${r.printer ?? "drukarka etykiet"})` } : { ok: false, text: r.error || "Błąd drukowania" });
      if (r.ok && serials === undefined) {
        // Druk przydzielil SN — odswiez zakres obok przycisku.
        fetch(`/api/admin/product-serials?orderId=${encodeURIComponent(orderId)}`)
          .then((x) => (x.ok ? x.json() : null))
          .then((d: { serials?: { serial: number }[] } | null) => { if (d?.serials) setOwn(d.serials.map((u) => u.serial)); })
          .catch(() => {});
      }
    } catch (e) {
      setPrintMsg({ ok: false, text: (e as Error).message });
    } finally {
      setPrinting(false);
    }
  };

  useEffect(() => {
    if (serials !== undefined) return;
    let cancelled = false;
    fetch(`/api/admin/product-serials?orderId=${encodeURIComponent(orderId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { serials?: { serial: number }[] } | null) => {
        if (!cancelled && d?.serials) setOwn(d.serials.map((u) => u.serial));
      })
      .catch(() => { /* brak SN to nie blad — przycisk dziala dalej */ });
    return () => { cancelled = true; };
  }, [orderId, serials]);

  const list = serials ?? own ?? [];
  const range = formatSerialRange(list);
  const firstSn = list.length ? String(Math.min(...list)).padStart(2, "0") : "";
  useEffect(() => {
    if (!backSnEdited) setBackSn(firstSn);
  }, [firstSn, backSnEdited]);

  return (
    <span className="inline-flex flex-wrap items-center gap-2" onClick={(e) => e.stopPropagation()}>
      <a
        href={`/admin/orders/${orderId}/etykieta`}
        target="_blank"
        rel="noreferrer"
        title="Etykieta produktowa 100×150 mm (tył + przód dla każdej sztuki) — druk na VEVOR"
        className={
          compact
            ? "inline-flex items-center gap-1 whitespace-nowrap rounded-md border border-[#3F4147] bg-[#2B2D31] px-2 py-1 text-xs text-[#E0E0E0] hover:bg-[#3F4147]"
            : "inline-flex items-center gap-2 whitespace-nowrap rounded-lg border border-[#3F4147] bg-[#2B2D31] px-4 py-2 text-xs font-medium text-[#E0E0E0] hover:bg-[#3F4147] transition-colors"
        }
      >
        🏷 {compact ? "Etykieta prod." : "Etykieta produktowa"}
      </a>
      {canPrint && (
        <button
          type="button"
          onClick={printNow}
          disabled={printing}
          title="Cichy druk etykiety produktowej (tył + przód dla każdej sztuki) na drukarce etykiet"
          className={
            compact
              ? "inline-flex items-center gap-1 whitespace-nowrap rounded-md bg-[#D8FF3D] px-2 py-1 text-xs font-semibold text-black hover:brightness-95 disabled:opacity-50"
              : "inline-flex items-center gap-2 whitespace-nowrap rounded-lg bg-[#D8FF3D] px-4 py-2 text-xs font-semibold text-black hover:brightness-95 disabled:opacity-50 transition"
          }
        >
          🖨 {printing ? "Drukuję…" : compact ? "Drukuj" : "Drukuj etykietę produktową"}
        </button>
      )}
      {canNiimbot && (
        <span
          className="inline-flex items-center gap-1 whitespace-nowrap rounded-md border border-[#3F4147] bg-[#2B2D31] px-1.5 py-0.5"
          title="Etykieta na tył kalkulatora 50×30 mm (CE, producent, SN) — Niimbot B1 Pro. Wszystkie kopie mają TEN SAM numer."
        >
          <span className="text-xs text-[#E0E0E0]/70">Tył SN</span>
          <input
            value={backSn}
            onChange={(e) => { setBackSn(e.target.value.replace(/[^A-Za-z0-9-]/g, "").slice(0, 12)); setBackSnEdited(true); }}
            placeholder="47"
            className="w-12 rounded bg-[#1E1F22] px-1 py-0.5 text-center font-mono text-xs text-[#E0E0E0] outline-none focus:ring-1 focus:ring-[#D8FF3D]"
          />
          {[1, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => printBack(n)}
              disabled={backBusy || !backSn}
              className="rounded bg-[#D8FF3D] px-1.5 py-0.5 text-xs font-semibold text-black hover:brightness-95 disabled:opacity-50"
            >
              {backBusy ? "…" : `Drukuj ${n}`}
            </button>
          ))}
        </span>
      )}
      {printMsg && (
        <span className={`whitespace-nowrap text-xs ${printMsg.ok ? "text-green-400" : "text-red-400"}`}>{printMsg.text}</span>
      )}
      {range && <span className="whitespace-nowrap font-mono text-xs text-[#E0E0E0]/60">{range}</span>}
    </span>
  );
}
