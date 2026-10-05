import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdminAuth } from "@/lib/admin-auth";


export async function GET(req: NextRequest) {
  const authErr = await requireAdminAuth(req); if (authErr) return authErr;
  try {
    // Get pagination parameters
    const { searchParams } = new URL(req.url);
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get("limit") || "100") || 100));
    const offset = Math.max(0, parseInt(searchParams.get("offset") || "0") || 0);
    // Szukanie po WSZYSTKICH kontach (wczesniej tylko na wczytanej stronie).
    const q = (searchParams.get("q") || "").trim();
    const where = q ? { OR: [{ email: { contains: q } }, { name: { contains: q } }] } : {};

    // Fetch users with their subscriptions
    const users = await prisma.user.findMany({
      where,
      take: limit,
      skip: offset,
      orderBy: { createdAt: "desc" },
      include: {
        Subscription: true,
      },
    });

    // Licencje / zamowienia / tokeny dla calej strony naraz (wczesniej 4 zapytania
    // NA KAZDEGO uzytkownika — ~400 zapytan przy 100 kontach).
    const ids = users.map((u) => u.id);
    const [licenseRows, orderRows] = await Promise.all([
      prisma.license.groupBy({ by: ["usedBy"], where: { usedBy: { in: ids } }, _count: { _all: true } }),
      prisma.order.groupBy({ by: ["userId"], where: { userId: { in: ids }, status: "paid" }, _count: { _all: true } }),
    ]);
    const licenses = new Map(licenseRows.map((r) => [r.usedBy, r._count._all]));
    const ordersBy = new Map(orderRows.map((r) => [r.userId, r._count._all]));
    const placeholders = ids.map(() => "?").join(",") || "''";
    const balances = new Map<string, number>();
    const purchases = new Map<string, { tokens: number; count: number }>();
    if (ids.length) {
      const rows = await prisma.$queryRawUnsafe<{ id: string; tokenBalance: number | null }[]>(
        `SELECT "id", "tokenBalance" FROM "User" WHERE "id" IN (${placeholders})`, ...ids
      ).catch(() => []);
      rows.forEach((r) => balances.set(r.id, Number(r.tokenBalance ?? 0)));
      const tp = await prisma.$queryRawUnsafe<{ userId: string; tokens: number | null; count: number | bigint }[]>(
        `SELECT userId, SUM(tokens) AS tokens, COUNT(*) AS count FROM TokenPurchase WHERE status = 'paid' AND userId IN (${placeholders}) GROUP BY userId`, ...ids
      ).catch(() => []); // tabela TokenPurchase powstaje przy pierwszym zakupie tokenow
      tp.forEach((r) => purchases.set(r.userId, { tokens: Number(r.tokens ?? 0), count: Number(r.count) }));
    }

    const usersWithLicenses = users.map((user) => {
        const licensesUsed = licenses.get(user.id) ?? 0;
        const ordersCount = ordersBy.get(user.id) ?? 0;
        const tokenBalance = balances.get(user.id) ?? 0;
        const tokensPurchased = purchases.get(user.id) ?? { tokens: 0, count: 0 };

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
      });

    // Get total count for pagination
    const totalUsers = await prisma.user.count({ where });

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
