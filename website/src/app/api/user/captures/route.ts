import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { listAllCaptures } from "@/lib/captures";

// GET /api/user/captures — lista zdjec zrobionych przez urzadzenia usera.
// Filtrowanie po Device.userId (tylko sparowane device).
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ ok: false, error: "Nie zalogowany" }, { status: 401 });
  }
  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) {
    return NextResponse.json({ ok: false, error: "Brak konta" }, { status: 401 });
  }

  // Zbierz wszystkie deviceId tego usera
  const devices = await prisma.device.findMany({
    where: { userId: user.id },
    select: { deviceId: true },
  });
  const allowedIds = new Set(devices.map((d) => d.deviceId));

  if (allowedIds.size === 0) {
    return NextResponse.json({ ok: true, items: [], stats: { total: 0 } });
  }

  const all = await listAllCaptures();
  const mine = all.filter((c) => allowedIds.has(c.deviceId));

  return NextResponse.json({
    ok: true,
    items: mine,
    stats: { total: mine.length },
  });
}
