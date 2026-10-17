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
//
// Protokół agenta (kontrakt K6, audyt 2026-10-16):
// - claim przyjmuje opcjonalnie agentId (trwały uuid instancji); serwer
//   zapisuje go w "claimedBy". Zlecenie 'sent' bez raportu wraca po
//   RECLAIM_AFTER_MS TYLKO do tego samego agentId (albo do dowolnego, gdy
//   claimedBy jest NULL — stary agent bez agentId). Innemu agentowi oddaje je
//   wyłącznie admin (akcja "reassign").
// - raport odpowiada { ok, state, accepted }; accepted=false = agent ma
//   porzucić zlecenie bez drukowania (anulowane, już wydrukowane, cudze).
// - heartbeat: jeden wiersz FiscalAgent na agentId ('default' = stary agent).

import type { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireAdminAuth } from "@/lib/admin-auth";
import { getOrderCoupon } from "@/lib/coupons";
import { readOrderUnits } from "@/lib/orderPersonalization";
import { randomUUID, timingSafeEqual } from "crypto";

export type FiscalJobState =
  | "queued"           // czeka na agenta
  | "sent"             // agent pobrał (drukuje albo ponawia po błędzie przejściowym)
  | "cancel_requested" // admin anulował zlecenie już pobrane — agent dostaje accepted=false
  | "printed"          // paragon wydrukowany, znany numer
  | "failed"           // błąd wymagający poprawy danych / interwencji
  | "uncertain"        // nie wiadomo, czy paragon się wydrukował — sprawdź drukarkę
  | "cancelled"        // anulowane w panelu / zamówienie anulowane lub nieopłacone
  | "superseded";      // błędne/niepewne zlecenie zastąpione nowym (ponowienie)

// Stany, w których zlecenie NIE blokuje nowego dla tego samego zamówienia:
// 'cancelled', 'failed', 'superseded' — ta sama lista w częściowym indeksie
// unikalnym (ensureFiscalTables) i w findActiveJob(). Zmieniasz — zmień oba.

// Panel admina (src/app/admin/fiscal, OrderFiscalCard) zna tylko 6 starych
// stanów i wywraca się na nieznanym. W odpowiedziach dla panelu `state`
// zostaje w starym zbiorze wartości, a prawdziwy stan jest w `stateDetail`.
export type FiscalJobLegacyState = "queued" | "sent" | "printed" | "failed" | "uncertain" | "cancelled";
const LEGACY_STATE: Record<FiscalJobState, FiscalJobLegacyState> = {
  queued: "queued",
  sent: "sent",
  cancel_requested: "sent",
  printed: "printed",
  failed: "failed",
  uncertain: "uncertain",
  cancelled: "cancelled",
  superseded: "cancelled",
};

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
  claimedBy: string | null;
  printedAt: number | null;
}

export type FiscalJobAdminView = Omit<FiscalJob, "state"> & {
  state: FiscalJobLegacyState;
  stateDetail: FiscalJobState;
};

export function toAdminView(job: FiscalJob): FiscalJobAdminView {
  return { ...job, state: LEGACY_STATE[job.state] ?? "cancelled", stateDetail: job.state };
}

// Agent może zgubić odpowiedź claim (sieć) — po tym czasie zlecenie „sent” bez
// raportu wraca do kolejki TEGO SAMEGO agenta. Bezpieczne: agent rozpozna id
// i tylko odeśle stan.
const RECLAIM_AFTER_MS = 10 * 60_000;
export const AGENT_ONLINE_MS = 2 * 60_000;

// Cena JEDNOSTKOWA produktu — ta sama co PRODUCT_CENTS.pln w lib/checkoutPricing.ts.
export const PRODUCT_PRICE_PLN = 69900;
const PRODUCT_NAME = (process.env.FISCAL_PRODUCT_NAME || "KalkMate v3 kalkulator AI").slice(0, 40);
const VAT_RATE = (process.env.FISCAL_VAT_RATE || "23") as ReceiptItem["vat"];

let _ready: Promise<void> | null = null;
export function ensureFiscalTables(): Promise<void> {
  if (!_ready) {
    _ready = createFiscalTables().catch((e) => {
      _ready = null; // spróbuj ponownie przy następnym wywołaniu
      throw e;
    });
  }
  return _ready;
}

async function createFiscalTables(): Promise<void> {
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
  // Kolumna dodana później (K6) — leniwie, jak w attribution.ts.
  const cols = await prisma.$queryRawUnsafe<{ name: string }[]>(`PRAGMA table_info("FiscalJob")`);
  if (!cols.some((c) => c.name === "claimedBy")) {
    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE "FiscalJob" ADD COLUMN "claimedBy" TEXT`);
    } catch (e) {
      // Równoległe pierwsze wywołanie mogło już dodać kolumnę.
      if (!/duplicate column/i.test(String((e as Error)?.message))) throw e;
    }
  }
  // Najwyżej jedno AKTYWNE zlecenie na zamówienie — twarda gwarancja w bazie,
  // niezależna od sprawdzenia w kodzie (dwa równoległe kliknięcia/webhooki).
  try {
    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "FiscalJob_activeOrder" ON "FiscalJob" ("orderId")
      WHERE "orderId" IS NOT NULL AND "state" NOT IN ('cancelled', 'failed', 'superseded')`);
  } catch (e) {
    // Np. w bazie są już dwa aktywne zlecenia dla jednego zamówienia — nie
    // blokujemy całej fiskalizacji, zostaje sprawdzenie w kodzie.
    console.error("[fiscal] nie udało się założyć indeksu FiscalJob_activeOrder (duplikaty aktywnych zleceń?):", e);
  }
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "FiscalAgent" (
      "id"         TEXT PRIMARY KEY,
      "lastSeenAt" BIGINT NOT NULL,
      "version"    TEXT,
      "printer"    TEXT
    )`);
}

type JobRow = Omit<FiscalJob, "payload"> & { payload: string };
const toJob = (r: JobRow): FiscalJob => ({
  id: r.id,
  orderId: r.orderId,
  payload: JSON.parse(r.payload),
  state: r.state,
  receiptNumber: r.receiptNumber == null ? null : Number(r.receiptNumber),
  error: r.error,
  errorCode: r.errorCode == null ? null : Number(r.errorCode),
  category: r.category,
  attempts: Number(r.attempts),
  createdBy: r.createdBy,
  createdAt: Number(r.createdAt),
  updatedAt: Number(r.updatedAt),
  claimedAt: r.claimedAt == null ? null : Number(r.claimedAt),
  claimedBy: r.claimedBy ?? null,
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

/**
 * agentId z body/nagłówka → bezpieczny identyfikator albo null (stary agent).
 * 'default' jest zarezerwowane dla agentów bez agentId.
 */
export function normalizeAgentId(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const id = v.trim();
  if (!id || id.length > 100 || id === "default" || !/^[A-Za-z0-9._:-]+$/.test(id)) return null;
  return id;
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
  fulfillmentStatus: string | null;
  amount: number;
  currency: string;
  paymentProvider: string;
}

const ORDER_FOR_RECEIPT_SELECT = {
  id: true, orderNumber: true, status: true, fulfillmentStatus: true, amount: true, currency: true, paymentProvider: true,
} as const;

export async function buildOrderReceipt(order: OrderForReceipt): Promise<ReceiptPayload> {
  if (order.status !== "paid") throw new FiscalError("Zamówienie nie jest opłacone.");
  // Ręcznie anulowane opłacone zamówienie = pieniądze zwrócone klientowi.
  if (order.fulfillmentStatus === "cancelled") throw new FiscalError("Zamówienie jest anulowane (zwrot) — paragonu nie wystawiamy.");
  if (order.currency.toLowerCase() !== "pln") {
    // Paragon jest w PLN; sprzedaż w EUR (często WSTO/OSS) wymaga decyzji księgowej.
    throw new FiscalError("Zamówienie w walucie innej niż PLN — paragon tylko po decyzji księgowej (patrz docs/fiskalizacja).");
  }
  const coupon = await getOrderCoupon(order.id).catch(() => null);
  const discount = coupon?.discountCents ?? 0;
  // Liczba sztuk (kolumna "quantity", stare zamówienia = 1). Błąd bazy NIE jest
  // łapany: cichy powrót do 1 szt. zrobiłby z ceny pozostałych sztuk „wysyłkę”.
  const { quantity } = await readOrderUnits(order.id);
  const qty = Math.max(1, Math.floor(Number(quantity) || 1));
  const productGross = PRODUCT_PRICE_PLN * qty;
  const shipping = order.amount - (productGross - discount);

  let items: ReceiptItem[];
  // Wysyłka jest stała na zamówienie i zawsze dużo tańsza od sztuki — „wysyłka”
  // ≥ cena sztuki = niezgodna ilość/cena → pozycja zbiorcza zamiast fałszywej linii.
  if (shipping >= 0 && shipping < PRODUCT_PRICE_PLN && discount < productGross) {
    // Agenci liczą wartość pozycji jako quantity × unit_price − discount
    // (fiscal-agent models.Item.total, desktop printer.js normalizeReceipt).
    items = [{
      name: PRODUCT_NAME,
      quantity: String(qty),
      unit_price: PRODUCT_PRICE_PLN,
      vat: VAT_RATE,
      ...(discount ? { discount } : {}),
    }];
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

/** Zlecenia zamówienia dla panelu (state w starym zbiorze wartości, patrz toAdminView). */
export async function listJobsForOrder(orderId: string): Promise<FiscalJobAdminView[]> {
  await ensureFiscalTables();
  const rows = await prisma.$queryRaw<JobRow[]>`
    SELECT * FROM "FiscalJob" WHERE "orderId" = ${orderId} ORDER BY "createdAt" DESC`;
  return rows.map((r) => toAdminView(toJob(r)));
}

async function findActiveJob(orderId: string, excludeId: string | null = null): Promise<FiscalJob | null> {
  const rows = await prisma.$queryRaw<JobRow[]>`
    SELECT * FROM "FiscalJob"
    WHERE "orderId" = ${orderId} AND "state" NOT IN ('cancelled', 'failed', 'superseded')
      AND (${excludeId} IS NULL OR "id" <> ${excludeId})
    ORDER BY "createdAt" DESC LIMIT 1`;
  return rows[0] ? toJob(rows[0]) : null;
}

function activeJobError(active: FiscalJob): FiscalError {
  const msg: Partial<Record<FiscalJobState, string>> = {
    printed: `Paragon już wystawiony (nr ${active.receiptNumber}).`,
    uncertain: "Poprzednie zlecenie ma stan niepewny — sprawdź drukarkę i rozstrzygnij je w panelu Fiskalizacja.",
    cancel_requested: "Poprzednie zlecenie czeka na potwierdzenie anulowania przez agenta — rozstrzygnij je w panelu Fiskalizacja.",
  };
  return new FiscalError(msg[active.state] ?? "Paragon dla tego zamówienia jest już w kolejce.", 409);
}

export async function enqueueOrderReceipt(orderId: string, createdBy: "admin" | "auto"): Promise<FiscalJobAdminView> {
  await ensureFiscalTables();
  const order = await orderForReceipt(orderId);

  const active = await findActiveJob(orderId);
  if (active) throw activeJobError(active);
  const payload = await buildOrderReceipt(order);

  const id = await prisma.$transaction(async (tx) => {
    const newId = await createJob(tx, payload, orderId, createdBy);
    // Stare błędne zlecenia tego zamówienia zostały zastąpione nowym.
    await tx.$executeRaw`
      UPDATE "FiscalJob" SET "state" = 'superseded', "updatedAt" = ${Date.now()}
      WHERE "orderId" = ${orderId} AND "state" = 'failed' AND "id" <> ${newId}`;
    return newId;
  });
  return toAdminView((await getJob(id))!);
}

// INSERT z obsługą konfliktu z indeksem FiscalJob_activeOrder: drugi równoległy
// enqueue dla tego samego zamówienia nie wstawi nic → 409 zamiast duplikatu.
async function createJob(
  db: Prisma.TransactionClient,
  payload: ReceiptPayload,
  orderId: string | null,
  createdBy: string,
): Promise<string> {
  const now = Date.now();
  const id = `fj_${randomUUID()}`;
  const n = await db.$executeRaw`
    INSERT INTO "FiscalJob" ("id", "orderId", "payload", "state", "createdBy", "createdAt", "updatedAt")
    VALUES (${id}, ${orderId}, ${JSON.stringify(payload)}, 'queued', ${createdBy}, ${now}, ${now})
    ON CONFLICT DO NOTHING`;
  if (!n) throw new FiscalError("Paragon dla tego zamówienia jest już w kolejce.", 409);
  return id;
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

/**
 * Zamówienie anulowane (zwrot) — zlecenia jeszcze nie pobrane przez agenta
 * anulujemy, a pobrane ('sent') oznaczamy 'cancel_requested' (agent dostanie
 * accepted=false i porzuci je bez drukowania). Nigdy nie rzuca.
 */
export async function cancelOpenFiscalJobsForOrder(orderId: string, reason = "Zamówienie anulowane"): Promise<{ cancelled: number; cancelRequested: number }> {
  try {
    await ensureFiscalTables();
    const now = Date.now();
    const cancelled = await prisma.$executeRaw`
      UPDATE "FiscalJob" SET "state" = 'cancelled', "error" = ${reason}, "updatedAt" = ${now}
      WHERE "orderId" = ${orderId} AND "state" = 'queued'`;
    const cancelRequested = await prisma.$executeRaw`
      UPDATE "FiscalJob" SET "state" = 'cancel_requested', "error" = ${reason}, "updatedAt" = ${now}
      WHERE "orderId" = ${orderId} AND "state" = 'sent'`;
    return { cancelled, cancelRequested };
  } catch (e) {
    console.error(`[fiscal] anulowanie zleceń zamówienia ${orderId} nie powiodło się:`, e);
    return { cancelled: 0, cancelRequested: 0 };
  }
}

// --- Agent ---------------------------------------------------------------------

type ClaimRow = JobRow & { orderStatus: string | null; orderFulfillment: string | null; orderExists: number | bigint };

export async function agentClaim(info: { version?: string; printer?: unknown; agentId?: string | null }): Promise<FiscalJob | null> {
  await ensureFiscalTables();
  const agentId = info.agentId ?? null;
  const now = Date.now();
  await prisma.$executeRaw`
    INSERT INTO "FiscalAgent" ("id", "lastSeenAt", "version", "printer")
    VALUES (${agentId ?? "default"}, ${now}, ${String(info.version ?? "").slice(0, 40)}, ${JSON.stringify(info.printer ?? null).slice(0, 4000)})
    ON CONFLICT("id") DO UPDATE SET "lastSeenAt" = excluded."lastSeenAt", "version" = excluded."version", "printer" = excluded."printer"`;

  // Pętla: zlecenia dla anulowanych/nieopłaconych zamówień odkładamy i
  // bierzemy następne (każdy obrót zmienia stan jednego zlecenia).
  for (let i = 0; i < 25; i++) {
    const rows = await prisma.$queryRaw<ClaimRow[]>`
      SELECT j.*, o."status" AS "orderStatus", o."fulfillmentStatus" AS "orderFulfillment",
             CASE WHEN o."id" IS NULL THEN 0 ELSE 1 END AS "orderExists"
      FROM "FiscalJob" j LEFT JOIN "Order" o ON o."id" = j."orderId"
      WHERE j."state" = 'queued'
         OR (j."state" = 'sent' AND j."claimedAt" < ${now - RECLAIM_AFTER_MS}
             AND (j."claimedBy" IS NULL OR j."claimedBy" = ${agentId}))
      ORDER BY j."createdAt" LIMIT 1`;
    const row = rows[0];
    if (!row) return null;

    if (row.orderId != null) {
      const exists = Number(row.orderExists) === 1;
      const reason = !exists
        ? "zamówienie nie istnieje"
        : row.orderFulfillment === "cancelled"
          ? "zamówienie anulowane (zwrot)"
          : row.orderStatus !== "paid"
            ? "zamówienie nie jest opłacone"
            : null;
      if (reason) {
        if (row.state === "queued") {
          await prisma.$executeRaw`
            UPDATE "FiscalJob" SET "state" = 'cancelled', "error" = ${`Pominięte przy pobraniu przez agenta: ${reason}.`}, "updatedAt" = ${now}
            WHERE "id" = ${row.id} AND "state" = 'queued'`;
        } else {
          // 'sent' bez raportu — agent mógł już wydrukować, więc nie kasujemy
          // po cichu: prosimy o anulowanie, raport 'printed' nadal przejdzie.
          await prisma.$executeRaw`
            UPDATE "FiscalJob" SET "state" = 'cancel_requested', "error" = ${`Anulowanie: ${reason}.`}, "updatedAt" = ${now}
            WHERE "id" = ${row.id} AND "state" = 'sent' AND "updatedAt" = ${row.updatedAt}`;
        }
        continue;
      }
    }

    // Warunek na stan w UPDATE: dwa równoległe claimy nie dostaną tego samego zlecenia.
    const n = await prisma.$executeRaw`
      UPDATE "FiscalJob" SET "state" = 'sent', "claimedAt" = ${now}, "claimedBy" = ${agentId}, "updatedAt" = ${now}
      WHERE "id" = ${row.id} AND "state" = ${row.state} AND "updatedAt" = ${row.updatedAt}`;
    if (n) return getJob(row.id);
  }
  return null;
}

export interface AgentReport {
  state: "queued" | "printing" | "printed" | "failed" | "uncertain";
  receipt_number?: number | null;
  error?: string | null;
  error_code?: number | null;
  category?: string | null;
  attempts?: number;
}

export interface AgentReportResult {
  found: boolean;
  state: FiscalJobState | "unknown";
  accepted: boolean;
}

type ReportDecision =
  | { kind: "reject"; notePrinted: boolean }
  | { kind: "update"; next: FiscalJobState; accepted: boolean };

function decideReport(job: FiscalJob, r: AgentReport, agentId: string | null): ReportDecision {
  const printedReport = r.state === "printed";
  const owner = job.claimedBy == null || job.claimedBy === agentId;
  if (!owner) return { kind: "reject", notePrinted: printedReport };

  const reported: FiscalJobState =
    r.state === "printed" ? "printed" : r.state === "failed" ? "failed" : r.state === "uncertain" ? "uncertain" : "sent";

  switch (job.state) {
    case "sent":
      return { kind: "update", next: reported, accepted: true };
    case "cancel_requested":
      if (printedReport) return { kind: "update", next: "printed", accepted: true }; // prawda z drukarki wygrywa
      if (reported === "uncertain") return { kind: "update", next: "uncertain", accepted: true }; // mógł się wydrukować — admin rozstrzyga
      if (reported === "failed") return { kind: "update", next: "cancelled", accepted: false }; // nic nie wydrukowano
      // queued/printing: nowy agent (z agentId) porzuca zlecenie po accepted=false,
      // więc anulowanie jest zakończone; stary agent ignoruje odpowiedź — czekamy dalej.
      return agentId ? { kind: "update", next: "cancelled", accepted: false } : { kind: "reject", notePrinted: false };
    case "failed":
    case "uncertain":
      // Wynik z drukarki po lokalnym ponowieniu w agencie (np. rozstrzygnięcie
      // stanu niepewnego) — tylko od agenta, który zlecenie pobrał.
      return { kind: "update", next: reported, accepted: true };
    default:
      // queued (nikt go nie pobrał / admin przekazał dalej), printed, cancelled, superseded
      return { kind: "reject", notePrinted: printedReport };
  }
}

export async function agentReport(id: string, r: AgentReport, agentId: string | null = null): Promise<AgentReportResult> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const job = await getJob(id);
    if (!job) return { found: false, state: "unknown", accepted: false };

    // Ten sam raport 'printed' wysłany ponownie (zgubiona odpowiedź) — zgodny ze stanem.
    if (job.state === "printed" && r.state === "printed" && job.receiptNumber === Number(r.receipt_number)
      && (job.claimedBy == null || job.claimedBy === agentId)) {
      return { found: true, state: job.state, accepted: true };
    }

    const d = decideReport(job, r, agentId);
    if (d.kind === "reject") {
      if (d.notePrinted) await noteRejectedPrint(job, r, agentId);
      return { found: true, state: job.state, accepted: false };
    }

    const next = d.next;
    const now = Date.now();
    const error =
      next === "printed" ? null
        : next === "cancelled"
          ? `Anulowane — agent porzucił zlecenie bez drukowania${job.error && !job.error.startsWith("Anulowane w panelu") ? ` (${job.error})` : ""}.`.slice(0, 1000)
          : (r.error ?? null)?.slice(0, 1000) ?? null;
    // Warunek na poprzedni stan: raport nie nadpisze równoległej akcji admina.
    const n = await prisma.$executeRaw`
      UPDATE "FiscalJob" SET
        "state" = ${next},
        "receiptNumber" = ${next === "printed" ? (r.receipt_number ?? null) : null},
        "error" = ${error},
        "errorCode" = ${r.error_code ?? null},
        "category" = ${r.category ?? null},
        "attempts" = ${Number(r.attempts ?? job.attempts) || 0},
        "claimedAt" = ${next === "sent" ? now : job.claimedAt},
        "printedAt" = ${next === "printed" ? now : null},
        "updatedAt" = ${now}
      WHERE "id" = ${id} AND "state" = ${job.state} AND "updatedAt" = ${job.updatedAt}`;
    if (n) return { found: true, state: next, accepted: d.accepted };
  }
  const job = await getJob(id);
  return { found: Boolean(job), state: job?.state ?? "unknown", accepted: false };
}

// Paragon fizycznie wydrukowany, ale raportu nie przyjmujemy (zlecenie
// anulowane/zastąpione/cudze) — nie gubimy tej informacji: notatka w `error`
// widoczna w panelu + log.
async function noteRejectedPrint(job: FiscalJob, r: AgentReport, agentId: string | null): Promise<void> {
  const nr = Number(r.receipt_number) || null;
  if (job.state === "printed" && job.receiptNumber === nr) return;
  const note = `UWAGA: agent ${agentId ?? "(bez id)"} zgłosił wydruk paragonu nr ${nr ?? "?"} dla zlecenia w stanie ${job.state}${job.claimedBy ? ` (pobrał je ${job.claimedBy})` : ""} — sprawdź drukarkę.`;
  console.error(`[fiscal] ${job.id}: ${note}`);
  if (job.error && nr && job.error.includes(`nr ${nr} `)) return; // już zanotowane
  await prisma.$executeRaw`
    UPDATE "FiscalJob" SET "error" = ${(note + (job.error ? ` | ${job.error}` : "")).slice(0, 1000)}, "updatedAt" = ${Date.now()}
    WHERE "id" = ${job.id}`;
}

// --- Panel ---------------------------------------------------------------------

export interface FiscalAgentInfo {
  id: string;
  lastSeenAt: number;
  online: boolean;
  version: string | null;
  printer: unknown;
}

export async function listAgents(): Promise<FiscalAgentInfo[]> {
  await ensureFiscalTables();
  const rows = await prisma.$queryRaw<{ id: string; lastSeenAt: number | bigint; version: string | null; printer: string | null }[]>`
    SELECT "id", "lastSeenAt", "version", "printer" FROM "FiscalAgent" ORDER BY "lastSeenAt" DESC LIMIT 20`;
  const now = Date.now();
  return rows.map((r) => {
    const lastSeenAt = Number(r.lastSeenAt);
    let printer: unknown = null;
    try { printer = r.printer ? JSON.parse(r.printer) : null; } catch { /* stary wpis */ }
    return { id: r.id, lastSeenAt, online: now - lastSeenAt < AGENT_ONLINE_MS, version: r.version, printer };
  });
}

/** Najświeższy agent (kształt jak dawniej) + lista wszystkich w `agents`. */
export async function agentInfo() {
  const agents = await listAgents();
  const r = agents[0];
  if (!r) return { lastSeenAt: null, online: false, version: null, printer: null, agents };
  return { lastSeenAt: r.lastSeenAt, online: r.online, version: r.version, printer: r.printer, agents };
}

export async function listJobs(limit = 100) {
  await ensureFiscalTables();
  const rows = await prisma.$queryRaw<(JobRow & { orderNumber: string | null })[]>`
    SELECT j.*, o."orderNumber" AS "orderNumber"
    FROM "FiscalJob" j LEFT JOIN "Order" o ON o."id" = j."orderId"
    ORDER BY j."createdAt" DESC LIMIT ${limit}`;
  return rows.map((r) => ({ ...toAdminView(toJob(r)), orderNumber: r.orderNumber }));
}

export type AdminJobActionName = "retry" | "cancel" | "mark_printed" | "reassign";
export const ADMIN_JOB_ACTIONS: AdminJobActionName[] = ["retry", "cancel", "mark_printed", "reassign"];

const STATE_CHANGED = () => new FiscalError("Stan zlecenia zmienił się w międzyczasie — odśwież listę.", 409);

function isUniqueViolation(e: unknown): boolean {
  return /UNIQUE constraint failed/i.test(String((e as Error)?.message ?? e));
}

export async function adminJobAction(
  id: string,
  action: AdminJobActionName,
  receiptNumber?: number,
): Promise<FiscalJobAdminView> {
  const job = await getJob(id);
  if (!job) throw new FiscalError("Nie znaleziono zlecenia.", 404);
  const now = Date.now();

  if (action === "cancel") {
    let n: number;
    if (job.state === "sent") {
      // Agent już je ma — nie da się „odebrać”; prosimy o porzucenie (K6).
      n = await prisma.$executeRaw`
        UPDATE "FiscalJob" SET "state" = 'cancel_requested', "error" = 'Anulowane w panelu — czeka na potwierdzenie agenta', "updatedAt" = ${now}
        WHERE "id" = ${id} AND "state" = 'sent'`;
    } else if (job.state === "queued" || job.state === "failed" || job.state === "uncertain" || job.state === "cancel_requested") {
      // cancel_requested → cancelled: admin potwierdza, że agent nic nie wydrukował.
      n = await prisma.$executeRaw`
        UPDATE "FiscalJob" SET "state" = 'cancelled', "updatedAt" = ${now} WHERE "id" = ${id} AND "state" = ${job.state}`;
    } else {
      throw new FiscalError("Można anulować tylko zlecenie oczekujące, pobrane przez agenta, błędne albo niepewne.", 409);
    }
    if (!n) throw STATE_CHANGED();
    return toAdminView((await getJob(id))!);
  }

  if (action === "mark_printed") {
    if (job.state !== "uncertain" && job.state !== "failed" && job.state !== "cancel_requested") {
      throw new FiscalError("Tylko dla zleceń niepewnych, błędnych lub czekających na anulowanie.", 409);
    }
    if (!receiptNumber || !Number.isInteger(receiptNumber) || receiptNumber <= 0) throw new FiscalError("Podaj numer paragonu z drukarki.");
    if (job.orderId) {
      const other = await findActiveJob(job.orderId, job.id);
      if (other) throw new FiscalError("To zamówienie ma już inne aktywne zlecenie paragonu — rozstrzygnij najpierw je.", 409);
    }
    let n: number;
    try {
      n = await prisma.$executeRaw`
        UPDATE "FiscalJob" SET "state" = 'printed', "receiptNumber" = ${receiptNumber}, "printedAt" = ${now},
          "error" = 'Oznaczone ręcznie jako wydrukowane', "updatedAt" = ${now} WHERE "id" = ${id} AND "state" = ${job.state}`;
    } catch (e) {
      if (isUniqueViolation(e)) throw new FiscalError("To zamówienie ma już inne aktywne zlecenie paragonu.", 409);
      throw e;
    }
    if (!n) throw STATE_CHANGED();
    return toAdminView((await getJob(id))!);
  }

  if (action === "reassign") {
    // Jedyny sposób, żeby zlecenie pobrane przez jednego agenta trafiło do
    // innego (np. stary komputer padł). UWAGA: jeśli stary agent jednak żyje
    // i wydrukował — będzie drugi paragon; panel musi to potwierdzić.
    if (job.state !== "sent") throw new FiscalError("Przekazać innemu agentowi można tylko zlecenie pobrane przez agenta.", 409);
    const note = `Przekazane do ponownego pobrania przez admina (poprzednio: ${job.claimedBy ?? "agent bez id"})`;
    const n = await prisma.$executeRaw`
      UPDATE "FiscalJob" SET "state" = 'queued', "claimedBy" = NULL, "claimedAt" = NULL, "error" = ${note}, "updatedAt" = ${now}
      WHERE "id" = ${id} AND "state" = 'sent' AND "updatedAt" = ${job.updatedAt}`;
    if (!n) throw STATE_CHANGED();
    return toAdminView((await getJob(id))!);
  }

  // retry: nowe zlecenie z aktualnymi danymi (agent nie drukuje drugi raz tego samego id).
  if (job.state !== "failed" && job.state !== "uncertain") throw new FiscalError("Ponowić można tylko zlecenie błędne lub niepewne.", 409);
  // Błąd walidacji (zamówienie anulowane/zwrócone, nieopłacone, inna waluta)
  // MA zatrzymać ponowienie — bez cichego powrotu do starego payloadu.
  const payload = job.orderId ? await buildOrderReceipt(await orderForReceipt(job.orderId)) : job.payload;
  if (job.orderId) {
    const other = await findActiveJob(job.orderId, job.id);
    if (other) throw activeJobError(other);
  }
  const newId = await prisma.$transaction(async (tx) => {
    const n = await tx.$executeRaw`
      UPDATE "FiscalJob" SET "state" = 'superseded', "updatedAt" = ${now} WHERE "id" = ${id} AND "state" = ${job.state}`;
    if (!n) throw STATE_CHANGED();
    return createJob(tx, payload, job.orderId, "admin");
  });
  return toAdminView((await getJob(newId))!);
}

async function orderForReceipt(orderId: string): Promise<OrderForReceipt> {
  const o = await prisma.order.findUnique({ where: { id: orderId }, select: ORDER_FOR_RECEIPT_SELECT });
  if (!o) throw new FiscalError("Nie znaleziono zamówienia.", 404);
  return o;
}
