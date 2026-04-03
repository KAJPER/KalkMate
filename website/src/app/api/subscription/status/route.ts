import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    })

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      )
    }

    // Get user's subscription
    const subscription = await prisma.subscription.findUnique({
      where: { userId: user.id },
    })

    if (!subscription) {
      return NextResponse.json(
        { error: "Subscription not found" },
        { status: 404 }
      )
    }

    // Check if user has purchased calculator
    const hasPurchasedCalculator = await prisma.order.count({
      where: {
        userId: user.id,
        status: "paid"
      }
    }) > 0

    const now = new Date()
    const isTrialActive = subscription.trialEndsAt > now
    const daysRemaining = Math.ceil(
      (subscription.trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    )

    return NextResponse.json({
      status: subscription.status,
      isTrialActive,
      trialEndsAt: subscription.trialEndsAt,
      daysRemaining: Math.max(0, daysRemaining),
      trialDays: subscription.trialDays,
      hasActiveSubscription: subscription.status === "active",
      canUseChat: isTrialActive || subscription.status === "active",
      hasPurchasedCalculator, // Czy kupił kalkulator
    })
  } catch (error) {
    console.error("Get subscription status error:", error)
    return NextResponse.json(
      { error: "Failed to get subscription status" },
      { status: 500 }
    )
  }
}
