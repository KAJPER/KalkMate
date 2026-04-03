import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import Stripe from "stripe";
import { SUBSCRIPTION_PRICING } from "@/lib/pricing";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  typescript: true,
});

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { plan } = body; // "second_month" or "regular"

    if (!plan || !["second_month", "regular"].includes(plan)) {
      return NextResponse.json(
        { error: "Invalid plan" },
        { status: 400 }
      );
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Get user's subscription
    let subscription = await prisma.subscription.findUnique({
      where: { userId: user.id },
    });

    if (!subscription) {
      // Create subscription if doesn't exist
      const now = new Date();
      subscription = await prisma.subscription.create({
        data: {
          userId: user.id,
          status: "trial",
          trialEndsAt: new Date(now.getTime() + 24 * 60 * 60 * 1000), // 1 day
          trialDays: 1,
        },
      });
    }

    // Create or retrieve Stripe customer
    let customerId = subscription.stripeCustomerId;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: session.user.email!,
        metadata: {
          userId: user.id,
        },
      });
      customerId = customer.id;

      await prisma.subscription.update({
        where: { id: subscription.id },
        data: { stripeCustomerId: customerId },
      });
    }

    // Determine price based on plan
    const priceAmount = plan === "second_month"
      ? SUBSCRIPTION_PRICING.SECOND_MONTH
      : SUBSCRIPTION_PRICING.REGULAR_MONTH;

    const planName = plan === "second_month"
      ? "Drugi miesiąc (-98%)"
      : "Subskrypcja miesięczna";

    // Create Stripe Checkout Session for subscription
    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ["card", "blik", "p24"],
      line_items: [
        {
          price_data: {
            currency: "pln",
            product_data: {
              name: `KalkMate AI Chat - ${planName}`,
              description: "Nielimitowany dostęp do AI chatbota KalkMate",
              images: ["https://kalkmate.pl/KalkMate.png"],
            },
            unit_amount: priceAmount,
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
        plan: plan,
      },
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error) {
    console.error("Create subscription purchase error:", error);
    return NextResponse.json(
      { error: "Failed to create subscription purchase" },
      { status: 500 }
    );
  }
}
