import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import Stripe from "stripe"
import { SUBSCRIPTION_PRICING } from "@/lib/pricing"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  typescript: true,
})

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

    if (!subscription) {
      return NextResponse.json(
        { error: "Subscription not found" },
        { status: 404 }
      )
    }

    // Check if trial has ended
    const now = new Date()
    if (subscription.trialEndsAt > now) {
      return NextResponse.json(
        { error: "Trial period is still active" },
        { status: 400 }
      )
    }

    // Create or retrieve Stripe customer
    let customerId = subscription.stripeCustomerId

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: session.user.email!,
        metadata: {
          userId: user.id,
        },
      })
      customerId = customer.id

      await prisma.subscription.update({
        where: { id: subscription.id },
        data: { stripeCustomerId: customerId },
      })
    }

    // Create Stripe Checkout Session for subscription (regular price - 15 zł)
    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ["card", "blik", "p24"],
      line_items: [
        {
          price_data: {
            currency: "pln",
            product_data: {
              name: "KalkMate AI Chat - Subskrypcja miesięczna",
              description: "Nielimitowany dostęp do AI chatbota KalkMate",
              images: ["https://kalkmate.pl/KalkMate.png"],
            },
            unit_amount: SUBSCRIPTION_PRICING.REGULAR_MONTH, // 15 zł
            recurring: {
              interval: "month",
            },
          },
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: `${process.env.NEXT_PUBLIC_APP_URL || "https://kalkmate.pl"}/panel?subscription=success`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || "https://kalkmate.pl"}/panel?subscription=cancelled`,
      metadata: {
        userId: user.id,
      },
    })

    return NextResponse.json({ url: checkoutSession.url })
  } catch (error) {
    console.error("Create subscription error:", error)
    return NextResponse.json(
      { error: "Failed to create subscription" },
      { status: 500 }
    )
  }
}
