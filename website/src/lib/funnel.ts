// Lejek zakupowy (bez cookies i danych osobowych — dziala bez zgody na
// analityke). Zdarzenia sa anonimowe: event + jezyk + kraj + typ urzadzenia
// (+ dostawca platnosci). Zadnego IP, sesji ani identyfikatorow.
//
// Tabela "FunnelEvent" tworzona surowym SQL (jak CouponReservation w
// lib/coupons.ts) — produkcyjnej bazy nie ruszamy przez prisma migrate.
// createdAt = BIGINT (ms): $queryRaw czyta INTEGER jako 32-bit i wywraca sie
// na timestampach w ms.

import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";
import { isLocale, localeFromPathname, type Locale } from "@/lib/i18n";
import { warsawDay, warsawDayStartMs } from "@/app/api/admin/_lib/stats";

/** Zdarzenia wysylane z przegladarki (/api/funnel). */
export const CLIENT_FUNNEL_EVENTS = ["view_buy", "sticky_click", "form_open", "form_submit"] as const;
/** Zdarzenia zapisywane tylko po stronie serwera. */
export const SERVER_FUNNEL_EVENTS = ["payment_start"] as const;
export type FunnelEvent = (typeof CLIENT_FUNNEL_EVENTS)[number] | (typeof SERVER_FUNNEL_EVENTS)[number];
export type FunnelDevice = "mobile" | "desktop";
/** Klucze w statystykach: zdarzenia + "paid" (oplacone zamowienia z tabeli Order). */
export type FunnelKey = FunnelEvent | "paid";
export const FUNNEL_KEYS: FunnelKey[] = ["view_buy", "sticky_click", "form_open", "form_submit", "payment_start", "paid"];

export function isClientFunnelEvent(v: unknown): v is (typeof CLIENT_FUNNEL_EVENTS)[number] {
  return typeof v === "string" && (CLIENT_FUNNEL_EVENTS as readonly string[]).includes(v);
}

export const BOT_UA = /bot|crawler|spider|crawling|headless|lighthouse|facebookexternalhit|linkedinbot|twitterbot|googlebot|bingbot|slurp|duckduckbot|baidu|yandex|semrush|ahrefs|mj12bot/i;

export function deviceFromUserAgent(ua: string | null | undefined): FunnelDevice {
  return /Mobi|Android|iPhone|iPad|iPod/i.test(ua || "") ? "mobile" : "desktop";
}

// Dla zdarzen serwerowych: urzadzenie z user-agenta, jezyk ze sciezki w
// Referer (checkout wysyla fetch ze strony landingu, np. /de) — brak -> null.
export function funnelContextFromHeaders(h: Headers): { lang: Locale | null; device: FunnelDevice } {
  let lang: Locale | null = null;
  try {
    const ref = h.get("referer");
    if (ref) lang = localeFromPathname(new URL(ref).pathname);
  } catch {
    /* zly Referer */
  }
  return { lang, device: deviceFromUserAgent(h.get("user-agent")) };
}

// Kraj: kod ISO-2 albo "OTHER"; reszta -> null.
function normCountry(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const c = v.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(c) || c === "OTHER" ? c : null;
}

let _ready = false;
async function ensureFunnelTable(): Promise<void> {
  if (_ready) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "FunnelEvent" (
      "id"        TEXT PRIMARY KEY,
      "event"     TEXT NOT NULL,
      "lang"      TEXT,
      "country"   TEXT,
      "device"    TEXT,
      "provider"  TEXT,
      "createdAt" BIGINT NOT NULL
    )`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "FunnelEvent_createdAt" ON "FunnelEvent" ("createdAt")`);
  _ready = true;
}

export interface FunnelEventInput {
  event: FunnelEvent;
  lang?: unknown;
  country?: unknown;
  device?: FunnelDevice | null;
  provider?: "stripe" | "p24" | null;
}

export async function recordFunnelEvent(e: FunnelEventInput): Promise<void> {
  await ensureFunnelTable();
  const lang = isLocale(e.lang) ? e.lang : null;
  const device = e.device === "mobile" || e.device === "desktop" ? e.device : null;
  await prisma.$executeRaw`
    INSERT INTO "FunnelEvent" ("id", "event", "lang", "country", "device", "provider", "createdAt")
    VALUES (${randomUUID()}, ${e.event}, ${lang}, ${normCountry(e.country)}, ${device}, ${e.provider ?? null}, ${Date.now()})`;
}

type Counts = Record<FunnelKey, number>;
const zero = (): Counts => ({ view_buy: 0, sticky_click: 0, form_open: 0, form_submit: 0, payment_start: 0, paid: 0 });

export interface FunnelStats {
  fromMs: number;
  toMs: number;
  days: string[]; // "YYYY-MM-DD" (Warszawa), od najstarszego
  daily: Record<string, Counts>;
  totals: Counts;
  // Oplacone zamowienia nie maja urzadzenia ani jezyka — "paid" = 0 w podzialach.
  byDevice: Record<FunnelDevice | "unknown", Counts>;
  byLang: Record<string, Counts>;
}

// Kolejne dni kalendarzowe (Warszawa) miedzy fromMs a toMs.
function dayKeys(fromMs: number, toMs: number): string[] {
  const out: string[] = [];
  const last = warsawDay(Math.max(fromMs, toMs - 1));
  let key = warsawDay(fromMs);
  for (let i = 0; i < 400; i++) {
    out.push(key);
    if (key >= last) break;
    const [y, m, d] = key.split("-").map(Number);
    key = new Date(Date.UTC(y, m - 1, d) + 86_400_000).toISOString().slice(0, 10);
  }
  return out;
}

export async function funnelStats(fromMs: number, toMs: number): Promise<FunnelStats> {
  await ensureFunnelTable();
  const days = dayKeys(fromMs, toMs);
  const daily: Record<string, Counts> = {};
  for (const d of days) daily[d] = zero();
  const totals = zero();
  const byDevice: FunnelStats["byDevice"] = { mobile: zero(), desktop: zero(), unknown: zero() };
  const byLang: Record<string, Counts> = {};

  // Grupowanie po godzinie (offset Warszawy to pelne godziny, wiec godzina
  // jednoznacznie trafia w dzien) — zamiast ciagnac kazdy wiersz.
  const rows = await prisma.$queryRaw<{ event: string; device: string | null; lang: string | null; h: bigint | number; n: bigint | number }[]>`
    SELECT "event", "device", "lang", ("createdAt" / 3600000) AS h, COUNT(*) AS n
    FROM "FunnelEvent"
    WHERE "createdAt" >= ${fromMs} AND "createdAt" < ${toMs}
    GROUP BY "event", "device", "lang", h`;
  for (const r of rows) {
    if (!(FUNNEL_KEYS as string[]).includes(r.event)) continue;
    const k = r.event as FunnelKey;
    const n = Number(r.n);
    const day = warsawDay(Number(r.h) * 3_600_000);
    if (daily[day]) daily[day][k] += n;
    totals[k] += n;
    const dev = r.device === "mobile" || r.device === "desktop" ? r.device : "unknown";
    byDevice[dev][k] += n;
    const lang = r.lang || "?";
    (byLang[lang] ??= zero())[k] += n;
  }

  // Oplacone: z tabeli Order (webhooki zostaja nietkniete). Bez anulowanych —
  // anulowane sa zawsze wczesniej zwracane (jak w /api/admin/analytics).
  const from = new Date(fromMs);
  const to = new Date(toMs);
  const paid = await prisma.order.findMany({
    where: {
      status: "paid",
      NOT: { fulfillmentStatus: "cancelled" },
      OR: [{ paidAt: { gte: from, lt: to } }, { paidAt: null, createdAt: { gte: from, lt: to } }],
    },
    select: { paidAt: true, createdAt: true },
  });
  for (const o of paid) {
    const day = warsawDay(o.paidAt ?? o.createdAt);
    if (daily[day]) daily[day].paid++;
    totals.paid++;
  }

  return { fromMs, toMs, days, daily, totals, byDevice, byLang };
}

/** Zakres "ostatnie n dni" (od 00:00 Warszawy n-1 dni temu do teraz). */
export function lastDaysRange(n: number, now: number = Date.now()): { fromMs: number; toMs: number } {
  const [y, m, d] = warsawDay(now).split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, d) - (n - 1) * 86_400_000).toISOString().slice(0, 10);
  return { fromMs: warsawDayStartMs(first), toMs: now };
}
