import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { rateLimit, clientIp } from "@/lib/rate-limit";

// Ujednolicony komunikat dla wszystkich "nieudanych" przypadkow zeby nie
// dawac sygnalu czy kod istnieje czy juz uzyty (anty-enumeracja).
const INVALID_CODE_MSG = "Nieprawidlowy lub juz wykorzystany kod licencji";

export async function POST(request: NextRequest) {
  try {
    // Rate limit per IP: 5 prob/min — chroni przed brute-force genratora kodow
    const ip = clientIp(request);
    const rl = rateLimit(`redeem:${ip}`, 5, 60_000);
    if (!rl.ok) {
      return NextResponse.json(
        { error: `Za duzo prob. Sprobuj za ${Math.ceil(rl.resetMs / 1000)}s.` },
        { status: 429 }
      );
    }

    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { licenseCode } = body;

    if (!licenseCode || typeof licenseCode !== "string") {
      return NextResponse.json(
        { error: "Kod licencji jest wymagany" },
        { status: 400 }
      );
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Find license (normalize: trim and lowercase to match generator)
    const normalizedCode = licenseCode.trim().toLowerCase();

    const license = await prisma.license.findUnique({
      where: { code: normalizedCode },
    });

    if (!license) {
      return NextResponse.json({ error: INVALID_CODE_MSG }, { status: 400 });
    }

    if (license.isUsed) {
      return NextResponse.json({ error: INVALID_CODE_MSG }, { status: 400 });
    }

    // M6: atomowe oznaczenie licencji — zapobiega TOCTOU (podwójnemu użyciu
    // przy równoczesnych żądaniach). UPDATE zwraca 0 wierszy jeśli już użyta.
    const now = new Date();
    const marked = await prisma.$executeRaw`
      UPDATE "License"
      SET "isUsed" = 1, "usedBy" = ${user.id}, "usedAt" = ${now.toISOString()}
      WHERE "id" = ${license.id} AND "isUsed" = 0
    `;
    if (Number(marked) === 0) {
      return NextResponse.json({ error: INVALID_CODE_MSG }, { status: 400 });
    }

    // Get or create subscription
    let subscription = await prisma.subscription.findUnique({
      where: { userId: user.id },
    });

    if (!subscription) {
      // Create new subscription with license duration
      const trialEndsAt = new Date(now.getTime() + license.durationDays * 24 * 60 * 60 * 1000);

      subscription = await prisma.subscription.create({
        data: {
          id: require("crypto").randomUUID(),
          userId: user.id,
          status: "trial",
          trialEndsAt,
          trialDays: license.durationDays,
          updatedAt: new Date(),
        },
      });
    } else {
      // Extend existing subscription
      const currentEndDate = subscription.trialEndsAt > now ? subscription.trialEndsAt : now;
      const newEndDate = new Date(currentEndDate.getTime() + license.durationDays * 24 * 60 * 60 * 1000);

      await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          trialEndsAt: newEndDate,
          status: subscription.status === "expired" ? "trial" : subscription.status,
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: `Licencja aktywowana! Dodano ${license.durationDays} dni dostępu do AI Chat.`,
      daysAdded: license.durationDays,
    });
  } catch (error) {
    console.error("Redeem license error:", error);
    return NextResponse.json(
      { error: "Nie udało się zrealizować licencji" },
      { status: 500 }
    );
  }
}
