import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getCoupon, computeDiscount } from "@/lib/coupons";
import { registerTransaction, paymentUrl } from "@/lib/przelewy24";
import { randomUUID } from "crypto";

const EU_COUNTRIES = new Set([
  "AT","BE","BG","HR","CY","CZ","DK","EE","FI","FR","DE",
  "GR","HU","IE","IT","LV","LT","LU","MT","NL","PT","RO","SK","SI","ES","SE",
]);

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Aby kupić kalkulator, musisz być zalogowany." },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, email: true, emailVerified: true, name: true },
    });
    if (!user) return NextResponse.json({ error: "Brak konta" }, { status: 401 });
    if (!user.emailVerified) {
      return NextResponse.json(
        { error: "Najpierw zweryfikuj swój email. Sprawdź skrzynkę pocztową." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      name, phone,
      pickupPoint, pickupPointAddress,
      street, postcode, city,
      country, currency, shippingCents, couponCode,
      blikMode = false,
    } = body;

    const email = user.email!;
    const resolvedCountry = (country || "PL") as string;
    const resolvedCurrency = ((currency as string) || "PLN").toUpperCase();
    const isPoland = resolvedCountry === "PL";

    if (!name || !phone) {
      return NextResponse.json({ error: "Imię i telefon są wymagane." }, { status: 400 });
    }
    if (isPoland && !pickupPoint) {
      return NextResponse.json({ error: "Paczkomat jest wymagany dla dostaw do Polski." }, { status: 400 });
    }
    if (!isPoland && (!street || !city)) {
      return NextResponse.json({ error: "Podaj pełny adres dostawy." }, { status: 400 });
    }

    const productAmount = resolvedCurrency === "EUR" ? 16900 : 69900;

    const MAX_SHIPPING = 5000;
    const resolvedShipping =
      typeof shippingCents === "number" &&
      Number.isInteger(shippingCents) &&
      shippingCents >= 0 &&
      shippingCents <= MAX_SHIPPING
        ? shippingCents
        : 0;

    let discountAmount = 0;
    let appliedCoupon = "";
    if (couponCode && String(couponCode).trim()) {
      const coupon = await getCoupon(String(couponCode));
      const disc = computeDiscount(coupon, productAmount, resolvedCurrency.toLowerCase());
      if (disc.ok) {
        discountAmount = disc.discountCents;
        appliedCoupon = disc.coupon!.code;
      }
    }

    const totalAmount = productAmount - discountAmount + resolvedShipping;
    const sessionId = `km-${randomUUID()}`;

    const baseUrl = process.env.NEXTAUTH_URL || "https://kalkmate.pl";
    const returnUrl = `${baseUrl}/?p24_return=true&p24_session=${sessionId}`;
    const statusUrl = `${baseUrl}/api/webhooks/p24`;

    // BLIK only: channel=8192. All other methods: channel=16 (everything enabled for merchant)
    const channel = blikMode ? 8192 : 16;

    const token = await registerTransaction({
      sessionId,
      amount: totalAmount,
      currency: resolvedCurrency,
      description: "KalkMate v1.0 - AI Calculator",
      email,
      client: name,
      phone,
      address: street || "",
      zip: postcode || "",
      city: city || resolvedCountry,
      country: resolvedCountry === "OTHER" ? "US" : resolvedCountry,
      language: resolvedCurrency === "PLN" ? "pl" : "en",
      urlReturn: returnUrl,
      urlStatus: statusUrl,
      channel,
    });

    const orderNumber = `KM-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(1000 + Math.random() * 9000)}`;
    const orderId = randomUUID();
    const now = new Date().toISOString();

    // Store pending order — raw SQL to use new columns before client regeneration
    await prisma.$executeRaw`
      INSERT INTO "Order" (
        id, "userId", "orderNumber", status,
        "customerName", "customerEmail", "customerPhone",
        "pickupPoint", "pickupPointAddress",
        amount, currency,
        "paymentProvider", "p24SessionId",
        "createdAt", "updatedAt"
      ) VALUES (
        ${orderId}, ${user.id}, ${orderNumber}, 'pending',
        ${name}, ${email}, ${phone},
        ${isPoland && pickupPoint ? String(pickupPoint) : ""},
        ${isPoland && pickupPointAddress ? String(pickupPointAddress) : ""},
        ${totalAmount}, ${resolvedCurrency.toLowerCase()},
        'p24', ${sessionId},
        ${now}, ${now}
      )
    `;

    return NextResponse.json({
      token,
      sessionId,
      redirectUrl: paymentUrl(token),
    });
  } catch (error) {
    console.error("[P24] create-transaction error:", error);
    return NextResponse.json(
      { error: "Błąd przy tworzeniu płatności Przelewy24." },
      { status: 500 }
    );
  }
}
