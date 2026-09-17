import { prisma } from "@/lib/db";

// Zdalna blokada wynajmowanych urzadzen. Kolumny poza Prisma schema (jak
// Device.promptMode, Order.personalizedCode) — raw SQL, ALTER TABLE
// wykonywany raz, duplikat kolumny po prostu ignorujemy.
//
// Dwa niezalezne pola:
//   rentalUntil  — data konca najmu (ISO string). Po tej dacie urzadzenie
//                  jest automatycznie traktowane jako zablokowane, bez
//                  koniecznosci recznej interwencji.
//   rentalLocked — reczny wylacznik admina (np. zgloszona kradziez, brak
//                  zwrotu mimo uplywu terminu) — nadrzedny wobec daty.
//
// Blokada dziala na poziomie /api/device/solve: zablokowane urzadzenie nadal
// dziala jako zwykly kalkulator (offline), ale traci dostep do AI — to ta
// funkcja jest przedmiotem najmu, wiec to ja odcinamy.

let _columnsReady = false;

export async function ensureRentalColumns(): Promise<void> {
  if (_columnsReady) return;
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "Device" ADD COLUMN "rentalUntil" DATETIME`);
  } catch {
    // kolumna juz istnieje — ok
  }
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "Device" ADD COLUMN "rentalLocked" INTEGER DEFAULT 0`);
  } catch {
    // kolumna juz istnieje — ok
  }
  _columnsReady = true;
}

export interface RentalInfo {
  rentalUntil: string | null;
  rentalLocked: boolean;
}

export interface RentalLockCheck {
  locked: boolean;
  reason: string | null; // komunikat pokazywany na ekranie kalkulatora (przez _solDrawError)
}

// Odczyt surowego stanu najmu — uzywane przez panel admina (lista urzadzen).
export async function getRentalInfo(deviceId: string): Promise<RentalInfo> {
  await ensureRentalColumns();
  const rows = await prisma.$queryRaw<{ rentalUntil: string | null; rentalLocked: number | null }[]>`
    SELECT "rentalUntil", "rentalLocked" FROM "Device" WHERE "deviceId" = ${deviceId} LIMIT 1
  `;
  const row = rows[0];
  return {
    rentalUntil: row?.rentalUntil ?? null,
    rentalLocked: !!row?.rentalLocked,
  };
}

// Odczyt dla WIELU urzadzen naraz (lista w panelu admina) — jedno zapytanie.
export async function getRentalInfoBatch(
  deviceIds: string[]
): Promise<Map<string, RentalInfo>> {
  await ensureRentalColumns();
  const map = new Map<string, RentalInfo>();
  if (deviceIds.length === 0) return map;
  const placeholders = deviceIds.map(() => "?").join(",");
  const rows = await prisma.$queryRawUnsafe<
    { deviceId: string; rentalUntil: string | null; rentalLocked: number | null }[]
  >(`SELECT "deviceId", "rentalUntil", "rentalLocked" FROM "Device" WHERE "deviceId" IN (${placeholders})`, ...deviceIds);
  for (const r of rows) {
    map.set(r.deviceId, { rentalUntil: r.rentalUntil, rentalLocked: !!r.rentalLocked });
  }
  return map;
}

// Sprawdzenie w /api/device/solve — czy odciac dostep do AI. Szybka sciezka:
// jesli urzadzenie nie ma w ogole ustawionego najmu (typowy zakupiony
// egzemplarz), zwraca od razu { locked: false } bez dodatkowego kosztu.
export async function checkRentalLock(deviceId: string): Promise<RentalLockCheck> {
  const info = await getRentalInfo(deviceId);

  if (info.rentalLocked) {
    return {
      locked: true,
      reason: "Wynajem zablokowany. Skontaktuj sie z KalkMate.",
    };
  }
  if (info.rentalUntil) {
    const until = new Date(info.rentalUntil);
    if (!isNaN(until.getTime()) && until.getTime() < Date.now()) {
      return {
        locked: true,
        reason: "Okres najmu zakonczony. Zwroc urzadzenie lub przedluz najem na kalkmate.pl.",
      };
    }
  }
  return { locked: false, reason: null };
}

// Ustawienie/zmiana najmu z panelu admina.
export async function setDeviceRental(
  deviceId: string,
  rentalUntil: string | null,
  rentalLocked: boolean
): Promise<void> {
  await ensureRentalColumns();
  await prisma.$executeRaw`
    UPDATE "Device" SET "rentalUntil" = ${rentalUntil}, "rentalLocked" = ${rentalLocked ? 1 : 0}
    WHERE "deviceId" = ${deviceId}
  `;
}
