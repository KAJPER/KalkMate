import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyDeviceAuth } from "@/lib/device-auth";

// GET /api/device/conversations?limit=20&before=<id>
// Headers: x-api-key, x-device-id, x-device-token
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyDeviceAuth(request);
    if (!auth.ok) {
      return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    }
    const { deviceId } = auth;

    const url = new URL(request.url);
    const limitRaw = url.searchParams.get("limit");
    const before = url.searchParams.get("before");
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
      select: { id: true, mode: true, question: true, answer: true, createdAt: true },
    });

    return NextResponse.json({ ok: true, items, count: items.length });
  } catch (e) {
    console.error("[device/conversations]", e);
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}
