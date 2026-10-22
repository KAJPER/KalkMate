// Cennik zamowienia kalkulatora — JEDYNE zrodlo prawdy po stronie serwera
// (audyt 2026-10-16). Uzywany przez create-payment-intent (Stripe),
// p24/create-transaction (Przelewy24) i webhook Stripe (weryfikacja kwoty).
//
// Zasady (kontrakt K1):
//   waluta  = z KRAJU dostawy: PL -> PLN, kazdy inny -> EUR
//   produkt = 69900 groszy / 16900 centow
//   wysylka = PL 0, kraj UE 2000, reszta swiata 3500 (jednostki minimalne waluty)
// Wartosci `currency` / `shippingCents` przyslane przez klienta IGNORUJEMY —
// wczesniej dowolna waluta != eur dostawala kwote 69900 (np. 699 HUF).
//
// Do tego drobne helpery wspolne dla sciezek platnosci: numer zamowienia,
// alert do admina, notatka w zamowieniu.

import { randomInt } from "crypto";
import { prisma } from "@/lib/db";
import { sendMail, CONTACT_EMAIL } from "@/lib/mailer";
import { checkCouponForCheckout, discountForCoupon, getCoupon, type CouponReasonCode } from "@/lib/coupons";

export const EU_COUNTRIES = new Set([
  "AT","BE","BG","HR","CY","CZ","DK","EE","FI","FR","DE",
  "GR","HU","IE","IT","LV","LT","LU","MT","NL","PT","RO","SK","SI","ES","SE",
]);

export type CheckoutCurrency = "pln" | "eur";

export const PRODUCT_CENTS: Record<CheckoutCurrency, number> = { pln: 69900, eur: 16900 };

export function normalizeCountry(country: unknown): string {
  const c = String(country ?? "").trim().toUpperCase();
  return c || "PL";
}

export function currencyForCountry(country: unknown): CheckoutCurrency {
  return normalizeCountry(country) === "PL" ? "pln" : "eur";
}

export function shippingCentsForCountry(country: unknown): number {
  const c = normalizeCountry(country);
  if (c === "PL") return 0;
  return EU_COUNTRIES.has(c) ? 2000 : 3500;
}

// === Ilosc sztuk w zamowieniu ===
// Jedno zamowienie = jedna paczka (wysylka stala), 1..MAX_ORDER_QUANTITY sztuk,
// kazda z wlasna personalizacja (kod AI + imie na etykiete).
// UWAGA: ten modul importuje prisma/mailer — tylko serwer. Front trzyma
// wlasna kopie stalej (nie importowac stad w komponentach klienckich).
export const MAX_ORDER_QUANTITY = 5;

// Brak pola (undefined/null/"") = 1. Liczba calkowita (lub ciag cyfr — np.
// z metadata Stripe) w zakresie 1..MAX_ORDER_QUANTITY, inaczej blad.
export function parseOrderQuantity(raw: unknown):
  | { ok: true; quantity: number }
  | { ok: false; error: string } {
  if (raw === undefined || raw === null || raw === "") return { ok: true, quantity: 1 };
  const n = typeof raw === "number"
    ? raw
    : typeof raw === "string" && /^\s*\d{1,3}\s*$/.test(raw) ? Number(raw) : NaN;
  if (!Number.isInteger(n) || n < 1 || n > MAX_ORDER_QUANTITY) {
    return { ok: false, error: `Ilość musi być liczbą całkowitą od 1 do ${MAX_ORDER_QUANTITY}.` };
  }
  return { ok: true, quantity: n };
}

function assertQuantity(q: number | undefined): number {
  const quantity = q ?? 1;
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_ORDER_QUANTITY) {
    throw new RangeError(`Nieprawidlowa ilosc: ${String(q)}`);
  }
  return quantity;
}

export interface CheckoutQuote {
  country: string;
  currency: CheckoutCurrency;
  quantity: number;
  unitCents: number;      // cena jednej sztuki
  subtotalCents: number;  // unitCents * quantity (od tego liczony kupon)
  /** @deprecated = subtotalCents (zgodnosc wstecz) */
  productCents: number;
  shippingCents: number;  // stala na zamowienie (jedna paczka)
  discountCents: number;
  amount: number;       // subtotal - rabat + wysylka
  couponCode: string;   // znormalizowany kod albo ""
}

export type QuoteResult =
  | { ok: true; quote: CheckoutQuote }
  | { ok: false; reason: CouponReasonCode; error: string };

// Wycena zamowienia. Podany, ale nieprawidlowy kupon = blad (route zwraca 409),
// zamiast po cichu liczyc pelna cene. userId — zeby wlasne rezerwacje klienta
// (poprzednia proba platnosci) nie blokowaly mu kuponu jednorazowego.
export async function quoteCheckout(input: {
  country: unknown;
  couponCode?: unknown;
  userId?: string | null;
  quantity?: number; // zwalidowana wczesniej (parseOrderQuantity); brak = 1
}): Promise<QuoteResult> {
  const country = normalizeCountry(input.country);
  const currency = currencyForCountry(country);
  const quantity = assertQuantity(input.quantity);
  const unitCents = PRODUCT_CENTS[currency];
  const subtotalCents = unitCents * quantity;
  const shippingCents = shippingCentsForCountry(country);

  let discountCents = 0;
  let couponCode = "";
  const rawCode = input.couponCode == null ? "" : String(input.couponCode).trim();
  if (rawCode) {
    // Kupon od CALEGO subtotalu (procentowy od calosci, kwotowy raz na zamowienie).
    const disc = await checkCouponForCheckout(rawCode, subtotalCents, currency, input.userId);
    if (!disc.ok || !disc.coupon) {
      return { ok: false, reason: disc.reasonCode || "invalid", error: disc.reason || "Nieprawidlowy kupon." };
    }
    discountCents = disc.discountCents;
    couponCode = disc.coupon.code;
  }

  return {
    ok: true,
    quote: {
      country, currency, quantity, unitCents, subtotalCents,
      productCents: subtotalCents,
      shippingCents, discountCents,
      amount: subtotalCents - discountCents + shippingCents,
      couponCode,
    },
  };
}

// Oczekiwana kwota JUZ OPLACONEGO zamowienia (webhook Stripe) — z kraju i kodu
// kuponu z metadata. Bez sprawdzania active/expiresAt/maxUses kuponu (mogl
// wygasnac miedzy utworzeniem platnosci a webhookiem). couponMissing = kod byl
// w metadata, ale kuponu nie ma juz w bazie (nie da sie przeliczyc rabatu).
export async function expectedPaidAmount(country: unknown, couponCode?: string | null, quantity = 1): Promise<{
  currency: CheckoutCurrency;
  amount: number;
  discountCents: number;
  couponMissing: boolean;
}> {
  const currency = currencyForCountry(country);
  const subtotalCents = PRODUCT_CENTS[currency] * assertQuantity(quantity);
  const shippingCents = shippingCentsForCountry(country);
  let discountCents = 0;
  let couponMissing = false;
  if (couponCode && couponCode.trim()) {
    const coupon = await getCoupon(couponCode);
    const d = coupon ? discountForCoupon(coupon, subtotalCents, currency) : null;
    if (d === null) couponMissing = !coupon;
    else discountCents = d;
  }
  return { currency, amount: subtotalCents - discountCents + shippingCents, discountCents, couponMissing };
}

export function formatMinor(cents: number, currency: string): string {
  return `${(Number(cents) / 100).toFixed(2)} ${String(currency || "").toUpperCase()}`;
}

// === Numer zamowienia ===
// KM-RRRRMMDD-NNNN (format zostaje — drukuje sie na etykietach). Losowanie z
// crypto (nie Math.random); kolizje UNIQUE obsluguje wywolujacy (ponawia).
export function generateOrderNumber(): string {
  return `KM-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${randomInt(1000, 10000)}`;
}

// Naruszenie UNIQUE na danej kolumnie — Prisma ORM (P2002) i raw SQL (P2010
// z komunikatem SQLite "UNIQUE constraint failed: Order.orderNumber").
export function isUniqueViolation(e: unknown, field: string): boolean {
  const err = e as { code?: string; meta?: { target?: unknown; message?: unknown }; message?: string } | null;
  if (!err) return false;
  const target = String(err.meta?.target ?? "");
  if (err.code === "P2002" && target.includes(field)) return true;
  const msg = `${err.message ?? ""} ${String(err.meta?.message ?? "")}`;
  return /unique constraint/i.test(msg) && msg.includes(field);
}

// === Alert do admina ===
// Do tej pory w kodzie nie bylo osobnego kanalu alertow — formularz kontaktowy
// wysyla na kontakt@kalkmate.pl, wiec domyslnie tam (ADMIN_ALERT_EMAIL nadpisuje).
// Nigdy nie rzuca — alert nie moze wywrocic webhooka.
function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function alertAdmin(subject: string, lines: string[]): Promise<void> {
  const text = lines.join("\n");
  console.warn(`[ALERT] ${subject}\n${text}`);
  try {
    const to = process.env.ADMIN_ALERT_EMAIL || CONTACT_EMAIL;
    const r = await sendMail({
      to,
      subject: `[KalkMate ALERT] ${subject}`,
      html: `<pre style="font-family:Consolas,monospace;font-size:13px;white-space:pre-wrap">${escHtml(text)}</pre>`,
      text,
    });
    if (!r.ok) console.error("[alertAdmin] mail failed:", r.error);
  } catch (e) {
    console.error("[alertAdmin] mail failed:", e);
  }
}

// === Notatka w zamowieniu ===
// Dopisuje linie do Order.adminNotes. dedupeMarker (np. id zdarzenia Stripe /
// sesji P24) — jesli juz jest w notatkach, nic nie dopisujemy (powtorzony
// webhook). Zwraca true gdy dopisano.
export async function appendOrderAdminNote(orderId: string, note: string, dedupeMarker?: string): Promise<boolean> {
  const marker = dedupeMarker || "";
  const changed = await prisma.$executeRaw`
    UPDATE "Order" SET "adminNotes" = CASE
      WHEN "adminNotes" IS NULL OR "adminNotes" = '' THEN ${note}
      ELSE "adminNotes" || char(10) || ${note}
    END
    WHERE id = ${orderId}
      AND (${marker} = '' OR "adminNotes" IS NULL OR instr("adminNotes", ${marker}) = 0)`;
  return Number(changed) > 0;
}

// (Model tokenowy 2026-10: usunieto grantDevicePurchaseTrial — zakup kalkulatora
// nie daje juz triala ani tokenow; tokeny sa z licencji w pudelku.)
