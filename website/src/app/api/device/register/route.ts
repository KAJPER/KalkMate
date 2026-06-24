import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { randomBytes } from "crypto";

// POST /api/device/register
// Headers: x-api-key, x-device-token (opcjonalny — wymagany gdy device ma token w DB)
// Body: { deviceId: string, unlockCode: string, firmwareVersion?: string }
//
// Zabezpieczenia:
//  - Jeśli device ma token w DB i przysłał zły/brak x-device-token → 401
//  - Jeśli device jest sparowany (ma userId) → unlockCode NIE jest nadpisywany
//    (zapobiega przejęciu konta przez zmianę kodu odblokowującego)
//  - Każde urządzenie otrzymuje unikalny deviceToken (64 znaki hex) przy rejestracji
export async function POST(request: NextRequest) {
  try {
    const apiKey = request.headers.get("x-api-key");
    if (!apiKey || apiKey !== process.env.CALCULATOR_API_KEY) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const deviceId = String(body?.deviceId || "").trim().toUpperCase();
    const unlockCode = String(body?.unlockCode || "").trim();
    const firmwareVersion = body?.firmwareVersion
      ? String(body.firmwareVersion).trim()
      : null;

    if (!deviceId || deviceId.length < 6) {
      return NextResponse.json({ ok: false, error: "Bad deviceId" }, { status: 400 });
    }
    if (!unlockCode || unlockCode.length < 1 || unlockCode.length > 16) {
      return NextResponse.json({ ok: false, error: "Bad unlockCode" }, { status: 400 });
    }

    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      null;

    const incomingToken = request.headers.get("x-device-token")?.trim() || null;

    const rows = await prisma.$queryRaw<
      { deviceToken: string | null; userId: string | null }[]
    >`
      SELECT "deviceToken", "userId" FROM "Device"
      WHERE "deviceId" = ${deviceId}
      LIMIT 1
    `;

    if (rows.length > 0) {
      const { deviceToken: storedToken, userId } = rows[0];

      // Urządzenie ma token w DB — weryfikacja obowiązkowa
      if (storedToken && (!incomingToken || incomingToken !== storedToken)) {
        return NextResponse.json(
          { ok: false, error: "Invalid device token" },
          { status: 401 }
        );
      }

      const assignedToken = storedToken ?? randomBytes(32).toString("hex");

      if (userId) {
        // Sparowane urządzenie: nie nadpisuj unlockCode (H2)
        await prisma.$executeRaw`
          UPDATE "Device"
          SET "lastSeen"        = CURRENT_TIMESTAMP,
              "firmwareVersion" = ${firmwareVersion},
              "lastIp"          = ${ip},
              "deviceToken"     = ${assignedToken}
          WHERE "deviceId" = ${deviceId}
        `;
      } else {
        // Niesparowane: może aktualizować swój kod odblokowujący
        await prisma.$executeRaw`
          UPDATE "Device"
          SET "unlockCode"      = ${unlockCode},
              "lastSeen"        = CURRENT_TIMESTAMP,
              "firmwareVersion" = ${firmwareVersion},
              "lastIp"          = ${ip},
              "deviceToken"     = ${assignedToken}
          WHERE "deviceId" = ${deviceId}
        `;
      }

      return NextResponse.json({ ok: true, deviceToken: assignedToken });
    }

    // Nowe urządzenie
    const id = `dev_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const deviceToken = randomBytes(32).toString("hex");

    await prisma.$executeRaw`
      INSERT INTO "Device" ("id", "deviceId", "unlockCode", "firmwareVersion", "lastIp", "deviceToken")
      VALUES (${id}, ${deviceId}, ${unlockCode}, ${firmwareVersion}, ${ip}, ${deviceToken})
    `;

    return NextResponse.json({ ok: true, deviceToken });
  } catch (e) {
    console.error("[device/register]", e);
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}
