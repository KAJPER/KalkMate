import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME } from "@/lib/admin-auth";
import { startRemoteSession } from "@/lib/remoteSessions";

// POST /api/admin/remote/start — { deviceId } — uruchamia (lub przedluza)
// sesje zdalnej pomocy. Urzadzenie zauwazy ja przy nastepnym odpytaniu
// (max ~2s po tym jak faktycznie wejdzie w tryb "Zdalna pomoc" w Ustawieniach
// — patrz src/remote_session.h, sesje nie sa inicjowane przez serwer,
// urzadzenie samo je odpytuje).
export async function POST(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (token !== process.env.ADMIN_SESSION_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const deviceId = String(body?.deviceId || "").trim().toUpperCase();
  if (!deviceId) {
    return NextResponse.json({ error: "Brak deviceId" }, { status: 400 });
  }

  await startRemoteSession(deviceId);
  return NextResponse.json({ ok: true });
}
