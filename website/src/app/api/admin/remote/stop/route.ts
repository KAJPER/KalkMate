import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { stopRemoteSession } from "@/lib/remoteSessions";

// POST /api/admin/remote/stop — { deviceId } — konczy sesje. Urzadzenie
// zauwazy to przy nastepnym checkin (odpowie active:false) i samo wroci do
// normalnego trybu (WiFi off, koniec pollingu, kwadracik znika).
export async function POST(req: NextRequest) {
  const authErr = await requireAdminAuth(req); if (authErr) return authErr;

  const body = await req.json().catch(() => null);
  const deviceId = String(body?.deviceId || "").trim().toUpperCase();
  if (!deviceId) {
    return NextResponse.json({ error: "Brak deviceId" }, { status: 400 });
  }

  await stopRemoteSession(deviceId);
  return NextResponse.json({ ok: true });
}
