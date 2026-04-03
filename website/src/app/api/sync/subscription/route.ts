import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// API endpoint dla kalkulatora do sprawdzania statusu subskrypcji
// Kalkulator będzie sprawdzał czy użytkownik ma aktywny dostęp do AI

const CALCULATOR_API_KEY = process.env.CALCULATOR_API_KEY;

export async function GET(request: NextRequest) {
  try {
    // Verify API key
    const apiKey = request.headers.get("x-api-key");

    if (!apiKey || apiKey !== CALCULATOR_API_KEY) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const userId = request.nextUrl.searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { error: "Missing userId parameter" },
        { status: 400 }
      );
    }

    // Get user's subscription
    const subscription = await prisma.subscription.findUnique({
      where: { userId },
    });

    if (!subscription) {
      return NextResponse.json(
        { error: "Subscription not found" },
        { status: 404 }
      );
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
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
