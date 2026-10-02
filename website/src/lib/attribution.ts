// Skad przyszedl klient — zrodla ruchu (UTM, referer, gclid...) dla wizyt
// i zamowien. Wynik w /admin/analytics ("Zrodla i sprzedaz") i w szczegolach
// zamowienia.
//
// Jak zamowienie dostaje zrodlo:
//   1. Przy zgodzie na cookies analityczne przegladarka pamieta pierwsze
//      i ostatnie wejscie (localStorage "km-attr", PageTracker) i wysyla je
//      przy zamowieniu — najdokladniej (dziala tez po zmianie IP).
//   2. Bez zgody — dopasowanie po ipHash do wizyt z ostatnich 30 dni (ten sam
//      hash IP, ktorego juz uzywa licznik wizyt; bez cookies).
//
// Kolumny Visit.* i tabela OrderAttribution sa poza Prisma (raw SQL, tworzone
// leniwie), jak Order.personalizedCode — nie trzeba `prisma db push`.

import { createHash } from "crypto";
import { prisma } from "@/lib/db";

// Ten sam hash IP co w liczniku wizyt (/api/track) — bez cookies.
export function ipHashFromHeaders(h: Headers): string {
  const ip = h.get("x-forwarded-for")?.split(",")[0].trim() || h.get("x-real-ip") || "unknown";
  const salt = process.env.ANALYTICS_SALT || "kalkmate-analytics";
  return createHash("sha256").update(ip + salt).digest("hex").slice(0, 16);
}

export type Channel = "search" | "paid" | "social" | "email" | "ai" | "referral" | "direct";

export const CHANNEL_LABELS: Record<Channel, string> = {
  search: "Wyszukiwarka",
  paid: "Reklama płatna",
  social: "Social media",
  email: "E-mail",
  ai: "Czat AI",
  referral: "Polecenie (link)",
  direct: "Bezpośrednio",
};

export interface Touch {
  channel: Channel;
  source: string;      // google, tiktok, newsletter, chatgpt.com, ...
  medium?: string;     // utm_medium
  campaign?: string;   // utm_campaign
  landing?: string;    // pierwsza strona wejscia
  at?: string;         // ISO
}

export interface Attribution {
  first: Touch | null;
  last: Touch | null;
  method: "browser" | "ip" | "none";
}

const SEARCH: [RegExp, string][] = [
  [/(^|\.)google\./, "google"], [/(^|\.)bing\.com$/, "bing"], [/(^|\.)duckduckgo\.com$/, "duckduckgo"],
  [/(^|\.)yahoo\./, "yahoo"], [/(^|\.)ecosia\.org$/, "ecosia"], [/(^|\.)yandex\./, "yandex"],
  [/(^|\.)search\.brave\.com$/, "brave"], [/(^|\.)qwant\.com$/, "qwant"], [/(^|\.)startpage\.com$/, "startpage"],
];
const SOCIAL: [RegExp, string][] = [
  [/(^|\.)tiktok\.com$/, "tiktok"], [/(^|\.)instagram\.com$/, "instagram"], [/(^|\.)(facebook\.com|fb\.com|fb\.me)$/, "facebook"],
  [/(^|\.)(youtube\.com|youtu\.be)$/, "youtube"], [/(^|\.)(x\.com|twitter\.com|t\.co)$/, "x"], [/(^|\.)reddit\.com$/, "reddit"],
  [/(^|\.)linkedin\.com$/, "linkedin"], [/(^|\.)pinterest\./, "pinterest"], [/(^|\.)wykop\.pl$/, "wykop"],
  [/(^|\.)snapchat\.com$/, "snapchat"], [/(^|\.)threads\.net$/, "threads"], [/(^|\.)discord(app)?\.com$/, "discord"],
];
const AI: [RegExp, string][] = [
  [/(^|\.)(chatgpt\.com|openai\.com)$/, "chatgpt"], [/(^|\.)perplexity\.ai$/, "perplexity"],
  [/(^|\.)gemini\.google\.com$/, "gemini"], [/(^|\.)copilot\.microsoft\.com$/, "copilot"], [/(^|\.)claude\.ai$/, "claude"],
];
const EMAIL_HOSTS = /(^|\.)(mail\.google\.com|outlook\.(live|office)\.com|poczta\.(onet|wp|interia|o2)\.pl|mail\.yahoo\.com)$/;
// Powroty z bramek platnosci i nasze domeny — to nie jest nowe zrodlo.
const IGNORE = /(^|\.)(kalkmate\.(pl|eu)|przelewy24\.pl|stripe\.com|klarna\.com|checkout\.stripe\.com|localhost)$/;

function match(host: string, list: [RegExp, string][]): string | null {
  for (const [re, name] of list) if (re.test(host)) return name;
  return null;
}

const clean = (v: string | null | undefined, max = 100) =>
  (v || "").trim().toLowerCase().replace(/[^\p{L}\p{N}._\-+ ]/gu, "").slice(0, max) || undefined;

// null = wejscie wewnetrzne / powrot z platnosci (nie nadpisuje zrodla).
export function classify(search: string, referrer: string): Touch | null {
  let params: URLSearchParams;
  try { params = new URLSearchParams(search || ""); } catch { params = new URLSearchParams(); }
  let host = "";
  try { host = referrer ? new URL(referrer).hostname.toLowerCase().replace(/^www\./, "") : ""; } catch { host = ""; }

  const utmSource = clean(params.get("utm_source"));
  const utmMedium = clean(params.get("utm_medium"));
  const utmCampaign = clean(params.get("utm_campaign"));

  if (utmSource || utmMedium || utmCampaign) {
    const m = utmMedium || "";
    const s = utmSource || host || "nieznane";
    let channel: Channel = "referral";
    if (/^(cpc|ppc|paid|paidsocial|paid_social|display|ads?)$/.test(m)) channel = "paid";
    else if (/^(email|e-mail|newsletter|mail)$/.test(m) || s === "newsletter") channel = "email";
    else if (/^(social|social-media|organic_social|video)$/.test(m) || match(s + ".com", SOCIAL)) channel = "social";
    else if (match(s, AI) || match(s + ".com", AI)) channel = "ai";
    else if (/^(organic|seo)$/.test(m)) channel = "search";
    return { channel, source: s, medium: utmMedium, campaign: utmCampaign };
  }
  // Identyfikatory klikniec reklam (gdy ktos nie dodal UTM).
  if (params.get("gclid") || params.get("gbraid") || params.get("wbraid")) return { channel: "paid", source: "google", medium: "cpc" };
  if (params.get("msclkid")) return { channel: "paid", source: "bing", medium: "cpc" };
  if (params.get("ttclid")) return { channel: "paid", source: "tiktok", medium: "cpc" };
  if (params.get("fbclid")) return { channel: "social", source: "facebook" };

  if (!host) return { channel: "direct", source: "(bezpośrednio)" };
  if (IGNORE.test(host)) return null;
  const se = match(host, SEARCH);
  if (se) return { channel: "search", source: se };
  const ai = match(host, AI);
  if (ai) return { channel: "ai", source: ai };
  const so = match(host, SOCIAL);
  if (so) return { channel: "social", source: so };
  if (EMAIL_HOSTS.test(host)) return { channel: "email", source: host };
  return { channel: "referral", source: host };
}

// === Wizyty ===

let _visitCols = false;
async function ensureVisitColumns(): Promise<void> {
  if (_visitCols) return;
  const cols = await prisma.$queryRawUnsafe<{ name: string }[]>(`PRAGMA table_info("Visit")`);
  const have = new Set(cols.map((c) => c.name));
  for (const [name, type] of [["landing", "INTEGER"], ["channel", "TEXT"], ["source", "TEXT"], ["medium", "TEXT"], ["campaign", "TEXT"]]) {
    if (!have.has(name)) await prisma.$executeRawUnsafe(`ALTER TABLE "Visit" ADD COLUMN "${name}" ${type}`);
  }
  _visitCols = true;
}

export async function recordVisit(v: {
  id: string; ipHash: string; userAgent: string; referer: string | null; page: string; host: string | null;
  landing: boolean; touch: Touch | null;
}): Promise<void> {
  await ensureVisitColumns();
  // createdAt jako INTEGER ms — tak samo jak zapisuje Prisma (sortowanie/filtry).
  await prisma.$executeRaw`
    INSERT INTO "Visit" ("id", "ipHash", "userAgent", "referer", "page", "host", "createdAt",
                         "landing", "channel", "source", "medium", "campaign")
    VALUES (${v.id}, ${v.ipHash}, ${v.userAgent}, ${v.referer}, ${v.page}, ${v.host}, ${Date.now()},
            ${v.landing ? 1 : 0}, ${v.touch?.channel ?? null}, ${v.touch?.source ?? null},
            ${v.touch?.medium ?? null}, ${v.touch?.campaign ?? null})`;
}

export interface LandingVisit { ipHash: string; channel: string | null; source: string | null; campaign: string | null; createdAt: number }

export async function landingVisitsSince(sinceMs: number): Promise<LandingVisit[]> {
  await ensureVisitColumns();
  const rows = await prisma.$queryRaw<{ ipHash: string; channel: string | null; source: string | null; campaign: string | null; createdAt: number | bigint | string }[]>`
    SELECT "ipHash", "channel", "source", "campaign", "createdAt" FROM "Visit"
    WHERE "landing" = 1 AND "channel" IS NOT NULL AND "createdAt" >= ${sinceMs}`;
  return rows.map((r) => ({ ...r, createdAt: Number(r.createdAt) }));
}

// Id wizyt, ktore sa przejsciami wewnatrz strony (landing = 0) — stary wykres
// "Zrodla ruchu" liczyl ich referer (zawsze ten sam document.referrer) wiele razy.
export async function internalVisitIdsSince(sinceMs: number): Promise<Set<string>> {
  await ensureVisitColumns();
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "Visit" WHERE "landing" = 0 AND "createdAt" >= ${sinceMs}`;
  return new Set(rows.map((r) => r.id));
}

// === Zamowienia ===

let _orderTable = false;
async function ensureOrderTable(): Promise<void> {
  if (_orderTable) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "OrderAttribution" (
      "orderId"       TEXT PRIMARY KEY,
      "method"        TEXT NOT NULL,
      "firstChannel"  TEXT, "firstSource" TEXT, "firstMedium" TEXT, "firstCampaign" TEXT, "firstLanding" TEXT, "firstAt" TEXT,
      "lastChannel"   TEXT, "lastSource"  TEXT, "lastMedium"  TEXT, "lastCampaign"  TEXT, "lastLanding"  TEXT, "lastAt"  TEXT
    )`);
  _orderTable = true;
}

const CHANNELS = new Set(Object.keys(CHANNEL_LABELS));

function sanitizeTouch(raw: unknown): Touch | null {
  const t = raw as Record<string, unknown> | null;
  if (!t || typeof t !== "object" || typeof t.channel !== "string" || !CHANNELS.has(t.channel)) return null;
  const s = (v: unknown, max = 100) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined);
  return {
    channel: t.channel as Channel,
    source: s(t.source) || "nieznane",
    medium: s(t.medium),
    campaign: s(t.campaign),
    landing: s(t.landing, 200),
    at: s(t.at, 40),
  };
}

// Zrodlo zamowienia: dane z przegladarki (gdy byla zgoda) albo dopasowanie po
// ipHash do wizyt z ostatnich 30 dni.
export async function resolveAttribution(clientRaw: unknown, ipHash: string): Promise<Attribution> {
  const c = (clientRaw || {}) as Record<string, unknown>;
  const first = sanitizeTouch(c.first);
  const last = sanitizeTouch(c.last);
  if (first || last) return { first: first || last, last: last || first, method: "browser" };

  await ensureVisitColumns();
  const since = Date.now() - 30 * 86400_000;
  const rows = await prisma.$queryRaw<{ channel: string; source: string | null; medium: string | null; campaign: string | null; page: string; createdAt: number | bigint }[]>`
    SELECT "channel", "source", "medium", "campaign", "page", "createdAt" FROM "Visit"
    WHERE "ipHash" = ${ipHash} AND "landing" = 1 AND "channel" IS NOT NULL AND "createdAt" >= ${since}
    ORDER BY "createdAt" ASC`;
  if (!rows.length) return { first: null, last: null, method: "none" };
  const toTouch = (r: (typeof rows)[number]): Touch => ({
    channel: r.channel as Channel, source: r.source || "nieznane", medium: r.medium || undefined,
    campaign: r.campaign || undefined, landing: r.page, at: new Date(Number(r.createdAt)).toISOString(),
  });
  // "Ostatnie" = ostatnie wejscie inne niz bezposrednie (standard last non-direct),
  // bo powrot z zakladki/maila potwierdzajacego nie jest zrodlem sprzedazy.
  const nonDirect = rows.filter((r) => r.channel !== "direct");
  return {
    first: toTouch(rows[0]),
    last: toTouch(nonDirect.length ? nonDirect[nonDirect.length - 1] : rows[rows.length - 1]),
    method: "ip",
  };
}

export async function saveOrderAttribution(orderId: string, a: Attribution): Promise<void> {
  if (!a.first && !a.last) return;
  await ensureOrderTable();
  const f = a.first, l = a.last;
  await prisma.$executeRaw`
    INSERT OR REPLACE INTO "OrderAttribution" ("orderId", "method",
      "firstChannel", "firstSource", "firstMedium", "firstCampaign", "firstLanding", "firstAt",
      "lastChannel", "lastSource", "lastMedium", "lastCampaign", "lastLanding", "lastAt")
    VALUES (${orderId}, ${a.method},
      ${f?.channel ?? null}, ${f?.source ?? null}, ${f?.medium ?? null}, ${f?.campaign ?? null}, ${f?.landing ?? null}, ${f?.at ?? null},
      ${l?.channel ?? null}, ${l?.source ?? null}, ${l?.medium ?? null}, ${l?.campaign ?? null}, ${l?.landing ?? null}, ${l?.at ?? null})`;
}

// Stripe: zamowienie powstaje dopiero w webhooku, wiec zrodlo jedzie w metadata
// PaymentIntentu (limit 500 znakow na wartosc).
export function attributionToMetadata(a: Attribution): string {
  const short = (t: Touch | null) => t && { c: t.channel, s: t.source, m: t.medium, k: t.campaign, l: t.landing?.slice(0, 60), a: t.at };
  let json = JSON.stringify({ f: short(a.first), l: short(a.last), m: a.method });
  if (json.length > 500) json = JSON.stringify({ f: short(a.first && { ...a.first, landing: undefined }), l: short(a.last && { ...a.last, landing: undefined }), m: a.method }).slice(0, 500);
  return json;
}

export function attributionFromMetadata(raw: string | undefined): Attribution | null {
  if (!raw) return null;
  try {
    const j = JSON.parse(raw);
    const long = (t: Record<string, string> | null) => t && sanitizeTouch({ channel: t.c, source: t.s, medium: t.m, campaign: t.k, landing: t.l, at: t.a });
    const method = j.m === "browser" || j.m === "ip" ? j.m : "none";
    return { first: long(j.f), last: long(j.l), method };
  } catch {
    return null;
  }
}

export interface OrderAttributionRow {
  orderId: string; method: string;
  firstChannel: string | null; firstSource: string | null; firstCampaign: string | null; firstLanding: string | null; firstAt: string | null;
  lastChannel: string | null; lastSource: string | null; lastMedium: string | null; lastCampaign: string | null; lastLanding: string | null; lastAt: string | null;
}

export async function getOrderAttribution(orderId: string): Promise<OrderAttributionRow | null> {
  await ensureOrderTable();
  const rows = await prisma.$queryRaw<OrderAttributionRow[]>`SELECT * FROM "OrderAttribution" WHERE "orderId" = ${orderId}`;
  return rows[0] ?? null;
}

// Oplacone zamowienia z okresu + ich zrodlo (do raportu w /admin/analytics).
export async function paidOrdersWithAttribution(sinceMs: number) {
  await ensureOrderTable();
  return prisma.$queryRaw<{
    id: string; amount: number; currency: string;
    firstChannel: string | null; firstSource: string | null;
    lastChannel: string | null; lastSource: string | null; lastCampaign: string | null;
  }[]>`
    SELECT o.id, o.amount, o.currency, a."firstChannel", a."firstSource", a."lastChannel", a."lastSource", a."lastCampaign"
    FROM "Order" o LEFT JOIN "OrderAttribution" a ON a."orderId" = o.id
    WHERE o.status = 'paid' AND (
      (typeof(o."paidAt") IN ('integer', 'real') AND o."paidAt" >= ${sinceMs})
      OR (typeof(o."paidAt") = 'text' AND o."paidAt" >= ${new Date(sinceMs).toISOString()})
    )`;
}
