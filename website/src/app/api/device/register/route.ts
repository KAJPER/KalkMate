import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// POST /api/device/register
// Headers: x-api-key
// Body: { deviceId: string, unlockCode: string, firmwareVersion?: string }
//
// Kalkulator po polaczeniu z WiFi zglasza swoj deviceId + aktualny unlockCode.
// Serwer zapisuje to w Device.unlockCode + ostatni IP / fwVersion.
// Pozniej user paruje na stronie za pomoca {deviceId, unlockCode}, server
// waliduje przez porownanie z zapisanym.
export async function POST(request: NextRequest) {
  try {
    const apiKey = request.headers.get("x-api-key");
    if (!apiKey || apiKey !== process.env.CALCULATOR_API_KEY) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const deviceId = String(body?.deviceId || "").trim().toUpperCase();
    const unlockCode = String(body?.unlockCode || "").trim();
    const firmwareVersion = body?.firmwareVersion ? String(body.firmwareVersion).trim() : null;

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

    // Upsert (raw SQL bo Prisma schema nie ma kolumny unlockCode)
    const existing = await prisma.device.findUnique({ where: { deviceId } });
    if (existing) {
      await prisma.$executeRaw`
        UPDATE "Device"
        SET "unlockCode" = ${unlockCode},
            "lastSeen" = CURRENT_TIMESTAMP,
            "firmwareVersion" = ${firmwareVersion},
            "lastIp" = ${ip}
        WHERE "deviceId" = ${deviceId}
      `;
    } else {
      // Wstaw nowy rekord (id musi byc cuid-like; uzywamy hex)
      const id = `dev_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      await prisma.$executeRaw`
        INSERT INTO "Device" ("id", "deviceId", "unlockCode", "firmwareVersion", "lastIp")
        VALUES (${id}, ${deviceId}, ${unlockCode}, ${firmwareVersion}, ${ip})
      `;
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[device/register]", e);
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}
