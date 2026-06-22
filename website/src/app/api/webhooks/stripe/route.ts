import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { sendMail } from "@/lib/mailer";
import { purchaseConfirmationEmail } from "@/lib/email-templates";
import { prisma } from "@/lib/db";

export async function POST(request: NextRequest) {
  console.log("[WEBHOOK] Received webhook request");
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    console.error("[WEBHOOK] No signature provided");
    return NextResponse.json({ error: "No signature" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
    console.log(`[WEBHOOK] Event verified: ${event.type}`);
  } catch (err) {
    console.error("[WEBHOOK] Signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // Idempotency: Stripe potrafi powtarzac eventy (retry przy 5xx/timeout).
  // Zapis do ProcessedStripeEvent z UNIQUE id — jezeli juz przetwarzane, skip.
  // Tabela utworzona raw SQL bo nie ma jej w Prisma schemie.
  try {
    const inserted = await prisma.$executeRaw`
      INSERT OR IGNORE INTO ProcessedStripeEvent (id, type) VALUES (${event.id}, ${event.type})
    `;
    if (inserted === 0) {
      console.log(`[WEBHOOK] Duplicate event ${event.id} (${event.type}) — skip`);
      return NextResponse.json({ received: true, duplicate: true });
    }
  } catch (e) {
    // Jezeli idempotency tabela padla — log ale nie blokuj webhooka
    // (gorzej miec duplikat niz zgubic event)
    console.error("[WEBHOOK] idempotency check failed:", e);
  }

  // Handle different event types
  console.log(`[WEBHOOK] Processing event: ${event.type}`);
  switch (event.type) {
    case "payment_intent.succeeded": {
      const pi = event.data.object as Stripe.PaymentIntent;
      await handlePaymentIntentSucceeded(pi);
      break;
    }

    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode === "payment") {
        if (session.metadata?.type === "token_purchase") {
          await handleTokenPurchase(session);
        } else {
          await handleCalculatorPurchase(session);
        }
      } else if (session.mode === "subscription") {
        await handleSubscriptionCreated(session);
      }
      break;
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      await handleSubscriptionUpdated(subscription);
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      await handleSubscriptionDeleted(subscription);
      break;
    }

    case "invoice.payment_succeeded": {
      const invoice = event.data.object as Stripe.Invoice;
      if ((invoice as any).subscription) {
        await handleInvoicePaymentSucceeded(invoice);
      }
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      if ((invoice as any).subscription) {
        await handleInvoicePaymentFailed(invoice);
      }
      break;
    }

    default:
      console.log(`Unhandled event type: ${event.type}`);
  }

  return NextResponse.json({ received: true });
}

async function handlePaymentIntentSucceeded(pi: Stripe.PaymentIntent) {
  const meta = pi.metadata;
  console.log("[WEBHOOK] handlePaymentIntentSucceeded called", { paymentIntentId: pi.id, metadata: meta });

  if (!meta.customer_email) {
    console.error("[WEBHOOK] Missing customer_email in payment intent metadata");
    return;
  }

  const email = meta.customer_email;
  const name = meta.customer_name || "";
  const phone = meta.customer_phone || "";
  const pickupPoint = meta.pickup_point || "";
  const pickupPointAddress = meta.pickup_point_address || "";

  console.log(`[WEBHOOK] Processing order for email: ${email}`);

  // Preferuj user_id z metadata (ustawione w create-payment-intent gdy user zalogowany).
  // Fallback: szukaj po emailu (legacy / kupno gosciem - juz nieuzywane).
  let existingUser = null;
  if (meta.user_id) {
    existingUser = await prisma.user.findUnique({ where: { id: meta.user_id } });
  }
  if (!existingUser) {
    existingUser = await prisma.user.findUnique({ where: { email } });
  }

  // Generate order number (e.g., KM-20260220-1234)
  const orderNumber = `KM-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(1000 + Math.random() * 9000)}`;

  // Zapisz zamowienie z userId
  await prisma.order.create({
    data: {
      id: require("crypto").randomUUID(),
      userId: existingUser?.id,
      orderNumber,
      status: "paid",
      customerName: name,
      customerEmail: email,
      customerPhone: phone,
      pickupPoint: pickupPoint,
      pickupPointAddress: pickupPointAddress,
      stripePaymentIntentId: pi.id,
      amount: pi.amount,
      currency: pi.currency,
      paidAt: new Date(),
      updatedAt: new Date(),
    },
  });

  // Jeśli użytkownik już ma konto, upgrade subskrypcji do 30 dni
  if (existingUser) {
    const subscription = await prisma.subscription.findUnique({
      where: { userId: existingUser.id },
    });

    if (subscription) {
      const newTrialEndsAt = new Date();
      newTrialEndsAt.setDate(newTrialEndsAt.getDate() + 30);

      await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          trialDays: 30,
          trialEndsAt: newTrialEndsAt,
          status: "trial",
        },
      });
    }
  }

  console.log(`[WEBHOOK] ✅ Order created successfully: ${orderNumber} for email ${email}${existingUser ? ` (user ID: ${existingUser.id})` : " (no account yet)"}`);

  // Send confirmation email
  try {
    await sendMail({
      to: email,
      subject: `Potwierdzenie zamówienia ${orderNumber} - KalkMate`,
      html: purchaseConfirmationEmail({
        customerName: name || "Kliencie",
        customerEmail: email,
        product: meta.product || "KalkMate v1.0",
        amount: pi.amount,
        pickupPoint: pickupPoint,
        pickupPointAddress: pickupPointAddress,
        orderId: orderNumber,
      }),
    });
    console.log(`[WEBHOOK] ✅ Confirmation email sent to ${email}`);
  } catch (emailError) {
    console.error("[WEBHOOK] ❌ Failed to send confirmation email:", emailError);
  }
}

async function handleCalculatorPurchase(session: Stripe.Checkout.Session) {
  console.log("[WEBHOOK] handleCalculatorPurchase called", { sessionId: session.id, metadata: session.metadata });
  const { name, email, phone, pickupPoint, pickupPointAddress } = session.metadata || {};

  if (!email) {
    console.error("[WEBHOOK] Missing email in checkout session metadata");
    return;
  }

  console.log(`[WEBHOOK] Processing order for email: ${email}`);

  // Sprawdź czy użytkownik już istnieje (ma konto)
  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  // Generate order number (e.g., KM-20260220-1234)
  const orderNumber = `KM-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(1000 + Math.random() * 9000)}`;

  // Zapisz zamówienie (z userId jeśli użytkownik istnieje, bez userId jeśli nie)
  await prisma.order.create({
    data: {
      id: require("crypto").randomUUID(),
      userId: existingUser?.id, // Może być undefined - wtedy NULL w bazie
      orderNumber,
      status: "paid",
      customerName: name || "",
      customerEmail: email,
      customerPhone: phone || "",
      pickupPoint: pickupPoint || "",
      pickupPointAddress: pickupPointAddress || "",
      stripePaymentIntentId: session.payment_intent as string,
      amount: session.amount_total || 0,
      currency: session.currency || "pln",
      paidAt: new Date(),
      updatedAt: new Date(),
    },
  });

  // Jeśli użytkownik już ma konto, upgrade subskrypcji do 30 dni
  if (existingUser) {
    const subscription = await prisma.subscription.findUnique({
      where: { userId: existingUser.id },
    });

    if (subscription) {
      const newTrialEndsAt = new Date();
      newTrialEndsAt.setDate(newTrialEndsAt.getDate() + 30);

      await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          trialDays: 30,
          trialEndsAt: newTrialEndsAt,
          status: "trial",
        },
      });
    }
  }
  // Jeśli użytkownik NIE ma konta, zamówienie zostanie połączone przy rejestracji

  console.log(`[WEBHOOK] ✅ Order created successfully: ${orderNumber} for email ${email}${existingUser ? ` (user ID: ${existingUser.id})` : " (no account yet)"}`);

  // Send confirmation email
  try {
    await sendMail({
      to: email,
      subject: `Potwierdzenie zamówienia ${orderNumber} - KalkMate`,
      html: purchaseConfirmationEmail({
        customerName: name || "Kliencie",
        customerEmail: email,
        product: "KalkMate v1.0",
        amount: session.amount_total || 0,
        pickupPoint: pickupPoint || "",
        pickupPointAddress: pickupPointAddress || "",
        orderId: orderNumber,
      }),
    });
    console.log(`[WEBHOOK] ✅ Confirmation email sent to ${email}`);
  } catch (emailError) {
    console.error("[WEBHOOK] ❌ Failed to send confirmation email:", emailError);
  }
}

async function handleTokenPurchase(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId;
  const tokens = parseInt(session.metadata?.tokens || "0", 10);
  if (!userId || !tokens || tokens <= 0) {
    console.error("[WEBHOOK] token purchase: brak userId/tokens w metadata", session.metadata);
    return;
  }
  // Dolicz tokeny (kolumna raw SQL, nie ma jej w Prisma schema). Idempotencja
  // zapewniona wyzej przez ProcessedStripeEvent (event.id) — brak podwojnego doladowania.
  await prisma.$executeRaw`
    UPDATE "User" SET "tokenBalance" = COALESCE("tokenBalance", 0) + ${tokens} WHERE "id" = ${userId}
  `;
  console.log(`[WEBHOOK] token purchase: +${tokens} tokenow dla user ${userId}`);
}

async function handleSubscriptionCreated(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId;

  if (!userId) {
    console.error("Missing userId in checkout session metadata");
    return;
  }

  const stripeSubscription = await stripe.subscriptions.retrieve(session.subscription as string) as any;

  await prisma.subscription.update({
    where: { userId },
    data: {
      stripeSubscriptionId: stripeSubscription.id,
      stripePriceId: stripeSubscription.items.data[0].price.id,
      stripeCurrentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
      status: "active",
    },
  });

  console.log(`Subscription created for user ${userId}`);
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const sub = subscription as any;
  const dbSubscription = await prisma.subscription.findUnique({
    where: { stripeSubscriptionId: sub.id },
  });

  if (!dbSubscription) {
    console.error(`Subscription not found: ${sub.id}`);
    return;
  }

  await prisma.subscription.update({
    where: { id: dbSubscription.id },
    data: {
      status: sub.status === "active" ? "active" : "cancelled",
      stripeCurrentPeriodEnd: new Date(sub.current_period_end * 1000),
    },
  });

  console.log(`Subscription updated: ${subscription.id}`);
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const dbSubscription = await prisma.subscription.findUnique({
    where: { stripeSubscriptionId: subscription.id },
  });

  if (!dbSubscription) {
    console.error(`Subscription not found: ${subscription.id}`);
    return;
  }

  await prisma.subscription.update({
    where: { id: dbSubscription.id },
    data: {
      status: "cancelled",
      cancelledAt: new Date(),
    },
  });

  console.log(`Subscription deleted: ${subscription.id}`);
}

async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
  const subscription = await stripe.subscriptions.retrieve((invoice as any).subscription as string) as any;

  const dbSubscription = await prisma.subscription.findUnique({
    where: { stripeSubscriptionId: subscription.id },
  });

  if (!dbSubscription) return;

  await prisma.subscription.update({
    where: { id: dbSubscription.id },
    data: {
      status: "active",
      stripeCurrentPeriodEnd: new Date(subscription.current_period_end * 1000),
    },
  });

  console.log(`Invoice payment succeeded for subscription ${subscription.id}`);
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  console.error(`Invoice payment failed for subscription ${(invoice as any).subscription}`);
  // TODO: Send payment failed email to customer
}
