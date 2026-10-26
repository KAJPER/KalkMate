import { prisma } from "@/lib/db";
import { readOrderUnits } from "@/lib/orderPersonalization";

// Numery seryjne (SN) na etykiecie produktowej (/admin/orders/[id]/etykieta).
//
// - Globalny licznik "ostatni wydany SN" w "AppSetting" (klucz
//   lastProductSerial). Start: 42 (ostatni numer wydrukowany recznie przed
//   wdrozeniem) — INSERT OR IGNORE, wiec istniejaca wartosc nigdy nie jest
//   nadpisywana. Edytowalny w pasku strony etykiety.
// - "ProductSerial": jeden wiersz na sztuke zamowienia (orderId + unitIndex,
//   0-based). serial = PRIMARY KEY -> ten sam SN nigdy dwa razy.
// - Przydzial: przy pierwszym otwarciu etykiety zamowienia (POST assign) —
//   kolejne numery od licznika+1, w transakcji, ktora ZACZYNA SIE od zapisu
//   (blokada zapisu SQLite od razu, bez "read -> upgrade"; patrz coupons.ts),
//   wiec dwie karty nie dostana tego samego numeru. Ponowny druk = te same SN.
// - Numery zajete recznie (nadpisanie SN sztuki) sa przy przydziale pomijane,
//   licznik mozna wiec tez cofnac bez ryzyka duplikatu.
// Tabele poza Prisma schema (raw SQL), tworzone leniwie + w dbInit.ts.

const COUNTER_KEY = "lastProductSerial";
const COUNTER_INITIAL = 42;
export const SERIAL_MAX = 999999;

let _ready = false;
export async function ensureProductSerialTables(): Promise<void> {
  if (_ready) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "AppSetting" (
      "key"   TEXT PRIMARY KEY,
      "value" TEXT NOT NULL
    )`);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ProductSerial" (
      "serial"    INTEGER PRIMARY KEY,
      "orderId"   TEXT NOT NULL,
      "unitIndex" INTEGER NOT NULL,
      "createdAt" INTEGER NOT NULL,
      UNIQUE ("orderId", "unitIndex")
    )`);
  await prisma.$executeRaw`
    INSERT OR IGNORE INTO "AppSetting" ("key", "value") VALUES (${COUNTER_KEY}, ${String(COUNTER_INITIAL)})`;
  _ready = true;
}

/** Format na etykiecie: min. 2 cyfry ("06", "43", "105"). */
export function formatSerial(n: number): string {
  return String(n).padStart(2, "0");
}

/** "43" / "0043" / 43 -> 43; zle dane -> null. */
export function parseSerial(raw: unknown): number | null {
  const s = typeof raw === "number" ? String(raw) : typeof raw === "string" ? raw.trim() : "";
  if (!/^\d{1,6}$/.test(s)) return null;
  const n = parseInt(s, 10);
  return n >= 1 && n <= SERIAL_MAX ? n : null;
}

export interface UnitSerial {
  unitIndex: number;
  serial: number;
}

export async function getCounterState(): Promise<{ last: number; maxAssigned: number | null }> {
  await ensureProductSerialTables();
  const rows = await prisma.$queryRaw<{ value: string }[]>`
    SELECT "value" FROM "AppSetting" WHERE "key" = ${COUNTER_KEY} LIMIT 1`;
  const max = await prisma.$queryRaw<{ m: bigint | number | null }[]>`
    SELECT MAX("serial") AS m FROM "ProductSerial"`;
  const last = parseInt(rows[0]?.value ?? "", 10);
  return {
    last: Number.isFinite(last) ? last : COUNTER_INITIAL,
    maxAssigned: max[0]?.m == null ? null : Number(max[0].m),
  };
}

export async function setCounter(last: number): Promise<void> {
  await ensureProductSerialTables();
  await prisma.$executeRaw`
    INSERT INTO "AppSetting" ("key", "value") VALUES (${COUNTER_KEY}, ${String(last)})
    ON CONFLICT ("key") DO UPDATE SET "value" = excluded."value"`;
}

export async function getSerialsForOrders(orderIds: string[]): Promise<Record<string, UnitSerial[]>> {
  await ensureProductSerialTables();
  const out: Record<string, UnitSerial[]> = {};
  if (!orderIds.length) return out;
  // Parametryzowane IN (...) — po jednym parametrze na id.
  const placeholders = orderIds.map(() => "?").join(", ");
  const rows = await prisma.$queryRawUnsafe<{ orderId: string; unitIndex: bigint | number; serial: bigint | number }[]>(
    `SELECT "orderId", "unitIndex", "serial" FROM "ProductSerial" WHERE "orderId" IN (${placeholders}) ORDER BY "orderId", "unitIndex"`,
    ...orderIds
  );
  for (const r of rows) {
    (out[r.orderId] ||= []).push({ unitIndex: Number(r.unitIndex), serial: Number(r.serial) });
  }
  return out;
}

/** Przydziela SN brakujacym sztukom zamowienia (0..quantity-1). Idempotentne. */
export async function assignOrderSerials(orderId: string): Promise<UnitSerial[]> {
  await ensureProductSerialTables();
  const { quantity } = await readOrderUnits(orderId);
  const now = Date.now();

  const run = () =>
    prisma.$transaction(async (tx) => {
      // Najpierw zapis — blokada zapisu SQLite od razu (patrz komentarz u gory).
      await tx.$executeRaw`UPDATE "AppSetting" SET "value" = "value" WHERE "key" = ${COUNTER_KEY}`;
      const existing = await tx.$queryRaw<{ unitIndex: bigint | number }[]>`
        SELECT "unitIndex" FROM "ProductSerial" WHERE "orderId" = ${orderId}`;
      const have = new Set(existing.map((r) => Number(r.unitIndex)));
      const missing = Array.from({ length: quantity }, (_, i) => i).filter((i) => !have.has(i));
      if (!missing.length) return;

      const cur = await tx.$queryRaw<{ value: string }[]>`
        SELECT "value" FROM "AppSetting" WHERE "key" = ${COUNTER_KEY} LIMIT 1`;
      let last = parseInt(cur[0]?.value ?? "", 10);
      if (!Number.isFinite(last) || last < 0) last = COUNTER_INITIAL;

      for (const unitIndex of missing) {
        let next = last + 1;
        // Pomin numery zajete (reczne nadpisania / licznik cofniety przez admina).
        for (;;) {
          const used = await tx.$queryRaw<{ serial: bigint | number }[]>`
            SELECT "serial" FROM "ProductSerial" WHERE "serial" = ${next} LIMIT 1`;
          if (!used.length) break;
          next++;
        }
        if (next > SERIAL_MAX) throw new Error("Zakres numerów seryjnych wyczerpany");
        await tx.$executeRaw`
          INSERT INTO "ProductSerial" ("serial", "orderId", "unitIndex", "createdAt")
          VALUES (${next}, ${orderId}, ${unitIndex}, ${now})`;
        last = next;
      }
      await tx.$executeRaw`UPDATE "AppSetting" SET "value" = ${String(last)} WHERE "key" = ${COUNTER_KEY}`;
    });

  try {
    await run();
  } catch (e) {
    // Wyscig na UNIQUE (inna karta przydzielila w tym samym momencie) — jedna
    // powtorka; druga transakcja zobaczy juz przydzielone numery.
    if (!isUniqueError(e)) throw e;
    await run();
  }
  return (await getSerialsForOrders([orderId]))[orderId] || [];
}

function isUniqueError(e: unknown): boolean {
  const err = e as { code?: string; message?: string; meta?: { message?: unknown } } | null;
  return err?.code === "P2002" || /unique constraint/i.test(`${err?.message ?? ""} ${String(err?.meta?.message ?? "")}`);
}

export type SetSerialResult =
  | { ok: true; serials: UnitSerial[] }
  | { ok: false; error: string; status: number };

/** Reczne nadpisanie SN sztuki. Duplikat (inna sztuka / inne zamowienie) = blad. */
export async function setUnitSerial(orderId: string, unitIndex: number, serial: number): Promise<SetSerialResult> {
  await ensureProductSerialTables();
  const { quantity } = await readOrderUnits(orderId);
  if (!Number.isInteger(unitIndex) || unitIndex < 0 || unitIndex >= quantity) {
    return { ok: false, error: `Nieprawidłowa sztuka (zamówienie ma ${quantity} szt.)`, status: 400 };
  }
  const taken = await prisma.$queryRaw<{ orderId: string; unitIndex: bigint | number }[]>`
    SELECT "orderId", "unitIndex" FROM "ProductSerial" WHERE "serial" = ${serial} LIMIT 1`;
  const t = taken[0];
  if (t && !(t.orderId === orderId && Number(t.unitIndex) === unitIndex)) {
    const o = await prisma.order.findUnique({ where: { id: t.orderId }, select: { orderNumber: true } }).catch(() => null);
    return {
      ok: false,
      status: 409,
      error: `SN ${formatSerial(serial)} jest już przypisany: zamówienie ${o?.orderNumber || t.orderId}, sztuka ${Number(t.unitIndex) + 1}.`,
    };
  }
  try {
    if (!t) {
      // Bez UPSERT: konflikt na "serial" (INTEGER PRIMARY KEY = rowid) SQLite
      // sprawdza przed UNIQUE(orderId, unitIndex), wiec osobno UPDATE / INSERT.
      const updated = await prisma.$executeRaw`
        UPDATE "ProductSerial" SET "serial" = ${serial} WHERE "orderId" = ${orderId} AND "unitIndex" = ${unitIndex}`;
      if (Number(updated) === 0) {
        await prisma.$executeRaw`
          INSERT INTO "ProductSerial" ("serial", "orderId", "unitIndex", "createdAt")
          VALUES (${serial}, ${orderId}, ${unitIndex}, ${Date.now()})`;
      }
    } // else: ta sama sztuka ma juz ten numer — nic do zmiany
  } catch (e) {
    if (isUniqueError(e)) {
      return { ok: false, status: 409, error: `SN ${formatSerial(serial)} został właśnie przypisany gdzie indziej — odśwież stronę.` };
    }
    throw e;
  }
  return { ok: true, serials: (await getSerialsForOrders([orderId]))[orderId] || [] };
}
