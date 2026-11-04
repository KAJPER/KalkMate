// Wypozyczenia KalkMate (/wypozyczenie, /admin/rentals).
//
// Przeplyw:
//   1. Klient wybiera plan i placi (Przelewy24, TYLKO BLIK + przelewy — bez
//      kart, wiec bez chargebackow po tygodniach) oplate za najem + kaucje.
//      Wiersz "Rental" w stanie pending (sesja P24).
//   2. Webhook P24 -> paid: tworzymy zwykle "Order" (status paid) — dzieki
//      temu dzialaja etykiety Base Courier, sledzenie i maile wysylkowe.
//      NIE idziemy przez settleP24OrderPayment (mail "zakup", paragon za
//      urzadzenie). Paragon tylko z OPLATY za najem — kaucja to nie przychod
//      (fiscal.ts buildOrderReceipt -> rentalReceiptForOrder).
//   3. Admin przypisuje kalkulator (Device ID) -> Device.rentalUntil =
//      teraz + dni planu + RENTAL_SHIPPING_BUFFER_DAYS (deviceRental.ts:
//      po terminie serwer odcina AI). Stan active.
//   4. Przypomnienia (cron): 3 dni przed koncem i po terminie.
//   5. Zwrot: admin "Przyjmij zwrot" -> urzadzenie odpiete od konta i
//      ZABLOKOWANE (rentalLocked) do nastepnego najmu, notatka o zwrocie kaucji.
// Tabela poza Prisma (raw SQL, tworzona leniwie) — jak TokenPurchase.

import { randomInt, randomUUID } from "crypto";
import { prisma } from "@/lib/db";
import { setDeviceRental, ensureRentalColumns } from "@/lib/deviceRental";

export interface RentalPlan {
  id: string;
  days: number;
  feeGrosze: number;
  label: string;
  hint: string;
}

// Ceny najmu (brutto, PLN). Zmiana tutaj = zmiana na stronie i w platnosci.
export const RENTAL_PLANS: RentalPlan[] = [
  { id: "week", days: 7, feeGrosze: 7900, label: "Tydzień", hint: "Na sprawdzian albo kartkówkę" },
  { id: "month", days: 30, feeGrosze: 14900, label: "Miesiąc", hint: "Najczęściej wybierany" },
  { id: "season", days: 60, feeGrosze: 24900, label: "2 miesiące", hint: "Cały okres matur" },
];

export const RENTAL_DEPOSIT_GROSZE = 30000;
// Doliczane do okresu najmu przy przypisaniu: dostawa do Paczkomatu + czas na odeslanie.
export const RENTAL_SHIPPING_BUFFER_DAYS = 3;

export function getRentalPlan(id: unknown): RentalPlan | null {
  return RENTAL_PLANS.find((p) => p.id === id) ?? null;
}

// Wariant "bez kaucji po potwierdzeniu tozsamosci" (mojeID / mObywatel przez
// KIR) — wymaga umowy z dostawca. Do tego czasu kaucja jest zawsze.
export function depositFor(identityVerified: boolean): number {
  return identityVerified ? 0 : RENTAL_DEPOSIT_GROSZE;
}

export type RentalStatus = "pending" | "paid" | "active" | "returned" | "cancelled";

export interface RentalRow {
  id: string;
  rentalNumber: string;
  sessionId: string;
  status: RentalStatus;
  planId: string;
  days: number;
  feeGrosze: number;
  depositGrosze: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  addressStreet: string;
  addressPostcode: string;
  addressCity: string;
  pickupPoint: string;
  pickupPointAddress: string;
  orderId: string | null;
  deviceId: string | null;
  startAt: string | null;
  endAt: string | null;
  createdAt: string;
  paidAt: string | null;
  returnedAt: string | null;
  depositRefundedAt: string | null;
  remindBeforeAt: string | null;
  remindOverdueAt: string | null;
  notes: string | null;
}

let _ready = false;
export async function ensureRentalTable(): Promise<void> {
  if (_ready) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Rental" (
      "id"                 TEXT PRIMARY KEY,
      "rentalNumber"       TEXT NOT NULL UNIQUE,
      "sessionId"          TEXT NOT NULL UNIQUE,
      "status"             TEXT NOT NULL DEFAULT 'pending',
      "planId"             TEXT NOT NULL,
      "days"               INTEGER NOT NULL,
      "feeGrosze"          INTEGER NOT NULL,
      "depositGrosze"      INTEGER NOT NULL,
      "customerName"       TEXT NOT NULL,
      "customerEmail"      TEXT NOT NULL,
      "customerPhone"      TEXT NOT NULL,
      "addressStreet"      TEXT NOT NULL,
      "addressPostcode"    TEXT NOT NULL,
      "addressCity"        TEXT NOT NULL,
      "pickupPoint"        TEXT NOT NULL,
      "pickupPointAddress" TEXT NOT NULL,
      "orderId"            TEXT,
      "deviceId"           TEXT,
      "startAt"            TEXT,
      "endAt"              TEXT,
      "createdAt"          TEXT NOT NULL,
      "paidAt"             TEXT,
      "returnedAt"         TEXT,
      "depositRefundedAt"  TEXT,
      "remindBeforeAt"     TEXT,
      "remindOverdueAt"    TEXT,
      "notes"              TEXT
    )
  `);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Rental_status_idx" ON "Rental"("status", "endAt")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Rental_order_idx" ON "Rental"("orderId")`);
  _ready = true;
}

type RawRental = Omit<RentalRow, "days" | "feeGrosze" | "depositGrosze"> & {
  days: number | bigint; feeGrosze: number | bigint; depositGrosze: number | bigint;
};
const toRow = (r: RawRental): RentalRow => ({ ...r, days: Number(r.days), feeGrosze: Number(r.feeGrosze), depositGrosze: Number(r.depositGrosze) });

function nowIso(): string {
  return new Date().toISOString();
}

export async function createPendingRental(input: {
  sessionId: string;
  plan: RentalPlan;
  depositGrosze: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  addressStreet: string;
  addressPostcode: string;
  addressCity: string;
  pickupPoint: string;
  pickupPointAddress: string;
}): Promise<RentalRow> {
  await ensureRentalTable();
  const id = randomUUID();
  const rentalNumber = `KW-${Date.now().toString(36).toUpperCase()}${randomInt(0, 36 ** 2).toString(36).toUpperCase().padStart(2, "0")}`;
  await prisma.$executeRaw`
    INSERT INTO "Rental" ("id", "rentalNumber", "sessionId", "status", "planId", "days", "feeGrosze", "depositGrosze",
      "customerName", "customerEmail", "customerPhone", "addressStreet", "addressPostcode", "addressCity",
      "pickupPoint", "pickupPointAddress", "createdAt")
    VALUES (${id}, ${rentalNumber}, ${input.sessionId}, 'pending', ${input.plan.id}, ${input.plan.days}, ${input.plan.feeGrosze},
      ${input.depositGrosze}, ${input.customerName}, ${input.customerEmail}, ${input.customerPhone}, ${input.addressStreet},
      ${input.addressPostcode}, ${input.addressCity}, ${input.pickupPoint}, ${input.pickupPointAddress}, ${nowIso()})
  `;
  return (await getRental(id))!;
}

export async function getRental(id: string): Promise<RentalRow | null> {
  await ensureRentalTable();
  const rows = await prisma.$queryRaw<RawRental[]>`SELECT * FROM "Rental" WHERE "id" = ${id} LIMIT 1`;
  return rows[0] ? toRow(rows[0]) : null;
}

export async function findRentalBySession(sessionId: string): Promise<RentalRow | null> {
  await ensureRentalTable();
  const rows = await prisma.$queryRaw<RawRental[]>`SELECT * FROM "Rental" WHERE "sessionId" = ${sessionId} LIMIT 1`;
  return rows[0] ? toRow(rows[0]) : null;
}

export async function findRentalByOrderId(orderId: string): Promise<RentalRow | null> {
  await ensureRentalTable();
  const rows = await prisma.$queryRaw<RawRental[]>`SELECT * FROM "Rental" WHERE "orderId" = ${orderId} LIMIT 1`;
  return rows[0] ? toRow(rows[0]) : null;
}

export async function listRentals(limit = 300): Promise<RentalRow[]> {
  await ensureRentalTable();
  const rows = await prisma.$queryRaw<RawRental[]>`
    SELECT * FROM "Rental" WHERE "status" <> 'pending' OR "createdAt" > ${new Date(Date.now() - 7 * 86_400_000).toISOString()}
    ORDER BY "createdAt" DESC LIMIT ${limit}
  `;
  return rows.map(toRow);
}

export async function appendRentalNote(id: string, line: string): Promise<void> {
  await prisma.$executeRaw`
    UPDATE "Rental" SET "notes" = CASE WHEN "notes" IS NULL OR "notes" = '' THEN ${line} ELSE "notes" || char(10) || ${line} END
    WHERE "id" = ${id}
  `;
}

// pending -> paid + zamowienie do wysylki. Atomowo: drugi webhook nic nie zrobi.
// Zwraca wiersz po zmianie albo null, gdy juz byl oplacony.
export async function markRentalPaid(rental: RentalRow): Promise<RentalRow | null> {
  await ensureRentalTable();
  const claimed = await prisma.$executeRaw`
    UPDATE "Rental" SET "status" = 'paid', "paidAt" = ${nowIso()} WHERE "id" = ${rental.id} AND "status" = 'pending'
  `;
  if (claimed !== 1) return null;

  const orderId = randomUUID();
  const now = new Date();
  await prisma.order.create({
    data: {
      id: orderId,
      orderNumber: rental.rentalNumber,
      status: "paid",
      customerName: rental.customerName,
      customerEmail: rental.customerEmail,
      customerPhone: rental.customerPhone,
      pickupPoint: rental.pickupPoint,
      pickupPointAddress: rental.pickupPointAddress,
      p24SessionId: null,
      paymentProvider: "p24",
      amount: rental.feeGrosze + rental.depositGrosze,
      currency: "pln",
      customerAddressStreet: rental.addressStreet,
      customerAddressPostcode: rental.addressPostcode,
      customerAddressCity: rental.addressCity,
      customerCountry: "PL",
      paidAt: now,
      updatedAt: now,
      adminNotes:
        `WYPOŻYCZENIE ${rental.rentalNumber}: ${rental.days} dni, najem ${(rental.feeGrosze / 100).toFixed(2)} zł` +
        ` + kaucja ${(rental.depositGrosze / 100).toFixed(2)} zł (zwrotna). Przypisz kalkulator w /admin/rentals.`,
    },
  });
  await prisma.$executeRaw`UPDATE "Rental" SET "orderId" = ${orderId} WHERE "id" = ${rental.id}`;
  return getRental(rental.id);
}

// Przypisanie kalkulatora = start najmu. Dziala tez jako zmiana kalkulatora
// (poprzedni zostaje zablokowany — nie powinien miec AI poza najmem).
export async function assignRentalDevice(rental: RentalRow, deviceId: string): Promise<RentalRow> {
  await ensureRentalColumns();
  const start = new Date();
  const end = new Date(start.getTime() + (rental.days + RENTAL_SHIPPING_BUFFER_DAYS) * 86_400_000);
  if (rental.deviceId && rental.deviceId !== deviceId) {
    await setDeviceRental(rental.deviceId, null, true);
  }
  await setDeviceRental(deviceId, end.toISOString(), false);
  await prisma.$executeRaw`
    UPDATE "Rental" SET "deviceId" = ${deviceId}, "status" = 'active',
      "startAt" = COALESCE("startAt", ${start.toISOString()}), "endAt" = ${end.toISOString()},
      "remindBeforeAt" = NULL, "remindOverdueAt" = NULL
    WHERE "id" = ${rental.id}
  `;
  return (await getRental(rental.id))!;
}

// Przedluzenie (np. po doplacie) — od obecnego konca, nie od dzis.
export async function extendRental(rental: RentalRow, days: number): Promise<RentalRow> {
  if (!rental.endAt || !rental.deviceId) throw new Error("Najem nie jest aktywny (brak kalkulatora / daty konca).");
  const base = Math.max(new Date(rental.endAt).getTime(), Date.now());
  const end = new Date(base + days * 86_400_000).toISOString();
  await setDeviceRental(rental.deviceId, end, false);
  await prisma.$executeRaw`
    UPDATE "Rental" SET "endAt" = ${end}, "remindBeforeAt" = NULL, "remindOverdueAt" = NULL WHERE "id" = ${rental.id}
  `;
  await appendRentalNote(rental.id, `${nowIso().slice(0, 16)} przedłużono o ${days} dni (do ${end.slice(0, 10)})`);
  return (await getRental(rental.id))!;
}

// Zwrot: kalkulator odpiety od konta najemcy i zablokowany do nastepnego najmu.
export async function markRentalReturned(rental: RentalRow): Promise<RentalRow> {
  if (rental.deviceId) {
    await setDeviceRental(rental.deviceId, null, true);
    await prisma.device.updateMany({ where: { deviceId: rental.deviceId }, data: { userId: null, licenseCode: null } });
  }
  await prisma.$executeRaw`UPDATE "Rental" SET "status" = 'returned', "returnedAt" = ${nowIso()} WHERE "id" = ${rental.id}`;
  await appendRentalNote(rental.id, `${nowIso().slice(0, 16)} zwrot przyjęty — zrób reset fabryczny i zwróć kaucję`);
  return (await getRental(rental.id))!;
}

export async function markDepositRefunded(rental: RentalRow, note: string): Promise<RentalRow> {
  await prisma.$executeRaw`UPDATE "Rental" SET "depositRefundedAt" = ${nowIso()} WHERE "id" = ${rental.id}`;
  await appendRentalNote(rental.id, `${nowIso().slice(0, 16)} kaucja: ${note || "zwrócona w całości"}`);
  return (await getRental(rental.id))!;
}

export async function cancelRental(rental: RentalRow, reason: string): Promise<RentalRow> {
  if (rental.deviceId) await setDeviceRental(rental.deviceId, null, true);
  await prisma.$executeRaw`UPDATE "Rental" SET "status" = 'cancelled' WHERE "id" = ${rental.id}`;
  await appendRentalNote(rental.id, `${nowIso().slice(0, 16)} anulowano: ${reason || "—"}`);
  return (await getRental(rental.id))!;
}

// --- Przypomnienia (cron) ---
// Zwraca najmy do przypomnienia; flagi ustawiane atomowo, wiec dwa przebiegi
// crona nie wysla dwa razy.
export async function claimRentalReminders(): Promise<{ before: RentalRow[]; overdue: RentalRow[] }> {
  await ensureRentalTable();
  const now = Date.now();
  const soon = new Date(now + 3 * 86_400_000).toISOString();
  const nowStr = new Date(now).toISOString();
  const active = (await prisma.$queryRaw<RawRental[]>`
    SELECT * FROM "Rental" WHERE "status" = 'active' AND "endAt" IS NOT NULL
      AND (("remindBeforeAt" IS NULL AND "endAt" <= ${soon}) OR ("remindOverdueAt" IS NULL AND "endAt" <= ${nowStr}))
  `).map(toRow);
  const before: RentalRow[] = [];
  const overdue: RentalRow[] = [];
  for (const r of active) {
    if (r.endAt! <= nowStr && !r.remindOverdueAt) {
      const n = await prisma.$executeRaw`UPDATE "Rental" SET "remindOverdueAt" = ${nowStr}, "remindBeforeAt" = COALESCE("remindBeforeAt", ${nowStr}) WHERE "id" = ${r.id} AND "remindOverdueAt" IS NULL`;
      if (n === 1) overdue.push(r);
    } else if (!r.remindBeforeAt) {
      const n = await prisma.$executeRaw`UPDATE "Rental" SET "remindBeforeAt" = ${nowStr} WHERE "id" = ${r.id} AND "remindBeforeAt" IS NULL`;
      if (n === 1) before.push(r);
    }
  }
  return { before, overdue };
}

export function formatPln(grosze: number): string {
  return `${(grosze / 100).toFixed(grosze % 100 ? 2 : 0).replace(".", ",")} zł`;
}
