import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME } from "@/lib/admin-auth";
import { stopRemoteSession } from "@/lib/remoteSessions";

// POST /api/admin/remote/stop — { deviceId } — konczy sesje. Urzadzenie
// zauwazy to przy nastepnym checkin (odpowie active:false) i samo wroci do
// normalnego trybu (WiFi off, koniec pollingu, kwadracik znika).
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

  await stopRemoteSession(deviceId);
  return NextResponse.json({ ok: true });
}
