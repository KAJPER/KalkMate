import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { checkDeviceApiKey } from "@/lib/device-auth";

// Endpoint: GET /api/device/firmware/check?current=<wersja>
// Zwraca info o najnowszym firmware + base64-podpis ECDSA P-256 (od v1.4.1)
//
// K4 — wariant sprzetu w naglowku x-hw-variant: "s3" | "legacy".
//   brak naglowka = "s3" (zachowanie starych urzadzen bez zmian),
//   "legacy" -> osobna wersja z env FIRMWARE_LATEST_VERSION_LEGACY (pliki w
//   firmware-private/legacy/); gdy nieustawiona -> "brak aktualizacji"
//   (zwracamy wersje klienta, wiec firmware nie widzi nowszej).

const FIRMWARE_LATEST_VERSION = process.env.FIRMWARE_LATEST_VERSION || "0.1.0";
const FIRMWARE_LATEST_NOTES = process.env.FIRMWARE_LATEST_NOTES || "";
const FIRMWARE_LATEST_VERSION_LEGACY = (process.env.FIRMWARE_LATEST_VERSION_LEGACY || "").trim();
const FIRMWARE_LATEST_NOTES_LEGACY = process.env.FIRMWARE_LATEST_NOTES_LEGACY || "";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://kalkmate.pl";
const FIRMWARE_DIR =
  process.env.CALCULATOR_FIRMWARE_DIR ||
  path.join(process.cwd(), "..", "firmware-private");

const SEMVER_RE = /^\d+\.\d+\.\d+$/;

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
  const hwVariant = (request.headers.get("x-hw-variant") || "s3").trim().toLowerCase();

  if (hwVariant === "legacy") {
    if (!SEMVER_RE.test(FIRMWARE_LATEST_VERSION_LEGACY)) {
      // Brak osobnej wersji dla starego sprzetu — "brak aktualizacji".
      const own = SEMVER_RE.test(current) ? current : SEMVER_RE.test(clientFw) ? clientFw : "0.0.0";
      return NextResponse.json({
        ok: true,
        version: own,
        url: "",
        notes: "",
        sig: "",
        current,
      });
    }
    const legacyDir = path.join(FIRMWARE_DIR, "legacy");
    return NextResponse.json({
      ok: true,
      version: FIRMWARE_LATEST_VERSION_LEGACY,
      url: `${APP_URL}/api/device/firmware/download/${FIRMWARE_LATEST_VERSION_LEGACY}?hw=legacy`,
      notes: FIRMWARE_LATEST_NOTES_LEGACY,
      sig: await loadSignature(legacyDir, FIRMWARE_LATEST_VERSION_LEGACY),
      current,
    });
  }

  // Routing URL pobierania zależny od wersji klienta:
  //   < 1.4.0  -> legacy public URL (klient nie umial wysylac auth headerow)
  //   >= 1.4.0 -> nowy auth-gated download endpoint (firmware-private/)
  const fwParts = clientFw.split(".").map((n) => parseInt(n, 10) || 0);
  const isLegacyClient =
    fwParts.length < 3 ||
    fwParts[0] < 1 ||
    (fwParts[0] === 1 && fwParts[1] < 4);

  const binUrl = isLegacyClient
    ? `${APP_URL}/firmware/v${FIRMWARE_LATEST_VERSION}.bin`
    : `${APP_URL}/api/device/firmware/download/${FIRMWARE_LATEST_VERSION}`;

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
