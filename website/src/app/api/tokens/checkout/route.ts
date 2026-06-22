import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { getTokenPack } from "@/lib/tokenPacks";

// POST /api/tokens/checkout  { packId }
// Tworzy Stripe Checkout Session (jednorazowa platnosc) na doladowanie tokenow.
// Po udanej platnosci webhook (checkout.session.completed, type=token_purchase)
// dolicza tokeny do User.tokenBalance.
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Nie zalogowany" }, { status: 401 });
    }

    const { packId } = await request.json().catch(() => ({}));
    const pack = getTokenPack(String(packId || ""));
    if (!pack) {
      return NextResponse.json({ error: "Nieznany pakiet" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user) {
      return NextResponse.json({ error: "Nie znaleziono uzytkownika" }, { status: 404 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://kalkmate.pl";
    const checkout = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card", "blik", "p24"],
      customer_email: user.email,
      line_items: [
        {
          price_data: {
            currency: "pln",
            product_data: {
              name: `KalkMate — ${pack.label}`,
              description: "Doładowanie tokenów AI dla kalkulatora KalkMate",
              images: ["https://kalkmate.pl/KalkMate.png"],
            },
            unit_amount: pack.priceGrosze,
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
