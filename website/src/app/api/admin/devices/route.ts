import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { COOKIE_NAME } from "@/lib/admin-auth";

function isAdmin(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  return token === process.env.ADMIN_SESSION_TOKEN;
}

// GET /api/admin/devices — lista urzadzen + dane sparowanego usera
export async function GET(req: NextRequest) {
  try {
    if (!isAdmin(req)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const devices = await prisma.device.findMany({
      orderBy: { lastSeen: "desc" },
    });

    // Pobierz userow w jednej kwerendzie (bez .include — schema serwerowa nie ma
    // relation Device.User w Prisma modelu, choc kolumna userId istnieje)
    const userIds = Array.from(
      new Set(devices.map((d) => d.userId).filter((x): x is string => !!x))
    );
    const users = userIds.length
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, email: true, name: true },
        })
      : [];
    const userMap = new Map(users.map((u) => [u.id, u]));

    const enriched = devices.map((d) => ({
      ...d,
      User: d.userId ? userMap.get(d.userId) ?? null : null,
    }));

    const totalRequests = devices.reduce((sum, d) => sum + d.requestCount, 0);
    const activeNow = devices.filter(
      (d) => Date.now() - new Date(d.lastSeen).getTime() < 5 * 60 * 1000
    ).length;
    const pairedCount = devices.filter((d) => d.userId).length;

    return NextResponse.json({
      ok: true,
      stats: {
        totalDevices: devices.length,
        totalRequests,
        activeNow,
        pairedCount,
      },
      devices: enriched,
    });
  } catch (e) {
    console.error("[admin/devices GET]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// PATCH /api/admin/devices?deviceId=... — odepnij urzadzenie (zostaw rekord)
// Czysci userId + licenseCode zeby kalkulator mogl byc sparowany ponownie
export async function PATCH(req: NextRequest) {
  try {
    if (!isAdmin(req)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const deviceId = (url.searchParams.get("deviceId") || "").trim().toUpperCase();
    if (!deviceId) {
      return NextResponse.json({ ok: false, error: "Brak deviceId" }, { status: 400 });
    }

    const device = await prisma.device.findUnique({ where: { deviceId } });
    if (!device) {
      return NextResponse.json({ ok: false, error: "Nie znaleziono" }, { status: 404 });
    }

    const updated = await prisma.device.update({
      where: { id: device.id },
      data: { userId: null, licenseCode: null },
    });

    return NextResponse.json({ ok: true, device: updated, action: "unpaired" });
  } catch (e) {
    console.error("[admin/devices PATCH]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// DELETE /api/admin/devices?deviceId=... — usun urzadzenie z bazy
// Kaskadowo usuwa DeviceSolve (relacja onDelete: Cascade w schemacie)
export async function DELETE(req: NextRequest) {
  try {
    if (!isAdmin(req)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const deviceId = (url.searchParams.get("deviceId") || "").trim().toUpperCase();
    if (!deviceId) {
      return NextResponse.json({ ok: false, error: "Brak deviceId" }, { status: 400 });
    }

    const device = await prisma.device.findUnique({ where: { deviceId } });
    if (!device) {
      return NextResponse.json({ ok: false, error: "Nie znaleziono" }, { status: 404 });
    }

    await prisma.device.delete({ where: { id: device.id } });

    return NextResponse.json({ ok: true, deletedDeviceId: deviceId });
  } catch (e) {
    console.error("[admin/devices DELETE]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
