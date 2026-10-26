"use client";

import { useEffect, useState } from "react";

// Przycisk "Etykieta produktowa" (nowa karta: /admin/orders/[id]/etykieta)
// + przydzielone numery seryjne sztuk ("SN 43–44"). W szczegolach zamowienia
// komponent sam pobiera SN; na liscie zamowien dostaje je z jednego zbiorczego
// zapytania (prop serials).

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
      {range && <span className="whitespace-nowrap font-mono text-xs text-[#E0E0E0]/60">{range}</span>}
    </span>
  );
}
