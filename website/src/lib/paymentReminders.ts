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
//
// Tu tez siedzi settleP24OrderPayment — JEDNA sciezka "zamowienie P24
// oplacone" (webhook P24, a gdy webhook nie dotarl: przypomnienie i
// auto-anulowanie po odpytaniu P24 o status transakcji).

import { prisma } from "@/lib/db";
import { sendMail } from "@/lib/mailer";
import { paymentReminderEmail, PAYMENT_REMINDER_SUBJECT, purchaseConfirmationEmail, localeFromCountry } from "@/lib/email-templates";
import { signLink, verifyLink } from "@/lib/linkTokens";
import { getTransactionBySessionId, p24StatusIsPaid, verifyTransaction, type P24TransactionInfo } from "@/lib/przelewy24";
import { getOrderCoupon, consumeCouponUsage } from "@/lib/coupons";
import { autoEnqueueOrderReceipt } from "@/lib/fiscal";
import { readOrderUnits } from "@/lib/orderPersonalization";
import { alertAdmin, appendOrderAdminNote, formatMinor, grantDevicePurchaseTrial } from "@/lib/checkoutPricing";

// Po ilu dniach bez platnosci zamowienie jest auto-anulowane (lib/orderCleanup.ts
// re-eksportuje te stala). Trzymana tutaj, zeby orderCleanup mogl importowac
// ten modul bez cyklu importow.
export const STALE_DAYS = 30;

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

// === Domkniecie platnosci P24 ===

interface SettleOrderRow {
  id: string;
  status: string;
  fulfillmentStatus: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  pickupPoint: string;
  pickupPointAddress: string;
  amount: number;
  currency: string | null;
  customerAddressStreet: string | null;
  customerAddressPostcode: string | null;
  customerAddressCity: string | null;
  customerCountry: string | null;
  userId: string | null;
}

export type SettleResult =
  | "settled"          // oplacone teraz, wszystkie kroki wykonane
  | "late_payment"     // wplata za zamowienie juz anulowane — zapisana, decyzja admina
  | "already_paid"     // ktos byl pierwszy (powtorzone powiadomienie) — nic nie robimy
  | "not_found"
  | "amount_mismatch"  // kwota/waluta z P24 != zamowienie — NIE weryfikujemy, alert
  | "verify_failed";   // P24 verify sie nie udal — webhook zwraca 500 (P24 ponowi)

// Oznacza zamowienie jako oplacone (atomowo: UPDATE ... WHERE status <> 'paid'
// i dalsze kroki tylko gdy zmienil sie 1 wiersz — rownolegle powiadomienia nie
// dubluja kuponu/maila/paragonu). alreadyVerified = P24 zwrocil status 2
// (zweryfikowana) — wtedy nie wolamy verify drugi raz.
export async function settleP24OrderPayment(p: {
  orderId: string;
  sessionId: string;
  p24OrderId: number;
  amount: number;
  currency: string;
  alreadyVerified?: boolean;
  source: "webhook" | "reminder" | "cleanup";
}): Promise<SettleResult> {
  const rows = await prisma.$queryRaw<SettleOrderRow[]>`
    SELECT id, status, "fulfillmentStatus", "orderNumber", "customerName", "customerEmail",
           "pickupPoint", "pickupPointAddress", amount, currency,
           "customerAddressStreet", "customerAddressPostcode", "customerAddressCity", "customerCountry", "userId"
    FROM "Order" WHERE id = ${p.orderId} LIMIT 1`;
  const order = rows[0];
  if (!order) return "not_found";
  if (order.status === "paid") return "already_paid";

  const day = new Date().toISOString().slice(0, 10);
  const orderCurrency = (order.currency || "pln").toLowerCase();
  const paidCurrency = String(p.currency || "").toLowerCase();

  // Druga linia obrony: kwota/waluta z powiadomienia vs zamowienie w bazie.
  if (Number(p.amount) !== Number(order.amount) || paidCurrency !== orderCurrency) {
    const marker = `kwota-P24 ${p.sessionId}`;
    const note = `[auto ${day}] [DO SPRAWDZENIA: kwota/waluta niezgodna — P24 ${formatMinor(p.amount, paidCurrency)}, zamowienie ${formatMinor(order.amount, orderCurrency)}; platnosc NIE zweryfikowana] ${marker}`;
    const added = await appendOrderAdminNote(order.id, note, marker).catch(() => false);
    if (added) {
      await alertAdmin(`P24: niezgodna kwota/waluta — ${order.orderNumber}`, [
        `Zamowienie: ${order.orderNumber} (${order.id})`,
        `Klient: ${order.customerEmail}`,
        `P24: ${formatMinor(p.amount, paidCurrency)} (sesja ${p.sessionId}, orderId P24 ${p.p24OrderId})`,
        `Zamowienie w bazie: ${formatMinor(order.amount, orderCurrency)}`,
        `Platnosci NIE zweryfikowano w P24 — sprawdz w panelu Przelewy24.`,
      ]);
    }
    return "amount_mismatch";
  }

  if (!p.alreadyVerified) {
    try {
      await verifyTransaction({
        sessionId: p.sessionId,
        orderId: Number(p.p24OrderId),
        amount: Number(p.amount),
        currency: String(p.currency).toUpperCase(),
      });
    } catch (err) {
      console.error(`[P24 settle] verify failed (${p.source}) ${order.orderNumber}:`, err);
      return "verify_failed";
    }
  }

  const wasCancelled = order.status !== "pending" || order.fulfillmentStatus === "cancelled";
  // Integer ms (nie ISO string!) — Prisma/SQLite trzyma DateTime jako INTEGER,
  // ISO string tutaj psuloby sortowanie "Order" po createdAt/updatedAt (SQLite
  // sortuje TEXT i INTEGER w oddzielnych blokach — patrz src/lib/orderDates.ts).
  const nowMs = Date.now();
  const changed = await prisma.$executeRaw`
    UPDATE "Order"
    SET status = 'paid', "paidAt" = ${nowMs}, "updatedAt" = ${nowMs}
    WHERE id = ${order.id} AND status <> 'paid'`;
  if (Number(changed) !== 1) return "already_paid";

  // Uzycie kuponu — konsumpcja rezerwacji (lib/coupons.ts), raz.
  try {
    const coupon = await getOrderCoupon(order.id);
    if (coupon) await consumeCouponUsage({ code: coupon.code, ref: order.id });
  } catch (err) {
    console.error("[P24 settle] coupon usage failed:", err);
  }

  if (wasCancelled) {
    // Wplata za zamowienie juz anulowane (np. auto-anulowanie po 30 dniach):
    // platnosc zapisana, fulfillmentStatus BEZ zmian — wysylka albo zwrot to
    // decyzja wlasciciela. Bez maila do klienta i bez paragonu z automatu.
    const marker = `po-anulowaniu ${p.sessionId}`;
    const note = `[auto ${day}] [WPŁATA PO ANULOWANIU — zdecyduj: wysyłka czy zwrot] P24 ${formatMinor(p.amount, paidCurrency)} ${marker}`;
    await appendOrderAdminNote(order.id, note, marker).catch((e) => console.error("[P24 settle] note failed:", e));
    await alertAdmin(`Wpłata po anulowaniu — ${order.orderNumber}`, [
      `Zamowienie: ${order.orderNumber} (${order.id}) bylo anulowane, a P24 zglosilo wplate.`,
      `Klient: ${order.customerName} <${order.customerEmail}>`,
      `Kwota: ${formatMinor(p.amount, paidCurrency)} (sesja ${p.sessionId})`,
      `Status platnosci ustawiony na "paid", fulfillmentStatus bez zmian ("${order.fulfillmentStatus}").`,
      `Zdecyduj: wysylka czy zwrot.`,
    ]);
    return "late_payment";
  }

  // Zakup kalkulatora = 30 dni AI (bez skracania dluzszego dostepu).
  try {
    await grantDevicePurchaseTrial(order.userId);
  } catch (err) {
    console.error("[P24 settle] subscription update failed:", err);
  }

  if (p.source !== "webhook") {
    const note = `[auto ${day}] Platnosc P24 domknieta automatycznie (${p.source}) — webhook P24 nie dotarl, status sprawdzony w API P24.`;
    await appendOrderAdminNote(order.id, note).catch(() => {});
  }

  console.log(`[P24 settle] ✅ Order paid (${p.source}): ${order.orderNumber} for ${order.customerEmail}`);

  // Paragon do kolejki agenta fiskalnego (tylko gdy FISCAL_AUTO_ENQUEUE=1) — lib/fiscal.ts.
  await autoEnqueueOrderReceipt(order.id);

  // Send confirmation email
  try {
    // Ilosc + imiona na etykietach (SELECT * w readOrderUnits — nie wywraca
    // sie na brakujacych kolumnach; blad = mail jak dla 1 sztuki bez listy).
    const orderUnits = await readOrderUnits(order.id).catch(() => ({ quantity: 1, units: [] as { code: string; name: string }[] }));
    const locale = localeFromCountry(order.customerCountry);
    const subject = locale === "de"
      ? `Bestellbestätigung ${order.orderNumber} – KalkMate`
      : locale === "en"
        ? `Order confirmation ${order.orderNumber} – KalkMate`
        : `Potwierdzenie zamówienia ${order.orderNumber} - KalkMate`;
    await sendMail({
      to: order.customerEmail,
      subject,
      html: purchaseConfirmationEmail({
        customerName: order.customerName || "Kliencie",
        customerEmail: order.customerEmail,
        product: "KalkMate v3.0",
        amount: order.amount,
        currency: order.currency || "pln",
        pickupPoint: order.pickupPoint || "",
        pickupPointAddress: order.pickupPointAddress || "",
        deliveryAddress: [order.customerAddressStreet, [order.customerAddressPostcode, order.customerAddressCity].filter(Boolean).join(" "), order.customerCountry]
          .filter(Boolean).join(", "),
        orderId: order.orderNumber,
        quantity: orderUnits.quantity,
        unitNames: orderUnits.units.map((u) => u.name),
      }, locale),
    });
    console.log(`[P24 settle] ✅ Confirmation email sent to ${order.customerEmail}`);
  } catch (emailErr) {
    console.error("[P24 settle] Email failed:", emailErr);
  }

  return "settled";
}

// Czy ktoras z sesji P24 zamowienia (pierwotna + z linku "Dokoncz platnosc")
// jest oplacona? error = P24 nie odpowiedzial — wywolujacy pomija rekord w tym
// przebiegu (fail-safe: lepiej przypomniec/anulowac godzine pozniej niz
// anulowac oplacone zamowienie).
export type P24OrderCheck =
  | { state: "paid"; info: P24TransactionInfo }
  | { state: "unpaid" }
  | { state: "error"; error: string };

export async function checkP24OrderPayment(orderId: string, primarySessionId: string | null): Promise<P24OrderCheck> {
  await ensureTables();
  const extra = await prisma.$queryRaw<{ sessionId: string }[]>`
    SELECT "sessionId" FROM "OrderPaymentSession" WHERE "orderId" = ${orderId}`;
  const sessions = Array.from(new Set([primarySessionId, ...extra.map((r) => r.sessionId)].filter((x): x is string => !!x)));
  for (const sessionId of sessions) {
    let info: P24TransactionInfo;
    try {
      info = await getTransactionBySessionId(sessionId);
    } catch (e) {
      return { state: "error", error: e instanceof Error ? e.message : String(e) };
    }
    if (info.found && p24StatusIsPaid(info.status)) return { state: "paid", info };
  }
  return { state: "unpaid" };
}

export function settleFromP24Check(orderId: string, info: P24TransactionInfo, source: "reminder" | "cleanup"): Promise<SettleResult> {
  return settleP24OrderPayment({
    orderId,
    sessionId: info.sessionId,
    p24OrderId: info.orderId,
    amount: info.amount,
    currency: info.currency,
    alreadyVerified: info.status === 2,
    source,
  });
}

// === Wysylka przypomnien ===

interface Candidate {
  id: string;
  p24SessionId: string | null;
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
  settled?: string[];  // P24 zglasza wplate (webhook nie dotarl) — domkniete zamiast przypomnienia
  deferred?: string[]; // P24 nie odpowiedzial — sprobujemy w nastepnym przebiegu
}

export async function sendPaymentReminders(): Promise<ReminderResult> {
  await ensureTables();
  const now = Date.now();
  const newest = now - REMIND_AFTER_HOURS * 3600_000;
  const oldest = now - MAX_AGE_DAYS * 86400_000;

  // createdAt bywa INTEGER (ms) albo TEXT ISO — patrz komentarz w orderCleanup.ts.
  const rows = await prisma.$queryRaw<Candidate[]>`
    SELECT o.id, o."p24SessionId", o."orderNumber", o."customerName", o."customerEmail", o."pickupPoint",
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

  const settled: string[] = [];
  const deferred: string[] = [];
  const result: ReminderResult = { sent: [], skipped: [], failed: [], settled, deferred };

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

    // Zanim przypomnimy: czy P24 nie ma juz wplaty (zgubiony webhook)?
    const p24 = await checkP24OrderPayment(o.id, o.p24SessionId);
    if (p24.state === "error") {
      console.warn(`[paymentReminders] P24 status check failed for ${o.orderNumber}, skip this run: ${p24.error}`);
      deferred.push(o.orderNumber);
      continue;
    }
    if (p24.state === "paid") {
      const r = await settleFromP24Check(o.id, p24.info, "reminder");
      if (r === "verify_failed") {
        deferred.push(o.orderNumber);
      } else {
        await prisma.$executeRaw`INSERT OR IGNORE INTO "PaymentReminder" ("orderId", "sentAt") VALUES (${o.id}, ${"p24-" + r + " " + nowIso})`;
        settled.push(o.orderNumber);
      }
      continue;
    }

    const reminderQty = await readOrderUnits(o.id).then((r) => r.quantity).catch(() => 1);
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
        quantity: reminderQty,
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
