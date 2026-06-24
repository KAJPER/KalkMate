import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { stripe } from "@/lib/stripe";

export async function GET(request: NextRequest) {
  const authErr = requireAdminAuth(request); if (authErr) return authErr;
  try {
    const allIntents: Array<{
      status: string;
      amount: number;
      created: number;
      metadata: Record<string, string>;
    }> = [];
    let hasMore = true;
    let startingAfter: string | undefined;

    while (hasMore) {
      const params: Record<string, unknown> = { limit: 100 };
      if (startingAfter) params.starting_after = startingAfter;

      const batch = await stripe.paymentIntents.list(params);
      for (const pi of batch.data) {
        allIntents.push({
          status: pi.status,
          amount: pi.amount,
          created: pi.created,
          metadata: pi.metadata as Record<string, string>,
        });
      }
      hasMore = batch.has_more;
      if (batch.data.length > 0) {
        startingAfter = batch.data[batch.data.length - 1].id;
      }
    }

    const succeeded = allIntents.filter((i) => i.status === "succeeded");
    const pending = allIntents.filter((i) =>
      ["requires_payment_method", "requires_confirmation", "requires_action", "processing"].includes(i.status)
    );
    const canceled = allIntents.filter((i) => i.status === "canceled");

    const totalRevenue = succeeded.reduce((sum, i) => sum + i.amount, 0);

    // Orders per day (last 30 days)
    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
    const dailyOrders: Record<string, { count: number; revenue: number }> = {};

    for (let d = 0; d < 30; d++) {
      const date = new Date(now - d * 24 * 60 * 60 * 1000);
      const key = date.toISOString().slice(0, 10);
      dailyOrders[key] = { count: 0, revenue: 0 };
    }

    succeeded
      .filter((i) => i.created * 1000 > thirtyDaysAgo)
      .forEach((i) => {
        const key = new Date(i.created * 1000).toISOString().slice(0, 10);
        if (dailyOrders[key]) {
          dailyOrders[key].count++;
          dailyOrders[key].revenue += i.amount;
        }
      });

    const fulfilled = succeeded.filter(
      (i) =>
        i.metadata.fulfillment_status === "fulfilled" ||
        i.metadata.fulfillment_status === "shipped"
    ).length;

    return NextResponse.json({
      totalRevenue,
      totalOrders: allIntents.length,
      succeededOrders: succeeded.length,
      pendingOrders: pending.length,
      canceledOrders: canceled.length,
      fulfilledOrders: fulfilled,
      unfulfilledOrders: succeeded.length - fulfilled,
      dailyOrders: Object.entries(dailyOrders)
        .map(([date, data]) => ({ date, ...data }))
        .sort((a, b) => a.date.localeCompare(b.date)),
    });
  } catch (error) {
    console.error("Error fetching analytics:", error);
    return NextResponse.json(
      { error: "Failed to fetch analytics" },
      { status: 500 }
    );
  }
}
