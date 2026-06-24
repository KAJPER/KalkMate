import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";

export type DeviceAuthResult =
  | { ok: true; deviceId: string }
  | { ok: false; status: number; error: string };

// Weryfikacja tożsamości urządzenia przez:
// 1. Wspólny klucz API (x-api-key)
// 2. Identyfikator MAC (x-device-id)
// 3. Unikalny token urządzenia (x-device-token) — wymagany gdy zapisany w DB
//
// Urządzenia bez tokenu w DB (stare firmware) przechodzą weryfikację przez
// sam x-api-key + x-device-id. Po aktualizacji firmware token jest wymagany.
export async function verifyDeviceAuth(
  request: NextRequest
): Promise<DeviceAuthResult> {
  const apiKey = request.headers.get("x-api-key");
  if (!apiKey || apiKey !== process.env.CALCULATOR_API_KEY) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  const deviceId = request.headers.get("x-device-id")?.trim().toUpperCase();
  if (!deviceId) {
    return { ok: false, status: 400, error: "Missing x-device-id" };
  }

  const incomingToken = request.headers.get("x-device-token")?.trim() || null;

  const device = await prisma.$queryRaw<{ deviceToken: string | null }[]>`
    SELECT "deviceToken" FROM "Device" WHERE "deviceId" = ${deviceId} LIMIT 1
  `;

  const storedToken = device[0]?.deviceToken ?? null;

  if (storedToken && (!incomingToken || incomingToken !== storedToken)) {
    return { ok: false, status: 401, error: "Invalid device token" };
  }

  return { ok: true, deviceId };
}
