import { NextRequest, NextResponse } from "next/server";
import { resolveCheckoutBuyer } from "@/lib/checkoutBuyer";
import { GUEST_NEWSLETTER_NOTE } from "@/lib/guestOrders";
import { giveConsent } from "@/lib/newsletter";
import { clientIp } from "@/lib/rate-limit";
import { ipHashFromHeaders, resolveAttribution, saveOrderAttribution } from "@/lib/attribution";
import { prisma } from "@/lib/db";
import { setOrderCoupon, reserveCoupon, releaseCouponReservation, COUPON_RESERVATION_TTL_P24_MS } from "@/lib/coupons";
import { registerTransaction, paymentUrl, p24Language } from "@/lib/przelewy24";
import { randomUUID } from "crypto";
import {
  ensureOrderPersonalizationColumns, validateOrderUnits, serializeOrderUnits, type OrderUnit,
} from "@/lib/orderPersonalization";
import { quoteCheckout, generateOrderNumber, isUniqueViolation } from "@/lib/checkoutPricing";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    // Zalogowany (email z konta) albo gosc (email z formularza) — lib/checkoutBuyer.ts.
    const resolved = await resolveCheckoutBuyer(request, body?.email);
    if (!resolved.ok) return resolved.res;
    const { buyer } = resolved;
    const {
      name, phone,
      pickupPoint, pickupPointAddress,
      street, postcode, city,
      // currency / shippingCents z body ignorujemy (stare klienty nadal je
      // wysylaja) — cena liczona na serwerze z kraju, lib/checkoutPricing.ts.
      country, couponCode,
      blikMode = false,
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
    // odznaczony) — zalogowanemu zapisujemy od razu. Gosc moglby wpisac cudzy
    // adres (a giveConsent zdejmuje go z listy wypisanych), wiec jego zgode
    // zapisujemy dopiero po oplaceniu (webhook / settle P24).
    const guestNewsletter = buyer.guest && marketingConsent === true;
    if (marketingConsent === true && !buyer.guest) {
      await giveConsent(buyer.email, "order", clientIp(request)).catch((e) => console.error("[checkout] consent save failed:", e));
    }

    const email = buyer.email;
    const resolvedCountry = String(country || "PL").trim().toUpperCase() || "PL";
    const isPoland = resolvedCountry === "PL";

    if (!name || !phone) {
      return NextResponse.json({ error: "Imię i telefon są wymagane." }, { status: 400 });
    }
    // Personalizacja jest obowiazkowa dla kazdego zamowienia fizycznego
    // urzadzenia — patrz komentarz w lib/orderPersonalization.ts (podstawa
    // wylaczenia prawa odstapienia, art. 38 pkt 3 ustawy o prawach konsumenta).
    // Wiele sztuk: quantity + personalizations[] (stary format: unlockCode/personalizeName = 1 szt.).
    const unitsCheck = validateOrderUnits({ quantity, personalizations, unlockCode, personalizeName });
    if (!unitsCheck.ok) {
      return NextResponse.json({ error: unitsCheck.error, reason: unitsCheck.reason }, { status: 400 });
    }
    const { units } = unitsCheck;
    if (isPoland && !pickupPoint) {
      return NextResponse.json({ error: "Paczkomat jest wymagany dla dostaw do Polski." }, { status: 400 });
    }
    if (!isPoland && (!street || !city)) {
      return NextResponse.json({ error: "Podaj pełny adres dostawy." }, { status: 400 });
    }

    // Cennik wylacznie po stronie serwera (K1): waluta i wysylka z kraju.
    const priced = await quoteCheckout({ country: resolvedCountry, couponCode, userId: buyer.couponOwner, quantity: unitsCheck.quantity });
    if (!priced.ok) {
      return NextResponse.json({ error: priced.error, reason: priced.reason }, { status: 409 });
    }
    const quote = priced.quote;
    const resolvedCurrency = quote.currency.toUpperCase();
    const totalAmount = quote.amount;
    const sessionId = `km-${randomUUID()}`;
    const orderId = randomUUID();

    // Rezerwacja kuponu na czas oczekiwania na wplate (zamowienie P24 mozna
    // oplacic do 30 dni) — webhook P24 ja skonsumuje, auto-anulowanie zwolni.
    // Kod partnera nie ma limitu uzyc — bez rezerwacji (lib/affiliates.ts).
    if (quote.couponCode && !quote.affiliate) {
      const rid = await reserveCoupon({
        code: quote.couponCode, ref: orderId, userId: buyer.couponOwner, ttlMs: COUPON_RESERVATION_TTL_P24_MS,
      });
      if (!rid) {
        return NextResponse.json({ error: "Kupon zostal juz wykorzystany.", reason: "used_up" }, { status: 409 });
      }
    }

    const baseUrl = process.env.NEXTAUTH_URL || "https://kalkmate.pl";
    const returnUrl = `${baseUrl}/?p24_return=true&p24_session=${sessionId}`;
    const statusUrl = `${baseUrl}/api/webhooks/p24`;

    // BLIK only: channel=8192. All other methods: channel=16 (everything enabled for merchant)
    const channel = blikMode ? 8192 : 16;

    let token: string;
    try {
      token = await registerTransaction({
        sessionId,
        amount: totalAmount,
        currency: resolvedCurrency,
        description: `KalkMate v3.0 - AI Calculator${quote.quantity > 1 ? ` x${quote.quantity}` : ""}`,
        email,
        client: name,
        phone,
        address: street || "",
        zip: postcode || "",
        city: city || resolvedCountry,
        country: resolvedCountry === "OTHER" ? "US" : resolvedCountry,
        language: p24Language(resolvedCurrency, resolvedCountry),
        urlReturn: returnUrl,
        urlStatus: statusUrl,
        channel,
      });

      await insertPendingOrder({
        orderId, userId: buyer.userId, name, email, phone,
        pickupPoint: isPoland && pickupPoint ? String(pickupPoint) : "",
        pickupPointAddress: isPoland && pickupPointAddress ? String(pickupPointAddress) : "",
        street: street || "", postcode: postcode || "", city: city || "", country: resolvedCountry,
        amount: totalAmount, currency: quote.currency, sessionId,
        quantity: quote.quantity, units,
        adminNotes: `[ZGODA] Brak prawa odstapienia (produkt personalizowany) zaakceptowany ${withdrawalWaiverAt}`
          + (guestNewsletter ? `\n${GUEST_NEWSLETTER_NOTE} ${withdrawalWaiverAt}` : ""),
      });
    } catch (e) {
      // Nie udalo sie zarejestrowac platnosci / zapisac zamowienia — oddaj kupon.
      if (quote.couponCode) await releaseCouponReservation({ ref: orderId }).catch(() => {});
      throw e;
    }

    // Kupon zapisany przy zamowieniu — webhook P24 zliczy uzycie po oplaceniu.
    if (quote.couponCode) {
      await setOrderCoupon(orderId, quote.couponCode, quote.discountCents).catch((e) => console.error("[P24] order coupon save failed:", e));
    }

    // Skad przyszedl klient (lib/attribution.ts) — blad nie blokuje platnosci.
    try {
      await saveOrderAttribution(orderId, await resolveAttribution(attribution, ipHashFromHeaders(request.headers)));
    } catch (e) {
      console.error("[P24] attribution save failed:", e);
    }

    return NextResponse.json({
      token,
      sessionId,
      redirectUrl: paymentUrl(token),
      // Kwota liczona na serwerze — front pokazuje ja na przycisku platnosci.
      amount: quote.amount,
      currency: quote.currency,
      shippingCents: quote.shippingCents,
      discountCents: quote.discountCents,
      quantity: quote.quantity,
      unitCents: quote.unitCents,
      subtotalCents: quote.subtotalCents,
    });
  } catch (error) {
    console.error("[P24] create-transaction error:", error);
    return NextResponse.json(
      { error: "Błąd przy tworzeniu płatności Przelewy24." },
      { status: 500 }
    );
  }
}

// Zamowienie "pending" — raw SQL, bo kolumny personalizacji nie ma w Prisma schemie.
// Numer zamowienia z crypto; przy kolizji UNIQUE (ten sam numer tego dnia)
// losujemy ponownie.
async function insertPendingOrder(o: {
  orderId: string; userId: string | null; name: string; email: string; phone: string;
  pickupPoint: string; pickupPointAddress: string;
  street: string; postcode: string; city: string; country: string;
  amount: number; currency: string; sessionId: string;
  quantity: number; units: OrderUnit[];
  adminNotes: string;
}): Promise<string> {
  // Pierwsza sztuka w starych kolumnach (zgodnosc wstecz), komplet w personalizationJson.
  const personalizedCode = o.units[0]?.code ?? null;
  const personalizedName = o.units[0]?.name ?? null;
  const personalizationJson = serializeOrderUnits(o.units);
  // Integer ms (NIE string ISO!) — Prisma/SQLite trzyma DateTime jako INTEGER
  // (tak zapisuja np. zamowienia Stripe przez ORM). ISO string tutaj psulby
  // sortowanie "Order" po createdAt (SQLite sortuje TEXT i INTEGER w
  // oddzielnych blokach niezaleznie od wartosci — stad bug "Stripe zawsze na
  // dole listy", naprawiony 2026-09-20).
  const now = Date.now();
  await ensureOrderPersonalizationColumns();
  for (let attempt = 0; ; attempt++) {
    const orderNumber = generateOrderNumber();
    try {
      await prisma.$executeRaw`
        INSERT INTO "Order" (
          id, "userId", "orderNumber", status,
          "customerName", "customerEmail", "customerPhone",
          "pickupPoint", "pickupPointAddress",
          "customerAddressStreet", "customerAddressPostcode", "customerAddressCity", "customerCountry",
          amount, currency,
          "paymentProvider", "p24SessionId",
          "personalizedCode", "personalizedName", "quantity", "personalizationJson", "adminNotes",
          "createdAt", "updatedAt"
        ) VALUES (
          ${o.orderId}, ${o.userId}, ${orderNumber}, 'pending',
          ${o.name}, ${o.email}, ${o.phone},
          ${o.pickupPoint}, ${o.pickupPointAddress},
          ${o.street}, ${o.postcode}, ${o.city}, ${o.country},
          ${o.amount}, ${o.currency},
          'p24', ${o.sessionId},
          ${personalizedCode}, ${personalizedName}, ${o.quantity}, ${personalizationJson}, ${o.adminNotes},
          ${now}, ${now}
        )
      `;
      return orderNumber;
    } catch (e) {
      if (attempt < 5 && isUniqueViolation(e, "orderNumber")) continue;
      throw e;
    }
  }
}
