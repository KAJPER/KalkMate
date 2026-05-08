import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET /api/device/account-status
// Headers: x-api-key, x-device-id
//
// Zwraca informacje czy device jest sparowany z kontem + status licencji.
// Kalkulator uzywa tego do wyswietlenia "Konto: X" lub "Niepodlaczone".
export async function GET(request: NextRequest) {
  try {
    const apiKey = request.headers.get("x-api-key");
    if (!apiKey || apiKey !== process.env.CALCULATOR_API_KEY) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const deviceId = request.headers.get("x-device-id")?.trim().toUpperCase();
    if (!deviceId) {
      return NextResponse.json({ ok: false, error: "Missing x-device-id" }, { status: 400 });
    }

    const device = await prisma.device.findUnique({
      where: { deviceId },
    });

    if (!device || !device.userId) {
      return NextResponse.json({
        ok: true,
        paired: false,
        userEmail: null,
        license: null,
      });
    }

    const user = await prisma.user.findUnique({ where: { id: device.userId } });
    const license = await prisma.license.findFirst({
      where: { claimedByUserId: device.userId },
    });
    const subscription = await prisma.subscription.findUnique({
      where: { userId: device.userId },
    });

    const now = new Date();

    // Priorytet: claimed License > active Subscription > trial Subscription
    let outCode: string | null = null;
    let outStatus: string | null = null;
    let outDays: number | null = null;
    let outDuration: number | null = null;

    if (license) {
      outCode = license.code;
      outDuration = license.durationDays;
      if (license.usedAt) {
        const expiresAt = new Date(
          new Date(license.usedAt).getTime() + license.durationDays * 24 * 60 * 60 * 1000
        );
        if (now > expiresAt) {
          outStatus = "expired";
          outDays = 0;
        } else {
          outStatus = "active";
          outDays = Math.ceil(
            (expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
          );
        }
      } else {
        outStatus = "trial";   // nieaktywowana licencja
      }
    } else if (subscription) {
      // Brak License -> uzyj Subscription jako zrodla "dostepu"
      if (subscription.status === "active") {
        outStatus = "active";
        outCode = "(subscription)";
        if (subscription.stripeCurrentPeriodEnd) {
          outDays = Math.ceil(
            (new Date(subscription.stripeCurrentPeriodEnd).getTime() - now.getTime()) /
              (24 * 60 * 60 * 1000)
          );
        }
      } else if (
        subscription.status === "trial" &&
        new Date(subscription.trialEndsAt) > now
      ) {
        outStatus = "trial";
        outCode = "(trial)";
        outDuration = subscription.trialDays;
        outDays = Math.ceil(
          (new Date(subscription.trialEndsAt).getTime() - now.getTime()) /
            (24 * 60 * 60 * 1000)
        );
      } else {
        outStatus = "expired";
        outDays = 0;
      }
    }

    return NextResponse.json({
      ok: true,
      paired: true,
      userEmail: user?.email || null,
      license: outCode
        ? {
            code: outCode,
            status: outStatus,
            daysLeft: outDays,
            durationDays: outDuration,
          }
        : null,
    });
  } catch (e) {
    console.error("[device/account-status]", e);
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}
