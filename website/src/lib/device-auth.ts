import { NextRequest } from "next/server";
import { createHash, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/db";

export type DeviceAuthResult =
  | {
      ok: true;
      deviceId: string;
      // Czy rekord Device ma zapisany token (plaintext lub hash). false =
      // stare urzadzenie bez tokenu, przepuszczone w trybie przejsciowym.
      hasToken: boolean;
      // Czy rekord Device w ogole istnieje w bazie.
      known: boolean;
      userId: string | null;
    }
  | { ok: false; status: number; error: string };

// Audyt 2026-10-16: wspolny x-api-key floty nalezy traktowac jako PUBLICZNY
// (wyciekl z firmware). Jedynym realnym dowodem tozsamosci urzadzenia jest
// per-urzadzenie x-device-token. Tryb przejsciowy (urzadzenia w terenie ze
// starym firmware, ktore nigdy nie dostaly tokenu) dziala TYLKO gdy
// DEVICE_AUTH_STRICT !== "1". Urzadzenie, ktore MA token w bazie, zawsze musi
// go przyslac — niezaleznie od trybu.
export function isDeviceAuthStrict(): boolean {
  return process.env.DEVICE_AUTH_STRICT === "1";
}

// Porownanie w stalym czasie, odporne na rozne dlugosci (timingSafeEqual
// rzuca dla buforow roznej dlugosci) — porownujemy skroty SHA-256.
export function safeEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const ha = createHash("sha256").update(a, "utf8").digest();
  const hb = createHash("sha256").update(b, "utf8").digest();
  return timingSafeEqual(ha, hb) && a.length === b.length;
}

export function hashDeviceToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

// Wspolny klucz floty. Pusty CALCULATOR_API_KEY w env = nic nie przechodzi.
export function checkDeviceApiKey(request: NextRequest): boolean {
  const expected = process.env.CALCULATOR_API_KEY;
  if (!expected) return false;
  return safeEqual(request.headers.get("x-api-key"), expected);
}

// Device ID = MAC ESP32 jako 12 znakow hex (firmware: "%02X" x6).
export const DEVICE_ID_RE = /^[0-9A-F]{12}$/;

export function normalizeDeviceId(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const v = raw.trim().toUpperCase();
  return DEVICE_ID_RE.test(v) ? v : null;
}

// Kolumna Device.deviceTokenHash (sha256 hex tokenu) — poza Prisma schema,
// dodawana leniwie (wzorem deviceRental.ts). Plaintext Device.deviceToken
// zostaje na razie rownolegle (krok 2: usuniecie plaintextu po migracji).
let _hashColumnReady = false;
export async function ensureDeviceTokenHashColumn(): Promise<void> {
  if (_hashColumnReady) return;
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "Device" ADD COLUMN "deviceTokenHash" TEXT`);
  } catch {
    // kolumna juz istnieje — ok
  }
  _hashColumnReady = true;
}

export interface StoredDeviceToken {
  deviceToken: string | null;
  deviceTokenHash: string | null;
}

export function hasStoredToken(row: StoredDeviceToken | null | undefined): boolean {
  return !!(row && (row.deviceToken || row.deviceTokenHash));
}

// Sprawdza przyslany token wzgledem zapisanego. Preferuje hash; gdy jest
// tylko plaintext (rekordy sprzed tej zmiany) — porownuje plaintext i przy
// sukcesie leniwie dopisuje hash.
export async function matchDeviceToken(
  deviceId: string,
  incoming: string | null,
  stored: StoredDeviceToken
): Promise<boolean> {
  if (!incoming) return false;
  if (stored.deviceTokenHash) {
    return safeEqual(hashDeviceToken(incoming), stored.deviceTokenHash);
  }
  if (stored.deviceToken && safeEqual(incoming, stored.deviceToken)) {
    const h = hashDeviceToken(incoming);
    prisma.$executeRaw`
      UPDATE "Device" SET "deviceTokenHash" = ${h}
      WHERE "deviceId" = ${deviceId} AND "deviceTokenHash" IS NULL
    `.catch((e) => console.error("[device-auth] hash migrate fail:", e));
    return true;
  }
  return false;
}

export async function loadDeviceAuthRow(
  deviceId: string
): Promise<(StoredDeviceToken & { userId: string | null }) | null> {
  await ensureDeviceTokenHashColumn();
  const rows = await prisma.$queryRaw<
    { deviceToken: string | null; deviceTokenHash: string | null; userId: string | null }[]
  >`
    SELECT "deviceToken", "deviceTokenHash", "userId" FROM "Device" WHERE "deviceId" = ${deviceId} LIMIT 1
  `;
  return rows[0] ?? null;
}

// Weryfikacja tożsamości urządzenia przez:
// 1. Wspólny klucz API (x-api-key) — tylko filtr szumu, NIE dowod tozsamosci
// 2. Identyfikator MAC (x-device-id, 12 hex)
// 3. Unikalny token urządzenia (x-device-token) — wymagany gdy zapisany w DB,
//    a przy DEVICE_AUTH_STRICT=1 wymagany zawsze.
export async function verifyDeviceAuth(
  request: NextRequest
): Promise<DeviceAuthResult> {
  if (!checkDeviceApiKey(request)) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  const rawId = request.headers.get("x-device-id");
  if (!rawId || !rawId.trim()) {
    return { ok: false, status: 400, error: "Missing x-device-id" };
  }
  const deviceId = normalizeDeviceId(rawId);
  if (!deviceId) {
    return { ok: false, status: 400, error: "Bad x-device-id" };
  }

  const incomingToken = request.headers.get("x-device-token")?.trim() || null;
  const row = await loadDeviceAuthRow(deviceId);

  if (row && hasStoredToken(row)) {
    if (!(await matchDeviceToken(deviceId, incomingToken, row))) {
      return { ok: false, status: 401, error: "Invalid device token" };
    }
    return { ok: true, deviceId, hasToken: true, known: true, userId: row.userId };
  }

  // Brak tokenu w bazie (stare firmware albo nieznane urzadzenie).
  if (isDeviceAuthStrict()) {
    return { ok: false, status: 401, error: "Device token required" };
  }
  return { ok: true, deviceId, hasToken: false, known: !!row, userId: row?.userId ?? null };
}
