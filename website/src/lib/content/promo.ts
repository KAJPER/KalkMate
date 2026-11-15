// Black Friday 2026 — JEDNO zrodlo dat, cen i limitu (bez importow serwerowych,
// wiec tez dla komponentow klienckich). Serwer: lib/promo.ts (limit sztuk z bazy,
// cena w platnosciach). Promocja tylko w PLN (Polska); kupony i kody partnerskie
// sie z nia nie lacza. Regulamin: /black-friday.
//
// Okno: 27.11.2026 00:00 – 30.11.2026 23:59:59 czasu polskiego (CET, UTC+1).

export const BLACK_FRIDAY = {
  id: "bf2026",
  startsAt: Date.parse("2026-11-27T00:00:00+01:00"),
  endsAt: Date.parse("2026-12-01T00:00:00+01:00"),   // koniec wylacznie (30.11 23:59:59)
  productPln: 54900,
  regularPln: 69900,
  unitLimit: 50,
  // Wypozyczenie (lib/content/rentalPlans.ts): miesiac za 99 zl zamiast 149 zl.
  rentalPlanId: "month",
  rentalFeeGrosze: 9900,
} as const;

export function bfActive(now = Date.now()): boolean {
  return now >= BLACK_FRIDAY.startsAt && now < BLACK_FRIDAY.endsAt;
}

// Stan promocji widoczny dla przegladarki (GET /api/promo).
export interface PromoState {
  active: boolean;        // trwa i sa jeszcze sztuki
  timeActive: boolean;    // trwa wg dat (rowniez gdy sztuki sie skonczyly)
  remaining: number;      // pozostale sztuki w cenie promocyjnej
  endsAt: number;
  productPln: number;
  regularPln: number;
  unitLimit: number;
}

// Cena sztuki dla klienta (grosze/centy). Tylko PLN dostaje cene promocyjna.
export function promoUnitCents(currency: string, regularCents: number, promo: Pick<PromoState, "active"> | null): number {
  return promo?.active && currency.toLowerCase() === "pln" ? BLACK_FRIDAY.productPln : regularCents;
}
