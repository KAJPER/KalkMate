import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME } from "@/lib/admin-auth";
import { getRemoteSession, isSessionLive } from "@/lib/remoteSessions";

// GET /api/admin/remote/frame?deviceId=X — najnowszy zrzut ekranu (jesli
// urzadzenie juz zdazylo cokolwiek wyslac) + status sesji. Panel odpytuje
// to co ~500ms zeby odswiezac podglad.
export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (token !== process.env.ADMIN_SESSION_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const deviceId = (req.nextUrl.searchParams.get("deviceId") || "").trim().toUpperCase();
  if (!deviceId) {
    return NextResponse.json({ error: "Brak deviceId" }, { status: 400 });
  }

  const row = await getRemoteSession(deviceId);
  const live = isSessionLive(row);

  return NextResponse.json({
    ok: true,
    active: live,
    frame: row?.frame ?? null,
    frameAt: row?.frameAt ?? null,
    // Jesli sesja "active" w bazie ale nie ma jeszcze zadnej klatki, to
    // urzadzenie prawdopodobnie jeszcze nie zdazylo wejsc w tryb Zdalna
    // pomoc (albo nie ma WiFi) — panel pokazuje "Czekam na urzadzenie...".
    waitingForDevice: live && !row?.frame,
  });
}
