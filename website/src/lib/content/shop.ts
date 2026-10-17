import { type Locale } from "@/lib/i18n";

// Cennik sklepu po stronie klienta — TYLKO do wyswietlania. Autorytatywna
// kwote liczy serwer (/api/create-payment-intent, /api/p24/create-transaction)
// i zwraca ja w odpowiedzi (amount/currency/shippingCents/discountCents);
// te wartosci sa fallbackiem, gdy serwer ich (jeszcze) nie zwraca.

export type ShopCurrency = "PLN" | "EUR";

export const PRODUCT_ID = "kalkmate-v1";
export const PRODUCT_NAME = "KalkMate v3.0";

export const PRODUCT_CENTS: Record<ShopCurrency, number> = { PLN: 69900, EUR: 16900 };

/** Maks. liczba sztuk w jednym zamowieniu (klientowa kopia — serwer ma swoja). */
export const MAX_ORDER_QUANTITY = 5;

/** Ilosc przycieta do 1..max (domyslnie MAX_ORDER_QUANTITY); smieci -> 1. */
export function clampQuantity(n: unknown, max: number = MAX_ORDER_QUANTITY): number {
  const v = Math.floor(Number(n));
  if (!Number.isFinite(v) || v < 1) return 1;
  return Math.min(v, Math.max(1, max));
}

export const EU_COUNTRIES = new Set([
  "AT","BE","BG","HR","CY","CZ","DK","EE","FI","FR","DE",
  "GR","HU","IE","IT","LV","LT","LU","MT","NL","PT","RO","SK","SI","ES","SE",
]);

export function currencyForCountry(country: string): ShopCurrency {
  return country === "PL" ? "PLN" : "EUR";
}

/** Wysylka w jednostkach minimalnych: PL 0 (InPost), UE 2000, reszta swiata 3500. */
export function shippingCentsFor(country: string): number {
  if (country === "PL") return 0;
  return EU_COUNTRIES.has(country) ? 2000 : 3500;
}

/**
 * Kwota w walucie wg jezyka strony (Intl), np. "699 zł", "€169", "169 €".
 * Pelne kwoty bez groszy, chyba ze `decimals: true` (np. przycisk platnosci).
 */
export function formatMoney(
  cents: number,
  currency: string,
  lang: Locale,
  opts: { decimals?: boolean } = {},
): string {
  const cur = (currency || "PLN").toUpperCase();
  const digits = opts.decimals || cents % 100 !== 0 ? 2 : 0;
  try {
    return new Intl.NumberFormat(lang, {
      style: "currency",
      currency: cur,
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(digits)} ${cur}`;
  }
}
