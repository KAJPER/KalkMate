import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { giveConsent } from "@/lib/newsletter";
import { clientIp } from "@/lib/rate-limit";
import { attributionToMetadata, ipHashFromHeaders, resolveAttribution } from "@/lib/attribution";
import { prisma } from "@/lib/db";
import {
  reserveCoupon, releaseCouponReservation, setCouponReservationRef, COUPON_RESERVATION_TTL_STRIPE_MS,
} from "@/lib/coupons";
import { validateOrderUnits, stripePersonalizationMetadata } from "@/lib/orderPersonalization";
import { quoteCheckout } from "@/lib/checkoutPricing";
import { randomUUID } from "crypto";

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
      country,
      // currency / shippingCents z body ignorujemy (stare klienty nadal je
      // wysylaja) — cena liczona na serwerze z kraju, lib/checkoutPricing.ts.
      couponCode,
      unlockCode, personalizeName,
      quantity, personalizations,
      marketingConsent, attribution,
      personalizeConsent, withdrawalConsent,
    } = body;
    // Produkt jest personalizowany (kod AI + imie) — art. 38 pkt 3 u.p.k.:
    // klient musi swiadomie zaakceptowac brak prawa odstapienia. Front wysyla
    // checkbox personalizacji jako personalizeConsent/withdrawalConsent.
    if (personalizeConsent !== true && withdrawalConsent !== true) {
      return NextResponse.json(
        { error: "Zaakceptuj warunki personalizacji (brak prawa odstapienia).", reason: "withdrawal_consent" },
        { status: 400 }
      );
    }
    const withdrawalWaiverAt = new Date().toISOString();
    // Zgoda na newsletter z formularza zamowienia (checkbox, domyslnie
    // odznaczony) — niezalezna od tego, czy klient potem zaplaci.
    if (marketingConsent === true) {
      await giveConsent(user.email!, "order", clientIp(request)).catch((e) => console.error("[checkout] consent save failed:", e));
    }
    const email = user.email!;
    const resolvedCountry = String(country || "PL").trim().toUpperCase() || "PL";
    const isPoland = resolvedCountry === "PL";

    if (!name || !phone) {
      return NextResponse.json({ error: "Imie i telefon sa wymagane." }, { status: 400 });
    }
    // Personalizacja obowiazkowa dla kazdego zamowienia fizycznego urzadzenia
    // — patrz lib/orderPersonalization.ts (podstawa wylaczenia prawa
    // odstapienia, art. 38 pkt 3 ustawy o prawach konsumenta). Przekazywana
    // dalej przez Stripe metadata, bo Order powstaje dopiero w webhooku.
    // Wiele sztuk: quantity + personalizations[] (stary format: unlockCode/personalizeName = 1 szt.).
    const unitsCheck = validateOrderUnits({ quantity, personalizations, unlockCode, personalizeName });
    if (!unitsCheck.ok) {
      return NextResponse.json({ error: unitsCheck.error, reason: unitsCheck.reason }, { status: 400 });
    }
    const { units } = unitsCheck;
    const personalizationMeta = stripePersonalizationMetadata(units);
    if (isPoland && !pickupPoint) {
      return NextResponse.json({ error: "Paczkomat jest wymagany dla dostaw do Polski." }, { status: 400 });
    }
    if (!isPoland && (!street || !city)) {
      return NextResponse.json({ error: "Street and city are required for international delivery." }, { status: 400 });
    }

    // Cennik wylacznie po stronie serwera (K1): waluta i wysylka z kraju.
    const priced = await quoteCheckout({ country: resolvedCountry, couponCode, userId: user.id, quantity: unitsCheck.quantity });
    if (!priced.ok) {
      return NextResponse.json({ error: priced.error, reason: priced.reason }, { status: 409 });
    }
    const quote = priced.quote;
    const resolvedCurrency = quote.currency;

    // Rezerwacja kuponu (limit uzyc liczony z rezerwacjami — lib/coupons.ts).
    // Webhook skonsumuje ja po oplaceniu (id w metadata PaymentIntentu).
    let reservationId = "";
    if (quote.couponCode) {
      const rid = await reserveCoupon({
        code: quote.couponCode, ref: randomUUID(), userId: user.id, ttlMs: COUPON_RESERVATION_TTL_STRIPE_MS,
      });
      if (!rid) {
        return NextResponse.json({ error: "Kupon zostal juz wykorzystany.", reason: "used_up" }, { status: 409 });
      }
      reservationId = rid;
    }

    // Poland: cards/Apple Pay/Google Pay go through Przelewy24 now — Stripe is
    // only reached here for the Klarna fallback, so restrict it to Klarna only
    // instead of offering the full automatic payment method menu again.
    const paymentMethodConfig = isPoland
      ? { payment_method_types: ["klarna"] }
      : { automatic_payment_methods: { enabled: true } };

    // Zrodlo klienta jedzie w metadata — Order powstaje dopiero w webhooku.
    const attributionMeta = await resolveAttribution(attribution, ipHashFromHeaders(request.headers))
      .then(attributionToMetadata)
      .catch(() => "");

    let paymentIntent;
    try {
      paymentIntent = await stripe.paymentIntents.create({
        amount: quote.amount,
        currency: resolvedCurrency,
        ...paymentMethodConfig,
        metadata: {
          product: "KalkMate v3.0",
          withdrawal_waiver_at: withdrawalWaiverAt,
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
          shipping_amount: String(quote.shippingCents),
          coupon_code: quote.couponCode,
          coupon_reservation: reservationId,
          discount_amount: String(quote.discountCents),
          // Pierwsza sztuka w starych polach (zgodnosc wstecz / podglad w Stripe),
          // komplet w `personalization` (albo personalization_1..n — limit 500 zn.).
          personalized_code: units[0].code,
          personalized_name: units[0].name,
          quantity: String(quote.quantity),
          ...personalizationMeta,
          attribution: attributionMeta,
        },
        receipt_email: email,
        description: `KalkMate v3.0 - AI Calculator${quote.quantity > 1 ? ` x${quote.quantity}` : ""}`,
      });
    } catch (e) {
      if (reservationId) await releaseCouponReservation({ id: reservationId }).catch(() => {});
      throw e;
    }
    if (reservationId) {
      await setCouponReservationRef(reservationId, paymentIntent.id).catch((e) => console.error("[checkout] reservation ref update failed:", e));
    }

    // amount/currency/shippingCents/discountCents — front pokazuje te liczby
    // na przycisku platnosci (zrodlo prawdy = serwer).
    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      amount: quote.amount,
      currency: quote.currency,
      shippingCents: quote.shippingCents,
      discountCents: quote.discountCents,
      quantity: quote.quantity,
      unitCents: quote.unitCents,
      subtotalCents: quote.subtotalCents,
    });
  } catch (error) {
    console.error("Stripe error:", error);
    return NextResponse.json(
      { error: "Wystapil blad przy tworzeniu platnosci." },
      { status: 500 }
    );
  }
}
