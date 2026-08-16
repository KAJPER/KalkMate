import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { getTokenPack } from "@/lib/tokenPacks";
import { registerTransaction, paymentUrl } from "@/lib/przelewy24";
import { createPendingTokenPurchaseP24 } from "@/lib/tokenPurchaseP24";
import { randomUUID } from "crypto";

// POST /api/tokens/checkout  { packId, currency? }
// PLN (domyslnie) -> Przelewy24 (spojne z platnoscia za kalkulator).
// Kazda inna waluta -> Stripe Checkout (karta), bo p24 jako Stripe payment
// method type NIE jest aktywowane na koncie Stripe — probowanie tego zawsze
// konczylo sie 400 "payment method type provided: p24 is invalid" (100%
// nieudanych platnosci).
// Po udanej platnosci: webhook P24 (TokenPurchaseP24) albo Stripe webhook
// (checkout.session.completed, type=token_purchase) dolicza tokeny do
// User.tokenBalance.
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Nie zalogowany" }, { status: 401 });
    }

    const { packId, currency } = await request.json().catch(() => ({}));
    const pack = getTokenPack(String(packId || ""));
    if (!pack) {
      return NextResponse.json({ error: "Nieznany pakiet" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user) {
      return NextResponse.json({ error: "Nie znaleziono uzytkownika" }, { status: 404 });
    }

    const resolvedCurrency = String(currency || "pln").toLowerCase();

    if (resolvedCurrency === "pln") {
      const sessionId = `km-tok-${randomUUID()}`;
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://kalkmate.pl";
      const returnUrl = `${appUrl}/panel?tokens=success`;
      const statusUrl = `${appUrl}/api/webhooks/p24`;

      const token = await registerTransaction({
        sessionId,
        amount: pack.priceGrosze,
        currency: "PLN",
        description: `KalkMate — ${pack.label}`,
        email: user.email,
        client: user.name || user.email,
        language: "pl",
        urlReturn: returnUrl,
        urlStatus: statusUrl,
        channel: 16,
      });

      await createPendingTokenPurchaseP24({
        id: randomUUID(),
        sessionId,
        userId: user.id,
        tokens: pack.tokens,
        amount: pack.priceGrosze,
        currency: "pln",
      });

      return NextResponse.json({ url: paymentUrl(token) });
    }

    // Inna waluta niz PLN -> Stripe (tylko karta, bez p24 - nieaktywowane).
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://kalkmate.pl";
    const checkout = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: user.email,
      line_items: [
        {
          price_data: {
            currency: resolvedCurrency,
            product_data: {
              name: `KalkMate — ${pack.label}`,
              description: "Doładowanie tokenów AI dla kalkulatora KalkMate",
              images: ["https://kalkmate.pl/KalkMate.png"],
            },
            unit_amount: pack.priceEurCents,
          },
          quantity: 1,
        },
      ],
      success_url: `${appUrl}/panel?tokens=success`,
      cancel_url: `${appUrl}/panel?tokens=cancelled`,
      metadata: {
        type: "token_purchase",
        userId: user.id,
        tokens: String(pack.tokens),
        packId: pack.id,
      },
    });

    return NextResponse.json({ url: checkout.url });
  } catch (error) {
    console.error("[tokens/checkout] error:", error);
    return NextResponse.json({ error: "Nie udalo sie utworzyc platnosci" }, { status: 500 });
  }
}
