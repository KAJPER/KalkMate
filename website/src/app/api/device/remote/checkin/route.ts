import { NextRequest, NextResponse } from "next/server";
import { getRemoteSession, isSessionLive, setRemoteFrame, consumePendingKey } from "@/lib/remoteSessions";

// POST /api/device/remote/checkin — wywolywane przez kalkulator co ~500ms
// PODCZAS aktywnej sesji "Zdalna pomoc" (Ustawienia -> Zdalna pomoc).
// Headers: x-api-key, x-device-id (jak /api/device/solve).
// Body: { frame?: "<base64, 2048 B, 1bpp u8g2 vertical_top_lsb>" }
// Response: { active: bool, key: number|null }
//   active=false -> urzadzenie ma natychmiast zakonczyc tryb zdalny
//   (wylaczyc WiFi, przestac odpytywac, zdjac wskaznik).
const CALCULATOR_API_KEY = process.env.CALCULATOR_API_KEY;

export async function POST(request: NextRequest) {
  const apiKey = request.headers.get("x-api-key");
  if (!apiKey || apiKey !== CALCULATOR_API_KEY) {
    return NextResponse.json({ active: false, error: "Unauthorized" }, { status: 401 });
  }

  const deviceId = (request.headers.get("x-device-id") || "").trim().toUpperCase();
  if (!deviceId) {
    return NextResponse.json({ active: false, error: "Brak x-device-id" }, { status: 400 });
  }

  const row = await getRemoteSession(deviceId);
  if (!isSessionLive(row)) {
    return NextResponse.json({ active: false, key: null });
  }

  const body = await request.json().catch(() => null);
  const frame = typeof body?.frame === "string" ? body.frame : null;
  if (frame) {
    // Sanity: 2048 B surowego bufora -> base64 to ok. 2732 znakow. Nie
    // wymuszamy dokladnej dlugosci (przyszly hardware moze miec inny
    // rozmiar ekranu) — po prostu ignorujemy jawnie absurdalnie duze payloady.
    if (frame.length <= 8192) {
      await setRemoteFrame(deviceId, frame);
    }
  }

  const key = await consumePendingKey(deviceId);
  return NextResponse.json({ active: true, key });
}
