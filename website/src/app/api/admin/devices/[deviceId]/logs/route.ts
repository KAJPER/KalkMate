import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { listDeviceLogs } from "@/lib/deviceLog";
import { normalizeDeviceId } from "@/lib/device-auth";

// GET /api/admin/devices/[deviceId]/logs — ostatnie zdarzenia z event_log.h
// (dolaczane do kazdej automatycznej rejestracji urzadzenia, patrz
// /api/device/register i src/event_log.h).
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ deviceId: string }> }
) {
  const authErr = await requireAdminAuth(req); if (authErr) return authErr;
  const { deviceId: raw } = await params;
  const deviceId = normalizeDeviceId(raw);
  if (!deviceId) {
    return NextResponse.json({ ok: false, error: "Bad deviceId" }, { status: 400 });
  }
  try {
    const logs = await listDeviceLogs(deviceId, 200);
    return NextResponse.json({ ok: true, deviceId, logs });
  } catch (e) {
    console.error("[admin/devices/logs]", e);
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}
