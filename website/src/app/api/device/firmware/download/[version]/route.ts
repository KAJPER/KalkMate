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

  // Auth: device must be registered (raises bar — losowy z API key
  // dalej nie pobierze bez waznego device-id sparowanego z baza)
  const deviceId = request.headers.get("x-device-id");
  if (!deviceId) {
    return new NextResponse("Missing x-device-id", { status: 403 });
  }

  const device = await prisma.device.findUnique({
    where: { deviceId },
  });
  if (!device) {
    return new NextResponse("Device not registered", { status: 403 });
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
