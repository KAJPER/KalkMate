import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/db";

// GET /api/device/firmware/download/<version>
// Headers wymagane:
//   x-api-key:   KALK_API_KEY (taki sam jak inne endpointy device)
//   x-device-id: MAC urzadzenia (musi byc zarejestrowane w bazie)
//
// Plik .bin lezy POZA /public (`/home/ubuntu/kalkulator/firmware-private/`)
// zeby nie byl dostepny bez autoryzacji przez bezposredni URL.

const CALCULATOR_API_KEY = process.env.CALCULATOR_API_KEY;
const FIRMWARE_DIR =
  process.env.CALCULATOR_FIRMWARE_DIR ||
  path.join(process.cwd(), "..", "firmware-private");

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ version: string }> }
) {
  // Auth: API key
  const apiKey = request.headers.get("x-api-key");
  if (!apiKey || apiKey !== CALCULATOR_API_KEY) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  // Wymagamy device-id (MAC). Normalizujemy jak w /register (.toUpperCase),
  // zeby uniknac niedopasowania wielkosci liter.
  const deviceId = (request.headers.get("x-device-id") || "").trim().toUpperCase();
  if (deviceId.length < 6) {
    return new NextResponse("Missing x-device-id", { status: 403 });
  }

  // Urzadzenie POWINNO byc zarejestrowane (accountRegister na boot). Jezeli
  // jednak go nie ma (nowy egzemplarz / rejestracja nie przeszla) — NIE
  // blokujemy OTA przez 403. To pulapka chicken-and-egg: nie da sie naprawic
  // firmware przez OTA, gdy OTA jest zablokowane. Sam api key i tak musi byc
  // poprawny, a /api/device/register juz teraz pozwala zarejestrowac dowolne
  // device-id z tym api key, wiec brama "musi byc wczesniej zarejestrowane"
  // nie dawala realnej ochrony. Auto-rejestrujemy minimalny rekord.
  let device = await prisma.device.findUnique({ where: { deviceId } });
  if (!device) {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      null;
    const fwVersion = request.headers.get("x-fw-version") || null;
    try {
      device = await prisma.device.create({
        data: { deviceId, firmwareVersion: fwVersion, lastIp: ip },
      });
      console.log(`[firmware] auto-registered device=${deviceId} fw=${fwVersion}`);
    } catch {
      // Wyscig — rekord mogl powstac rownolegle. Sprobuj ponownie odczytac.
      device = await prisma.device.findUnique({ where: { deviceId } });
      if (!device) {
        return new NextResponse("Device registration failed", { status: 500 });
      }
    }
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
  if (!resolved.startsWith(path.resolve(FIRMWARE_DIR))) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  try {
    const data = await readFile(filepath);
    console.log(
      `[firmware] dl: device=${deviceId} v=${version} size=${data.length}B`
    );
    // Bumpuj lastSeen na okazji
    prisma.device
      .update({
        where: { deviceId },
        data: { lastSeen: new Date() },
      })
      .catch(() => {});

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
