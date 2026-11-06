// Cennik wypozyczen — JEDNO zrodlo dla serwera (lib/rentals.ts: kwota
// platnosci), strony /wypozyczenie i wzmianek na stronie glownej
// (RentalPromo, Hero, BuyNow, FAQ). Bez importow serwerowych — mozna uzywac
// w komponentach klienckich. Ceny brutto w groszach.

export interface RentalPlan {
  id: "week" | "month" | "season";
  days: number;
  feeGrosze: number;
  label: string;
  hint: string;
  featured?: boolean;
}

export const RENTAL_PLANS: RentalPlan[] = [
  { id: "week", days: 7, feeGrosze: 7900, label: "Tydzień", hint: "Na sprawdzian albo kartkówkę" },
  { id: "month", days: 30, feeGrosze: 14900, label: "Miesiąc", hint: "Najczęściej wybierany", featured: true },
  { id: "season", days: 60, feeGrosze: 24900, label: "2 miesiące", hint: "Cały okres matur" },
];

export const RENTAL_DEPOSIT_GROSZE = 30000;

// "od 79 zł" w wzmiankach na stronie.
export const RENTAL_FROM_PLN = Math.min(...RENTAL_PLANS.map((p) => p.feeGrosze)) / 100;
