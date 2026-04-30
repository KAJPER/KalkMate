import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

// GET /api/user/conversations?limit=20
// Wymaga: zalogowany user, zaclaimowana licencja
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ ok: false, error: "Nie zalogowany" }, { status: 401 });
    }
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });
    if (!user) {
      return NextResponse.json({ ok: false, error: "Brak konta" }, { status: 401 });
    }

    const url = new URL(request.url);
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "30", 10)));

    const items = await prisma.deviceSolve.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        deviceId: true,
        mode: true,
        question: true,
        answer: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ ok: true, items, count: items.length });
  } catch (e) {
    console.error("[user/conversations]", e);
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}
