import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { userFwUpdateStatus } from "@/lib/fwUpdateNotice";

// Baner "Zaktualizuj kalkulator" w panelu klienta (kampania z /admin/aktualizacje).
// Blad = brak banera — panel nie moze sie przez to wysypac.

const NO_STORE = { "Cache-Control": "no-store" };

// GET /api/user/fw-update-status
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ ok: false, error: "Nie zalogowany" }, { status: 401, headers: NO_STORE });
  }
  try {
    const user = await prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true } });
    if (!user) return NextResponse.json({ ok: false, error: "Nie zalogowany" }, { status: 401, headers: NO_STORE });
    const status = await userFwUpdateStatus(user.id);
    return NextResponse.json({ ok: true, ...status }, { headers: NO_STORE });
  } catch (err) {
    console.error("[fw-update-status]", err);
    return NextResponse.json(
      { ok: true, needed: false, targetVersion: null, deadline: null, devices: [] },
      { headers: NO_STORE },
    );
  }
}
