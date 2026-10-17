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

// Audyt 2026-10-16: limit rozmiaru sprawdzany PRZED wczytaniem body
// (content-length), a kazdy blad serwera zwraca JSON {active:false} —
// firmware traktuje 401/403/404 oraz active:false jako koniec sesji.
const MAX_BODY_BYTES = 64 * 1024;

export async function POST(request: NextRequest) {
  try {
    const len = Number(request.headers.get("content-length") || 0);
    if (len > MAX_BODY_BYTES) {
      return NextResponse.json({ active: false, key: null, error: "Payload too large" }, { status: 413 });
    }

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
  } catch (e) {
    console.error("[device/remote/checkin]", e);
    return NextResponse.json({ active: false, key: null, error: "Server error" }, { status: 503 });
  }
}
