// Przypomnienie "dokoncz platnosc" dla porzuconych zamowien P24 (BLIK /
// przelew — klienci z Polski). Wolane co godzine z /api/cron/tracking, PRZED
// cancelStaleUnpaidOrders (ktore anuluje po STALE_DAYS).
//
// Stripe (karty, zagranica) tu nie wystepuje: zamowienie Stripe powstaje w
// bazie dopiero w webhooku po udanej platnosci, wiec nie ma czego przypominac.
//
// Link w mailu prowadzi do /api/p24/resume, ktory rejestruje NOWA transakcje
// P24 dla tego samego zamowienia (stary token P24 mogl juz wygasnac). Dodatkowe
// sessionId trzymamy w OrderPaymentSession — webhook i /api/p24/status szukaja
// zamowienia takze po nich (orderIdForPaymentSession).
//
// Tabele poza Prisma (raw SQL, tworzone leniwie):
//   PaymentReminder      — jedno przypomnienie na zamowienie (orderId PK)
//   OrderPaymentSession  — dodatkowe sesje P24 utworzone z linku w mailu

import { prisma } from "@/lib/db";
import { sendMail } from "@/lib/mailer";
import { paymentReminderEmail, PAYMENT_REMINDER_SUBJECT } from "@/lib/email-templates";
import { signLink, verifyLink } from "@/lib/linkTokens";
import { STALE_DAYS } from "@/lib/orderCleanup";

// Po ilu godzinach od zlozenia przypominamy (BLIK/przelew zwykle konczy sie
// w minutach; spozniony webhook P24 to max kilkanascie minut).
const REMIND_AFTER_HOURS = Math.max(1, parseInt(process.env.PAYMENT_REMINDER_AFTER_HOURS || "3", 10) || 3);
// Starszych nie ruszamy — m.in. zeby pierwsze wdrozenie nie wyslalo maili do
// wszystkich porzuconych zamowien z ostatniego miesiaca.
const MAX_AGE_DAYS = 7;

let _ready = false;
async function ensureTables(): Promise<void> {
  if (_ready) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "PaymentReminder" (
      "orderId" TEXT PRIMARY KEY,
      "sentAt"  TEXT NOT NULL
    )`);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "OrderPaymentSession" (
      "sessionId" TEXT PRIMARY KEY,
      "orderId"   TEXT NOT NULL,
      "createdAt" TEXT NOT NULL
    )`);
  _ready = true;
}

// === Link "dokoncz platnosc" ===

export function resumePaymentUrl(orderId: string): string {
  const base = process.env.NEXTAUTH_URL || "https://kalkmate.pl";
  return `${base}/api/p24/resume?o=${encodeURIComponent(orderId)}&t=${signLink("pay", orderId)}`;
}

export function verifyResumeToken(orderId: string, token: string): boolean {
  return verifyLink("pay", orderId, token);
}

export async function addPaymentSession(sessionId: string, orderId: string): Promise<void> {
  await ensureTables();
  await prisma.$executeRaw`
    INSERT INTO "OrderPaymentSession" ("sessionId", "orderId", "createdAt")
    VALUES (${sessionId}, ${orderId}, ${new Date().toISOString()})`;
}

// Zamowienie dla sesji P24 utworzonej z linku w mailu (null = nie nasza sesja).
export async function orderIdForPaymentSession(sessionId: string): Promise<string | null> {
  await ensureTables();
  const rows = await prisma.$queryRaw<{ orderId: string }[]>`
    SELECT "orderId" FROM "OrderPaymentSession" WHERE "sessionId" = ${sessionId} LIMIT 1`;
  return rows[0]?.orderId ?? null;
}

// === Wysylka przypomnien ===

interface Candidate {
  id: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  pickupPoint: string;
  amount: number;
  currency: string;
  createdAt: string | number | bigint;
}

function toMs(v: string | number | bigint): number {
  return typeof v === "string" ? Date.parse(v) : Number(v);
}

function fmtAmount(cents: number, currency: string): string {
  const c = currency.toUpperCase();
  const n = (cents / 100).toFixed(2).replace(/\.00$/, "");
  return c === "PLN" ? `${n.replace(".", ",")} zł` : `${n} ${c}`;
}

export interface ReminderResult {
  sent: string[];     // numery zamowien
  skipped: string[];  // klient w miedzyczasie zaplacil inne / ma nowsze zamowienie
  failed: string[];
}

export async function sendPaymentReminders(): Promise<ReminderResult> {
  await ensureTables();
  const now = Date.now();
  const newest = now - REMIND_AFTER_HOURS * 3600_000;
  const oldest = now - MAX_AGE_DAYS * 86400_000;

  // createdAt bywa INTEGER (ms) albo TEXT ISO — patrz komentarz w orderCleanup.ts.
  const rows = await prisma.$queryRaw<Candidate[]>`
    SELECT o.id, o."orderNumber", o."customerName", o."customerEmail", o."pickupPoint",
           o.amount, o.currency, o."createdAt"
    FROM "Order" o
    WHERE o.status = 'pending'
      AND o."paymentProvider" = 'p24'
      AND o."fulfillmentStatus" <> 'cancelled'
      AND NOT EXISTS (SELECT 1 FROM "PaymentReminder" r WHERE r."orderId" = o.id)
      AND (
        (typeof(o."createdAt") IN ('integer', 'real') AND o."createdAt" BETWEEN ${oldest} AND ${newest})
        OR (typeof(o."createdAt") = 'text' AND o."createdAt" BETWEEN ${new Date(oldest).toISOString()} AND ${new Date(newest).toISOString()})
      )`;

  const result: ReminderResult = { sent: [], skipped: [], failed: [] };

  for (const o of rows) {
    const created = toMs(o.createdAt);
    // Czesty przypadek: BLIK sie nie udal, klient od razu zlozyl drugie
    // zamowienie i zaplacil. Wtedy przypomnienie o pierwszym tylko myli.
    const others = await prisma.$queryRaw<{ status: string; createdAt: string | number | bigint }[]>`
      SELECT status, "createdAt" FROM "Order"
      WHERE lower("customerEmail") = lower(${o.customerEmail}) AND id <> ${o.id}
        AND status IN ('paid', 'pending')`;
    const supersede = others.some((x) => x.status === "paid" || toMs(x.createdAt) > created);
    const nowIso = new Date().toISOString();
    if (supersede) {
      // Zapisujemy, zeby nie sprawdzac tego zamowienia co godzine.
      await prisma.$executeRaw`INSERT OR IGNORE INTO "PaymentReminder" ("orderId", "sentAt") VALUES (${o.id}, ${"skipped " + nowIso})`;
      result.skipped.push(o.orderNumber);
      continue;
    }

    const mail = await sendMail({
      to: o.customerEmail,
      subject: PAYMENT_REMINDER_SUBJECT(o.orderNumber),
      html: paymentReminderEmail({
        customerName: o.customerName,
        orderNumber: o.orderNumber,
        amount: fmtAmount(Number(o.amount), o.currency || "pln"),
        pickupPoint: o.pickupPoint || undefined,
        resumeUrl: resumePaymentUrl(o.id),
        cancelAfterDays: STALE_DAYS,
      }),
    });
    if (!mail.ok) {
      // Bez wpisu w PaymentReminder — sprobuje ponownie za godzine.
      result.failed.push(o.orderNumber);
      continue;
    }

    await prisma.$executeRaw`INSERT OR IGNORE INTO "PaymentReminder" ("orderId", "sentAt") VALUES (${o.id}, ${nowIso})`;
    const note = `[auto ${nowIso.slice(0, 10)}] Wysłano przypomnienie o niedokończonej płatności.`;
    await prisma.$executeRaw`
      UPDATE "Order" SET "adminNotes" = CASE
        WHEN "adminNotes" IS NULL OR "adminNotes" = '' THEN ${note}
        ELSE "adminNotes" || char(10) || ${note}
      END
      WHERE id = ${o.id}`;
    result.sent.push(o.orderNumber);
  }

  if (result.sent.length) console.log(`[paymentReminders] sent: ${result.sent.join(", ")}`);
  return result;
}
