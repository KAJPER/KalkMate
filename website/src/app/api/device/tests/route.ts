import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyDeviceAuth } from "@/lib/device-auth";

// GET /api/device/tests
// Headers: x-api-key + (x-device-id + x-device-token [paired] LUB x-license-key [legacy])
export async function GET(request: NextRequest) {
  try {
    const apiKey = request.headers.get("x-api-key");
    if (!apiKey || apiKey !== process.env.CALCULATOR_API_KEY) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    let userId: string | null = null;

    const deviceIdHeader = request.headers.get("x-device-id");
    if (deviceIdHeader) {
      const auth = await verifyDeviceAuth(request);
      if (!auth.ok) {
        return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
      }
      const dev = await prisma.device.findUnique({
        where: { deviceId: auth.deviceId },
        select: { userId: true },
      });
      if (dev?.userId) userId = dev.userId;
    }

    // Fallback: license header (legacy — nie wymaga tokenu urządzenia)
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
