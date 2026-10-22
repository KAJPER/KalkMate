import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyNotificationSign, verifyTransaction } from "@/lib/przelewy24";
import { findTokenPurchaseBySession, markTokenPurchasePaidAndCredit } from "@/lib/tokenPurchases";
import { orderIdForPaymentSession, settleP24OrderPayment } from "@/lib/paymentReminders";
import { alertAdmin, formatMinor } from "@/lib/checkoutPricing";

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

  // Doladowanie tokenow AI (osobna tabela od "Order" — patrz tokenPurchases.ts)
  const tokenPurchase = await findTokenPurchaseBySession(String(sessionId));
  if (tokenPurchase) {
    if (tokenPurchase.status === "paid") {
      console.log("[P24 WEBHOOK] Token purchase already processed:", tokenPurchase.id);
      return NextResponse.json({ received: true });
    }
    // Druga linia obrony: kwota/waluta z powiadomienia vs zapisany zakup.
    // Niezgodnosc = NIE weryfikujemy (P24 zwroci srodki), alert do admina.
    if (
      Number(amount) !== Number(tokenPurchase.amount) ||
      String(currency).toLowerCase() !== String(tokenPurchase.currency || "pln").toLowerCase()
    ) {
      await alertAdmin("P24: niezgodna kwota zakupu tokenow", [
        `Zakup: ${tokenPurchase.id} (sesja ${tokenPurchase.sessionId}), user ${tokenPurchase.userId}`,
        `P24: ${formatMinor(Number(amount), String(currency))}, zapisane: ${formatMinor(tokenPurchase.amount, tokenPurchase.currency)}`,
        `Tokenow NIE doliczono, platnosci NIE zweryfikowano.`,
      ]);
      return NextResponse.json({ received: true });
    }
    try {
      await verifyTransaction({
        sessionId: String(sessionId),
        orderId: Number(orderId),
        amount: Number(amount),
        currency: String(currency).toUpperCase(),
      });
    } catch (err) {
      console.error("[P24 WEBHOOK] Verify transaction failed (token purchase):", err);
      return NextResponse.json({ error: "Verify failed" }, { status: 500 });
    }
    // pending -> paid i saldo w jednej transakcji; drugi rownolegly webhook nic nie doliczy.
    const credited = await markTokenPurchasePaidAndCredit(tokenPurchase);
    if (credited) {
      console.log(`[P24 WEBHOOK] ✅ Token purchase paid: +${tokenPurchase.tokens} tokenow dla user ${tokenPurchase.userId}`);
    } else {
      console.log("[P24 WEBHOOK] Token purchase already processed (race):", tokenPurchase.id);
    }
    return NextResponse.json({ received: true });
  }

  // Find order — po p24SessionId albo po dodatkowej sesji z linku
  // "Dokończ płatność" (lib/paymentReminders.ts, /api/p24/resume).
  const extraOrderId = await orderIdForPaymentSession(String(sessionId));
  const rows = await prisma.$queryRaw<Array<{ id: string; orderNumber: string }>>`
    SELECT id, "orderNumber"
    FROM "Order"
    WHERE "p24SessionId" = ${String(sessionId)} OR id = ${extraOrderId ?? ""}
    LIMIT 1
  `;

  if (!rows.length) {
    console.error("[P24 WEBHOOK] Order not found for sessionId:", sessionId);
    // Return 200 so P24 doesn't retry indefinitely
    return NextResponse.json({ received: true });
  }

  // Wspolna sciezka z przypomnieniami/auto-anulowaniem (lib/paymentReminders.ts):
  // porownanie kwoty, verify, atomowe pending->paid, kupon, paragon, mail,
  // wplata po anulowaniu -> notatka + alert.
  const result = await settleP24OrderPayment({
    orderId: rows[0].id,
    sessionId: String(sessionId),
    p24OrderId: Number(orderId),
    amount: Number(amount),
    currency: String(currency),
    source: "webhook",
  });

  if (result === "verify_failed") {
    return NextResponse.json({ error: "Verify failed" }, { status: 500 });
  }
  if (result === "already_paid") {
    console.log("[P24 WEBHOOK] Already processed:", rows[0].orderNumber);
  }
  return NextResponse.json({ received: true });
}
