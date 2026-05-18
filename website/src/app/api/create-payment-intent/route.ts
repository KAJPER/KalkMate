import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    // Wymagamy zalogowania zeby kupic
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Aby kupic kalkulator, musisz byc zalogowany. Zaloguj sie lub zaloz konto." },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, email: true, emailVerified: true },
    });
    if (!user) {
      return NextResponse.json({ error: "Brak konta" }, { status: 401 });
    }
    if (!user.emailVerified) {
      return NextResponse.json(
        { error: "Najpierw zweryfikuj swoj email. Sprawdz skrzynke pocztowa." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name, phone, pickupPoint, pickupPointAddress } = body;
    // Uzywamy emaila z sesji (a nie z body) - eliminuje ryzyko podszywania
    const email = user.email!;

    if (!name || !phone || !pickupPoint) {
      return NextResponse.json(
        { error: "Imie, telefon i paczkomat sa wymagane." },
        { status: 400 }
      );
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: 69900,
      currency: "pln",
      automatic_payment_methods: { enabled: true },
      metadata: {
        product: "KalkMate v1.0",
        user_id: user.id,                  // <-- key: link payment do konta
        customer_name: name,
        customer_email: email,
        customer_phone: phone,
        pickup_point: pickupPoint,
        pickup_point_address: pickupPointAddress || "",
      },
      receipt_email: email,
      description: "KalkMate v1.0 - Inteligentny kalkulator z AI",
    });

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
    });
  } catch (error) {
    console.error("Stripe error:", error);
    return NextResponse.json(
      { error: "Wystapil blad przy tworzeniu platnosci." },
      { status: 500 }
    );
  }
}
