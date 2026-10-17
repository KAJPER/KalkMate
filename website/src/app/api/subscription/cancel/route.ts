import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { stripe } from "@/lib/stripe"

// Anulowanie = cancel_at_period_end (audyt 2026-10-16). Klient zaplacil za
// biezacy okres, wiec dostep zostaje do jego konca — status w bazie zostaje
// 'active', a webhook customer.subscription.deleted ustawi 'cancelled' po
// koncu okresu. Wczesniej subscriptions.cancel() odcinal dostep od razu.
export async function POST(request: NextRequest) {
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

    if (!subscription?.stripeSubscriptionId) {
      return NextResponse.json(
        { error: "No active subscription found" },
        { status: 404 }
      )
    }

    const updated = await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
      cancel_at_period_end: true,
    })

    // Koniec oplaconego okresu (stripe@20: na pozycji subskrypcji).
    const ts = updated.items?.data?.[0]?.current_period_end
    const periodEnd = typeof ts === "number" && Number.isFinite(ts) && ts > 0 ? new Date(ts * 1000) : null

    // Update database — status bez zmian (dostep do konca okresu), tylko data anulowania.
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        cancelledAt: new Date(),
        ...(periodEnd && !isNaN(periodEnd.getTime()) ? { stripeCurrentPeriodEnd: periodEnd } : {}),
      },
    })

    return NextResponse.json({
      success: true,
      cancelAtPeriodEnd: true,
      currentPeriodEnd: periodEnd,
    })
  } catch (error) {
    console.error("Cancel subscription error:", error)
    return NextResponse.json(
      { error: "Failed to cancel subscription" },
      { status: 500 }
    )
  }
}
