"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePromo } from "@/components/usePromo";
import { BLACK_FRIDAY } from "@/lib/content/promo";

// Pasek Black Friday na gorze polskich stron (Navigation). Widoczny tylko
// w oknie promocji (lib/content/promo.ts) — wlacza i wylacza sie sam.

function left(ms: number): string {
  if (ms <= 0) return "0:00:00";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const hh = String(Math.floor((s % 86400) / 3600)).padStart(2, "0");
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return d > 0 ? `${d}d ${hh}:${mm}:${ss}` : `${hh}:${mm}:${ss}`;
}

export default function PromoBar() {
  const promo = usePromo();
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    if (!promo.timeActive) return;
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const iv = setInterval(tick, 1000);
    return () => { clearTimeout(first); clearInterval(iv); };
  }, [promo.timeActive]);

  if (!promo.timeActive || (now !== null && now >= promo.endsAt)) return null;

  const price = promo.productPln / 100;
  const regular = promo.regularPln / 100;
  const rent = BLACK_FRIDAY.rentalFeeGrosze / 100;

  return (
    <div className="bg-[#D8FF3D] text-[#0B0B0B]">
      <div className="mx-auto max-w-[1400px] px-5 lg:px-10 py-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[13px] leading-tight">
        <span className="km-mono-eyebrow font-bold">Black Friday</span>
        {promo.active ? (
          <Link href="/#kup-teraz" className="font-semibold hover:underline">
            KalkMate {price} zł <span className="line-through opacity-60 font-normal">{regular} zł</span>
            <span className="font-normal"> · zostało {promo.remaining} z {promo.unitLimit} szt.</span>
          </Link>
        ) : (
          <span className="font-semibold">Kalkulatory w cenie promocyjnej wyprzedane</span>
        )}
        <Link href="/wypozyczenie?plan=month" className="hover:underline hidden sm:inline">
          Wypożyczenie: miesiąc {rent} zł
        </Link>
        {now !== null && <span className="km-mono-eyebrow tabular-nums">Koniec za {left(promo.endsAt - now)}</span>}
        <Link href="/black-friday" className="underline opacity-70 hover:opacity-100 text-[12px]">Zasady</Link>
      </div>
    </div>
  );
}
