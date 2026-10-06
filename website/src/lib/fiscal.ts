// Fiskalizacja — kolejka paragonów dla lokalnego agenta (fiscal-agent/).
//
// Drukarka fiskalna stoi w sieci lokalnej, serwer w chmurze. Serwer NIE łączy
// się z drukarką: agent (Raspberry Pi / PC obok drukarki) sam co kilka sekund
// pyta /api/fiscal/agent/claim o zlecenie i odsyła wynik. Dzięki temu nie
// trzeba otwierać portów w routerze. Opis: docs/fiskalizacja/README.md.
//
// FiscalJob nie jest w Prisma schemie — raw SQL + lazy CREATE TABLE, jak Coupon.
// Daty jako ms w kolumnach BIGINT (przy INTEGER Prisma zgłasza przepełnienie
// int32). Jedno zlecenie = jeden paragon; ponowienie po błędzie
// tworzy NOWE zlecenie (nowe id), bo agent pamięta id i nigdy nie drukuje
// drugi raz tego samego (idempotencja po jego stronie).

import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdminAuth } from "@/lib/admin-auth";
import { getOrderCoupon } from "@/lib/coupons";
import { randomUUID, timingSafeEqual } from "crypto";

export type FiscalJobState =
  | "queued"     // czeka na agenta
  | "sent"       // agent pobrał (drukuje albo ponawia po błędzie przejściowym)
  | "printed"    // paragon wydrukowany, znany numer
  | "failed"     // błąd wymagający poprawy danych / interwencji
  | "uncertain"  // nie wiadomo, czy paragon się wydrukował — sprawdź drukarkę
  | "cancelled"; // anulowane w panelu albo zastąpione nowym zleceniem

export interface ReceiptItem {
  name: string;
  quantity?: string;
  unit_price: number; // grosze brutto
  vat: "23" | "8" | "5" | "0" | "zw";
  discount?: number;  // grosze brutto
}
export interface ReceiptPayment {
  type: "cash" | "card" | "transfer" | "voucher" | "credit" | "other";
  amount: number;
  name?: string;
}
export interface ReceiptPayload {
  items: ReceiptItem[];
  payments: ReceiptPayment[];
  reference?: string;
}

export interface FiscalJob {
  id: string;
  orderId: string | null;
  payload: ReceiptPayload;
  state: FiscalJobState;
  receiptNumber: number | null;
  error: string | null;
  errorCode: number | null;
  category: string | null;
  attempts: number;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
  claimedAt: number | null;
  printedAt: number | null;
}

// Agent może zgubić odpowiedź claim (sieć) — po tym czasie zlecenie „sent” bez
// raportu wraca do kolejki. Bezpieczne: agent rozpozna id i tylko odeśle stan.
const RECLAIM_AFTER_MS = 10 * 60_000;
export const AGENT_ONLINE_MS = 2 * 60_000;

// Cena produktu — ta sama co w create-payment-intent i p24/create-transaction.
export const PRODUCT_PRICE_PLN = 69900;
const PRODUCT_NAME = (process.env.FISCAL_PRODUCT_NAME || "KalkMate v3 kalkulator AI").slice(0, 40);
const VAT_RATE = (process.env.FISCAL_VAT_RATE || "23") as ReceiptItem["vat"];

let _ready = false;
export async function ensureFiscalTables(): Promise<void> {
  if (_ready) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "FiscalJob" (
      "id"            TEXT PRIMARY KEY,
      "orderId"       TEXT,
      "payload"       TEXT NOT NULL,
      "state"         TEXT NOT NULL DEFAULT 'queued',
      "receiptNumber" INTEGER,
      "error"         TEXT,
      "errorCode"     INTEGER,
      "category"      TEXT,
      "attempts"      INTEGER NOT NULL DEFAULT 0,
      "createdBy"     TEXT NOT NULL DEFAULT 'admin',
      "createdAt"     BIGINT NOT NULL,
      "updatedAt"     BIGINT NOT NULL,
      "claimedAt"     BIGINT,
      "printedAt"     BIGINT
    )`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "FiscalJob_orderId" ON "FiscalJob" ("orderId")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "FiscalJob_state" ON "FiscalJob" ("state", "createdAt")`);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "FiscalAgent" (
      "id"         TEXT PRIMARY KEY,
      "lastSeenAt" BIGINT NOT NULL,
      "version"    TEXT,
      "printer"    TEXT
    )`);
  _ready = true;
}

type JobRow = Omit<FiscalJob, "payload"> & { payload: string };
const toJob = (r: JobRow): FiscalJob => ({
  ...r,
  payload: JSON.parse(r.payload),
  receiptNumber: r.receiptNumber == null ? null : Number(r.receiptNumber),
  errorCode: r.errorCode == null ? null : Number(r.errorCode),
  attempts: Number(r.attempts),
  createdAt: Number(r.createdAt),
  updatedAt: Number(r.updatedAt),
  claimedAt: r.claimedAt == null ? null : Number(r.claimedAt),
  printedAt: r.printedAt == null ? null : Number(r.printedAt),
});

/** Agent = token FISCAL_AGENT_TOKEN (agent Python) albo sesja admina (agent w aplikacji KalkMate Admin). */
export async function agentAuthorized(request: NextRequest): Promise<boolean> {
  if (agentTokenValid(request.headers.get("x-fiscal-agent-token"))) return true;
  return (await requireAdminAuth(request)) === null;
}

export function agentTokenValid(header: string | null): boolean {
  const expected = process.env.FISCAL_AGENT_TOKEN || "";
  if (!expected || !header) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

// --- Paragon z zamówienia ----------------------------------------------------

export class FiscalError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

interface OrderForReceipt {
  id: string;
  orderNumber: string;
  status: string;
  amount: number;
  currency: string;
  paymentProvider: string;
}

export async function buildOrderReceipt(order: OrderForReceipt): Promise<ReceiptPayload> {
  if (order.status !== "paid") throw new FiscalError("Zamówienie nie jest opłacone.");
  if (order.currency.toLowerCase() !== "pln") {
    // Paragon jest w PLN; sprzedaż w EUR (często WSTO/OSS) wymaga decyzji księgowej.
    throw new FiscalError("Zamówienie w walucie innej niż PLN — paragon tylko po decyzji księgowej (patrz docs/fiskalizacja).");
  }
  const coupon = await getOrderCoupon(order.id).catch(() => null);
  const discount = coupon?.discountCents ?? 0;
  const shipping = order.amount - (PRODUCT_PRICE_PLN - discount);

  let items: ReceiptItem[];
  if (shipping >= 0 && discount < PRODUCT_PRICE_PLN) {
    items = [{ name: PRODUCT_NAME, unit_price: PRODUCT_PRICE_PLN, vat: VAT_RATE, ...(discount ? { discount } : {}) }];
    if (shipping > 0) items.push({ name: "Wysyłka", unit_price: shipping, vat: VAT_RATE });
  } else {
    // Cena była inna niż obecna (np. stare zamówienie) — jedna pozycja na całą kwotę.
    items = [{ name: PRODUCT_NAME, unit_price: order.amount, vat: VAT_RATE }];
  }
  const p24 = order.paymentProvider === "p24";
  return {
    items,
    payments: [{ type: p24 ? "transfer" : "other", amount: order.amount, name: p24 ? "Przelewy24" : "Stripe" }],
    reference: order.orderNumber,
  };
}

// --- Kolejka -----------------------------------------------------------------

export async function listJobsForOrder(orderId: string): Promise<FiscalJob[]> {
  await ensureFiscalTables();
  const rows = await prisma.$queryRaw<JobRow[]>`
    SELECT * FROM "FiscalJob" WHERE "orderId" = ${orderId} ORDER BY "createdAt" DESC`;
  return rows.map(toJob);
}

export async function enqueueOrderReceipt(orderId: string, createdBy: "admin" | "auto"): Promise<FiscalJob> {
  await ensureFiscalTables();
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, orderNumber: true, status: true, amount: true, currency: true, paymentProvider: true },
  });
  if (!order) throw new FiscalError("Nie znaleziono zamówienia.", 404);

  const active = (await listJobsForOrder(orderId)).find((j) => j.state !== "cancelled" && j.state !== "failed");
  if (active) {
    const msg: Record<string, string> = {
      printed: `Paragon już wystawiony (nr ${active.receiptNumber}).`,
      uncertain: "Poprzednie zlecenie ma stan niepewny — sprawdź drukarkę i rozstrzygnij je w panelu Fiskalizacja.",
    };
    throw new FiscalError(msg[active.state] ?? "Paragon dla tego zamówienia jest już w kolejce.", 409);
  }
  return createJob(await buildOrderReceipt(order), orderId, createdBy);
}

async function createJob(payload: ReceiptPayload, orderId: string | null, createdBy: string): Promise<FiscalJob> {
  const now = Date.now();
  const id = `fj_${randomUUID()}`;
  await prisma.$executeRaw`
    INSERT INTO "FiscalJob" ("id", "orderId", "payload", "state", "createdBy", "createdAt", "updatedAt")
    VALUES (${id}, ${orderId}, ${JSON.stringify(payload)}, 'queued', ${createdBy}, ${now}, ${now})`;
  return (await getJob(id))!;
}

export async function getJob(id: string): Promise<FiscalJob | null> {
  await ensureFiscalTables();
  const rows = await prisma.$queryRaw<JobRow[]>`SELECT * FROM "FiscalJob" WHERE "id" = ${id}`;
  return rows[0] ? toJob(rows[0]) : null;
}

/** Automatyczne kolejkowanie po opłaceniu (FISCAL_AUTO_ENQUEUE=1). Nigdy nie rzuca. */
export async function autoEnqueueOrderReceipt(orderId: string): Promise<void> {
  if (process.env.FISCAL_AUTO_ENQUEUE !== "1") return;
  try {
    await enqueueOrderReceipt(orderId, "auto");
  } catch (e) {
    console.warn(`[fiscal] auto-enqueue ${orderId}: ${e instanceof Error ? e.message : e}`);
  }
}

// --- Agent ---------------------------------------------------------------------

export async function agentClaim(info: { version?: string; printer?: unknown }): Promise<FiscalJob | null> {
  await ensureFiscalTables();
  const now = Date.now();
  await prisma.$executeRaw`
    INSERT INTO "FiscalAgent" ("id", "lastSeenAt", "version", "printer")
    VALUES ('default', ${now}, ${String(info.version ?? "").slice(0, 40)}, ${JSON.stringify(info.printer ?? null).slice(0, 4000)})
    ON CONFLICT("id") DO UPDATE SET "lastSeenAt" = excluded."lastSeenAt", "version" = excluded."version", "printer" = excluded."printer"`;

  const rows = await prisma.$queryRaw<JobRow[]>`
    SELECT * FROM "FiscalJob"
    WHERE "state" = 'queued' OR ("state" = 'sent' AND "claimedAt" < ${now - RECLAIM_AFTER_MS})
    ORDER BY "createdAt" LIMIT 1`;
  if (!rows[0]) return null;
  // Warunek na stan w UPDATE: dwa równoległe claimy nie dostaną tego samego zlecenia.
  const n = await prisma.$executeRaw`
    UPDATE "FiscalJob" SET "state" = 'sent', "claimedAt" = ${now}, "updatedAt" = ${now}
    WHERE "id" = ${rows[0].id} AND "updatedAt" = ${rows[0].updatedAt}`;
  return n ? getJob(rows[0].id) : null;
}

export interface AgentReport {
  state: "queued" | "printing" | "printed" | "failed" | "uncertain";
  receipt_number?: number | null;
  error?: string | null;
  error_code?: number | null;
  category?: string | null;
  attempts?: number;
}

export async function agentReport(id: string, r: AgentReport): Promise<boolean> {
  const job = await getJob(id);
  if (!job) return false;
  if (job.state === "printed") return true; // wynik ostateczny — nie cofamy
  const now = Date.now();
  const state: FiscalJobState =
    r.state === "printed" ? "printed" : r.state === "failed" ? "failed" : r.state === "uncertain" ? "uncertain" : "sent";
  // Zlecenie anulowane w panelu, a agent i tak je wydrukował — prawda z drukarki wygrywa.
  if (job.state === "cancelled" && state !== "printed") return true;
  await prisma.$executeRaw`
    UPDATE "FiscalJob" SET
      "state" = ${state},
      "receiptNumber" = ${state === "printed" ? (r.receipt_number ?? null) : null},
      "error" = ${state === "printed" ? null : (r.error ?? null)?.slice(0, 1000) ?? null},
      "errorCode" = ${r.error_code ?? null},
      "category" = ${r.category ?? null},
      "attempts" = ${Number(r.attempts ?? job.attempts)},
      "claimedAt" = ${state === "sent" ? now : job.claimedAt},
      "printedAt" = ${state === "printed" ? now : null},
      "updatedAt" = ${now}
    WHERE "id" = ${id}`;
  return true;
}

// --- Panel ---------------------------------------------------------------------

export async function agentInfo() {
  await ensureFiscalTables();
  const rows = await prisma.$queryRaw<{ lastSeenAt: number | bigint; version: string | null; printer: string | null }[]>`
    SELECT "lastSeenAt", "version", "printer" FROM "FiscalAgent" WHERE "id" = 'default'`;
  const r = rows[0];
  if (!r) return { lastSeenAt: null, online: false, version: null, printer: null };
  const lastSeenAt = Number(r.lastSeenAt);
  let printer: unknown = null;
  try { printer = r.printer ? JSON.parse(r.printer) : null; } catch { /* stary wpis */ }
  return { lastSeenAt, online: Date.now() - lastSeenAt < AGENT_ONLINE_MS, version: r.version, printer };
}

export async function listJobs(limit = 100) {
  await ensureFiscalTables();
  const rows = await prisma.$queryRaw<(JobRow & { orderNumber: string | null })[]>`
    SELECT j.*, o."orderNumber" AS "orderNumber"
    FROM "FiscalJob" j LEFT JOIN "Order" o ON o."id" = j."orderId"
    ORDER BY j."createdAt" DESC LIMIT ${limit}`;
  return rows.map((r) => ({ ...toJob(r), orderNumber: r.orderNumber }));
}

export async function adminJobAction(
  id: string,
  action: "retry" | "cancel" | "mark_printed",
  receiptNumber?: number,
): Promise<FiscalJob> {
  const job = await getJob(id);
  if (!job) throw new FiscalError("Nie znaleziono zlecenia.", 404);
  const now = Date.now();
  if (action === "cancel") {
    if (job.state !== "queued" && job.state !== "failed" && job.state !== "uncertain") {
      throw new FiscalError("Można anulować tylko zlecenie oczekujące, błędne albo niepewne.", 409);
    }
    await prisma.$executeRaw`UPDATE "FiscalJob" SET "state" = 'cancelled', "updatedAt" = ${now} WHERE "id" = ${id}`;
    return (await getJob(id))!;
  }
  if (action === "mark_printed") {
    if (job.state !== "uncertain" && job.state !== "failed") throw new FiscalError("Tylko dla zleceń niepewnych lub błędnych.", 409);
    if (!receiptNumber || !Number.isInteger(receiptNumber) || receiptNumber <= 0) throw new FiscalError("Podaj numer paragonu z drukarki.");
    await prisma.$executeRaw`
      UPDATE "FiscalJob" SET "state" = 'printed', "receiptNumber" = ${receiptNumber}, "printedAt" = ${now},
        "error" = 'Oznaczone ręcznie jako wydrukowane', "updatedAt" = ${now} WHERE "id" = ${id}`;
    return (await getJob(id))!;
  }
  // retry: nowe zlecenie z tymi samymi danymi (agent nie drukuje drugi raz tego samego id).
  if (job.state !== "failed" && job.state !== "uncertain") throw new FiscalError("Ponowić można tylko zlecenie błędne lub niepewne.", 409);
  await prisma.$executeRaw`UPDATE "FiscalJob" SET "state" = 'cancelled', "updatedAt" = ${now} WHERE "id" = ${id}`;
  const payload = job.orderId
    ? await buildOrderReceipt(await orderForReceipt(job.orderId)).catch(() => job.payload)
    : job.payload;
  return createJob(payload, job.orderId, "admin");
}

async function orderForReceipt(orderId: string): Promise<OrderForReceipt> {
  const o = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, orderNumber: true, status: true, amount: true, currency: true, paymentProvider: true },
  });
  if (!o) throw new FiscalError("Nie znaleziono zamówienia.", 404);
  return o;
}
