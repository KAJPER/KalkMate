// Newsletter z /admin/newsletter — wysylka do zarejestrowanych uzytkownikow
// i kupujacych (oplacone zamowienia / tokeny), z noreply@ przez lib/mailer.
//
// Tabele poza Prisma (raw SQL, tworzone leniwie — jak AdminSession,
// TokenPurchase), wiec nie trzeba `prisma db push`:
//   NewsletterUnsubscribe — wypisani (sprawdzane przy KAZDEJ wysylce)
//   NewsletterCampaign    — wyslane kampanie (tresc + postep)
//   NewsletterDelivery    — kazdy odbiorca kampanii osobno (pending/sent/failed),
//                           dzieki czemu po restarcie serwera mozna wznowic
//
// Wysylka idzie w tle w procesie Next (systemd, dlugo zyjacy), po jednym
// mailu co NEWSLETTER_DELAY_MS — hosting SMTP ma limity godzinowe, a seria
// setek maili naraz konczy sie blokada konta / spamem.

import { createHmac, randomUUID, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/db";
import { sendMail } from "@/lib/mailer";
import { newsletterEmail, type NewsletterContent } from "@/lib/email-templates";
import { SITE_URL } from "@/lib/i18n";

const DELAY_MS = Math.max(200, parseInt(process.env.NEWSLETTER_DELAY_MS || "2500", 10) || 2500);

function secret(): string {
  const s = process.env.NEWSLETTER_SECRET || process.env.NEXTAUTH_SECRET || process.env.ADMIN_SESSION_TOKEN;
  if (!s) throw new Error("Brak NEWSLETTER_SECRET / NEXTAUTH_SECRET w konfiguracji serwera");
  return s;
}

// === Wypisywanie ===

export function unsubscribeToken(email: string): string {
  return createHmac("sha256", secret()).update(`unsub:${email.toLowerCase()}`).digest("base64url").slice(0, 32);
}

export function verifyUnsubscribeToken(email: string, token: string): boolean {
  const a = Buffer.from(unsubscribeToken(email));
  const b = Buffer.from(token || "");
  return a.length === b.length && timingSafeEqual(a, b);
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
  _ready = true;
}

export async function addUnsubscribe(email: string): Promise<void> {
  await ensureTables();
  await prisma.$executeRaw`
    INSERT OR IGNORE INTO "NewsletterUnsubscribe" ("email", "createdAt")
    VALUES (${email.toLowerCase()}, ${new Date().toISOString()})`;
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
}

export interface Recipient {
  email: string;
  name: string | null;
  registered: boolean;
  buyer: boolean;
  country: string | null;
  unsubscribed: boolean;
}

const EMAIL_RE = /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/;

// Wszyscy potencjalni odbiorcy (z flaga `unsubscribed`) — lista w panelu
// pokazuje tez wypisanych, wysylka ich pomija.
export async function listRecipients(filter: AudienceFilter): Promise<Recipient[]> {
  const unsub = await unsubscribedSet();
  const map = new Map<string, Recipient>();
  const upsert = (email: string, patch: Partial<Recipient>) => {
    const key = email.trim().toLowerCase();
    if (!EMAIL_RE.test(key)) return;
    const cur = map.get(key) || {
      email: key, name: null, registered: false, buyer: false, country: null, unsubscribed: unsub.has(key),
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

  let list = Array.from(map.values());
  if (filter.country === "PL") list = list.filter((r) => r.country === "PL");
  if (filter.country === "foreign") list = list.filter((r) => r.country && r.country !== "PL");
  return list.sort((a, b) => a.email.localeCompare(b.email));
}

// === Tresc ===

export interface CampaignContent extends Omit<NewsletterContent, "unsubscribeUrl" | "imageSrc"> {
  subject: string;
  image?: { filename: string; contentType: string; data: string } | null; // base64
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

function buildMail(content: CampaignContent, to: string, name: string | null) {
  const p = (s?: string) => (s ? personalize(s, name) : s);
  const html = newsletterEmail({
    ...content,
    title: p(content.title) || "",
    body: p(content.body) || "",
    preheader: p(content.preheader),
    imageSrc: content.image ? `cid:${IMAGE_CID}` : undefined,
    unsubscribeUrl: unsubscribeUrl(to),
  });
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

export async function sendTest(content: CampaignContent, to: string): Promise<{ ok: boolean; error?: string }> {
  const mail = buildMail(content, to, "Jan Testowy");
  return sendMail({ ...mail, subject: `[TEST] ${mail.subject}` });
}

// === Kampanie ===

export interface CampaignRow {
  id: string;
  subject: string;
  audience: string;
  status: string; // sending | done | stopped
  total: number;
  sent: number;
  failed: number;
  createdAt: string;
  finishedAt: string | null;
}

export async function listCampaigns(): Promise<CampaignRow[]> {
  await ensureTables();
  const rows = await prisma.$queryRaw<(Omit<CampaignRow, "sent" | "failed"> & { sent: bigint | number; failed: bigint | number; total: bigint | number })[]>`
    SELECT c."id", c."subject", c."audience", c."status", c."total", c."createdAt", c."finishedAt",
      (SELECT COUNT(*) FROM "NewsletterDelivery" d WHERE d."campaignId" = c."id" AND d."status" = 'sent') AS sent,
      (SELECT COUNT(*) FROM "NewsletterDelivery" d WHERE d."campaignId" = c."id" AND d."status" = 'failed') AS failed
    FROM "NewsletterCampaign" c ORDER BY c."createdAt" DESC LIMIT 50`;
  return rows.map((r) => ({ ...r, total: Number(r.total), sent: Number(r.sent), failed: Number(r.failed) }));
}

export async function campaignFailures(id: string): Promise<{ email: string; error: string | null }[]> {
  await ensureTables();
  return prisma.$queryRaw`SELECT "email", "error" FROM "NewsletterDelivery" WHERE "campaignId" = ${id} AND "status" = 'failed'`;
}

export async function createCampaign(
  content: CampaignContent,
  filter: AudienceFilter
): Promise<{ id: string; total: number }> {
  await ensureTables();
  const recipients = (await listRecipients(filter)).filter((r) => !r.unsubscribed);
  if (!recipients.length) throw new Error("Brak odbiorców dla wybranych filtrów.");

  const id = randomUUID();
  const now = new Date().toISOString();
  await prisma.$executeRaw`
    INSERT INTO "NewsletterCampaign" ("id", "subject", "content", "audience", "status", "total", "createdAt")
    VALUES (${id}, ${content.subject}, ${JSON.stringify(content)}, ${JSON.stringify(filter)}, 'sending', ${recipients.length}, ${now})`;
  // SQLite: w transakcji, inaczej kilkaset osobnych INSERT-ow trwa sekundy.
  await prisma.$transaction(
    recipients.map((r) => prisma.$executeRaw`
      INSERT OR IGNORE INTO "NewsletterDelivery" ("campaignId", "email", "name") VALUES (${id}, ${r.email}, ${r.name})`)
  );
  startWorker(id);
  return { id, total: recipients.length };
}

// Kampanie, ktore ten proces aktualnie wysyla (zeby "Wznow" nie odpalil drugiej petli).
const running = new Set<string>();
const stopRequested = new Set<string>();

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
  await prisma.$executeRaw`UPDATE "NewsletterCampaign" SET "status" = 'sending', "finishedAt" = NULL WHERE "id" = ${id}`;
  startWorker(id);
}

export async function stopCampaign(id: string): Promise<void> {
  stopRequested.add(id);
  await ensureTables();
  await prisma.$executeRaw`UPDATE "NewsletterCampaign" SET "status" = 'stopped' WHERE "id" = ${id}`;
}

export function isRunning(id: string): boolean {
  return running.has(id);
}

async function runWorker(id: string): Promise<void> {
  const rows = await prisma.$queryRaw<{ content: string }[]>`SELECT "content" FROM "NewsletterCampaign" WHERE "id" = ${id}`;
  if (!rows[0]) return;
  const content = JSON.parse(rows[0].content) as CampaignContent;

  for (;;) {
    if (stopRequested.has(id)) return;
    const next = await prisma.$queryRaw<{ email: string; name: string | null }[]>`
      SELECT "email", "name" FROM "NewsletterDelivery"
      WHERE "campaignId" = ${id} AND "status" = 'pending' LIMIT 1`;
    if (!next[0]) break;
    const { email, name } = next[0];

    // Ktos mogl sie wypisac w trakcie wysylki (wysylka trwa nawet godzine).
    const unsub = await prisma.$queryRaw<{ email: string }[]>`
      SELECT "email" FROM "NewsletterUnsubscribe" WHERE "email" = ${email}`;
    const result = unsub.length
      ? { ok: false, error: "wypisany" }
      : await sendMail(buildMail(content, email, name));

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
