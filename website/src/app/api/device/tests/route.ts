import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyDeviceAuth, checkDeviceApiKey, isDeviceAuthStrict } from "@/lib/device-auth";

// GET /api/device/tests
// Headers: x-api-key + (x-device-id + x-device-token [paired] LUB x-license-key [legacy])
export async function GET(request: NextRequest) {
  try {
    if (!checkDeviceApiKey(request)) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    let userId: string | null = null;
    let deviceHasToken = false;

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
      deviceHasToken = auth.hasToken;
    }

    // Fallback: license header (legacy — nie wymaga tokenu urządzenia).
    // Audyt 2026-10-16: tylko dla urzadzen BEZ tokenu w bazie i tylko w trybie
    // przejsciowym (DEVICE_AUTH_STRICT !== "1") — inaczej sam (publiczny)
    // api key + kod licencji dawal dostep do notatek wlasciciela licencji.
    if (!userId && !deviceHasToken && !isDeviceAuthStrict()) {
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
