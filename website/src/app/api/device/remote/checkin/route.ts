import { NextRequest, NextResponse } from "next/server";
import { getRemoteSession, isSessionLive, setRemoteFrame, consumePendingKey } from "@/lib/remoteSessions";
import { verifyDeviceAuth } from "@/lib/device-auth";

// POST /api/device/remote/checkin — wywolywane przez kalkulator co ~500ms
// PODCZAS aktywnej sesji "Zdalna pomoc" (Ustawienia -> Zdalna pomoc).
// Headers: x-api-key, x-device-id, x-device-token (fw >= 1.9.6).
// Body: { frame?: "<base64, 2048 B, 1bpp u8g2 vertical_top_lsb>" }
// Response: { active: bool, key: number|null }
//   active=false -> urzadzenie ma natychmiast zakonczyc tryb zdalny
//   (wylaczyc WiFi, przestac odpytywac, zdjac wskaznik).
//
// Audyt 2026-09-17: wczesniej sprawdzany byl tylko wspolny x-api-key +
// x-device-id z naglowka — kazdy z kluczem mogl podszyc sie pod cudze
// urzadzenie, przechwycic klawisze wysylane przez admina (dostarczane
// jednorazowo) i podstawic falszywy obraz ekranu. Teraz przez
// verifyDeviceAuth(): token urzadzenia z bazy, jesli zostal juz nadany.

export async function POST(request: NextRequest) {
  const auth = await verifyDeviceAuth(request);
  if (!auth.ok) {
    return NextResponse.json({ active: false, error: auth.error }, { status: auth.status });
  }
  const deviceId = auth.deviceId;

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
