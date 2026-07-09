import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";

const PAYMENT_STATUS: Record<string, string> = {
  pending: "requires_payment_method",
  paid: "succeeded",
  cancelled: "canceled",
  refunded: "refunded",
};

export async function GET(request: NextRequest) {
  const authErr = requireAdminAuth(request); if (authErr) return authErr;
  const searchParams = request.nextUrl.searchParams;
  const limit = parseInt(searchParams.get("limit") || "50");
  const offset = parseInt(searchParams.get("offset") || "0");

  try {
    const rows = await prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      skip: offset,
      take: limit + 1,
    });

    const has_more = rows.length > limit;
    const page = rows.slice(0, limit);

    const orders = page.map((o) => ({
      id: o.id,
      amount: o.amount,
      currency: o.currency,
      status: PAYMENT_STATUS[o.status] || o.status,
      created: Math.floor(o.createdAt.getTime() / 1000),
      customer_name: o.customerName || "",
      customer_email: o.customerEmail || "",
      customer_phone: o.customerPhone || "",
      pickup_point: o.pickupPoint || "",
      pickup_point_address: o.pickupPointAddress || "",
      product: "KalkMate v1.0",
      fulfillment_status: o.fulfillmentStatus || "unfulfilled",
      shipped_at: o.shippedAt ? o.shippedAt.toISOString() : null,
      tracking_number: o.trackingNumber || "",
      payment_provider: o.paymentProvider,
    }));

    return NextResponse.json({
      orders,
      has_more,
      next_offset: offset + limit,
    });
  } catch (error) {
    console.error("Error fetching orders:", error);
    return NextResponse.json(
      { error: "Failed to fetch orders" },
      { status: 500 }
    );
  }
}
