import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";
import { ensureOrderPersonalizationColumns, readOrderUnits } from "@/lib/orderPersonalization";
import { applyFulfillmentStatus, isFulfillmentStatus, FULFILLMENT_STATUSES } from "@/lib/orderFulfillment";
import { syncOrderTracking, looksLikeInPostNumber } from "@/lib/inpostTracking";
import { CHANNEL_LABELS, type Channel, getOrderAttribution } from "@/lib/attribution";

const PAYMENT_STATUS: Record<string, string> = {
  pending: "requires_payment_method",
  paid: "succeeded",
  cancelled: "canceled",
  refunded: "refunded",
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authErr = await requireAdminAuth(request); if (authErr) return authErr;
  const { id } = await params;

  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  // Personalizacja (kod AI + imie na etykiete) — kolumny poza Prisma schema.
  await ensureOrderPersonalizationColumns();
  const persRows = await prisma.$queryRaw<
    { personalizedCode: string | null; personalizedName: string | null }[]
  >`SELECT "personalizedCode", "personalizedName" FROM "Order" WHERE id = ${id} LIMIT 1`;
  const personalization = persRows[0] || { personalizedCode: null, personalizedName: null };
  // Kilka sztuk w zamowieniu: kod AI + imie dla KAZDEJ sztuki (admin wgrywa je
  // flasherem do kolejnych egzemplarzy). Blad odczytu = stara para pol (1 szt.).
  const units = await readOrderUnits(id).catch(() => null);
  const personalizations = units?.units?.length
    ? units.units
    : personalization.personalizedCode || personalization.personalizedName
      ? [{ code: personalization.personalizedCode || "", name: personalization.personalizedName || "" }]
      : [];
  const quantity = Math.max(1, Math.floor(Number(units?.quantity) || 1));
  const attr = await getOrderAttribution(id).catch(() => null);
  const touch = (channel: string | null, source: string | null, campaign: string | null, landing: string | null, at: string | null) =>
    channel ? { channel: CHANNEL_LABELS[channel as Channel] || channel, source, campaign, landing, at } : null;

  return NextResponse.json({
    order: {
      id: order.id,
      order_number: order.orderNumber,
      amount: order.amount,
      currency: order.currency,
      status: PAYMENT_STATUS[order.status] || order.status,
      created: Math.floor(order.createdAt.getTime() / 1000),
      metadata: {},
      customer_name: order.customerName || "",
      customer_email: order.customerEmail || "",
      customer_phone: order.customerPhone || "",
      customer_address_street: order.customerAddressStreet || "",
      customer_address_postcode: order.customerAddressPostcode || "",
      customer_address_city: order.customerAddressCity || "",
      customer_country: order.customerCountry || "",
      pickup_point: order.pickupPoint || "",
      pickup_point_address: order.pickupPointAddress || "",
      product: "KalkMate v3.0",
      fulfillment_status: order.fulfillmentStatus || "unfulfilled",
      shipped_at: order.shippedAt ? order.shippedAt.toISOString() : null,
      tracking_number: order.trackingNumber || "",
      admin_notes: order.adminNotes || "",
      furgonetka_package_id: order.furgonetkaPackageId || "",
      furgonetka_order_uuid: order.furgonetkaOrderUuid || "",
      furgonetka_status: order.furgonetkaStatus || "",
      // Nadanie Base Courier w toku / niepewne (patrz basecourier/route.ts).
      shipment_uncertain: order.furgonetkaStatus === "basecourier_pending",
      invoice_sent_at: order.invoiceSentAt ? order.invoiceSentAt.toISOString() : null,
      invoice_filename: order.invoiceFilename || "",
      payment_provider: order.paymentProvider,
      stripe_payment_intent_id: order.stripePaymentIntentId || null,
      p24_session_id: order.p24SessionId || null,
      personalized_code: personalization.personalizedCode || null,
      personalized_name: personalization.personalizedName || null,
      quantity,
      personalizations,
      attribution: attr
        ? {
            method: attr.method,
            first: touch(attr.firstChannel, attr.firstSource, attr.firstCampaign, attr.firstLanding, attr.firstAt),
            last: touch(attr.lastChannel, attr.lastSource, attr.lastCampaign, attr.lastLanding, attr.lastAt),
          }
        : null,
    },
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authErr = await requireAdminAuth(request); if (authErr) return authErr;
  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Nieprawidłowe dane" }, { status: 400 });
  }
  const { fulfillment_status, tracking_number, notes, expected_fulfillment_status } = body as Record<string, unknown>;

  // K7: status tylko z allowlisty (lib/orderFulfillment.ts).
  const hasStatus = fulfillment_status !== undefined && fulfillment_status !== null && fulfillment_status !== "";
  if (hasStatus && !isFulfillmentStatus(fulfillment_status)) {
    return NextResponse.json(
      { error: `Nieprawidłowy status realizacji (dozwolone: ${FULFILLMENT_STATUSES.join(", ")})` },
      { status: 400 }
    );
  }
  if (expected_fulfillment_status !== undefined && expected_fulfillment_status !== null && typeof expected_fulfillment_status !== "string") {
    return NextResponse.json({ error: "Nieprawidłowy expected_fulfillment_status" }, { status: 400 });
  }
  if (tracking_number !== undefined && tracking_number !== null && typeof tracking_number !== "string") {
    return NextResponse.json({ error: "Nieprawidłowy numer przesyłki" }, { status: 400 });
  }
  if (notes !== undefined && notes !== null && typeof notes !== "string") {
    return NextResponse.json({ error: "Nieprawidłowe notatki" }, { status: 400 });
  }

  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  // Wspolna logika zmiany statusu + maili (src/lib/orderFulfillment.ts) —
  // ta sama, ktorej uzywa automat sledzenia InPost.
  // tracking_number: pominiete = bez zmian, "" / null = wyczysc (K7).
  const result = await applyFulfillmentStatus(id, hasStatus ? (fulfillment_status as Parameters<typeof applyFulfillmentStatus>[1]) : undefined, {
    source: "manual",
    trackingNumber: tracking_number === undefined ? undefined : (tracking_number as string | null),
    adminNotes: notes !== undefined ? (notes as string | null) : undefined,
    expectedStatus: typeof expected_fulfillment_status === "string" ? expected_fulfillment_status : undefined,
  });
  if (result?.conflict) {
    const current = (await prisma.order.findUnique({ where: { id }, select: { fulfillmentStatus: true } }))?.fulfillmentStatus || "unfulfilled";
    return NextResponse.json(
      { error: "Status zamówienia zmienił się w międzyczasie — odśwież i spróbuj ponownie.", current },
      { status: 409 }
    );
  }

  // Nowy numer InPost wpisany recznie -> od razu sprawdz status, zeby admin
  // nie musial czekac na cron (max 1h). Blad InPost nie psuje zapisu.
  let trackingSync = null;
  const newNumber = typeof tracking_number === "string" ? tracking_number.trim() : "";
  if (newNumber && newNumber !== (order.trackingNumber || "") && looksLikeInPostNumber(newNumber)) {
    try {
      trackingSync = await syncOrderTracking(id);
    } catch (e) {
      console.error("[admin/orders PATCH] tracking sync failed:", e);
    }
  }

  const updated = await prisma.order.findUnique({ where: { id } });
  return NextResponse.json({ order: updated, fulfillment: result, trackingSync });
}
