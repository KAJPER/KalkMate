import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { COOKIE_NAME } from "@/lib/admin-auth";

// GET /api/admin/devices
// Zwraca liste wszystkich urzadzen ESP32 ktore kontaktowaly sie z serwerem
export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (token !== process.env.ADMIN_SESSION_TOKEN) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const devices = await prisma.device.findMany({
      orderBy: { lastSeen: "desc" },
    });

    const totalRequests = devices.reduce((sum, d) => sum + d.requestCount, 0);
    const activeNow = devices.filter(
      (d) => Date.now() - new Date(d.lastSeen).getTime() < 5 * 60 * 1000
    ).length;

    return NextResponse.json({
      ok: true,
      stats: {
        totalDevices: devices.length,
        totalRequests,
        activeNow,
      },
      devices,
    });
  } catch (e) {
    console.error("[admin/devices]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
