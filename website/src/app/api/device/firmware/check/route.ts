import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/db";
import { checkDeviceApiKey, verifyDeviceAuth } from "@/lib/device-auth";

// Endpoint: GET /api/device/firmware/check?current=<wersja>
// Zwraca info o najnowszym firmware + base64-podpis ECDSA P-256 (od v1.4.1)
//
// Naglowek x-hw-variant jest ignorowany — jedyny wspierany sprzet to ESP32-S3
// (brak naglowka / dowolna wartosc = "s3").

const FIRMWARE_LATEST_VERSION = process.env.FIRMWARE_LATEST_VERSION || "0.1.0";
const FIRMWARE_LATEST_NOTES = process.env.FIRMWARE_LATEST_NOTES || "";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://kalkmate.pl";
// fw >= 2.1.0 laczy sie przez api.kalkmate.pl — URL pobierania pod tym samym
// hostem. Tylko ta lista (nigdy echo dowolnego Host). Stary firmware przyjmuje
// wylacznie prefiks https://kalkmate.pl/ (ota_update.h), wiec reszta -> APP_URL.
const DEVICE_API_HOSTS: Record<string, string> = {
  "api.kalkmate.pl": "https://api.kalkmate.pl",
};
// Jak w /api/device/register.
const FW_VERSION_RE = /^[0-9A-Za-z.+_-]{1,32}$/;

function baseUrlForHost(host: string | null): string {
  const h = (host || "").toLowerCase().split(":")[0];
  return DEVICE_API_HOSTS[h] ?? APP_URL;
}
const FIRMWARE_DIR =
  process.env.CALCULATOR_FIRMWARE_DIR ||
  path.join(process.cwd(), "..", "firmware-private");

async function loadSignature(dir: string, version: string): Promise<string> {
  // Sprobuj zaladowac podpis ECDSA (jezeli istnieje) i wyslac jako base64.
  // Firmware v1.4.1+ weryfikuje podpis przed instalacja OTA.
  try {
    const sigBuf = await readFile(path.join(dir, `v${version}.sig`));
    return sigBuf.toString("base64");
  } catch {
    // Brak pliku .sig - moze byc legacy version (przed signed OTA). Klient
    // bez x-fw-version >= 1.4.1 i tak nie weryfikuje, wiec OK.
    return "";
  }
}

export async function GET(request: NextRequest) {
  // Weryfikacja API key urzadzenia (taka sama jak w solve)
  if (!checkDeviceApiKey(request)) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const url = new URL(request.url);
  const current = url.searchParams.get("current") || "";
  const clientFw = request.headers.get("x-fw-version") || "";

  // Routing URL pobierania zależny od wersji klienta:
  //   < 1.4.0  -> legacy public URL (klient nie umial wysylac auth headerow)
  //   >= 1.4.0 -> nowy auth-gated download endpoint (firmware-private/)
  const fwParts = clientFw.split(".").map((n) => parseInt(n, 10) || 0);
  const isLegacyClient =
    fwParts.length < 3 ||
    fwParts[0] < 1 ||
    (fwParts[0] === 1 && fwParts[1] < 4);

  const base = baseUrlForHost(request.headers.get("host"));
  const binUrl = isLegacyClient
    ? `${base}/firmware/v${FIRMWARE_LATEST_VERSION}.bin`
    : `${base}/api/device/firmware/download/${FIRMWARE_LATEST_VERSION}`;

  // Wersja firmware na zywo (admin widzi adopcje). Check z fw <= 2.0.x nie
  // wysyla x-device-token — verifyDeviceAuth przepusci wtedy tylko rekordy
  // bez tokenu; reszta i tak raportuje wersje w /register i /solve.
  // Blad auth NIE blokuje OTA (binarka jest podpisana).
  const reported = (clientFw || current).trim();
  if (reported && FW_VERSION_RE.test(reported)) {
    verifyDeviceAuth(request)
      .then((auth) => {
        if (!auth.ok || !auth.known) return;
        return prisma.device.update({
          where: { deviceId: auth.deviceId },
          data: { firmwareVersion: reported, lastSeen: new Date() },
        });
      })
      .catch((e) => console.error("[firmware/check] fw version update fail:", e));
  }

  const signatureB64 = await loadSignature(FIRMWARE_DIR, FIRMWARE_LATEST_VERSION);

  return NextResponse.json({
    ok: true,
    version: FIRMWARE_LATEST_VERSION,
    url: binUrl,
    notes: FIRMWARE_LATEST_NOTES,
    sig: signatureB64,           // ECDSA P-256 podpis bin (raw DER, base64)
    current,
  });
}
