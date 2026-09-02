import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { COOKIE_NAME } from "@/lib/admin-auth";
import { sumTokensPurchasedByUser } from "@/lib/tokenPurchases";

export async function GET(req: NextRequest) {
  try {
    // Verify admin using cookie
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (token !== process.env.ADMIN_SESSION_TOKEN) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get pagination parameters
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "100");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Fetch users with their subscriptions
    const users = await prisma.user.findMany({
      take: limit,
      skip: offset,
      orderBy: { createdAt: "desc" },
      include: {
        Subscription: true,
      },
    });

    // Get license usage + purchase summary for each user
    const usersWithLicenses = await Promise.all(
      users.map(async (user) => {
        const licensesUsed = await prisma.license.count({
          where: { usedBy: user.id },
        });
        const ordersCount = await prisma.order.count({
          where: { userId: user.id, status: "paid" },
        });
        const tokenRow = await prisma.$queryRaw<{ tokenBalance: number | null }[]>`
          SELECT "tokenBalance" FROM "User" WHERE "id" = ${user.id} LIMIT 1
        `.catch(() => []);
        const tokenBalance = Number(tokenRow[0]?.tokenBalance ?? 0);
        const tokensPurchased = await sumTokensPurchasedByUser(user.id).catch(() => ({ tokens: 0, count: 0 }));

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          createdAt: user.createdAt,
          subscription: user.Subscription
            ? {
                status: user.Subscription.status,
                trialEndsAt: user.Subscription.trialEndsAt,
                trialDays: user.Subscription.trialDays,
                plan: user.Subscription.plan,
                pricePerMonth: user.Subscription.pricePerMonth,
                stripeCustomerId: user.Subscription.stripeCustomerId,
                stripeSubscriptionId: user.Subscription.stripeSubscriptionId,
                stripeCurrentPeriodEnd: user.Subscription.stripeCurrentPeriodEnd,
                cancelledAt: user.Subscription.cancelledAt,
                createdAt: user.Subscription.createdAt,
                updatedAt: user.Subscription.updatedAt,
              }
            : null,
          licensesUsed,
          ordersCount,
          tokenBalance,
          tokensPurchased: tokensPurchased.tokens,
          tokenPurchaseCount: tokensPurchased.count,
        };
      })
    );

    // Get total count for pagination
    const totalUsers = await prisma.user.count();

    return NextResponse.json({
      users: usersWithLicenses,
      total: totalUsers,
      limit,
      offset,
      hasMore: offset + limit < totalUsers,
    });
  } catch (error) {
    console.error("Users fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch users" },
      { status: 500 }
    );
  }
}
