import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyDeviceAuth } from "@/lib/device-auth";

// H2: userId wyprowadzany z uwierzytelnionego urządzenia (x-device-id + x-device-token),
// nie z parametru żądania — zapobiega IDOR (odczyt subskrypcji dowolnego użytkownika).
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyDeviceAuth(request);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    // Pobierz userId powiązane z urządzeniem (nie z query param)
    const deviceRow = await prisma.$queryRaw<{ userId: string | null }[]>`
      SELECT "userId" FROM "Device" WHERE "deviceId" = ${auth.deviceId} LIMIT 1
    `;
    const userId = deviceRow[0]?.userId ?? null;
    if (!userId) {
      return NextResponse.json({ error: "Device not paired with any account" }, { status: 403 });
    }

    const subscription = await prisma.subscription.findUnique({
      where: { userId },
    });

    if (!subscription) {
      return NextResponse.json({ error: "Subscription not found" }, { status: 404 });
    }

    const now = new Date();
    const isTrialActive = subscription.trialEndsAt > now;
    const hasActiveSubscription = subscription.status === "active";
    const canUseAI = isTrialActive || hasActiveSubscription;

    return NextResponse.json({
      canUseAI,
      status: subscription.status,
      isTrialActive,
      trialEndsAt: subscription.trialEndsAt,
      subscriptionEndsAt: subscription.stripeCurrentPeriodEnd,
    });
  } catch (error) {
    console.error("Get subscription error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
