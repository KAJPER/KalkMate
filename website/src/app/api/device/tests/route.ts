import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET /api/device/tests
// Headers: x-api-key + (x-device-id [paired] LUB x-license-key [legacy])
export async function GET(request: NextRequest) {
  try {
    const apiKey = request.headers.get("x-api-key");
    if (!apiKey || apiKey !== process.env.CALCULATOR_API_KEY) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const deviceIdHeader = request.headers.get("x-device-id");
    let userId: string | null = null;

    if (deviceIdHeader) {
      const dev = await prisma.device.findUnique({
        where: { deviceId: deviceIdHeader.trim().toUpperCase() },
      });
      if (dev?.userId) userId = dev.userId;
    }
    if (!userId) {
      const licenseKey = request.headers.get("x-license-key")?.trim().toLowerCase();
      if (licenseKey) {
        const license = await prisma.license.findUnique({ where: { code: licenseKey } });
        if (license?.claimedByUserId) userId = license.claimedByUserId;
      }
    }
    if (!userId) {
      return NextResponse.json({ ok: true, tests: [], userClaimed: false });
    }

    const tests = await prisma.test.findMany({
      where: { userId },
      orderBy: [{ position: "asc" }, { updatedAt: "desc" }],
      select: { id: true, title: true, content: true, position: true, updatedAt: true },
    });
    return NextResponse.json({ ok: true, tests, userClaimed: true });
  } catch (e) {
    console.error("[device/tests]", e);
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}
