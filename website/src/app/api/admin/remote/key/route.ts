import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME } from "@/lib/admin-auth";
import { setPendingKey, getRemoteSession, isSessionLive } from "@/lib/remoteSessions";

// POST /api/admin/remote/key — { deviceId, key } — kolejkuje "wirtualne"
// nacisniecie klawisza (key = numeryczna wartosc enuma KalkKey z input.h,
// 1..27; patrz keypad w admin/remote/page.tsx). Tylko JEDEN oczekujacy
// klawisz na raz — kolejny nadpisuje niedostarczony (urzadzenie odpytuje
// co ~500ms wiec to rzadki przypadek, i tak jest lepsze niz kolejkowanie
// bez limitu przy zerwanym polaczeniu).
export async function POST(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (token !== process.env.ADMIN_SESSION_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const deviceId = String(body?.deviceId || "").trim().toUpperCase();
  const key = Number(body?.key);
  if (!deviceId || !Number.isFinite(key) || key < 1 || key > 27) {
    return NextResponse.json({ error: "Nieprawidlowe dane" }, { status: 400 });
  }

  const row = await getRemoteSession(deviceId);
  if (!isSessionLive(row)) {
    return NextResponse.json({ error: "Sesja nieaktywna" }, { status: 409 });
  }

  await setPendingKey(deviceId, key);
  return NextResponse.json({ ok: true });
}
