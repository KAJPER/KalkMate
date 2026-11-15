// Black Friday po stronie serwera: limit sztuk liczony z zamowien i cena
// w platnosciach. Daty i kwoty: lib/content/promo.ts.
//
// Limit = sztuki z zamowien PLN utworzonych w oknie promocji w cenie
// promocyjnej: oplacone + nieoplacone z OSTATNIEJ GODZINY (dluzej czekajace
// nie blokuja sztuk — inaczej seria nieoplaconych zamowien "wykupilaby" cala
// promocje). Anulowane sie nie licza.
// Platnosci Stripe tworza zamowienie dopiero po oplaceniu, wiec przy ostatnich
// sztukach moze sie sprzedac 1–2 wiecej — swiadomie, bez blokowania kasy.

import { prisma } from "@/lib/db";
import { BLACK_FRIDAY, bfActive, type PromoState } from "@/lib/content/promo";

export async function bfUnitsSold(): Promise<number> {
  const rows = await prisma.$queryRaw<{ n: number | bigint | null }[]>`
    SELECT SUM(COALESCE("quantity", 1)) AS n FROM "Order"
    WHERE "currency" = 'pln'
      AND "orderNumber" NOT LIKE 'KW-%'
      AND "createdAt" >= ${BLACK_FRIDAY.startsAt} AND "createdAt" < ${BLACK_FRIDAY.endsAt}
      AND ("status" = 'paid' OR ("status" = 'pending' AND "createdAt" >= ${Date.now() - 60 * 60_000}))
      AND ("fulfillmentStatus" IS NULL OR "fulfillmentStatus" <> 'cancelled')
      AND "amount" + 0 <= ${BLACK_FRIDAY.productPln} * COALESCE("quantity", 1)
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
    unitLimit: BLACK_FRIDAY.unitLimit,
  };
}

// Cena sztuki przy tworzeniu platnosci. Cala ilosc musi zmiescic sie w limicie
// (2 sztuki przy 1 pozostalej = cena regularna — prosto i bez dzielenia koszyka).
export async function checkoutUnitCents(currency: "pln" | "eur", quantity: number, regularCents: number): Promise<{ unitCents: number; promo: boolean }> {
  if (currency !== "pln" || !bfActive()) return { unitCents: regularCents, promo: false };
  const state = await getPromoState();
  if (state.active && state.remaining >= quantity) return { unitCents: BLACK_FRIDAY.productPln, promo: true };
  return { unitCents: regularCents, promo: false };
}

// Webhook Stripe: cena promocyjna, jesli PaymentIntent powstal w oknie promocji
// (pi.created ze Stripe — klient go nie podrobi) i byl oznaczony jako promocyjny.
export function stripeIntentWasPromo(meta: Record<string, string>, createdUnixSec: number): boolean {
  const t = createdUnixSec * 1000;
  return meta.promo === BLACK_FRIDAY.id && t >= BLACK_FRIDAY.startsAt && t < BLACK_FRIDAY.endsAt;
}
