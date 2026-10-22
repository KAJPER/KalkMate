import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdminAuth } from "@/lib/admin-auth";
import { ensureLicenseTokensColumn } from "@/lib/licenseTokens";
import { LICENSE_TOKENS, MIN_TOKENS_FOR_AI } from "@/lib/tokenGrants";

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

    // Model tokenowy (2026-10): dostep do AI = saldo >= MIN_TOKENS_FOR_AI.
    // Statystyki subskrypcji nizej zostaja jako dane historyczne.
    let usersWithAccess = 0;
    let totalTokenBalance = 0;
    let licensesWithTokens = 0;
    try {
      const rows = await prisma.$queryRaw<{ n: number | bigint; s: number | bigint | null }[]>`
        SELECT COUNT(CASE WHEN COALESCE("tokenBalance", 0) >= ${MIN_TOKENS_FOR_AI} THEN 1 END) AS n,
               SUM(COALESCE("tokenBalance", 0)) AS s
        FROM "User"
      `;
      usersWithAccess = Number(rows?.[0]?.n ?? 0);
      totalTokenBalance = Number(rows?.[0]?.s ?? 0);
      await ensureLicenseTokensColumn();
      const lr = await prisma.$queryRaw<{ n: number | bigint }[]>`
        SELECT COUNT(*) AS n FROM "License" WHERE "tokensGrantedAt" IS NOT NULL
      `;
      licensesWithTokens = Number(lr?.[0]?.n ?? 0);
    } catch (e) {
      console.error("[admin/stats] token stats fail:", e);
    }

    return NextResponse.json({
      model: "tokens",
      users: {
        total: totalUsers,
      },
      tokens: {
        usersWithAccess,
        totalBalance: totalTokenBalance,
        minForAi: MIN_TOKENS_FOR_AI,
        licenseValue: LICENSE_TOKENS,
        licensesWithTokens,
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
