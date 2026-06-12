import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const limit = parseInt(searchParams.get("limit") || "50");
  const starting_after = searchParams.get("starting_after") || undefined;

  try {
    const params: Record<string, unknown> = { limit, expand: ["data.latest_charge"] };
    if (starting_after) params.starting_after = starting_after;

    const paymentIntents = await stripe.paymentIntents.list(params);

    const orders = paymentIntents.data.map((pi) => {
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
      };
    });

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
