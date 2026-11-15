"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePromo } from "@/components/usePromo";
import { BLACK_FRIDAY, PROMO_TEXT } from "@/lib/content/promo";
import { formatMoney } from "@/lib/content/shop";
import { type Locale } from "@/lib/i18n";

// Pasek Black Friday na gorze stron (Navigation). Widoczny tylko w oknie
// promocji (lib/content/promo.ts) — wlacza i wylacza sie sam. Polska strona:
// cena w PLN + wypozyczenie; pozostale jezyki: cena w EUR.

function left(ms: number): string {
  if (ms <= 0) return "0:00:00";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const hh = String(Math.floor((s % 86400) / 3600)).padStart(2, "0");
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return d > 0 ? `${d}d ${hh}:${mm}:${ss}` : `${hh}:${mm}:${ss}`;
}

export default function PromoBar({ lang = "pl" }: { lang?: Locale }) {
  const promo = usePromo();
  const [now, setNow] = useState<number | null>(null);
  const t = PROMO_TEXT[lang];
  const pl = lang === "pl";

  useEffect(() => {
    if (!promo.timeActive) return;
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const iv = setInterval(tick, 1000);
    return () => { clearTimeout(first); clearInterval(iv); };
  }, [promo.timeActive]);

  if (!promo.timeActive || (now !== null && now >= promo.endsAt)) return null;

  const cur = pl ? "PLN" : "EUR";
  const price = formatMoney(pl ? promo.productPln : promo.productEur, cur, lang);
  const regular = formatMoney(pl ? promo.regularPln : promo.regularEur, cur, lang);
  const home = pl ? "/#kup-teraz" : `/${lang}#kup-teraz`;

  return (
    <div className="bg-[#D8FF3D] text-[#0B0B0B]">
      <div className="mx-auto max-w-[1400px] px-5 lg:px-10 py-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[13px] leading-tight">
        <span className="km-mono-eyebrow font-bold">Black Friday</span>
        {promo.active ? (
          <Link href={home} className="font-semibold hover:underline">
            KalkMate {price} <span className="line-through opacity-60 font-normal">{regular}</span>
            <span className="font-normal"> · {t.left(promo.remaining, promo.unitLimit)}</span>
          </Link>
        ) : (
          <span className="font-semibold">{t.soldOut}</span>
        )}
        {pl && (
          <Link href="/wypozyczenie?plan=month" className="hover:underline hidden sm:inline">
            Wypożyczenie: miesiąc {BLACK_FRIDAY.rentalFeeGrosze / 100} zł
          </Link>
        )}
        {now !== null && <span className="km-mono-eyebrow tabular-nums">{t.endsIn} {left(promo.endsAt - now)}</span>}
        <Link href="/black-friday" className="underline opacity-70 hover:opacity-100 text-[12px]">{t.terms}</Link>
      </div>
    </div>
  );
}
