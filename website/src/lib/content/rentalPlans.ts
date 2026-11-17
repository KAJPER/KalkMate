// Cennik wypozyczen — JEDNO zrodlo dla serwera (lib/rentals.ts: kwota
// platnosci), strony /wypozyczenie i wzmianek na stronie glownej
// (RentalPromo, Hero, BuyNow, FAQ). Bez importow serwerowych — mozna uzywac
// w komponentach klienckich. Ceny brutto w groszach.

import { BLACK_FRIDAY, bfActive } from "@/lib/content/promo";

export interface RentalPlan {
  id: "week" | "month" | "season";
  days: number;
  feeGrosze: number;
  label: string;
  hint: string;
  featured?: boolean;
}

export const RENTAL_PLANS: RentalPlan[] = [
  { id: "week", days: 7, feeGrosze: 7900, label: "Tydzień", hint: "Na szybką powtórkę materiału" },
  { id: "month", days: 30, feeGrosze: 14900, label: "Miesiąc", hint: "Najczęściej wybierany", featured: true },
  { id: "season", days: 60, feeGrosze: 24900, label: "2 miesiące", hint: "Na dłuższą, spokojną naukę" },
];

export const RENTAL_DEPOSIT_GROSZE = 30000;

// Cena planu teraz (Black Friday: miesiac taniej — lib/content/promo.ts).
// Uzywana przez serwer (kwota platnosci) i strone — ta sama funkcja.
export function rentalFeeNow(plan: RentalPlan, now = Date.now()): number {
  return bfActive(now) && plan.id === BLACK_FRIDAY.rentalPlanId ? BLACK_FRIDAY.rentalFeeGrosze : plan.feeGrosze;
}

// "od 79 zł" w wzmiankach na stronie.
export const RENTAL_FROM_PLN = Math.min(...RENTAL_PLANS.map((p) => p.feeGrosze)) / 100;
