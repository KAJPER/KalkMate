// Newsletter z /admin/newsletter — wysylka do zarejestrowanych uzytkownikow
// i kupujacych (oplacone zamowienia / tokeny), z noreply@ przez lib/mailer.
//
// Tabele poza Prisma (raw SQL, tworzone leniwie — jak AdminSession,
// TokenPurchase), wiec nie trzeba `prisma db push`:
//   NewsletterUnsubscribe — wypisani (sprawdzane przy KAZDEJ wysylce)
//   NewsletterCampaign    — wyslane kampanie (tresc + postep)
//   NewsletterDelivery    — kazdy odbiorca kampanii osobno (pending/sent/failed),
//                           dzieki czemu po restarcie serwera mozna wznowic
//   MarketingConsent      — zgody na mail marketingowy (art. 398 PKE / RODO
//                           art. 6.1.a): kiedy, skad, jaka tresc zgody, IP —
//                           dowod zgody. Wycofanie = withdrawnAt (wiersz zostaje).
//
// Wysylka idzie w tle w procesie Next (systemd, dlugo zyjacy), po jednym
// mailu co NEWSLETTER_DELAY_MS — hosting SMTP ma limity godzinowe, a seria
// setek maili naraz konczy sie blokada konta / spamem.

import { randomUUID } from "crypto";
import { signLink, verifyLink } from "@/lib/linkTokens";
import { prisma } from "@/lib/db";
import { sendMail } from "@/lib/mailer";
import { newsletterEmail, EMAIL_LOCALES, type EmailLocale, type NewsletterContent } from "@/lib/email-templates";
import { SITE_URL } from "@/lib/i18n";
import { translateNewsletter, type NewsletterTexts } from "@/lib/translate";

const DELAY_MS = Math.max(200, parseInt(process.env.NEWSLETTER_DELAY_MS || "2500", 10) || 2500);

// Przejsciowe bledy SMTP (4xx, zerwane polaczenie, timeout): ponowienie tego
// samego odbiorcy z rosnacym odstepem, dopiero potem 'failed'. Seria bledow z
// rzedu = problem z kontem/serwerem SMTP, nie z adresami -> auto-pauza.
const MAX_ATTEMPTS = 3;
const RETRY_BACKOFF_MS = [30_000, 120_000];
const MAX_CONSECUTIVE_ERRORS = 5;

// Stan workerow wspolny dla calego procesu (modul moze byc zaladowany w kilku
// bundlach route'ow Next — patrz tez prisma w lib/db.ts).
const nlState = ((globalThis as unknown as { __kmNewsletter?: { running: Set<string>; stopRequested: Set<string>; recovered: boolean } })
  .__kmNewsletter ??= { running: new Set<string>(), stopRequested: new Set<string>(), recovered: false });

export function isTransientSmtpError(message: string | undefined | null): boolean {
  const m = message || "";
  if (/\b4\d\d[\s-]/.test(m) || /\b4\.\d{1,3}\.\d{1,3}\b/.test(m)) return true;
  return /ECONN|ETIMEDOUT|ESOCKET|EAI_AGAIN|ENOTFOUND|EPIPE|ECONNRESET|EAUTH|timeout|timed out|greeting never received|socket|connection (closed|lost)|too many (connections|messages)|try again/i.test(m);
}

// === Wypisywanie ===

export function unsubscribeToken(email: string): string {
  return signLink("unsub", email.toLowerCase());
}

export function verifyUnsubscribeToken(email: string, token: string): boolean {
  return verifyLink("unsub", email.toLowerCase(), token);
}

export function unsubscribeUrl(email: string): string {
  return `${SITE_URL}/api/newsletter/unsubscribe?e=${encodeURIComponent(email.toLowerCase())}&t=${unsubscribeToken(email)}`;
}

let _ready = false;
async function ensureTables(): Promise<void> {
  if (_ready) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "NewsletterUnsubscribe" (
      "email"     TEXT PRIMARY KEY,
      "createdAt" TEXT NOT NULL
    )`);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "NewsletterCampaign" (
      "id"         TEXT PRIMARY KEY,
      "subject"    TEXT NOT NULL,
      "content"    TEXT NOT NULL,
      "audience"   TEXT NOT NULL,
      "status"     TEXT NOT NULL,
      "total"      INTEGER NOT NULL DEFAULT 0,
      "createdAt"  TEXT NOT NULL,
      "finishedAt" TEXT
    )`);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "NewsletterDelivery" (
      "campaignId" TEXT NOT NULL,
      "email"      TEXT NOT NULL,
      "name"       TEXT,
      "status"     TEXT NOT NULL DEFAULT 'pending',
      "error"      TEXT,
      "sentAt"     TEXT,
      PRIMARY KEY ("campaignId", "email")
    )`);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "MarketingConsent" (
      "email"       TEXT PRIMARY KEY,
      "consentedAt" TEXT NOT NULL,
      "source"      TEXT NOT NULL,
      "consentText" TEXT NOT NULL,
      "ip"          TEXT,
      "withdrawnAt" TEXT
    )`);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "UserLanguage" (
      "email"     TEXT PRIMARY KEY,
      "lang"      TEXT NOT NULL,
      "updatedAt" TEXT NOT NULL
    )`);
  const cols = await prisma.$queryRawUnsafe<{ name: string }[]>(`PRAGMA table_info("NewsletterDelivery")`);
  if (!cols.some((c) => c.name === "lang")) {
    await prisma.$executeRawUnsafe(`ALTER TABLE "NewsletterDelivery" ADD COLUMN "lang" TEXT`);
  }
  // pauseReason — dlaczego kampania stoi ('paused'): auto-pauza po serii
  // bledow SMTP albo restart serwera. clientRequestId — idempotencja POST
  // (podwojne klikniecie "Wyslij" nie tworzy dwoch kampanii).
  const campCols = await prisma.$queryRawUnsafe<{ name: string }[]>(`PRAGMA table_info("NewsletterCampaign")`);
  for (const [name, type] of [["pauseReason", "TEXT"], ["clientRequestId", "TEXT"]] as const) {
    if (campCols.some((c) => c.name === name)) continue;
    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE "NewsletterCampaign" ADD COLUMN "${name}" ${type}`);
    } catch (e) {
      if (!/duplicate column/i.test(String((e as Error)?.message))) throw e;
    }
  }
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "NewsletterCampaign_clientRequestId"
    ON "NewsletterCampaign" ("clientRequestId") WHERE "clientRequestId" IS NOT NULL`);
  _ready = true;
  await recoverOrphanedCampaigns();
}

// Przy pierwszym uzyciu modulu w procesie: kampanie 'sending' nie maja tu
// workera (serwer zrestartowal sie w trakcie wysylki) — oznaczamy je jako
// wstrzymane, admin wznawia recznie ("Wznow"). Flaga na globalThis, bo modul
// moze byc zaladowany w kilku bundlach route'ow tego samego procesu.
async function recoverOrphanedCampaigns(): Promise<void> {
  if (nlState.recovered) return;
  nlState.recovered = true;
  try {
    const n = await prisma.$executeRaw`
      UPDATE "NewsletterCampaign" SET "status" = 'paused',
        "pauseReason" = 'Przerwana restartem serwera — sprawdź postęp i wznów ręcznie.'
      WHERE "status" = 'sending'`;
    if (n) console.warn(`[newsletter] ${n} kampanii 'sending' bez workera po starcie procesu -> 'paused'`);
  } catch (e) {
    console.error("[newsletter] recovery of orphaned campaigns failed:", e);
  }
}

// Wypisanie z newslettera = tez wycofanie zgody marketingowej.
export async function addUnsubscribe(email: string): Promise<void> {
  await ensureTables();
  const now = new Date().toISOString();
  await prisma.$executeRaw`
    INSERT OR IGNORE INTO "NewsletterUnsubscribe" ("email", "createdAt")
    VALUES (${email.toLowerCase()}, ${now})`;
  await prisma.$executeRaw`
    UPDATE "MarketingConsent" SET "withdrawnAt" = ${now}
    WHERE "email" = ${email.toLowerCase()} AND "withdrawnAt" IS NULL`;
}

// === Zgoda marketingowa ===

// Tresc zgody zapisywana przy kazdym wierszu — jesli kiedys zmienisz brzmienie
// checkboxa, zmien tez to (i podbij wersje), zeby dowod zgadzal sie z tym,
// co klient faktycznie zaznaczyl.
export const CONSENT_TEXT =
  "v1: Chcę dostawać e-mailem informacje o nowościach, promocjach i kuponach KalkMate (newsletter). Zgodę mogę wycofać w każdej chwili.";

export type ConsentSource = "register" | "order" | "panel";

// Wyrazenie zgody. Zdejmuje tez adres z listy wypisanych — to swiezy,
// wyrazny opt-in tej osoby.
export async function giveConsent(email: string, source: ConsentSource, ip?: string | null): Promise<void> {
  await ensureTables();
  const e = email.trim().toLowerCase();
  if (!EMAIL_RE.test(e)) return;
  const now = new Date().toISOString();
  await prisma.$executeRaw`
    INSERT INTO "MarketingConsent" ("email", "consentedAt", "source", "consentText", "ip", "withdrawnAt")
    VALUES (${e}, ${now}, ${source}, ${CONSENT_TEXT}, ${ip || null}, NULL)
    ON CONFLICT("email") DO UPDATE SET
      "consentedAt" = excluded."consentedAt", "source" = excluded."source",
      "consentText" = excluded."consentText", "ip" = excluded."ip", "withdrawnAt" = NULL`;
  await prisma.$executeRaw`DELETE FROM "NewsletterUnsubscribe" WHERE "email" = ${e}`;
}

export async function withdrawConsent(email: string): Promise<void> {
  await addUnsubscribe(email);
}

export async function consentStatus(email: string): Promise<{ consent: boolean; consentedAt: string | null }> {
  await ensureTables();
  const rows = await prisma.$queryRaw<{ consentedAt: string }[]>`
    SELECT "consentedAt" FROM "MarketingConsent"
    WHERE "email" = ${email.trim().toLowerCase()} AND "withdrawnAt" IS NULL`;
  return { consent: rows.length > 0, consentedAt: rows[0]?.consentedAt ?? null };
}

async function consentedSet(): Promise<Set<string>> {
  await ensureTables();
  const rows = await prisma.$queryRaw<{ email: string }[]>`
    SELECT "email" FROM "MarketingConsent" WHERE "withdrawnAt" IS NULL`;
  return new Set(rows.map((r) => r.email));
}

export async function removeUnsubscribe(email: string): Promise<void> {
  await ensureTables();
  await prisma.$executeRaw`DELETE FROM "NewsletterUnsubscribe" WHERE "email" = ${email.toLowerCase()}`;
}

async function unsubscribedSet(): Promise<Set<string>> {
  await ensureTables();
  const rows = await prisma.$queryRaw<{ email: string }[]>`SELECT "email" FROM "NewsletterUnsubscribe"`;
  return new Set(rows.map((r) => r.email));
}

// === Odbiorcy ===

export interface AudienceFilter {
  registered: boolean;   // konta na kalkmate.pl
  verifiedOnly: boolean; // ...tylko z potwierdzonym e-mailem
  buyers: boolean;       // oplacone zamowienia urzadzenia + zakupy tokenow
  country: "all" | "PL" | "foreign"; // wg kraju zamowienia (konta bez zamowien = brak kraju)
  consentOnly: boolean;  // tylko osoby z aktywna zgoda marketingowa
}

export interface Recipient {
  email: string;
  name: string | null;
  registered: boolean;
  buyer: boolean;
  country: string | null;
  unsubscribed: boolean;
  consent: boolean;
  lang: NlLang;
}

// === Jezyk odbiorcy ===
// Admin pisze po polsku; odbiorca dostaje wersje w swoim jezyku (wszystkie
// jezyki strony, lib/i18n.ts). Kolejnosc zrodel: kraj z zamowienia, koncowka
// domeny e-mail, jezyk przegladarki zapisany przy rejestracji (UserLanguage),
// domyslnie PL. Kraj: PL->pl, DE/AT/CH/LI->de, CZ->cs, SK->sk, LT->lt, ES->es,
// PT->pt, FR/BE/LU->fr, IT->it, reszta swiata->en. Bialorus nie jest krajem
// wysylki — "be" tylko z domeny .by albo z przegladarki.
export type NlLang = EmailLocale;
export const NL_LANGS: readonly NlLang[] = EMAIL_LOCALES;
/** Jezyki, na ktore tlumaczymy polska tresc (wszystkie poza pl). */
export const NL_TRANSLATED_LANGS = NL_LANGS.filter((l): l is Exclude<NlLang, "pl"> => l !== "pl");
export type NlTranslatedLang = Exclude<NlLang, "pl">;
export const GERMAN_COUNTRIES = new Set(["DE", "AT", "CH", "LI"]);
const COUNTRY_LANG: Record<string, NlLang> = {
  PL: "pl", CZ: "cs", SK: "sk", LT: "lt", ES: "es", PT: "pt",
  FR: "fr", BE: "fr", LU: "fr", IT: "it",
};
const TLD_LANG: Record<string, NlLang> = {
  pl: "pl", de: "de", at: "de", ch: "de", li: "de", cz: "cs", sk: "sk", lt: "lt",
  by: "be", es: "es", pt: "pt", fr: "fr", be: "fr", lu: "fr", it: "it",
};
const GENERIC_TLDS = new Set(["com", "net", "org", "eu", "io", "info", "me", "co", "app", "dev", "edu", "biz", "xyz", "online"]);

export function isNlLang(v: unknown): v is NlLang {
  return typeof v === "string" && (NL_LANGS as readonly string[]).includes(v);
}

export function langForCountry(country: string | null | undefined): NlLang | null {
  const c = (country || "").toUpperCase();
  if (!c) return null;
  if (GERMAN_COUNTRIES.has(c)) return "de";
  return COUNTRY_LANG[c] ?? "en";
}

function langForEmail(email: string): NlLang | null {
  const tld = email.split(".").pop()?.toLowerCase() || "";
  if (TLD_LANG[tld]) return TLD_LANG[tld];
  if (tld.length === 2 && !GENERIC_TLDS.has(tld)) return "en";
  return null;
}

// Wolane przy rejestracji (naglowek Accept-Language) — dla kont bez zamowien
// to jedyna wskazowka, w jakim jezyku pisac.
export async function rememberUserLanguage(email: string, acceptLanguage: string | null | undefined): Promise<void> {
  const primary = (acceptLanguage || "").split(",")[0]?.trim().toLowerCase() || "";
  if (!primary) return;
  const tag = primary.split(";")[0].split(/[-_]/)[0];
  const lang: NlLang = isNlLang(tag) ? tag : "en";
  await ensureTables();
  await prisma.$executeRaw`
    INSERT INTO "UserLanguage" ("email", "lang", "updatedAt") VALUES (${email.toLowerCase()}, ${lang}, ${new Date().toISOString()})
    ON CONFLICT("email") DO UPDATE SET "lang" = excluded."lang", "updatedAt" = excluded."updatedAt"`;
}

async function userLanguages(): Promise<Map<string, NlLang>> {
  await ensureTables();
  const rows = await prisma.$queryRaw<{ email: string; lang: NlLang }[]>`SELECT "email", "lang" FROM "UserLanguage"`;
  return new Map(rows.map((r) => [r.email, r.lang]));
}

const EMAIL_RE = /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/;

// Wszyscy potencjalni odbiorcy (z flaga `unsubscribed`) — lista w panelu
// pokazuje tez wypisanych, wysylka ich pomija.
export async function listRecipients(filter: AudienceFilter): Promise<Recipient[]> {
  const unsub = await unsubscribedSet();
  const consented = await consentedSet();
  const regLangs = await userLanguages();
  const map = new Map<string, Recipient>();
  const upsert = (email: string, patch: Partial<Recipient>) => {
    const key = email.trim().toLowerCase();
    if (!EMAIL_RE.test(key)) return;
    const cur = map.get(key) || {
      email: key, name: null, registered: false, buyer: false, country: null,
      unsubscribed: unsub.has(key), consent: consented.has(key), lang: "pl" as NlLang,
    };
    map.set(key, {
      ...cur,
      ...patch,
      name: cur.name || patch.name || null,
      country: cur.country || patch.country || null,
      registered: cur.registered || !!patch.registered,
      buyer: cur.buyer || !!patch.buyer,
    });
  };

  // Kupujacy liczeni zawsze (do kolumny "kupil" i kraju), filtr nizej.
  const orders = await prisma.order.findMany({
    where: { status: "paid" },
    select: { customerEmail: true, customerName: true, customerCountry: true },
    orderBy: { createdAt: "desc" },
  });
  const buyerEmails = new Set<string>();
  for (const o of orders) {
    buyerEmails.add(o.customerEmail.trim().toLowerCase());
    if (filter.buyers) upsert(o.customerEmail, { name: o.customerName, country: o.customerCountry, buyer: true });
  }
  try {
    const tokenBuyers = await prisma.$queryRaw<{ email: string; name: string | null }[]>`
      SELECT DISTINCT u."email" AS email, u."name" AS name
      FROM "TokenPurchase" t JOIN "User" u ON u."id" = t."userId"
      WHERE t."status" = 'paid'`;
    for (const t of tokenBuyers) {
      buyerEmails.add(t.email.trim().toLowerCase());
      if (filter.buyers) upsert(t.email, { name: t.name, buyer: true });
    }
  } catch {
    // tabela TokenPurchase powstaje dopiero przy pierwszym zakupie tokenow
  }

  if (filter.registered) {
    const users = await prisma.user.findMany({
      where: filter.verifiedOnly ? { emailVerified: { not: null } } : {},
      select: { email: true, name: true },
    });
    for (const u of users) upsert(u.email, { name: u.name, registered: true, buyer: buyerEmails.has(u.email.trim().toLowerCase()) });
  }

  let list = Array.from(map.values()).map((r) => ({
    ...r,
    lang: langForCountry(r.country) || langForEmail(r.email) || regLangs.get(r.email) || ("pl" as NlLang),
  }));
  if (filter.country === "PL") list = list.filter((r) => r.country === "PL");
  if (filter.country === "foreign") list = list.filter((r) => r.country && r.country !== "PL");
  if (filter.consentOnly) list = list.filter((r) => r.consent);
  return list.sort((a, b) => a.email.localeCompare(b.email));
}

// === Tresc ===

export interface CampaignContent extends Omit<NewsletterContent, "unsubscribeUrl" | "imageSrc"> {
  subject: string;
  image?: { filename: string; contentType: string; data: string } | null; // base64
  // Tlumaczenia polskiej tresci (AI, poprawiane recznie w panelu).
  translations?: Partial<Record<NlTranslatedLang, NewsletterTexts>>;
}

export function sourceTexts(c: CampaignContent): NewsletterTexts {
  return {
    subject: c.subject || "", preheader: c.preheader || "", eyebrow: c.eyebrow || "",
    title: c.title || "", body: c.body || "", ctaText: c.ctaText || "",
  };
}

// Brakujace tlumaczenia (np. wysylka bez klikniecia "Przetlumacz") robi serwer.
export async function ensureTranslations(c: CampaignContent, langs: NlLang[]): Promise<CampaignContent> {
  const translations = { ...(c.translations || {}) };
  // Rownolegle — przy 10 jezykach sekwencyjnie trwaloby to kilka minut.
  const missing = Array.from(new Set(langs)).filter(
    (l): l is NlTranslatedLang => l !== "pl" && !translations[l as NlTranslatedLang]?.body,
  );
  const done = await Promise.all(missing.map((l) => translateNewsletter(sourceTexts(c), l)));
  missing.forEach((l, i) => { translations[l] = done[i]; });
  return { ...c, translations };
}

function contentFor(c: CampaignContent, lang: NlLang): CampaignContent {
  const t = lang === "pl" ? null : c.translations?.[lang];
  if (!t) return c;
  return {
    ...c, subject: t.subject || c.subject, preheader: t.preheader || undefined, eyebrow: t.eyebrow || undefined,
    title: t.title || c.title, body: t.body || c.body, ctaText: t.ctaText || undefined,
  };
}

// Link do strony glownej / pomocy -> wersja jezykowa (/en, /de, /cs, /sk, ...).
function localizeLinks(html: string, lang: NlLang): string {
  if (lang === "pl") return html;
  return html.replace(/href="https:\/\/(www\.)?kalkmate\.pl(\/pomoc)?\/?((?:\?|#)[^"]*)?"/g, (_m, www, pomoc, rest) =>
    `href="https://${www || ""}kalkmate.pl/${lang}${pomoc || ""}${rest || ""}"`);
}

const IMAGE_CID = "newsletter-image@kalkmate.pl";

// {{imie}} / {{name}} -> imie odbiorcy (pierwszy czlon), a gdy go brak — pusto
// i sprzatamy osierocony przecinek ("Czesc {{imie}}," -> "Czesc,").
function personalize(text: string, name: string | null): string {
  const first = (name || "").trim().split(/\s+/)[0] || "";
  return text
    .replace(/[ \t]*\{\{\s*(imie|imię|name)\s*\}\}/gi, first ? ` ${first}` : "")
    .replace(/^ /gm, "");
}

// UTM do linkow na nasza strone — w /admin/analytics widac potem wejscia
// i zamowienia z kazdej kampanii (lib/attribution.ts). Bez /api/ (wypis) i bez
// linkow, ktore juz maja wlasne utm_.
function campaignSlug(subject: string): string {
  return subject.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ł/g, "l")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "newsletter";
}

export function addUtm(html: string, campaign: string): string {
  return html.replace(/href="(https:\/\/(?:www\.)?kalkmate\.(?:pl|eu)(?:\/[^"]*)?)"/g, (m, url: string) => {
    if (/\/api\//.test(url) || /[?&]utm_/.test(url.replace(/&amp;/g, "&"))) return m;
    const [base, hash = ""] = url.split("#");
    const sep = base.includes("?") ? "&amp;" : "?";
    return `href="${base}${sep}utm_source=newsletter&amp;utm_medium=email&amp;utm_campaign=${campaign}${hash ? "#" + hash : ""}"`;
  });
}

export function buildMail(source: CampaignContent, to: string, name: string | null, lang: NlLang = "pl") {
  const content = contentFor(source, lang);
  const p = (s?: string) => (s ? personalize(s, name) : s);
  const html = addUtm(localizeLinks(newsletterEmail({
    ...content,
    lang,
    title: p(content.title) || "",
    body: p(content.body) || "",
    preheader: p(content.preheader),
    imageSrc: content.image ? `cid:${IMAGE_CID}` : undefined,
    unsubscribeUrl: unsubscribeUrl(to),
  }), lang), campaignSlug(source.subject));
  const unsub = unsubscribeUrl(to);
  return {
    to,
    subject: p(content.subject) || content.subject,
    html,
    headers: {
      // RFC 8058 — przycisk "Wypisz sie" w Gmailu/Outlooku (wymagany przez
      // Gmail/Yahoo dla wysylek masowych od 2024).
      "List-Unsubscribe": `<${unsub}>, <mailto:kontakt@kalkmate.pl?subject=unsubscribe>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      Precedence: "bulk",
    },
    attachments: content.image
      ? [{
          filename: content.image.filename,
          contentType: content.image.contentType,
          content: Buffer.from(content.image.data, "base64"),
          cid: IMAGE_CID,
        }]
      : undefined,
  };
}

// Test w kazdym jezyku osobnym mailem ("[TEST PL] ...", "[TEST EN] ...").
export async function sendTest(
  content: CampaignContent, to: string, langs: NlLang[] = ["pl", "en", "de", "cs"]
): Promise<{ ok: boolean; error?: string }> {
  const c = await ensureTranslations(content, langs);
  for (const lang of langs) {
    const mail = buildMail(c, to, "Jan Testowy", lang);
    const r = await sendMail({ ...mail, subject: `[TEST ${lang.toUpperCase()}] ${mail.subject}` });
    if (!r.ok) return r;
  }
  return { ok: true };
}

// === Kampanie ===

export interface CampaignRow {
  id: string;
  subject: string;
  audience: string;
  status: string; // sending | done | stopped | paused
  total: number;
  sent: number;
  failed: number;
  createdAt: string;
  finishedAt: string | null;
  // Dlaczego 'paused' (auto-pauza po bledach SMTP / restart serwera).
  pauseReason: string | null;
}

export async function listCampaigns(): Promise<CampaignRow[]> {
  await ensureTables();
  const rows = await prisma.$queryRaw<(Omit<CampaignRow, "sent" | "failed"> & { sent: bigint | number; failed: bigint | number; total: bigint | number })[]>`
    SELECT c."id", c."subject", c."audience", c."status", c."total", c."createdAt", c."finishedAt", c."pauseReason",
      (SELECT COUNT(*) FROM "NewsletterDelivery" d WHERE d."campaignId" = c."id" AND d."status" = 'sent') AS sent,
      (SELECT COUNT(*) FROM "NewsletterDelivery" d WHERE d."campaignId" = c."id" AND d."status" = 'failed') AS failed
    FROM "NewsletterCampaign" c ORDER BY c."createdAt" DESC LIMIT 50`;
  return rows.map((r) => ({ ...r, total: Number(r.total), sent: Number(r.sent), failed: Number(r.failed), pauseReason: r.pauseReason ?? null }));
}

export async function campaignFailures(id: string): Promise<{ email: string; error: string | null }[]> {
  await ensureTables();
  return prisma.$queryRaw`SELECT "email", "error" FROM "NewsletterDelivery" WHERE "campaignId" = ${id} AND "status" = 'failed'`;
}

async function campaignByRequestId(clientRequestId: string): Promise<{ id: string; total: number } | null> {
  const rows = await prisma.$queryRaw<{ id: string; total: number | bigint }[]>`
    SELECT "id", "total" FROM "NewsletterCampaign" WHERE "clientRequestId" = ${clientRequestId} LIMIT 1`;
  return rows[0] ? { id: rows[0].id, total: Number(rows[0].total) } : null;
}

export async function createCampaign(
  content: CampaignContent,
  filter: AudienceFilter,
  clientRequestId: string | null = null
): Promise<{ id: string; total: number; duplicate?: boolean }> {
  await ensureTables();
  // Idempotencja: ten sam clientRequestId (np. podwojne klikniecie, ponowienie
  // po timeoucie sieci) zwraca istniejaca kampanie zamiast drugiej wysylki.
  if (clientRequestId) {
    const existing = await campaignByRequestId(clientRequestId);
    if (existing) return { ...existing, duplicate: true };
  }
  const recipients = (await listRecipients(filter)).filter((r) => !r.unsubscribed);
  if (!recipients.length) throw new Error("Brak odbiorców dla wybranych filtrów.");

  // Tlumaczenia na jezyki, ktore faktycznie sa wsrod odbiorcow — raz, przed
  // startem (zapisane w tresci kampanii, wiec wznowienie nie tlumaczy od nowa).
  content = await ensureTranslations(content, Array.from(new Set(recipients.map((r) => r.lang))));

  const id = randomUUID();
  const now = new Date().toISOString();
  try {
    await prisma.$executeRaw`
      INSERT INTO "NewsletterCampaign" ("id", "subject", "content", "audience", "status", "total", "createdAt", "clientRequestId")
      VALUES (${id}, ${content.subject}, ${JSON.stringify(content)}, ${JSON.stringify(filter)}, 'sending', ${recipients.length}, ${now}, ${clientRequestId})`;
  } catch (e) {
    // Rownolegly duplikat wygral wyscig (indeks unikalny na clientRequestId).
    if (clientRequestId && /UNIQUE constraint failed/i.test(String((e as Error)?.message))) {
      const existing = await campaignByRequestId(clientRequestId);
      if (existing) return { ...existing, duplicate: true };
    }
    throw e;
  }
  // SQLite: w transakcji, inaczej kilkaset osobnych INSERT-ow trwa sekundy.
  await prisma.$transaction(
    recipients.map((r) => prisma.$executeRaw`
      INSERT OR IGNORE INTO "NewsletterDelivery" ("campaignId", "email", "name", "lang") VALUES (${id}, ${r.email}, ${r.name}, ${r.lang})`)
  );
  startWorker(id);
  return { id, total: recipients.length };
}

// Kampanie, ktore ten proces aktualnie wysyla (zeby "Wznow" nie odpalil drugiej petli).
const running = nlState.running;
const stopRequested = nlState.stopRequested;

export function startWorker(id: string): void {
  if (running.has(id)) return;
  running.add(id);
  stopRequested.delete(id);
  void runWorker(id)
    .catch((e) => console.error("[newsletter] worker crashed:", id, e))
    .finally(() => running.delete(id));
}

export async function resumeCampaign(id: string): Promise<void> {
  await ensureTables();
  // Najpierw zdejmij prosbe o stop: jesli worker jeszcze dziala (czeka miedzy
  // mailami po "Zatrzymaj"), startWorker() nic nie zrobi, a stara flaga
  // zatrzymalaby go mimo wznowienia.
  stopRequested.delete(id);
  await prisma.$executeRaw`
    UPDATE "NewsletterCampaign" SET "status" = 'sending', "finishedAt" = NULL, "pauseReason" = NULL WHERE "id" = ${id}`;
  startWorker(id);
}

/** "Ponow nieudane": nieudani odbiorcy (poza wypisanymi) wracaja do kolejki. */
export async function retryFailedDeliveries(id: string): Promise<number> {
  await ensureTables();
  const n = await prisma.$executeRaw`
    UPDATE "NewsletterDelivery" SET "status" = 'pending', "error" = NULL, "sentAt" = NULL
    WHERE "campaignId" = ${id} AND "status" = 'failed' AND COALESCE("error", '') <> 'wypisany'`;
  if (n > 0) await resumeCampaign(id);
  return n;
}

export async function stopCampaign(id: string): Promise<void> {
  stopRequested.add(id);
  await ensureTables();
  await prisma.$executeRaw`UPDATE "NewsletterCampaign" SET "status" = 'stopped' WHERE "id" = ${id}`;
}

export function isRunning(id: string): boolean {
  return running.has(id);
}

// Czeka `ms`, ale wychodzi wczesniej po "Zatrzymaj" (backoff trwa minuty).
async function sleepUnlessStopped(id: string, ms: number): Promise<void> {
  const until = Date.now() + ms;
  while (Date.now() < until && !stopRequested.has(id)) {
    await new Promise((r) => setTimeout(r, Math.min(2000, until - Date.now())));
  }
}

async function campaignStatus(id: string): Promise<string | null> {
  const rows = await prisma.$queryRaw<{ status: string }[]>`SELECT "status" FROM "NewsletterCampaign" WHERE "id" = ${id}`;
  return rows[0]?.status ?? null;
}

async function runWorker(id: string): Promise<void> {
  const rows = await prisma.$queryRaw<{ content: string }[]>`SELECT "content" FROM "NewsletterCampaign" WHERE "id" = ${id}`;
  if (!rows[0]) return;
  const content = JSON.parse(rows[0].content) as CampaignContent;
  let consecutiveErrors = 0;

  for (;;) {
    if (stopRequested.has(id)) return;
    // Status w bazie tez sie liczy (zatrzymanie/pauza z innego procesu).
    if ((await campaignStatus(id)) !== "sending") return;
    const next = await prisma.$queryRaw<{ email: string; name: string | null; lang: NlLang | null }[]>`
      SELECT "email", "name", "lang" FROM "NewsletterDelivery"
      WHERE "campaignId" = ${id} AND "status" = 'pending' LIMIT 1`;
    if (!next[0]) break;
    const { email, name, lang } = next[0];

    // Ktos mogl sie wypisac w trakcie wysylki (wysylka trwa nawet godzine).
    const unsub = await prisma.$queryRaw<{ email: string }[]>`
      SELECT "email" FROM "NewsletterUnsubscribe" WHERE "email" = ${email}`;

    let result: { ok: boolean; error?: string } = { ok: false, error: "wypisany" };
    if (!unsub.length) {
      for (let attempt = 1; ; attempt++) {
        result = await sendMail(buildMail(content, email, name, isNlLang(lang) ? lang : "pl"));
        if (result.ok) {
          consecutiveErrors = 0;
          break;
        }
        consecutiveErrors++;
        if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
          // Odbiorca zostaje 'pending' — po wznowieniu dostanie maila.
          const reason = `Auto-pauza: ${consecutiveErrors} błędów wysyłki z rzędu (ostatni: ${(result.error || "błąd").slice(0, 200)}). Sprawdź konto SMTP i wznów.`;
          await prisma.$executeRaw`
            UPDATE "NewsletterCampaign" SET "status" = 'paused', "pauseReason" = ${reason}
            WHERE "id" = ${id} AND "status" = 'sending'`;
          console.error(`[newsletter] ${id}: ${reason}`);
          return;
        }
        if (!isTransientSmtpError(result.error) || attempt >= MAX_ATTEMPTS) break;
        await sleepUnlessStopped(id, RETRY_BACKOFF_MS[attempt - 1] ?? RETRY_BACKOFF_MS[RETRY_BACKOFF_MS.length - 1]);
        if (stopRequested.has(id)) return; // odbiorca zostaje 'pending'
      }
    }

    await prisma.$executeRaw`
      UPDATE "NewsletterDelivery"
      SET "status" = ${result.ok ? "sent" : "failed"}, "error" = ${result.ok ? null : (result.error || "błąd").slice(0, 300)},
          "sentAt" = ${new Date().toISOString()}
      WHERE "campaignId" = ${id} AND "email" = ${email}`;
    await new Promise((r) => setTimeout(r, DELAY_MS));
  }

  await prisma.$executeRaw`
    UPDATE "NewsletterCampaign" SET "status" = 'done', "finishedAt" = ${new Date().toISOString()}
    WHERE "id" = ${id} AND "status" = 'sending'`;
}

export async function getCampaignContent(id: string): Promise<CampaignContent | null> {
  await ensureTables();
  const rows = await prisma.$queryRaw<{ content: string }[]>`SELECT "content" FROM "NewsletterCampaign" WHERE "id" = ${id}`;
  return rows[0] ? (JSON.parse(rows[0].content) as CampaignContent) : null;
}
