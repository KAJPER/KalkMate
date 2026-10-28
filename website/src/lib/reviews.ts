// Prawdziwe, zweryfikowane opinie kupujacych (zamowienie oplacone i dostarczone).
// Nigdy nie wstawiamy tu opinii recznie ani "na start" — kazdy wiersz powstaje
// z prosby wyslanej do klienta po dostawie, a tresc pochodzi wylacznie od niego.
//
// Przeplyw:
//   1. cron (/api/cron/tracking, co godzine) -> sendReviewRequests():
//      zamowienia paid + fulfilled, dostarczone 5-14 dni temu, bez wiersza
//      CustomerReview, adres nie wypisany (NewsletterUnsubscribe) -> wiersz
//      'requested' (atomowo PRZED wysylka) + mail z linkiem /opinia/<token>.
//      Wysylka nieudana -> wiersz usuwany (nastepny cron ponowi).
//   2. Klient: /opinia/<token> -> POST /api/reviews/submit -> 'submitted'.
//   3. Admin: /admin/opinie -> 'approved' | 'rejected'.
//   4. Publicznie (Reviews.tsx, /api/reviews, JSON-LD) tylko 'approved'.
//
// Tabela poza Prisma (raw SQL, tworzona leniwie — jak Coupon). Znaczniki czasu
// w ms jako BIGINT (Prisma $queryRaw czyta INTEGER jako 32-bit).

import { randomBytes, randomUUID } from "crypto";
import { prisma } from "@/lib/db";
import { sendMail } from "@/lib/mailer";
import { reviewRequestEmail, localeFromCountry, EMAIL_SUBJECTS } from "@/lib/email-templates";
import { unsubscribeUrl } from "@/lib/newsletter";
import { locales, SITE_URL, type Locale } from "@/lib/i18n";

export type ReviewStatus = "requested" | "submitted" | "approved" | "rejected";
export const REVIEW_STATUSES: readonly ReviewStatus[] = ["requested", "submitted", "approved", "rejected"];

export const REVIEW_PRODUCT = "KalkMate v3.0";
export const REVIEW_TEXT_MAX = 1000;
export const REVIEW_NAME_MAX = 40;

// Prosba 5-14 dni po dostawie (okno, a nie dokladny dzien — cron co godzine,
// a pierwsze wdrozenie nie wysle nic do starszych zamowien).
const REQUEST_AFTER_DAYS = 5;
const REQUEST_BEFORE_DAYS = 14;
// Link z maila wazny tyle dni od wyslania prosby.
const LINK_VALID_DAYS = 60;
// Ten sam adres (kilka zamowien) dostaje najwyzej jedna prosbe na tyle dni.
const SAME_EMAIL_GAP_DAYS = 60;
const DAY_MS = 24 * 60 * 60_000;

let _ready = false;
export async function ensureCustomerReviewTable(): Promise<void> {
  if (_ready) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "CustomerReview" (
      "id"          TEXT PRIMARY KEY,
      "orderId"     TEXT NOT NULL UNIQUE,
      "token"       TEXT NOT NULL UNIQUE,
      "email"       TEXT NOT NULL,
      "name"        TEXT NOT NULL DEFAULT '',
      "rating"      INTEGER CHECK ("rating" IS NULL OR ("rating" BETWEEN 1 AND 5)),
      "text"        TEXT,
      "lang"        TEXT NOT NULL DEFAULT 'pl',
      "status"      TEXT NOT NULL DEFAULT 'requested',
      "requestedAt" BIGINT NOT NULL,
      "submittedAt" BIGINT,
      "moderatedAt" BIGINT
    )`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "CustomerReview_status" ON "CustomerReview" ("status")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "CustomerReview_email" ON "CustomerReview" ("email")`);
  // Wypisani z maili (lib/newsletter.ts tworzy ja tak samo) — tu tylko na
  // wypadek, gdyby cron ruszyl, zanim newsletter kiedykolwiek jej uzyl.
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "NewsletterUnsubscribe" (
      "email"     TEXT PRIMARY KEY,
      "createdAt" TEXT NOT NULL
    )`);
  _ready = true;
}

// 32 losowe bajty, base64url (43 znaki, bez paddingu).
export function newReviewToken(): string {
  return randomBytes(32).toString("base64url");
}

export function isReviewTokenFormat(v: unknown): v is string {
  return typeof v === "string" && /^[A-Za-z0-9_-]{43}$/.test(v);
}

function isLocale(v: unknown): v is Locale {
  return typeof v === "string" && (locales as readonly string[]).includes(v);
}

// "Jan Kowalski" -> "Jan K."; "jan" -> "Jan"; pusty -> "".
export function displayNameFromCustomer(fullName: string | null | undefined): string {
  const parts = String(fullName || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "";
  const cap = (s: string) => s.charAt(0).toLocaleUpperCase("pl-PL") + s.slice(1);
  const first = cap(parts[0]).slice(0, 30);
  const last = parts.length > 1 ? parts[parts.length - 1] : "";
  return last ? `${first} ${last.charAt(0).toLocaleUpperCase("pl-PL")}.` : first;
}

// Nazwa wpisana przez klienta: bez znakow sterujacych i nadmiarowych spacji.
export function cleanDisplayName(v: unknown): string {
  return String(v ?? "").replace(/[\u0000-\u001F\u007F<>]/g, "").replace(/\s+/g, " ").trim();
}

export function cleanReviewText(v: unknown): string {
  return String(v ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function reviewUrl(token: string): string {
  return `${SITE_URL}/opinia/${token}`;
}

const toNum = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));

// === Strona /opinia/<token> ===

export async function getReviewRequestForPage(token: string): Promise<{
  status: ReviewStatus;
  lang: Locale;
  name: string;
  product: string;
} | null> {
  if (!isReviewTokenFormat(token)) return null;
  await ensureCustomerReviewTable();
  const rows = await prisma.$queryRaw<{ status: string; lang: string; name: string; requestedAt: bigint | number }[]>`
    SELECT "status", "lang", "name", "requestedAt" FROM "CustomerReview" WHERE "token" = ${token} LIMIT 1`;
  const r = rows[0];
  if (!r) return null;
  const status = (REVIEW_STATUSES as readonly string[]).includes(r.status) ? (r.status as ReviewStatus) : null;
  if (!status) return null;
  // Wygasly link pokazujemy jak nieznany — chyba ze opinia juz jest (podziekowanie).
  if (status === "requested" && Date.now() - Number(r.requestedAt) > LINK_VALID_DAYS * DAY_MS) return null;
  return { status, lang: isLocale(r.lang) ? r.lang : "pl", name: r.name || "", product: REVIEW_PRODUCT };
}

export type SubmitResult = "ok" | "not_found" | "already_submitted";

// Atomowo: tylko wiersz 'requested' z niewygaslym linkiem.
export async function submitReview(p: { token: string; rating: number; text: string; name: string }): Promise<SubmitResult> {
  await ensureCustomerReviewTable();
  const now = Date.now();
  const minRequested = now - LINK_VALID_DAYS * DAY_MS;
  const changed = await prisma.$executeRaw`
    UPDATE "CustomerReview"
    SET "status" = 'submitted', "rating" = ${p.rating}, "text" = ${p.text}, "name" = ${p.name}, "submittedAt" = ${now}
    WHERE "token" = ${p.token} AND "status" = 'requested' AND "requestedAt" >= ${minRequested}`;
  if (Number(changed) > 0) return "ok";
  const rows = await prisma.$queryRaw<{ status: string }[]>`
    SELECT "status" FROM "CustomerReview" WHERE "token" = ${p.token} LIMIT 1`;
  if (rows[0] && rows[0].status !== "requested") return "already_submitted";
  return "not_found";
}

// === Prosby o opinie (cron) ===

export interface ReviewRequestResult {
  sent: string[];    // numery zamowien
  failed: { orderNumber: string; error: string }[];
  skipped: number;   // np. ten sam adres w tej samej turze / wyscig z drugim procesem
}

interface Candidate {
  id: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerCountry: string | null;
}

export async function sendReviewRequests(limit = 30): Promise<ReviewRequestResult> {
  await ensureCustomerReviewTable();
  const now = Date.now();
  const newest = now - REQUEST_AFTER_DAYS * DAY_MS;   // dostarczone najpozniej
  const oldest = now - REQUEST_BEFORE_DAYS * DAY_MS;  // dostarczone najwczesniej
  const emailGapFrom = now - SAME_EMAIL_GAP_DAYS * DAY_MS;

  // deliveredAt bywa INTEGER (ms, Prisma) albo TEXT ISO (stare wiersze) —
  // jak createdAt w lib/orderCleanup.ts.
  const rows = await prisma.$queryRaw<Candidate[]>`
    SELECT o.id, o."orderNumber", o."customerName", o."customerEmail", o."customerCountry"
    FROM "Order" o
    WHERE o.status = 'paid'
      AND o."fulfillmentStatus" = 'fulfilled'
      AND o."customerEmail" IS NOT NULL AND trim(o."customerEmail") <> ''
      AND (
        (typeof(o."deliveredAt") IN ('integer', 'real') AND o."deliveredAt" BETWEEN ${oldest} AND ${newest})
        OR (typeof(o."deliveredAt") = 'text' AND o."deliveredAt" BETWEEN ${new Date(oldest).toISOString()} AND ${new Date(newest).toISOString()})
      )
      AND NOT EXISTS (SELECT 1 FROM "CustomerReview" r WHERE r."orderId" = o.id)
      AND NOT EXISTS (
        SELECT 1 FROM "CustomerReview" r2
        WHERE r2."email" = lower(trim(o."customerEmail")) AND r2."requestedAt" >= ${emailGapFrom}
      )
      AND NOT EXISTS (SELECT 1 FROM "NewsletterUnsubscribe" u WHERE u."email" = lower(trim(o."customerEmail")))
    ORDER BY o."deliveredAt" ASC
    LIMIT ${Math.max(1, Math.min(200, limit))}`;

  const result: ReviewRequestResult = { sent: [], failed: [], skipped: 0 };
  const seen = new Set<string>();
  for (const o of rows) {
    const email = o.customerEmail.trim().toLowerCase();
    if (seen.has(email)) { result.skipped++; continue; }
    seen.add(email);

    const locale = localeFromCountry(o.customerCountry);
    const id = randomUUID();
    const token = newReviewToken();
    // Znacznik PRZED wysylka: UNIQUE(orderId) — rownolegly cron nie wysle drugi raz.
    const claimed = await prisma.$executeRaw`
      INSERT OR IGNORE INTO "CustomerReview" ("id", "orderId", "token", "email", "name", "lang", "status", "requestedAt")
      VALUES (${id}, ${o.id}, ${token}, ${email}, ${displayNameFromCustomer(o.customerName)}, ${locale}, 'requested', ${Date.now()})`;
    if (Number(claimed) === 0) { result.skipped++; continue; }

    const unsub = unsubscribeUrl(email);
    const html = reviewRequestEmail({ customerName: o.customerName || "", reviewUrl: reviewUrl(token), unsubscribeUrl: unsub }, locale);
    const r = await sendMail({
      to: email,
      subject: EMAIL_SUBJECTS.reviewRequest[locale],
      html,
      headers: {
        "List-Unsubscribe": `<${unsub}>, <mailto:kontakt@kalkmate.pl?subject=unsubscribe>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    }).catch((err) => ({ ok: false, error: String(err) }));

    if (r.ok) {
      result.sent.push(o.orderNumber);
    } else {
      console.error(`[reviews] request email failed for order ${o.orderNumber}:`, r.error);
      result.failed.push({ orderNumber: o.orderNumber, error: String(r.error || "send failed").slice(0, 200) });
      await prisma.$executeRaw`DELETE FROM "CustomerReview" WHERE "id" = ${id} AND "status" = 'requested'`
        .catch((e) => console.error(`[reviews] marker rollback failed ${o.orderNumber}:`, e));
    }
  }
  return result;
}

// === Moderacja (admin) ===

export interface AdminReviewRow {
  id: string;
  orderId: string;
  orderNumber: string | null;
  email: string;
  name: string;
  rating: number | null;
  text: string | null;
  lang: string;
  status: ReviewStatus;
  requestedAt: number;
  submittedAt: number | null;
  moderatedAt: number | null;
}

export interface ReviewStats {
  requested: number;   // wszystkie wyslane prosby
  responded: number;   // submitted + approved + rejected
  responseRate: number; // 0..1
  avgRating: number | null;        // ze wszystkich odpowiedzi
  approved: number;
  avgApprovedRating: number | null;
  pending: number;     // czekaja na moderacje
}

type RawAdminRow = Omit<AdminReviewRow, "rating" | "requestedAt" | "submittedAt" | "moderatedAt"> & {
  rating: bigint | number | null;
  requestedAt: bigint | number;
  submittedAt: bigint | number | null;
  moderatedAt: bigint | number | null;
};

export async function listReviewsForAdmin(historyLimit = 300): Promise<{ pending: AdminReviewRow[]; history: AdminReviewRow[]; stats: ReviewStats }> {
  await ensureCustomerReviewTable();
  const map = (r: RawAdminRow): AdminReviewRow => ({
    ...r,
    rating: toNum(r.rating),
    requestedAt: Number(r.requestedAt),
    submittedAt: toNum(r.submittedAt),
    moderatedAt: toNum(r.moderatedAt),
  });
  const pending = await prisma.$queryRaw<RawAdminRow[]>`
    SELECT r."id", r."orderId", o."orderNumber", r."email", r."name", r."rating", r."text", r."lang", r."status",
           r."requestedAt", r."submittedAt", r."moderatedAt"
    FROM "CustomerReview" r LEFT JOIN "Order" o ON o.id = r."orderId"
    WHERE r."status" = 'submitted'
    ORDER BY r."submittedAt" ASC`;
  const history = await prisma.$queryRaw<RawAdminRow[]>`
    SELECT r."id", r."orderId", o."orderNumber", r."email", r."name", r."rating", r."text", r."lang", r."status",
           r."requestedAt", r."submittedAt", r."moderatedAt"
    FROM "CustomerReview" r LEFT JOIN "Order" o ON o.id = r."orderId"
    WHERE r."status" IN ('approved', 'rejected')
    ORDER BY r."moderatedAt" DESC
    LIMIT ${historyLimit}`;
  return { pending: pending.map(map), history: history.map(map), stats: await reviewStats() };
}

export async function reviewStats(): Promise<ReviewStats> {
  await ensureCustomerReviewTable();
  const rows = await prisma.$queryRaw<{
    requested: bigint | number;
    responded: bigint | number;
    respSum: bigint | number | null;
    approved: bigint | number;
    apprSum: bigint | number | null;
    pending: bigint | number;
  }[]>`
    SELECT COUNT(*) AS requested,
           SUM(CASE WHEN "status" <> 'requested' THEN 1 ELSE 0 END) AS responded,
           SUM(CASE WHEN "status" <> 'requested' THEN "rating" ELSE 0 END) AS respSum,
           SUM(CASE WHEN "status" = 'approved' THEN 1 ELSE 0 END) AS approved,
           SUM(CASE WHEN "status" = 'approved' THEN "rating" ELSE 0 END) AS apprSum,
           SUM(CASE WHEN "status" = 'submitted' THEN 1 ELSE 0 END) AS pending
    FROM "CustomerReview"`;
  const s = rows[0];
  const requested = Number(s?.requested ?? 0);
  const responded = Number(s?.responded ?? 0);
  const approved = Number(s?.approved ?? 0);
  return {
    requested,
    responded,
    responseRate: requested ? responded / requested : 0,
    avgRating: responded ? Number(s?.respSum ?? 0) / responded : null,
    approved,
    avgApprovedRating: approved ? Number(s?.apprSum ?? 0) / approved : null,
    pending: Number(s?.pending ?? 0),
  };
}

// Admin: submitted -> approved/rejected, oraz zmiana decyzji (approved <-> rejected).
// Prosby bez odpowiedzi ('requested') nie da sie zatwierdzic.
export async function moderateReview(id: string, status: "approved" | "rejected"): Promise<boolean> {
  await ensureCustomerReviewTable();
  const changed = await prisma.$executeRaw`
    UPDATE "CustomerReview" SET "status" = ${status}, "moderatedAt" = ${Date.now()}
    WHERE "id" = ${id} AND "status" IN ('submitted', 'approved', 'rejected') AND "rating" IS NOT NULL`;
  if (Number(changed) > 0) invalidatePublicReviewsCache();
  return Number(changed) > 0;
}

// === Publicznie (tylko 'approved') ===

export interface PublicReview {
  name: string;
  rating: number;
  text: string;
  lang: Locale;
  date: string; // YYYY-MM-DD (data wyslania opinii)
}

const PUBLIC_CACHE_MS = 5 * 60_000;
const cache = ((globalThis as unknown as { __kmReviews?: { at: number; list: PublicReview[] | null } })
  .__kmReviews ??= { at: 0, list: null });

function invalidatePublicReviewsCache(): void {
  cache.at = 0;
  cache.list = null;
}

// Najnowsze zatwierdzone (max 50). Cache w pamieci procesu na 5 min — strona
// glowna jest dynamiczna, a moderacja czyści cache od razu.
export async function getApprovedReviews(): Promise<PublicReview[]> {
  if (cache.list && Date.now() - cache.at < PUBLIC_CACHE_MS) return cache.list;
  await ensureCustomerReviewTable();
  const rows = await prisma.$queryRaw<{ name: string; rating: bigint | number; text: string | null; lang: string; submittedAt: bigint | number | null }[]>`
    SELECT "name", "rating", "text", "lang", "submittedAt" FROM "CustomerReview"
    WHERE "status" = 'approved' AND "rating" IS NOT NULL
    ORDER BY "submittedAt" DESC
    LIMIT 50`;
  const list = rows.map((r) => ({
    name: r.name,
    rating: Math.min(5, Math.max(1, Number(r.rating))),
    text: r.text || "",
    lang: isLocale(r.lang) ? r.lang : "pl",
    date: r.submittedAt != null ? new Date(Number(r.submittedAt)).toISOString().slice(0, 10) : "",
  }));
  cache.at = Date.now();
  cache.list = list;
  return list;
}

// AggregateRating do JSON-LD — WYLACZNIE z zatwierdzonych CustomerReview
// (bez opinii z reviews-source.json) i dopiero od 5 opinii. null = nie pokazuj.
export interface VerifiedRating {
  ratingValue: string;
  reviewCount: string;
}

export const MIN_REVIEWS_FOR_AGGREGATE = 5;

export async function getVerifiedAggregateRating(): Promise<VerifiedRating | null> {
  try {
    const s = await reviewStats();
    if (s.approved < MIN_REVIEWS_FOR_AGGREGATE || s.avgApprovedRating == null) return null;
    return { ratingValue: s.avgApprovedRating.toFixed(1), reviewCount: String(s.approved) };
  } catch (e) {
    console.error("[reviews] aggregate rating failed:", e);
    return null;
  }
}
