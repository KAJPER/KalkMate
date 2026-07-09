import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/db";

// Prisma Order.status (payment lifecycle) -> vocabulary used by OrderStatusBadge
// (which was built around Stripe PaymentIntent statuses).
const P24_PAYMENT_STATUS: Record<string, string> = {
  pending: "requires_payment_method",
  paid: "succeeded",
  cancelled: "canceled",
  refunded: "refunded",
};

function p24FulfillmentStatus(order: {
  status: string;
  shippedAt: Date | null;
  deliveredAt: Date | null;
}): string {
  if (order.status === "cancelled") return "cancelled";
  if (order.deliveredAt) return "fulfilled";
  if (order.shippedAt) return "shipped";
  return "unfulfilled";
}

async function fetchP24Orders() {
  const rows = await prisma.order.findMany({
    where: { paymentProvider: "p24" },
    orderBy: { createdAt: "desc" },
  });

  return rows.map((o) => ({
    id: o.id,
    amount: o.amount,
    currency: o.currency,
    status: P24_PAYMENT_STATUS[o.status] || o.status,
    created: Math.floor(o.createdAt.getTime() / 1000),
    customer_name: o.customerName || "",
    customer_email: o.customerEmail || "",
    customer_phone: o.customerPhone || "",
    pickup_point: o.pickupPoint || "",
    pickup_point_address: o.pickupPointAddress || "",
    product: "KalkMate v1.0",
    fulfillment_status: p24FulfillmentStatus(o),
    shipped_at: o.shippedAt ? o.shippedAt.toISOString() : null,
    tracking_number: o.trackingNumber || "",
    payment_provider: "p24" as const,
  }));
}

export async function GET(request: NextRequest) {
  const authErr = requireAdminAuth(request); if (authErr) return authErr;
  const searchParams = request.nextUrl.searchParams;
  const limit = parseInt(searchParams.get("limit") || "50");
  const starting_after = searchParams.get("starting_after") || undefined;

  try {
    const params: Record<string, unknown> = { limit, expand: ["data.latest_charge"] };
    if (starting_after) params.starting_after = starting_after;

    const paymentIntents = await stripe.paymentIntents.list(params);

    const stripeOrders = paymentIntents.data.map((pi) => {
      let mappedStatus = pi.status as string;
      const charge = pi.latest_charge as any;

      if (mappedStatus === "succeeded" && charge) {
        if (charge.refunded) {
          mappedStatus = "refunded";
        } else if (charge.amount_refunded && charge.amount_refunded > 0) {
          mappedStatus = "partially_refunded";
        }
      }

      return {
        id: pi.id,
        amount: pi.amount,
        currency: pi.currency,
        status: mappedStatus,
        created: pi.created,
        customer_name: pi.metadata.customer_name || "",
        customer_email: pi.metadata.customer_email || "",
        customer_phone: pi.metadata.customer_phone || "",
        pickup_point: pi.metadata.pickup_point || "",
        pickup_point_address: pi.metadata.pickup_point_address || "",
        product: pi.metadata.product || "",
        fulfillment_status: pi.metadata.fulfillment_status || "unfulfilled",
        shipped_at: pi.metadata.shipped_at || null,
        tracking_number: pi.metadata.tracking_number || "",
        payment_provider: "stripe" as const,
      };
    });

    // Przelewy24 orders live in our own DB (no Stripe PaymentIntent exists for
    // them), so they can't come from stripe.paymentIntents.list above. Merge
    // them in on the first page only, to avoid re-inserting duplicates on every
    // paginated "load more" click (Stripe cursor pagination doesn't know about them).
    let orders: Array<(typeof stripeOrders)[number] | Awaited<ReturnType<typeof fetchP24Orders>>[number]> = stripeOrders;
    if (!starting_after) {
      const p24Orders = await fetchP24Orders();
      orders = [...stripeOrders, ...p24Orders].sort((a, b) => b.created - a.created);
    }

    return NextResponse.json({
      orders,
      has_more: paymentIntents.has_more,
      last_id: paymentIntents.data[paymentIntents.data.length - 1]?.id,
    });
  } catch (error) {
    console.error("Error fetching orders:", error);
    return NextResponse.json(
      { error: "Failed to fetch orders" },
      { status: 500 }
    );
  }
}
