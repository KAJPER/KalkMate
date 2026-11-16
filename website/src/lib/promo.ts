// Black Friday po stronie serwera: limit sztuk liczony z zamowien i cena
// w platnosciach. Daty i kwoty: lib/content/promo.ts.
//
// Limit = sztuki z zamowien PLN i EUR (wspolna pula) utworzonych w oknie
// promocji w cenie promocyjnej: oplacone + nieoplacone z OSTATNIEJ GODZINY (dluzej czekajace
// nie blokuja sztuk — inaczej seria nieoplaconych zamowien "wykupilaby" cala
// promocje). Anulowane sie nie licza.
// Platnosci Stripe tworza zamowienie dopiero po oplaceniu, wiec przy ostatnich
// sztukach moze sie sprzedac 1–2 wiecej — swiadomie, bez blokowania kasy.

import { prisma } from "@/lib/db";
import { BLACK_FRIDAY, bfActive, promoPriceFor, type PromoState } from "@/lib/content/promo";

export async function bfUnitsSold(): Promise<number> {
  const rows = await prisma.$queryRaw<{ n: number | bigint | null }[]>`
    SELECT SUM(COALESCE("quantity", 1)) AS n FROM "Order"
    WHERE "orderNumber" NOT LIKE 'KW-%'
      AND "createdAt" >= ${BLACK_FRIDAY.startsAt} AND "createdAt" < ${BLACK_FRIDAY.endsAt}
      AND ("status" = 'paid' OR ("status" = 'pending' AND "createdAt" >= ${Date.now() - 60 * 60_000}))
      AND ("fulfillmentStatus" IS NULL OR "fulfillmentStatus" <> 'cancelled')
      -- Cena promocyjna: PLN bez wysylki; EUR z wysylka (max 35 EUR) — zamowienie
      -- regularne w EUR (169 EUR/szt.) zawsze kosztuje wiecej niz ten prog.
      AND (("currency" = 'pln' AND "amount" <= ${BLACK_FRIDAY.productPln} * COALESCE("quantity", 1))
        OR ("currency" = 'eur' AND "amount" <= ${BLACK_FRIDAY.productEur} * COALESCE("quantity", 1) + 3500))
  `;
  return Number(rows[0]?.n ?? 0);
}

export async function getPromoState(now = Date.now()): Promise<PromoState> {
  const timeActive = bfActive(now);
  const sold = timeActive ? await bfUnitsSold().catch(() => 0) : 0;
  const remaining = Math.max(0, BLACK_FRIDAY.unitLimit - sold);
  return {
    active: timeActive && remaining > 0,
    timeActive,
    remaining: timeActive ? remaining : BLACK_FRIDAY.unitLimit,
    endsAt: BLACK_FRIDAY.endsAt,
    productPln: BLACK_FRIDAY.productPln,
    regularPln: BLACK_FRIDAY.regularPln,
    productEur: BLACK_FRIDAY.productEur,
    regularEur: BLACK_FRIDAY.regularEur,
    unitLimit: BLACK_FRIDAY.unitLimit,
  };
}

// Cena sztuki przy tworzeniu platnosci. Cala ilosc musi zmiescic sie w limicie
// (2 sztuki przy 1 pozostalej = cena regularna — prosto i bez dzielenia koszyka).
export async function checkoutUnitCents(currency: "pln" | "eur", quantity: number, regularCents: number): Promise<{ unitCents: number; promo: boolean }> {
  const promoCents = promoPriceFor(currency);
  if (!promoCents || !bfActive()) return { unitCents: regularCents, promo: false };
  const state = await getPromoState();
  if (state.active && state.remaining >= quantity) return { unitCents: promoCents, promo: true };
  return { unitCents: regularCents, promo: false };
}

// Webhook Stripe: cena promocyjna, jesli PaymentIntent powstal w oknie promocji
// (pi.created ze Stripe — klient go nie podrobi) i byl oznaczony jako promocyjny.
export function stripeIntentWasPromo(meta: Record<string, string>, createdUnixSec: number): boolean {
  const t = createdUnixSec * 1000;
  return meta.promo === BLACK_FRIDAY.id && t >= BLACK_FRIDAY.startsAt && t < BLACK_FRIDAY.endsAt;
}

// Strony glowne (wszystkie jezyki): ceny do Hero i do danych dla Google.
export async function homePromo(): Promise<{ hero: { pln: number; eur: number } | null; jsonLd: { pricePln: number; priceEur: number; validUntil: string } | null }> {
  const st = await getPromoState().catch(() => null);
  if (!st?.active) return { hero: null, jsonLd: null };
  return {
    hero: { pln: st.productPln, eur: st.productEur },
    jsonLd: { pricePln: st.productPln, priceEur: st.productEur, validUntil: "2026-11-30" },
  };
}
