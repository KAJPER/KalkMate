import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyDeviceAuth } from "@/lib/device-auth";
import { isSubscriptionValid, readTokenBalance } from "@/lib/aiCost";

// Prog salda, przy ktorym wygasla licencja nadal "dziala" (spojnie z solve).
const MIN_TOKENS_FOR_EXPIRED_LICENSE = 1000;

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
    // Audyt 2026-10-16: wczesniej findFirst bez sortowania -> przypadkowa
    // (czesto stara, wygasla) licencja, a firmware zapisuje zwrocony "code"
    // do NVS i wysyla go w x-license-key. Teraz: najnowsza aktywna licencja,
    // potem subskrypcja (K2), potem saldo tokenow — tak jak decyduje solve.
    const licenses = await prisma.license.findMany({
      where: { claimedByUserId: device.userId },
      orderBy: { usedAt: "desc" },
    });
    const subscription = await prisma.subscription.findUnique({
      where: { userId: device.userId },
    });
    const tokenBalance = (await readTokenBalance(device.userId)) ?? 0;

    const now = new Date();
    const DAY = 24 * 60 * 60 * 1000;
    const expiresAtOf = (l: { usedAt: Date | null; durationDays: number }) =>
      l.usedAt ? new Date(new Date(l.usedAt).getTime() + l.durationDays * DAY) : null;

    const activeLicense = licenses.find((l) => {
      const exp = expiresAtOf(l);
      return !!exp && exp > now;
    });
    const unusedLicense = licenses.find((l) => !l.usedAt);
    const latestLicense = licenses[0] ?? null;
    const subValid = isSubscriptionValid(subscription, now);

    let outCode: string | null = null;
    let outStatus: string | null = null;
    let outDays: number | null = null;
    let outDuration: number | null = null;

    if (activeLicense) {
      const exp = expiresAtOf(activeLicense) as Date;
      outCode = activeLicense.code;
      outDuration = activeLicense.durationDays;
      outStatus = "active";
      outDays = Math.ceil((exp.getTime() - now.getTime()) / DAY);
    } else if (subscription && subValid) {
      if (subscription.status === "active") {
        outStatus = "active";
        outCode = "(subscription)";
        if (subscription.stripeCurrentPeriodEnd) {
          outDays = Math.ceil(
            (new Date(subscription.stripeCurrentPeriodEnd).getTime() - now.getTime()) / DAY
          );
        }
      } else {
        outStatus = "trial";
        outCode = "(trial)";
        outDuration = subscription.trialDays;
        outDays = Math.ceil((new Date(subscription.trialEndsAt).getTime() - now.getTime()) / DAY);
      }
    } else if (unusedLicense) {
      // Licencja jeszcze nieaktywowana — timer startuje przy pierwszym solve.
      outCode = unusedLicense.code;
      outDuration = unusedLicense.durationDays;
      outStatus = "trial";
    } else if (latestLicense) {
      outCode = latestLicense.code;
      outDuration = latestLicense.durationDays;
      if (tokenBalance >= MIN_TOKENS_FOR_EXPIRED_LICENSE) {
        // Model tokenowy: wygasla licencja czasowa dziala dalej, dopoki sa
        // tokeny (patrz /api/device/solve) — nie pokazuj "expired".
        outStatus = "active";
        outDays = null;
      } else {
        outStatus = "expired";
        outDays = 0;
      }
    } else if (subscription) {
      outStatus = "expired";
      outDays = 0;
    }

    return NextResponse.json({
      ok: true,
      paired: true,
      userEmail: user?.email || null,
      license: outCode
        ? { code: outCode, status: outStatus, daysLeft: outDays, durationDays: outDuration }
        : null,
      tokenBalance,
    });
  } catch (e) {
    console.error("[device/account-status]", e);
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}
