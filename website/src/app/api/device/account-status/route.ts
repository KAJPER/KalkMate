import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyDeviceAuth } from "@/lib/device-auth";
import { readTokenBalance } from "@/lib/aiCost";
import { MIN_TOKENS_FOR_AI } from "@/lib/tokenGrants";

// GET /api/device/account-status
// Headers: x-api-key, x-device-id, x-device-token
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyDeviceAuth(request);
    if (!auth.ok) {
      return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    }
    const { deviceId } = auth;

    const device = await prisma.device.findUnique({ where: { deviceId } });

    if (!device || !device.userId) {
      return NextResponse.json({ ok: true, paired: false, userEmail: null, license: null });
    }

    const user = await prisma.user.findUnique({ where: { id: device.userId } });
    // Model tokenowy (2026-10): brak subskrypcji/triali/licencji czasowych.
    // status = "active" gdy saldo >= MIN_TOKENS_FOR_AI, inaczej "expired"
    // (firmware pokazuje ten napis); daysLeft = -1 -> firmware ukrywa "Dni".
    // code: najnowsza licencja aktywowana na koncie (firmware zapisuje ja do
    // NVS i wysyla w x-license-key — solve juz jej nie wymaga), albo
    // "(tokens)", zeby firmware w ogole pokazal linie statusu.
    const latestLicense = await prisma.license.findFirst({
      where: { claimedByUserId: device.userId },
      orderBy: [{ usedAt: "desc" }, { createdAt: "desc" }],
      select: { code: true },
    });
    const tokenBalance = (await readTokenBalance(device.userId)) ?? 0;

    const outCode = latestLicense?.code || "(tokens)";
    const outStatus = tokenBalance >= MIN_TOKENS_FOR_AI ? "active" : "expired";

    return NextResponse.json({
      ok: true,
      paired: true,
      userEmail: user?.email || null,
      license: outCode
        ? { code: outCode, status: outStatus, daysLeft: -1, durationDays: null }
        : null,
      tokenBalance,
    });
  } catch (e) {
    console.error("[device/account-status]", e);
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}
