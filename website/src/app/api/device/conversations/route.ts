import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET /api/device/conversations?limit=20&before=<id>
// Header: x-api-key, x-device-id
// Zwraca historie zadan dla urzadzenia (od najnowszych)
export async function GET(request: NextRequest) {
  try {
    const apiKey = request.headers.get("x-api-key");
    if (!apiKey || apiKey !== process.env.CALCULATOR_API_KEY) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    const deviceId = request.headers.get("x-device-id");
    if (!deviceId) {
      return NextResponse.json({ ok: false, error: "Missing x-device-id" }, { status: 400 });
    }

    const url = new URL(request.url);
    const limitRaw = url.searchParams.get("limit");
    const before = url.searchParams.get("before"); // id starszego rekordu (paging)
    const limit = Math.min(50, Math.max(1, parseInt(limitRaw || "20", 10)));

    const where: any = { deviceId };
    if (before) {
      const ref = await prisma.deviceSolve.findUnique({ where: { id: before } });
      if (ref) where.createdAt = { lt: ref.createdAt };
    }

    const items = await prisma.deviceSolve.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        mode: true,
        question: true,
        answer: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ ok: true, items, count: items.length });
  } catch (e) {
    console.error("[device/conversations]", e);
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}
