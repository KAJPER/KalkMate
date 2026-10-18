import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/db";
import { checkDeviceApiKey, normalizeDeviceId } from "@/lib/device-auth";
import { clientIp, rateLimit } from "@/lib/rate-limit";

// GET /api/device/firmware/download/<version>
// Headers wymagane:
//   x-api-key:   KALK_API_KEY (taki sam jak inne endpointy device)
//   x-device-id: MAC urzadzenia (12 hex)
//
// Plik .bin lezy POZA /public (`/home/ubuntu/kalkulator/firmware-private/`)
// zeby nie byl dostepny bez autoryzacji przez bezposredni URL. Jedyny
// wariant sprzetu to ESP32-S3 (parametr ?hw jest ignorowany).
//
// Audyt 2026-10-16: endpoint NIE tworzy juz rekordow Device dla dowolnego
// MAC (wczesniej auto-rejestracja = kazdy z publicznym api key mogl zalozyc
// rekord bez tokenu dla cudzego MAC i potem "przejac" go przez /register).
// OTA nadal dziala dla urzadzen spoza bazy (chicken-and-egg), binarka jest
// podpisana ECDSA i weryfikowana przez firmware przed instalacja.

const FIRMWARE_DIR =
  process.env.CALCULATOR_FIRMWARE_DIR ||
  path.join(process.cwd(), "..", "firmware-private");

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ version: string }> }
) {
  // Auth: API key
  if (!checkDeviceApiKey(request)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  // Wymagamy device-id (MAC). Normalizujemy jak w /register (.toUpperCase).
  const deviceId = normalizeDeviceId(request.headers.get("x-device-id"));
  if (!deviceId) {
    return new NextResponse("Missing x-device-id", { status: 403 });
  }

  const rl = rateLimit(`fwdl:${clientIp(request)}`, 120, 60 * 60_000);
  if (!rl.ok) {
    return new NextResponse("Too many requests", { status: 429 });
  }

  const device = await prisma.device.findUnique({ where: { deviceId }, select: { id: true } });
  if (!device) {
    console.log(`[firmware] dl: urzadzenie ${deviceId} spoza bazy (bez auto-rejestracji)`);
  }

  // Walidacja wersji (anty path-traversal — tylko semver X.Y.Z)
  const { version } = await params;
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    return new NextResponse("Invalid version format", { status: 400 });
  }

  const filename = `v${version}.bin`;
  const filepath = path.join(FIRMWARE_DIR, filename);

  // Dodatkowa sanityzacja - upewnij sie ze nie wyjdziemy poza FIRMWARE_DIR
  const resolved = path.resolve(filepath);
  if (!resolved.startsWith(path.resolve(FIRMWARE_DIR) + path.sep)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  try {
    const data = await readFile(filepath);
    console.log(
      `[firmware] dl: device=${deviceId} v=${version} size=${data.length}B`
    );
    // Bumpuj lastSeen na okazji (tylko istniejacy rekord — bez tworzenia)
    if (device) {
      prisma.device
        .update({
          where: { deviceId },
          data: { lastSeen: new Date() },
        })
        .catch(() => {});
    }

    return new NextResponse(data, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Length": String(data.length),
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    console.error("[firmware] read fail:", e);
    return new NextResponse("Firmware not found", { status: 404 });
  }
}
