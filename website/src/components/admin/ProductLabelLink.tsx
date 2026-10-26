"use client";

import { useEffect, useState } from "react";

// Przycisk "Etykieta produktowa" (nowa karta: /admin/orders/[id]/etykieta)
// + przydzielone numery seryjne sztuk ("SN 43–44"). W szczegolach zamowienia
// komponent sam pobiera SN; na liscie zamowien dostaje je z jednego zbiorczego
// zapytania (prop serials).

type DesktopWindow = Window & {
  kalkmateDesktop?: { printProductLabel?: (orderId: string, units: number[]) => Promise<{ ok: boolean; printer?: string; error?: string }> };
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
  useEffect(() => {
    setCanPrint(typeof (window as DesktopWindow).kalkmateDesktop?.printProductLabel === "function");
  }, []);

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
      {printMsg && (
        <span className={`whitespace-nowrap text-xs ${printMsg.ok ? "text-green-400" : "text-red-400"}`}>{printMsg.text}</span>
      )}
      {range && <span className="whitespace-nowrap font-mono text-xs text-[#E0E0E0]/60">{range}</span>}
    </span>
  );
}
