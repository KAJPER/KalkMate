// Black Friday 2026 — JEDNO zrodlo dat, cen i limitu (bez importow serwerowych,
// wiec tez dla komponentow klienckich). Serwer: lib/promo.ts (limit sztuk z bazy,
// cena w platnosciach). Promocja w PLN (Polska) i EUR (reszta swiata), wspolna
// pula sztuk; kupony i kody partnerskie sie z nia nie lacza. Regulamin: /black-friday.
//
// Okno: 27.11.2026 00:00 – 30.11.2026 23:59:59 czasu polskiego (CET, UTC+1).

export const BLACK_FRIDAY = {
  id: "bf2026",
  startsAt: Date.parse("2026-11-27T00:00:00+01:00"),
  endsAt: Date.parse("2026-12-01T00:00:00+01:00"),   // koniec wylacznie (30.11 23:59:59)
  productPln: 54900,
  regularPln: 69900,
  productEur: 12900,
  regularEur: 16900,
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
  productEur: number;
  regularEur: number;
  unitLimit: number;
}

// Cena promocyjna sztuki w walucie (null = waluta bez promocji).
export function promoPriceFor(currency: string): number | null {
  const c = currency.toLowerCase();
  return c === "pln" ? BLACK_FRIDAY.productPln : c === "eur" ? BLACK_FRIDAY.productEur : null;
}

// Cena sztuki dla klienta (grosze/centy).
export function promoUnitCents(currency: string, regularCents: number, promo: Pick<PromoState, "active"> | null): number {
  return (promo?.active && promoPriceFor(currency)) || regularCents;
}

// Teksty paska i etykiety ceny we wszystkich jezykach strony.
export const PROMO_TEXT: Record<
  "pl" | "en" | "de" | "cs" | "sk" | "lt" | "be" | "es" | "pt" | "fr" | "it",
  { left: (n: number, of: number) => string; endsIn: string; terms: string; soldOut: string }
> = {
  pl: { left: (n, of) => `zostało ${n} z ${of} szt.`, endsIn: "Koniec za", terms: "Zasady", soldOut: "Kalkulatory w cenie promocyjnej wyprzedane" },
  en: { left: (n, of) => `${n} of ${of} left`, endsIn: "Ends in", terms: "Terms", soldOut: "Black Friday units sold out" },
  de: { left: (n, of) => `noch ${n} von ${of}`, endsIn: "Endet in", terms: "Bedingungen", soldOut: "Black-Friday-Kontingent ausverkauft" },
  cs: { left: (n, of) => `zbývá ${n} z ${of} ks`, endsIn: "Končí za", terms: "Podmínky", soldOut: "Akční kusy jsou vyprodány" },
  sk: { left: (n, of) => `zostáva ${n} z ${of} ks`, endsIn: "Končí o", terms: "Podmienky", soldOut: "Akciové kusy sú vypredané" },
  lt: { left: (n, of) => `liko ${n} iš ${of}`, endsIn: "Baigiasi po", terms: "Taisyklės", soldOut: "Akcijos prekės išparduotos" },
  be: { left: (n, of) => `засталося ${n} з ${of}`, endsIn: "Заканчваецца праз", terms: "Умовы", soldOut: "Акцыйныя штукі распрададзены" },
  es: { left: (n, of) => `quedan ${n} de ${of}`, endsIn: "Termina en", terms: "Condiciones", soldOut: "Unidades en oferta agotadas" },
  pt: { left: (n, of) => `restam ${n} de ${of}`, endsIn: "Termina em", terms: "Condições", soldOut: "Unidades em promoção esgotadas" },
  fr: { left: (n, of) => `plus que ${n} sur ${of}`, endsIn: "Fin dans", terms: "Conditions", soldOut: "Stock promo épuisé" },
  it: { left: (n, of) => `ne restano ${n} su ${of}`, endsIn: "Termina tra", terms: "Condizioni", soldOut: "Pezzi in promozione esauriti" },
};
