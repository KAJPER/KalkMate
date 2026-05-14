import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, phone, pickupPoint, pickupPointAddress } = body;

    if (!name || !email || !phone || !pickupPoint) {
      return NextResponse.json(
        { error: "Wszystkie pola są wymagane." },
        { status: 400 }
      );
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: 69900,
      currency: "pln",
      automatic_payment_methods: { enabled: true },
      metadata: {
        product: "KalkMate v1.0",
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
      { error: "Wystąpił błąd przy tworzeniu płatności." },
      { status: 500 }
    );
  }
}
