import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { SUBSCRIPTION_PRICING } from "@/lib/pricing";

// Plan "second_month" = zwykla cena miesieczna (15 zl) + JEDNORAZOWY rabat na
// pierwsza fakture (Stripe coupon duration 'once'), tak by pierwszy okres
// kosztowal 1 zl. Wczesniej unit_amount = 100 w recurring price, czyli
// 1 zl/mies. NA ZAWSZE (audyt 2026-10-16).
const SECOND_MONTH_COUPON_ID = "km_second_month_once";

async function ensureSecondMonthCoupon(): Promise<string> {
  const amountOff = SUBSCRIPTION_PRICING.REGULAR_MONTH - SUBSCRIPTION_PRICING.SECOND_MONTH; // 1400 gr
  try {
    const existing = await stripe.coupons.retrieve(SECOND_MONTH_COUPON_ID);
    if (
      existing.valid &&
      existing.duration === "once" &&
      existing.amount_off === amountOff &&
      (existing.currency || "").toLowerCase() === "pln"
    ) {
      return existing.id;
    }
    // Kupon o tym id istnieje, ale z innymi parametrami — nie nadpisujemy
    // (Stripe nie pozwala edytowac kwoty), lepiej glosno sie wywrocic.
    throw new Error(`Stripe coupon ${SECOND_MONTH_COUPON_ID} ma nieoczekiwane parametry`);
  } catch (e) {
    const err = e as { code?: string; statusCode?: number };
    if (err?.code !== "resource_missing" && err?.statusCode !== 404) throw e;
  }
  try {
    const created = await stripe.coupons.create({
      id: SECOND_MONTH_COUPON_ID,
      amount_off: amountOff,
      currency: "pln",
      duration: "once",
      name: "KalkMate — drugi miesiac za 1 zl",
    });
    return created.id;
  } catch (e) {
    // Rownolegle zadanie zdazylo utworzyc ten sam kupon.
    const err = e as { code?: string };
    if (err?.code === "resource_already_exists") return SECOND_MONTH_COUPON_ID;
    throw e;
  }
}

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

    // M5: plan second_month (-98%) dostępny tylko dla kupujących KalkMate —
    // i to z OPLACONYM zamowieniem (wczesniej wystarczalo porzucone "pending").
    if (plan === "second_month") {
      const order = await prisma.order.findFirst({ where: { userId: user.id, status: "paid" } });
      if (!order) {
        return NextResponse.json(
          { error: "Plan dostępny wyłącznie dla klientów KalkMate." },
          { status: 403 }
        );
      }
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
          id: require("crypto").randomUUID(),
          userId: user.id,
          status: "trial",
          trialEndsAt: new Date(now.getTime() + 24 * 60 * 60 * 1000), // 1 day
          trialDays: 1,
          updatedAt: new Date(),
        },
      });
    }

    // Juz trwa subskrypcja Stripe — druga rownolegla = podwojne obciazenie.
    const now = new Date();
    if (
      subscription.stripeSubscriptionId &&
      (subscription.status === "active" || subscription.status === "past_due") &&
      (!subscription.stripeCurrentPeriodEnd || subscription.stripeCurrentPeriodEnd > now)
    ) {
      return NextResponse.json(
        { error: "Masz już aktywną subskrypcję." },
        { status: 409 }
      );
    }
    // Promocja drugiego miesiaca jest jednorazowa — kto juz mial subskrypcje
    // Stripe, kupuje zwykly plan.
    if (plan === "second_month" && subscription.stripeSubscriptionId) {
      return NextResponse.json(
        { error: "Promocja drugiego miesiąca została już wykorzystana." },
        { status: 409 }
      );
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

    const planName = plan === "second_month"
      ? "Drugi miesiąc (-98%)"
      : "Subskrypcja miesięczna";

    const discounts: Stripe.Checkout.SessionCreateParams.Discount[] | undefined =
      plan === "second_month" ? [{ coupon: await ensureSecondMonthCoupon() }] : undefined;

    // Create Stripe Checkout Session for subscription.
    // Tylko karta: BLIK i P24 nie obsluguja platnosci cyklicznych w trybie
    // subscription (Stripe zwracal blad -> zawsze 500).
    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "pln",
            product_data: {
              name: `KalkMate AI Chat - ${planName}`,
              description: "Nielimitowany dostęp do AI chatbota KalkMate",
            },
            unit_amount: SUBSCRIPTION_PRICING.REGULAR_MONTH,
            recurring: {
              interval: "month",
            },
          },
          quantity: 1,
        },
      ],
      ...(discounts ? { discounts } : {}),
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
