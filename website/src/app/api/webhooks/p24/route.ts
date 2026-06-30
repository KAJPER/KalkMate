import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyNotificationSign, verifyTransaction } from "@/lib/przelewy24";
import { sendMail } from "@/lib/mailer";
import { purchaseConfirmationEmail } from "@/lib/email-templates";

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const {
    merchantId, posId, sessionId, amount, originAmount,
    currency, orderId, methodId, statement, sign,
  } = body as Record<string, any>;

  // Validate required fields
  if (!sessionId || !orderId || !amount || !currency || !sign) {
    console.error("[P24 WEBHOOK] Missing required fields", body);
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  // Verify signature
  const signValid = verifyNotificationSign({
    merchantId: Number(merchantId),
    posId: Number(posId),
    sessionId: String(sessionId),
    amount: Number(amount),
    originAmount: Number(originAmount),
    currency: String(currency),
    orderId: Number(orderId),
    methodId: Number(methodId),
    statement: String(statement),
    sign: String(sign),
  });

  if (!signValid) {
    console.error("[P24 WEBHOOK] Invalid signature for sessionId:", sessionId);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // Find pending order
  const rows = await prisma.$queryRaw<
    Array<{
      id: string;
      status: string;
      orderNumber: string;
      customerName: string;
      customerEmail: string;
      customerPhone: string;
      pickupPoint: string;
      pickupPointAddress: string;
      amount: number;
      userId: string | null;
    }>
  >`
    SELECT id, status, "orderNumber", "customerName", "customerEmail",
           "customerPhone", "pickupPoint", "pickupPointAddress", amount, "userId"
    FROM "Order"
    WHERE "p24SessionId" = ${String(sessionId)}
    LIMIT 1
  `;

  if (!rows.length) {
    console.error("[P24 WEBHOOK] Order not found for sessionId:", sessionId);
    // Return 200 so P24 doesn't retry indefinitely
    return NextResponse.json({ received: true });
  }

  const order = rows[0];

  // Idempotency: skip if already paid
  if (order.status === "paid") {
    console.log("[P24 WEBHOOK] Already processed:", order.orderNumber);
    return NextResponse.json({ received: true });
  }

  // Verify transaction with P24
  try {
    await verifyTransaction({
      sessionId: String(sessionId),
      orderId: Number(orderId),
      amount: Number(amount),
      currency: String(currency).toUpperCase(),
    });
  } catch (err) {
    console.error("[P24 WEBHOOK] Verify transaction failed:", err);
    return NextResponse.json({ error: "Verify failed" }, { status: 500 });
  }

  const now = new Date().toISOString();

  // Update order to paid
  await prisma.$executeRaw`
    UPDATE "Order"
    SET status = 'paid', "paidAt" = ${now}, "updatedAt" = ${now}
    WHERE id = ${order.id}
  `;

  // Upgrade user subscription to 30 days trial if they have a subscription
  if (order.userId) {
    try {
      const subscription = await prisma.subscription.findUnique({
        where: { userId: order.userId },
      });
      if (subscription) {
        const newTrialEndsAt = new Date();
        newTrialEndsAt.setDate(newTrialEndsAt.getDate() + 30);
        await prisma.subscription.update({
          where: { id: subscription.id },
          data: { trialDays: 30, trialEndsAt: newTrialEndsAt, status: "trial" },
        });
      }
    } catch (err) {
      console.error("[P24 WEBHOOK] Subscription update failed:", err);
    }
  }

  console.log(`[P24 WEBHOOK] ✅ Order paid: ${order.orderNumber} for ${order.customerEmail}`);

  // Send confirmation email
  try {
    await sendMail({
      to: order.customerEmail,
      subject: `Potwierdzenie zamówienia ${order.orderNumber} - KalkMate`,
      html: purchaseConfirmationEmail({
        customerName: order.customerName || "Kliencie",
        customerEmail: order.customerEmail,
        product: "KalkMate v1.0",
        amount: order.amount,
        pickupPoint: order.pickupPoint || "",
        pickupPointAddress: order.pickupPointAddress || "",
        orderId: order.orderNumber,
      }),
    });
    console.log(`[P24 WEBHOOK] ✅ Confirmation email sent to ${order.customerEmail}`);
  } catch (emailErr) {
    console.error("[P24 WEBHOOK] Email failed:", emailErr);
  }

  return NextResponse.json({ received: true });
}
