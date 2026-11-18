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
//   3. Admin przypisuje kalkulator (Device ID) -> stan active, TYMCZASOWY
//      termin: teraz + dni planu + RENTAL_SHIPPING_BUFFER_DAYS (deviceRental.ts:
//      po terminie serwer odcina AI) — gdyby odbior nigdy nie zostal wykryty.
//   3b. Najem liczy sie OD ODBIORU paczki: cron (syncRentalPickups) czeka na
//      status InPost "delivered" i przelicza: start = odbior, koniec = odbior
//      + dni (+ przedluzenia) + RENTAL_RETURN_GRACE_DAYS. Admin moze to zrobic
//      recznie ("Odebrano") — np. gdy paczka nie szla przez InPost.
//   4. Przypomnienia (cron): 3 dni przed koncem i po terminie.
//   5. Zwrot: admin "Przyjmij zwrot" -> urzadzenie odpiete od konta i
//      ZABLOKOWANE (rentalLocked) do nastepnego najmu, notatka o zwrocie kaucji.
// Tabela poza Prisma (raw SQL, tworzona leniwie) — jak TokenPurchase.

import { randomBytes, randomInt, randomUUID } from "crypto";
import { prisma } from "@/lib/db";
import { setDeviceRental, ensureRentalColumns } from "@/lib/deviceRental";

// Cennik: lib/content/rentalPlans.ts (wspolny ze strona).
import { RENTAL_PLANS, RENTAL_DEPOSIT_GROSZE, rentalFeeNow, type RentalPlan } from "@/lib/content/rentalPlans";
export { RENTAL_PLANS, RENTAL_DEPOSIT_GROSZE, type RentalPlan };

// Doliczane do okresu najmu przy przypisaniu: dostawa do Paczkomatu + czas na odeslanie.
export const RENTAL_SHIPPING_BUFFER_DAYS = 3;
// Po odbiorze: najem = dni planu od odbioru + ten zapas na nadanie zwrotu.
export const RENTAL_RETURN_GRACE_DAYS = 1;

// Plan z cena obowiazujaca TERAZ (promocje: rentalFeeNow) — kwota platnosci.
export function getRentalPlan(id: unknown): RentalPlan | null {
  const plan = RENTAL_PLANS.find((p) => p.id === id);
  return plan ? { ...plan, feeGrosze: rentalFeeNow(plan) } : null;
}

// Bez kaucji po pozytywnej weryfikacji tozsamosci w Didit (lib/didit.ts):
// imie i nazwisko z dowodu = najemca, ukonczone 18 lat.
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
  // Weryfikacja tozsamosci (Didit): null = najem z kaucja.
  identityStatus: IdentityStatus | null;
  identitySessionId: string | null;
  identityName: string | null;
  identityCheckedAt: string | null;
  // Losowy sekret strony powrotu z Didit (/wypozyczenie?r=<id>&t=<token>).
  accessToken: string | null;
  // Odbior paczki z kalkulatorem (InPost "delivered" albo reczne "Odebrano").
  // null = jeszcze w drodze — okres najmu jest tymczasowy.
  pickedUpAt: string | null;
}

export type IdentityStatus = "pending" | "approved" | "declined" | "mismatch" | "review";

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
  // Kolumny dodane po pierwszym wdrozeniu (weryfikacja Didit).
  const cols = await prisma.$queryRawUnsafe<{ name: string }[]>(`PRAGMA table_info("Rental")`);
  for (const c of ["identityStatus", "identitySessionId", "identityName", "identityCheckedAt", "accessToken", "pickedUpAt"]) {
    if (!cols.some((x) => x.name === c)) await prisma.$executeRawUnsafe(`ALTER TABLE "Rental" ADD COLUMN "${c}" TEXT`);
  }
  // Kazda rejestracja platnosci P24 dla najmu (sesja + kwota). Webhook szuka
  // tu, nie tylko w Rental.sessionId — klient mogl zaczac platnosc, wrocic,
  // zaplacic ponownie (nowa sesja), a potem jednak dokonczyc pierwsza.
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "RentalPaySession" (
      "sessionId" TEXT PRIMARY KEY,
      "rentalId"  TEXT NOT NULL,
      "amount"    INTEGER NOT NULL,
      "deposit"   INTEGER NOT NULL,
      "createdAt" TEXT NOT NULL
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
  const accessToken = randomBytes(24).toString("hex");
  const rentalNumber = `KW-${Date.now().toString(36).toUpperCase()}${randomInt(0, 36 ** 2).toString(36).toUpperCase().padStart(2, "0")}`;
  await prisma.$executeRaw`
    INSERT INTO "Rental" ("id", "rentalNumber", "sessionId", "status", "planId", "days", "feeGrosze", "depositGrosze",
      "customerName", "customerEmail", "customerPhone", "addressStreet", "addressPostcode", "addressCity",
      "pickupPoint", "pickupPointAddress", "createdAt", "accessToken")
    VALUES (${id}, ${rentalNumber}, ${input.sessionId}, 'pending', ${input.plan.id}, ${input.plan.days}, ${input.plan.feeGrosze},
      ${input.depositGrosze}, ${input.customerName}, ${input.customerEmail}, ${input.customerPhone}, ${input.addressStreet},
      ${input.addressPostcode}, ${input.addressCity}, ${input.pickupPoint}, ${input.pickupPointAddress}, ${nowIso()}, ${accessToken})
  `;
  const row = (await getRental(id))!;
  await recordRentalPaySession(row);
  return row;
}

export async function getRental(id: string): Promise<RentalRow | null> {
  await ensureRentalTable();
  const rows = await prisma.$queryRaw<RawRental[]>`SELECT * FROM "Rental" WHERE "id" = ${id} LIMIT 1`;
  return rows[0] ? toRow(rows[0]) : null;
}

export async function recordRentalPaySession(rental: RentalRow): Promise<void> {
  await prisma.$executeRaw`
    INSERT OR IGNORE INTO "RentalPaySession" ("sessionId", "rentalId", "amount", "deposit", "createdAt")
    VALUES (${rental.sessionId}, ${rental.id}, ${rental.feeGrosze + rental.depositGrosze}, ${rental.depositGrosze}, ${nowIso()})`;
}

// Webhook P24: najem + kwota i kaucja TEJ sesji platnosci.
export async function findRentalPayment(sessionId: string): Promise<{ rental: RentalRow; amount: number; deposit: number } | null> {
  await ensureRentalTable();
  const rows = await prisma.$queryRaw<{ rentalId: string; amount: number | bigint; deposit: number | bigint }[]>`
    SELECT "rentalId", "amount", "deposit" FROM "RentalPaySession" WHERE "sessionId" = ${sessionId} LIMIT 1`;
  if (!rows[0]) return null;
  const rental = await getRental(rows[0].rentalId);
  return rental ? { rental, amount: Number(rows[0].amount), deposit: Number(rows[0].deposit) } : null;
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

// Strona powrotu z Didit: id + token (staly czas porownania nie jest tu
// potrzebny — token 48 hex, a odpowiedz nie zdradza, ktora czesc byla zla).
export async function getRentalByAccess(id: unknown, token: unknown): Promise<RentalRow | null> {
  if (typeof id !== "string" || typeof token !== "string" || !/^[0-9a-f-]{36}$/.test(id) || !/^[0-9a-f]{48}$/.test(token)) return null;
  const r = await getRental(id);
  return r && r.accessToken === token ? r : null;
}

export async function setRentalIdentityPending(id: string, diditSessionId: string): Promise<void> {
  await prisma.$executeRaw`
    UPDATE "Rental" SET "identityStatus" = 'pending', "identitySessionId" = ${diditSessionId} WHERE "id" = ${id}`;
}

// Wynik z webhooka Didit. Tylko dla nieoplaconego najmu (pozniej bez znaczenia).
export async function setRentalIdentityResult(id: string, status: IdentityStatus, name: string | null): Promise<boolean> {
  const n = await prisma.$executeRaw`
    UPDATE "Rental" SET "identityStatus" = ${status}, "identityName" = ${name}, "identityCheckedAt" = ${nowIso()}
    WHERE "id" = ${id} AND "status" = 'pending'`;
  return n === 1;
}

// Przed rejestracja platnosci po weryfikacji: nowa sesja P24 (kazda proba
// placenia = nowa rejestracja) i kaucja wg wyniku weryfikacji / wyboru klienta.
export async function prepareRentalPayment(rental: RentalRow, depositGrosze: number): Promise<RentalRow | null> {
  const sessionId = `km-rent-${randomUUID()}`;
  const n = await prisma.$executeRaw`
    UPDATE "Rental" SET "sessionId" = ${sessionId}, "depositGrosze" = ${depositGrosze}
    WHERE "id" = ${rental.id} AND "status" = 'pending'`;
  if (n !== 1) return null;
  const updated = (await getRental(rental.id))!;
  await recordRentalPaySession(updated);
  return updated;
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
// paidDeposit = kaucja z oplaconej sesji (moze sie roznic od ostatnio
// przygotowanej, gdy klient dokonczyl wczesniejsza platnosc).
export async function markRentalPaid(rental: RentalRow, paidSessionId?: string, paidDeposit?: number): Promise<RentalRow | null> {
  await ensureRentalTable();
  const deposit = paidDeposit ?? rental.depositGrosze;
  const claimed = await prisma.$executeRaw`
    UPDATE "Rental" SET "status" = 'paid', "paidAt" = ${nowIso()}, "depositGrosze" = ${deposit},
      "sessionId" = ${paidSessionId ?? rental.sessionId}
    WHERE "id" = ${rental.id} AND "status" = 'pending'
  `;
  if (claimed !== 1) return null;
  rental = { ...rental, depositGrosze: deposit };

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
  // Zamiana kalkulatora PO odbiorze: okres juz policzony od odbioru — zostaje.
  if (rental.pickedUpAt && rental.endAt) {
    if (rental.deviceId && rental.deviceId !== deviceId) await setDeviceRental(rental.deviceId, null, true);
    await setDeviceRental(deviceId, rental.endAt, false);
    await prisma.$executeRaw`UPDATE "Rental" SET "deviceId" = ${deviceId} WHERE "id" = ${rental.id}`;
    return (await getRental(rental.id))!;
  }
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

// Odbior paczki -> start najmu. Dlugosc = obecny okres bez zapasu na dostawe
// (czyli dni planu + ewentualne przedluzenia sprzed odbioru) + zapas na zwrot.
// Atomowo (pickedUpAt IS NULL): cron i reczne "Odebrano" nie policza dwa razy.
export async function startRentalAtPickup(rental: RentalRow, pickedUpAt: Date, source: string): Promise<RentalRow | null> {
  if (rental.status !== "active" || rental.pickedUpAt || !rental.deviceId) return null;
  const day = 86_400_000;
  let durationMs = rental.days * day;
  if (rental.startAt && rental.endAt) {
    const provisional = new Date(rental.endAt).getTime() - new Date(rental.startAt).getTime() - RENTAL_SHIPPING_BUFFER_DAYS * day;
    durationMs = Math.max(durationMs, provisional);
  }
  const startIso = pickedUpAt.toISOString();
  // Nigdy krocej niz tymczasowy termin z przypisania (stara zasada regulaminu:
  // od nadania + 3 dni) — szybki odbior nie skraca najmu.
  const endMs = Math.max(
    pickedUpAt.getTime() + durationMs + RENTAL_RETURN_GRACE_DAYS * day,
    rental.endAt ? new Date(rental.endAt).getTime() : 0,
  );
  const end = new Date(endMs).toISOString();
  const n = await prisma.$executeRaw`
    UPDATE "Rental" SET "pickedUpAt" = ${startIso}, "startAt" = ${startIso}, "endAt" = ${end},
      "remindBeforeAt" = NULL, "remindOverdueAt" = NULL
    WHERE "id" = ${rental.id} AND "status" = 'active' AND "pickedUpAt" IS NULL`;
  if (n !== 1) return null;
  await setDeviceRental(rental.deviceId, end, false);
  await appendRentalNote(rental.id, `${nowIso().slice(0, 16)} odebrano ${startIso.slice(0, 16)} (${source}) — najem do ${end.slice(0, 10)}`);
  // Mail "najem rozpoczety" z data konca (regulamin: date konca Najemca dostaje mailem).
  try {
    const [{ sendMail }, { rentalStartedEmail, RENTAL_EMAIL_SUBJECTS }] = await Promise.all([
      import("@/lib/mailer"), import("@/lib/email-templates"),
    ]);
    const res = await sendMail({
      to: rental.customerEmail,
      subject: RENTAL_EMAIL_SUBJECTS.started,
      html: rentalStartedEmail({
        customerName: rental.customerName, rentalNumber: rental.rentalNumber, days: rental.days,
        fee: formatPln(rental.feeGrosze), deposit: formatPln(rental.depositGrosze),
        endDate: new Date(end).toLocaleDateString("pl-PL", { timeZone: "Europe/Warsaw" }),
      }),
    });
    if (!res.ok) await appendRentalNote(rental.id, `${nowIso().slice(0, 16)} mail o starcie najmu NIE wyslany`);
  } catch (e) {
    console.error("[rentals] started email failed", rental.id, e);
  }
  return getRental(rental.id);
}

// Cron: aktywne najmy bez odbioru, ktorych paczka (zamowienie) ma numer InPost
// -> sprawdz, czy klient juz odebral ("delivered"). Do 4 zapytan naraz.
export async function syncRentalPickups(limit = 100): Promise<{ checked: number; started: string[] }> {
  await ensureRentalTable();
  const { looksLikeInPostNumber, fetchInPostTracking, mapWithConcurrency } = await import("@/lib/inpostTracking");
  const rows = (await prisma.$queryRaw<(RawRental & { trackingNumber: string | null })[]>`
    SELECT r.*, o."trackingNumber" AS "trackingNumber" FROM "Rental" r JOIN "Order" o ON o."id" = r."orderId"
    WHERE r."status" = 'active' AND r."pickedUpAt" IS NULL AND r."deviceId" IS NOT NULL AND o."trackingNumber" IS NOT NULL
    ORDER BY r."createdAt" DESC LIMIT ${limit}
  `).filter((r) => looksLikeInPostNumber(r.trackingNumber));
  const started: string[] = [];
  await mapWithConcurrency(rows, 4, async (r) => {
    const t = await fetchInPostTracking(r.trackingNumber!.trim());
    if (!t) return null;
    const ev = t.events.find((e) => e.status === "delivered");
    if (t.status !== "delivered" && !ev) return null;
    const when = ev?.datetime ? new Date(ev.datetime) : new Date();
    const at = Number.isNaN(when.getTime()) || when.getTime() > Date.now() ? new Date() : when;
    const { trackingNumber: _tn, ...raw } = r;
    void _tn;
    const done = await startRentalAtPickup(toRow(raw), at, "InPost");
    if (done) started.push(done.rentalNumber);
    return null;
  }, "rentalPickups");
  return { checked: rows.length, started };
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
