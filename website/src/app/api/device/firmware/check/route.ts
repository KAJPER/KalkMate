import { NextRequest, NextResponse } from "next/server";

// Endpoint: GET /api/device/firmware/check?current=<wersja>
// Zwraca info o najnowszym firmware do pobrania.
//
// Konfiguracja przez env:
//   FIRMWARE_LATEST_VERSION  np. "0.2.0"  (jesli pusta -> "0.1.0" jako default)
//   FIRMWARE_LATEST_NOTES    krotki changelog (opcjonalne)
//
// Plik .bin musi byc w /public/firmware/v<version>.bin
// Wtedy URL: https://kalkmate.pl/firmware/v<version>.bin

const CALCULATOR_API_KEY = process.env.CALCULATOR_API_KEY;
const FIRMWARE_LATEST_VERSION = process.env.FIRMWARE_LATEST_VERSION || "0.1.0";
const FIRMWARE_LATEST_NOTES = process.env.FIRMWARE_LATEST_NOTES || "";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://kalkmate.pl";

export async function GET(request: NextRequest) {
  // Weryfikacja API key urzadzenia (taka sama jak w solve)
  const apiKey = request.headers.get("x-api-key");
  if (!apiKey || apiKey !== CALCULATOR_API_KEY) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const url = new URL(request.url);
  const current = url.searchParams.get("current") || "";

  const binUrl = `${APP_URL}/firmware/v${FIRMWARE_LATEST_VERSION}.bin`;

  return NextResponse.json({
    ok: true,
    version: FIRMWARE_LATEST_VERSION,
    url: binUrl,
    notes: FIRMWARE_LATEST_NOTES,
    current,
  });
}
