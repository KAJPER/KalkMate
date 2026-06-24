import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getCoupon, computeDiscount } from "@/lib/coupons";

const EU_COUNTRIES = new Set([
  "AT","BE","BG","HR","CY","CZ","DK","EE","FI","FR","DE",
  "GR","HU","IE","IT","LV","LT","LU","MT","NL","PT","RO","SK","SI","ES","SE",
]);

export async function POST(request: NextRequest) {
  try {
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
    const {
      name, phone,
      pickupPoint, pickupPointAddress,
      street, postcode, city,
      country, currency, shippingCents,
      couponCode,
    } = body;
    const email = user.email!;
    const resolvedCountry = (country || "PL") as string;
    const isPoland = resolvedCountry === "PL";
    const resolvedCurrency = ((currency as string) || "pln").toLowerCase();

    if (!name || !phone) {
      return NextResponse.json({ error: "Imie i telefon sa wymagane." }, { status: 400 });
    }
    if (isPoland && !pickupPoint) {
      return NextResponse.json({ error: "Paczkomat jest wymagany dla dostaw do Polski." }, { status: 400 });
    }
    if (!isPoland && (!street || !city)) {
      return NextResponse.json({ error: "Street and city are required for international delivery." }, { status: 400 });
    }

    // Pricing
    const productAmount = resolvedCurrency === "eur" ? 16900 : 69900;

    // H10: walidacja shippingCents od klienta — max 5000 groszy (50 zł), tylko integer >= 0
    const MAX_SHIPPING = 5000;
    if (
      shippingCents !== undefined &&
      shippingCents !== null &&
      (typeof shippingCents !== "number" ||
        !Number.isInteger(shippingCents) ||
        shippingCents < 0 ||
        shippingCents > MAX_SHIPPING)
    ) {
      return NextResponse.json({ error: "Nieprawidłowa kwota wysyłki." }, { status: 400 });
    }
    const resolvedShipping = typeof shippingCents === "number" ? shippingCents : 0;

    // Kupon rabatowy — autorytatywna walidacja po stronie serwera (nie ufamy klientowi).
    let discountAmount = 0;
    let appliedCoupon = "";
    if (couponCode && String(couponCode).trim()) {
      const coupon = await getCoupon(String(couponCode));
      const disc = computeDiscount(coupon, productAmount, resolvedCurrency);
      if (disc.ok) {
        discountAmount = disc.discountCents;
        appliedCoupon = disc.coupon!.code;
      }
    }

    const totalAmount = (productAmount - discountAmount) + resolvedShipping;

    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalAmount,
      currency: resolvedCurrency,
      automatic_payment_methods: { enabled: true },
      metadata: {
        product: "KalkMate v1.0",
        user_id: user.id,
        customer_name: name,
        customer_email: email,
        customer_phone: phone,
        customer_address_street: street || "",
        customer_address_postcode: postcode || "",
        customer_address_city: city || "",
        customer_country: resolvedCountry,
        pickup_point: pickupPoint || "",
        pickup_point_address: pickupPointAddress || "",
        currency: resolvedCurrency,
        shipping_amount: String(resolvedShipping),
        coupon_code: appliedCoupon,
        discount_amount: String(discountAmount),
      },
      receipt_email: email,
      description: "KalkMate v1.0 - AI Calculator",
    });

    return NextResponse.json({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    console.error("Stripe error:", error);
    return NextResponse.json(
      { error: "Wystapil blad przy tworzeniu platnosci." },
      { status: 500 }
    );
  }
}
