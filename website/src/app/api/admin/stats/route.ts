import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdminAuth } from "@/lib/admin-auth";

export async function GET(req: NextRequest) {
  const authErr = await requireAdminAuth(req); if (authErr) return authErr;
  try {
    // Pobierz statystyki
    const [
      totalUsers,
      totalSubscriptions,
      activeSubscriptions,
      trialSubscriptions,
      expiredSubscriptions,
      totalLicenses,
      usedLicenses,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.subscription.count(),
      prisma.subscription.count({
        where: { status: "active" },
      }),
      prisma.subscription.count({
        where: { status: "trial" },
      }),
      prisma.subscription.count({
        where: {
          status: "trial",
          trialEndsAt: { lt: new Date() },
        },
      }),
      prisma.license.count(),
      prisma.license.count({
        where: { isUsed: true },
      }),
    ]);

    return NextResponse.json({
      users: {
        total: totalUsers,
      },
      subscriptions: {
        total: totalSubscriptions,
        active: activeSubscriptions,
        trial: trialSubscriptions,
        expired: expiredSubscriptions,
      },
      licenses: {
        total: totalLicenses,
        used: usedLicenses,
        available: totalLicenses - usedLicenses,
      },
    });
  } catch (error) {
    console.error("Stats error:", error);
    return NextResponse.json(
      { error: "Failed to get stats" },
      { status: 500 }
    );
  }
}
