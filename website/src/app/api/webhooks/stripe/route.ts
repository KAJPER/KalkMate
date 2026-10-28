import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import type { Prisma } from "@prisma/client";
import { stripe } from "@/lib/stripe";
import { sendMail } from "@/lib/mailer";
import { purchaseConfirmationEmail, localeFromCountry, orderConfirmationSubject } from "@/lib/email-templates";
import { prisma } from "@/lib/db";
import { attributionFromMetadata, saveOrderAttribution } from "@/lib/attribution";
import { consumeCouponUsage, setOrderCoupon } from "@/lib/coupons";
import { giveConsent } from "@/lib/newsletter";
import { accrueAffiliateCommission, reverseAffiliateCommission } from "@/lib/affiliates";
import { autoEnqueueOrderReceipt } from "@/lib/fiscal";
import { createPaidTokenPurchaseAndCredit, appendTokenPurchaseNote } from "@/lib/tokenPurchases";
import { getTokenPack } from "@/lib/tokenPacks";
import { setOrderPersonalization, setOrderUnits, unitsFromStripeMetadata, type OrderUnit } from "@/lib/orderPersonalization";
import {
  alertAdmin, appendOrderAdminNote, expectedPaidAmount, formatMinor,
  generateOrderNumber, isUniqueViolation, parseOrderQuantity,
  PRODUCT_CENTS,
} from "@/lib/checkoutPricing";
import { randomUUID } from "crypto";

// Idempotencja na poziomie zdarzenia: tabela poza Prisma schema, tworzona
// leniwie. Event oznaczamy jako przetworzony DOPIERO po udanej obsludze —
// wyjatek = 500, Stripe ponowi. Handlery i tak sa idempotentne same w sobie
// (unikalny stripePaymentIntentId zamowienia, INSERT OR IGNORE zakupu tokenow),
// bo dwa rownolegle doreczenia tego samego eventu moga sie minac.
let _eventTableReady = false;
async function ensureProcessedEventTable(): Promise<void> {
  if (_eventTableReady) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS ProcessedStripeEvent (
      id        TEXT PRIMARY KEY,
      type      TEXT,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);
  _eventTableReady = true;
}

export async function POST(request: NextRequest) {
  console.log("[WEBHOOK] Received webhook request");
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    console.error("[WEBHOOK] No signature provided");
    return NextResponse.json({ error: "No signature" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
    console.log(`[WEBHOOK] Event verified: ${event.type}`);
  } catch (err) {
    console.error("[WEBHOOK] Signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    await ensureProcessedEventTable();
    const done = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM ProcessedStripeEvent WHERE id = ${event.id} LIMIT 1
    `;
    if (done.length > 0) {
      console.log(`[WEBHOOK] Duplicate event ${event.id} (${event.type}) — skip`);
      return NextResponse.json({ received: true, duplicate: true });
    }
  } catch (e) {
    // Tabela idempotencji padla — log, ale obsluguj dalej (handlery sa
    // idempotentne; gorzej zgubic event niz go powtorzyc).
    console.error("[WEBHOOK] idempotency check failed:", e);
  }

  // Handle different event types
  console.log(`[WEBHOOK] Processing event: ${event.type}`);
  try {
    switch (event.type) {
      case "payment_intent.succeeded": {
        const pi = event.data.object as Stripe.PaymentIntent;
        await handlePaymentIntentSucceeded(pi);
        break;
      }

      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode === "payment") {
          if (session.metadata?.type === "token_purchase") {
            await handleTokenPurchase(session);
          } else {
            await handleCalculatorPurchase(session);
          }
        } else if (session.mode === "subscription") {
          logIgnoredSubscriptionEvent(event.type, session.id);
        }
        break;
      }

      case "customer.subscription.updated":
      case "customer.subscription.deleted":
      case "invoice.payment_succeeded":
      case "invoice.payment_failed": {
        const obj = event.data.object as { id?: string };
        logIgnoredSubscriptionEvent(event.type, obj?.id);
        break;
      }

      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        await handleChargeRefunded(charge, event.id);
        break;
      }

      case "charge.dispute.created": {
        const dispute = event.data.object as Stripe.Dispute;
        await handleDisputeCreated(dispute, event.id);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
  } catch (e) {
    console.error(`[WEBHOOK] ❌ handler failed for ${event.type} (${event.id}) — 500, Stripe ponowi:`, e);
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }

  try {
    await prisma.$executeRaw`
      INSERT OR IGNORE INTO ProcessedStripeEvent (id, type) VALUES (${event.id}, ${event.type})
    `;
  } catch (e) {
    console.error("[WEBHOOK] mark event processed failed:", e);
  }

  return NextResponse.json({ received: true });
}

function dayTag(): string {
  return new Date().toISOString().slice(0, 10);
}

// Zamowienie oplacone przez Stripe. Numer zamowienia z crypto; kolizja UNIQUE
// na orderNumber = losujemy ponownie, kolizja na stripePaymentIntentId =
// rownolegly webhook juz je utworzyl (null).
async function createPaidOrder(
  data: Omit<Prisma.OrderUncheckedCreateInput, "orderNumber">
): Promise<{ orderNumber: string } | null> {
  for (let attempt = 0; ; attempt++) {
    const orderNumber = generateOrderNumber();
    try {
      await prisma.order.create({ data: { ...data, orderNumber } });
      return { orderNumber };
    } catch (e) {
      if (isUniqueViolation(e, "stripePaymentIntentId")) return null;
      if (attempt < 5 && isUniqueViolation(e, "orderNumber")) continue;
      throw e;
    }
  }
}

async function handlePaymentIntentSucceeded(pi: Stripe.PaymentIntent) {
  const meta = pi.metadata || {};
  console.log("[WEBHOOK] handlePaymentIntentSucceeded called", { paymentIntentId: pi.id, metadata: meta });

  if (!meta.customer_email) {
    // Np. PaymentIntent faktury subskrypcji / Checkout Session — nie nasze zamowienie.
    console.error("[WEBHOOK] Missing customer_email in payment intent metadata");
    return;
  }

  // Idempotencja: zamowienie dla tego PaymentIntentu juz jest.
  const already = await prisma.order.findUnique({
    where: { stripePaymentIntentId: pi.id },
    select: { orderNumber: true },
  });
  if (already) {
    console.log(`[WEBHOOK] Order for PI ${pi.id} already exists (${already.orderNumber}) — skip`);
    return;
  }

  // M3/K1: kwota i waluta wg SERWEROWEGO cennika (kraj + kupon z metadata),
  // nie wg kwot z metadata. Niezgodnosc NIE gubi oplaconego zamowienia —
  // tworzymy je z notatka "DO SPRAWDZENIA" i alertem do admina.
  const country = meta.customer_country || "PL";
  // Ilosc sztuk z metadata (brak = 1, stare PaymentIntenty). Nieprawidlowa
  // (nie powinno sie zdarzyc) = liczymy 1 i oznaczamy do sprawdzenia.
  const qParsed = parseOrderQuantity(meta.quantity);
  const quantity = qParsed.ok ? qParsed.quantity : 1;
  const expected = await expectedPaidAmount(country, meta.coupon_code || null, quantity);
  const paidCurrency = String(pi.currency || "").toLowerCase();
  const amountOk = qParsed.ok && pi.amount === expected.amount && paidCurrency === expected.currency && !expected.couponMissing;
  const mismatchNote = amountOk
    ? null
    : `[auto ${dayTag()}] [DO SPRAWDZENIA: kwota/waluta niezgodna — zaplacono ${formatMinor(pi.amount, paidCurrency)}, ` +
      `oczekiwano ${formatMinor(expected.amount, expected.currency)} (kraj ${country}, ilosc ${qParsed.ok ? quantity : `NIEPRAWIDLOWA "${meta.quantity}"`}` +
      `${meta.coupon_code ? `, kupon ${meta.coupon_code}${expected.couponMissing ? " — brak w bazie" : ""}` : ""}); PI ${pi.id}]`;

  // Personalizacje sztuk: nowy format (personalization / personalization_1..n),
  // fallback na stare pola = 1 sztuka.
  let units: OrderUnit[] = unitsFromStripeMetadata(meta) ?? [];
  if (units.length === 0 && meta.personalized_code && meta.personalized_name) {
    units = [{ code: meta.personalized_code, name: meta.personalized_name }];
  }
  const unitsOk = units.length === quantity;
  if (!amountOk) {
    console.error(`[WEBHOOK] ❌ KWOTA/WALUTA NIESPÓJNA: ${mismatchNote}`);
  }

  const email = meta.customer_email;
  const name = meta.customer_name || "";
  const phone = meta.customer_phone || "";
  const pickupPoint = meta.pickup_point || "";
  const pickupPointAddress = meta.pickup_point_address || "";
  const addressStreet = meta.customer_address_street || "";
  const addressPostcode = meta.customer_address_postcode || "";
  const addressCity = meta.customer_address_city || "";

  console.log(`[WEBHOOK] Processing order for email: ${email}`);

  // Preferuj user_id z metadata (ustawione w create-payment-intent gdy user zalogowany).
  // Fallback: szukaj po emailu (legacy / kupno gosciem - juz nieuzywane).
  let existingUser = null;
  if (meta.user_id) {
    existingUser = await prisma.user.findUnique({ where: { id: meta.user_id } });
  }
  if (!existingUser) {
    existingUser = await prisma.user.findUnique({ where: { email } });
  }

  const orderId = randomUUID();
  const created = await createPaidOrder({
    id: orderId,
    userId: existingUser?.id,
    status: "paid",
    customerName: name,
    customerEmail: email,
    customerPhone: phone,
    pickupPoint: pickupPoint,
    pickupPointAddress: pickupPointAddress,
    customerAddressStreet: addressStreet,
    customerAddressPostcode: addressPostcode,
    customerAddressCity: addressCity,
    customerCountry: meta.customer_country || "",
    stripePaymentIntentId: pi.id,
    amount: pi.amount,
    currency: pi.currency,
    paidAt: new Date(),
    updatedAt: new Date(),
    adminNotes: mismatchNote,
  });
  if (!created) {
    console.log(`[WEBHOOK] Order for PI ${pi.id} created concurrently — skip`);
    return;
  }
  const { orderNumber } = created;

  // Personalizacja (kod AI + imie na etykiete) — podstawa wylaczenia prawa
  // odstapienia, patrz lib/orderPersonalization.ts. Order nie ma tych kolumn
  // w Prisma schemie, wiec dopisujemy raw SQL zaraz po create(). Blad tu nie
  // moze dac 500 (retry zobaczylby istniejace zamowienie i pominal reszte).
  // Ilosc + personalizacje wszystkich sztuk (kolumny quantity/personalizationJson).
  // Gdy zapis padnie, kolumna quantity zostaje DEFAULT 1 — wtedy notatka z
  // pelna lista, alert i BEZ automatycznego paragonu (decyzja admina).
  const unitsList = units.map((u, i) => `#${i + 1} kod ${u.code}, imie "${u.name}"`).join("; ") || "brak";
  let unitsSaved = false;
  if (units.length > 0 || quantity > 1) {
    try {
      await setOrderUnits(orderId, quantity, units);
      unitsSaved = true;
    } catch (e) {
      console.error("[WEBHOOK] personalization save failed:", e);
      const note = `[auto ${dayTag()}] [DO SPRAWDZENIA: nie zapisano ilosci/personalizacji — ILOSC ${quantity} szt.; ${unitsList}]`;
      await appendOrderAdminNote(orderId, note).catch(() => {});
      await alertAdmin(`Stripe: brak personalizacji — ${orderNumber}`, [note]);
    }
  } else {
    unitsSaved = true; // 1 sztuka bez personalizacji (stare PI) — nic do zapisu
  }
  if (unitsSaved && !unitsOk) {
    const note = `[auto ${dayTag()}] [DO SPRAWDZENIA: ${units.length} personalizacji na ${quantity} szt. — ${unitsList}]`;
    await appendOrderAdminNote(orderId, note).catch(() => {});
    await alertAdmin(`Stripe: niekompletna personalizacja — ${orderNumber}`, [note, `PI ${pi.id}`]);
  }

  // Zrodlo klienta (UTM/referer) z create-payment-intent — lib/attribution.ts.
  const attribution = attributionFromMetadata(meta.attribution);
  if (attribution) {
    await saveOrderAttribution(orderId, attribution).catch((e) => console.error("[WEBHOOK] attribution save failed:", e));
  }

  // Zuzycie kuponu (dopiero po oplaceniu) — konsumpcja rezerwacji z
  // create-payment-intent, raz. Wygasly/nieaktywny kupon nie blokuje: platnosc juz jest.
  if (meta.coupon_code) {
    try {
      // Do statystyk kuponow w panelu (lib/coupons.ts getCouponStats).
      await setOrderCoupon(orderId, meta.coupon_code, parseInt(meta.discount_amount || "0", 10) || 0)
        .catch((e) => console.error("[WEBHOOK] order coupon save failed:", e));
      await consumeCouponUsage({ code: meta.coupon_code, reservationId: meta.coupon_reservation || null, ref: pi.id });
      console.log(`[WEBHOOK] ✅ Coupon usage counted: ${meta.coupon_code} (-${meta.discount_amount || 0})`);
    } catch (e) {
      console.error("[WEBHOOK] ❌ Failed to count coupon usage:", e);
    }
  }

  // Gosc zaznaczyl newsletter w formularzu — zgode zapisujemy dopiero teraz,
  // po oplaceniu (lib/checkoutBuyer.ts: cudzy adres wpisany bez platnosci
  // nie moze zdjac nikogo z listy wypisanych).
  if (meta.newsletter_consent === "1") {
    await giveConsent(email, "order", null).catch((e) => console.error("[WEBHOOK] guest consent save failed:", e));
  }

  if (!amountOk) {
    // Bez maila do klienta, triala i paragonu z automatu — decyzja admina.
    await alertAdmin(`Stripe: niezgodna kwota/waluta — ${orderNumber}`, [
      `Zamowienie ${orderNumber} (${orderId}) utworzone jako oplacone, ale kwota nie pasuje do cennika.`,
      mismatchNote || "",
      `Klient: ${name} <${email}>`,
      `Sprawdz w Stripe i zdecyduj: wysylka, doplata czy zwrot.`,
    ]);
    console.log(`[WEBHOOK] ⚠️ Order created FLAGGED: ${orderNumber} for email ${email}`);
    return;
  }

  // Model tokenowy (2026-10): zakup kalkulatora nie daje triala/tokenow —
  // tokeny sa z licencji w pudelku (aktywacja w panelu).

  // Prowizja partnera (kod partnera w polu kuponu) — dopiero dla zamowienia
  // z poprawna kwota (zamowienie "DO SPRAWDZENIA" wyzej konczy sie returnem).
  if (meta.coupon_code) {
    await accrueAffiliateCommission({
      orderId, orderNumber, code: meta.coupon_code, units: quantity,
      productNetCents: PRODUCT_CENTS[expected.currency] * quantity - expected.discountCents,
      currency: expected.currency, buyerUserId: existingUser?.id ?? null, buyerEmail: email,
    }).catch((e) => console.error("[WEBHOOK] affiliate commission failed:", e));
  }

  console.log(`[WEBHOOK] ✅ Order created successfully: ${orderNumber} for email ${email}${existingUser ? ` (user ID: ${existingUser.id})` : " (no account yet)"}`);

  // Paragon do kolejki agenta fiskalnego (tylko gdy FISCAL_AUTO_ENQUEUE=1) — lib/fiscal.ts.
  // Bez zapisanej ilosci (kolumna = 1, a kupiono wiecej) paragon bylby zly — admin.
  if (unitsSaved || quantity === 1) {
    await autoEnqueueOrderReceipt(orderId);
  }

  // Send confirmation email
  try {
    const locale = localeFromCountry(meta.customer_country);
    const subject = orderConfirmationSubject(locale, orderNumber);
    await sendMail({
      to: email,
      subject,
      html: purchaseConfirmationEmail({
        customerName: name || "Customer",
        customerEmail: email,
        product: meta.product || "KalkMate v3.0",
        amount: pi.amount,
        currency: pi.currency,
        pickupPoint: pickupPoint,
        pickupPointAddress: pickupPointAddress,
        deliveryAddress: [addressStreet, [addressPostcode, addressCity].filter(Boolean).join(" "), meta.customer_country || ""].filter(Boolean).join(", "),
        orderId: orderNumber,
        quantity,
        unitNames: units.map((u) => u.name),
        hasAccount: !!existingUser,
      }, locale),
    });
    console.log(`[WEBHOOK] ✅ Confirmation email sent to ${email}`);
  } catch (emailError) {
    console.error("[WEBHOOK] ❌ Failed to send confirmation email:", emailError);
  }
}

// Stara sciezka (Checkout Session w trybie payment bez type=token_purchase) —
// zaden endpoint juz takich sesji nie tworzy, zostaje dla zgodnosci.
async function handleCalculatorPurchase(session: Stripe.Checkout.Session) {
  console.log("[WEBHOOK] handleCalculatorPurchase called", { sessionId: session.id, metadata: session.metadata });
  const { name, email, phone, pickupPoint, pickupPointAddress, personalized_code, personalized_name } = session.metadata || {};

  if (!email) {
    console.error("[WEBHOOK] Missing email in checkout session metadata");
    return;
  }

  const piId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id ?? null;
  if (piId) {
    const already = await prisma.order.findUnique({ where: { stripePaymentIntentId: piId }, select: { orderNumber: true } });
    if (already) {
      console.log(`[WEBHOOK] Order for PI ${piId} already exists (${already.orderNumber}) — skip`);
      return;
    }
  }

  console.log(`[WEBHOOK] Processing order for email: ${email}`);

  // Sprawdź czy użytkownik już istnieje (ma konto)
  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  const orderId = randomUUID();

  // Zapisz zamówienie (z userId jeśli użytkownik istnieje, bez userId jeśli nie)
  const created = await createPaidOrder({
    id: orderId,
    userId: existingUser?.id, // Może być undefined - wtedy NULL w bazie
    status: "paid",
    customerName: name || "",
    customerEmail: email,
    customerPhone: phone || "",
    pickupPoint: pickupPoint || "",
    pickupPointAddress: pickupPointAddress || "",
    stripePaymentIntentId: piId,
    amount: session.amount_total || 0,
    currency: session.currency || "pln",
    paidAt: new Date(),
    updatedAt: new Date(),
  });
  if (!created) {
    console.log(`[WEBHOOK] Order for PI ${piId} created concurrently — skip`);
    return;
  }
  const { orderNumber } = created;

  // Personalizacja (kod AI + imie na etykiete) — jak w handlePaymentIntentSucceeded.
  if (personalized_code && personalized_name) {
    await setOrderPersonalization(orderId, personalized_code, personalized_name)
      .catch((e) => console.error("[WEBHOOK] personalization save failed:", e));
  }

  // Model tokenowy (2026-10): zakup kalkulatora nie daje triala/tokenow —
  // tokeny sa z licencji w pudelku. Jeśli użytkownik NIE ma konta, zamówienie
  // zostanie połączone przy rejestracji.

  await autoEnqueueOrderReceipt(orderId);

  console.log(`[WEBHOOK] ✅ Order created successfully: ${orderNumber} for email ${email}${existingUser ? ` (user ID: ${existingUser.id})` : " (no account yet)"}`);

  // Send confirmation email
  try {
    const locale = localeFromCountry(session.metadata?.customer_country);
    const subject = orderConfirmationSubject(locale, orderNumber);
    await sendMail({
      to: email,
      subject,
      html: purchaseConfirmationEmail({
        customerName: name || "Customer",
        customerEmail: email,
        product: "KalkMate v3.0",
        amount: session.amount_total || 0,
        currency: session.currency || "pln",
        pickupPoint: pickupPoint || "",
        pickupPointAddress: pickupPointAddress || "",
        orderId: orderNumber,
        hasAccount: !!existingUser,
      }, locale),
    });
    console.log(`[WEBHOOK] ✅ Confirmation email sent to ${email}`);
  } catch (emailError) {
    console.error("[WEBHOOK] ❌ Failed to send confirmation email:", emailError);
  }
}

async function handleTokenPurchase(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId;
  const tokens = parseInt(session.metadata?.tokens || "0", 10);
  const packId = String(session.metadata?.packId || "");
  if (!userId || !tokens || tokens <= 0) {
    console.error("[WEBHOOK] token purchase: brak userId/tokens w metadata", session.metadata);
    return;
  }

  // Kwota/waluta wg SERWEROWEGO cennika paczki (lib/tokenPacks.ts), nie wg metadata.
  const pack = getTokenPack(packId);
  const currency = String(session.currency || "").toLowerCase();
  const amount = session.amount_total ?? -1;
  const problems: string[] = [];
  if (!pack) {
    problems.push(`nieznany pakiet "${packId}"`);
  } else {
    if (pack.tokens !== tokens) problems.push(`tokeny w metadata ${tokens} != pakiet ${pack.tokens}`);
    if (currency !== "pln" && currency !== "eur") {
      problems.push(`nieobslugiwana waluta "${currency}"`);
    } else {
      const expected = currency === "pln" ? pack.priceGrosze : pack.priceEurCents;
      if (amount !== expected) problems.push(`kwota ${formatMinor(amount, currency)} != cena pakietu ${formatMinor(expected, currency)}`);
    }
  }
  if (session.payment_status !== "paid") problems.push(`payment_status=${session.payment_status}`);

  if (problems.length > 0) {
    await alertAdmin("Stripe: zakup tokenow NIE doliczony", [
      `Checkout Session: ${session.id}`,
      `User: ${userId}, pakiet: ${packId}, tokeny: ${tokens}`,
      `Zaplacono: ${formatMinor(amount, currency)}`,
      `Problemy: ${problems.join("; ")}`,
      `Tokenow NIE doliczono — sprawdz w Stripe i zdecyduj (doliczenie recznie albo zwrot).`,
    ]);
    return;
  }

  // Dolicz tokeny: INSERT OR IGNORE po unikalnym sessionId + saldo w jednej
  // transakcji — powtorzony/rownolegly webhook nie doladuje drugi raz.
  const credited = await createPaidTokenPurchaseAndCredit({
    id: randomUUID(),
    sessionId: session.id,
    provider: "stripe",
    userId,
    tokens,
    amount,
    currency,
  });
  if (credited) {
    console.log(`[WEBHOOK] token purchase: +${tokens} tokenow dla user ${userId}`);
  } else {
    console.log(`[WEBHOOK] token purchase ${session.id} already credited — skip`);
  }
}

// === Subskrypcje — wycofane (model tokenowy 2026-10) ===
// Dostep do AI nie zalezy juz od Subscription, wiec zdarzenia subskrypcyjne
// Stripe (resztki sprzed zmiany: odnowienia, anulowania, porzucone sesje
// checkout mode=subscription) tylko logujemy i ignorujemy — bez zapisu.
function logIgnoredSubscriptionEvent(type: string, id: string | null | undefined) {
  console.warn(`[WEBHOOK] subskrypcje wycofane — ignoruje ${type} (${id ?? "?"})`);
}

// === Zwroty i spory (chargeback) ===
// Tylko notatka w zamowieniu / zakupie tokenow + alert do admina. Tokenow NIE
// odejmujemy automatycznie (decyzja wlasciciela). Marker = id zdarzenia, zeby
// powtorzony webhook nie dopisal notatki drugi raz.

// Prowizja partnera za zamowienie z tym PaymentIntentem (lib/affiliates.ts).
async function reverseStripeAffiliate(piId: string | null, note: string): Promise<boolean> {
  if (!piId) return false;
  const order = await prisma.order.findUnique({ where: { stripePaymentIntentId: piId }, select: { id: true } });
  if (!order) return false;
  return reverseAffiliateCommission(order.id, note).catch((e) => {
    console.error("[WEBHOOK] affiliate reverse failed:", e);
    return false;
  });
}

async function annotateStripePayment(piId: string | null, note: string, marker: string): Promise<{ target: string; added: boolean }> {
  if (!piId) return { target: "brak PaymentIntent w zdarzeniu", added: true };
  const order = await prisma.order.findUnique({
    where: { stripePaymentIntentId: piId },
    select: { id: true, orderNumber: true },
  });
  if (order) {
    const added = await appendOrderAdminNote(order.id, note, marker);
    return { target: `zamowienie ${order.orderNumber} (${order.id})`, added };
  }
  // Zakup tokenow: TokenPurchase.sessionId = id Checkout Session tej platnosci.
  try {
    const sessions = await stripe.checkout.sessions.list({ payment_intent: piId, limit: 1 });
    const cs = sessions.data[0];
    if (cs && cs.metadata?.type === "token_purchase") {
      const added = await appendTokenPurchaseNote(cs.id, `${note} — tokenow NIE odjeto automatycznie (decyzja wlasciciela)`, marker);
      return {
        target: `zakup tokenow ${cs.id} (user ${cs.metadata?.userId}, ${cs.metadata?.tokens} tokenow — NIE odjeto automatycznie)`,
        added,
      };
    }
    if (cs) return { target: `Checkout Session ${cs.id} (${cs.mode}) — bez zamowienia w bazie`, added: true };
  } catch (e) {
    console.error("[WEBHOOK] checkout session lookup failed:", e);
  }
  return { target: `nie znaleziono zamowienia ani zakupu tokenow dla PI ${piId}`, added: true };
}

async function handleChargeRefunded(charge: Stripe.Charge, eventId: string) {
  const piId = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id ?? null;
  const refunded = formatMinor(charge.amount_refunded, charge.currency);
  const total = formatMinor(charge.amount, charge.currency);
  const kind = charge.refunded ? "ZWROT CALKOWITY" : "zwrot czesciowy";
  const note = `[auto ${dayTag()}] Stripe: ${kind} ${refunded} z ${total} (charge ${charge.id}) ${eventId}`;
  const { target, added } = await annotateStripePayment(piId, note, eventId);
  // Pelny zwrot = prowizja partnera cofnieta (czesciowy — decyzja admina).
  const affReversed = charge.refunded ? await reverseStripeAffiliate(piId, `Stripe: zwrot calkowity ${eventId}`) : false;
  if (added) {
    await alertAdmin(`Stripe: ${kind} ${refunded}`, [
      note,
      `Dotyczy: ${target}`,
      `Status zamowienia/tokeny NIE zmienione automatycznie.`,
      ...(affReversed ? ["Prowizja partnera za to zamowienie zostala cofnieta."] : []),
    ]);
  }
}

async function handleDisputeCreated(dispute: Stripe.Dispute, eventId: string) {
  let piId = typeof dispute.payment_intent === "string" ? dispute.payment_intent : dispute.payment_intent?.id ?? null;
  if (!piId) {
    const chargeId = typeof dispute.charge === "string" ? dispute.charge : dispute.charge?.id;
    if (chargeId) {
      const ch = await stripe.charges.retrieve(chargeId);
      piId = typeof ch.payment_intent === "string" ? ch.payment_intent : ch.payment_intent?.id ?? null;
    }
  }
  const dueBy = dispute.evidence_details?.due_by ? new Date(dispute.evidence_details.due_by * 1000).toISOString().slice(0, 10) : "?";
  const note =
    `[auto ${dayTag()}] Stripe: SPOR/CHARGEBACK ${formatMinor(dispute.amount, dispute.currency)} — powod: ${dispute.reason}, ` +
    `status: ${dispute.status}, dowody do ${dueBy} (dispute ${dispute.id}) ${eventId}`;
  const { target, added } = await annotateStripePayment(piId, note, eventId);
  const affReversed = await reverseStripeAffiliate(piId, `Stripe: spor ${dispute.id}`);
  if (affReversed) console.log(`[WEBHOOK] affiliate commission reversed (dispute ${dispute.id})`);
  if (added) {
    await alertAdmin(`Stripe: CHARGEBACK ${formatMinor(dispute.amount, dispute.currency)}`, [
      note,
      `Dotyczy: ${target}`,
      `Odpowiedz w panelu Stripe przed terminem. Nic nie zmieniono automatycznie.`,
    ]);
  }
}
