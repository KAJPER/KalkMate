import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
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
      return NextResponse.json(
        { error: "Nieprawidłowy kod licencji" },
        { status: 404 }
      );
    }

    if (license.isUsed) {
      return NextResponse.json(
        { error: "Ten kod licencji został już wykorzystany" },
        { status: 400 }
      );
    }

    // Get or create subscription
    let subscription = await prisma.subscription.findUnique({
      where: { userId: user.id },
    });

    const now = new Date();

    if (!subscription) {
      // Create new subscription with license duration
      const trialEndsAt = new Date(now.getTime() + license.durationDays * 24 * 60 * 60 * 1000);

      subscription = await prisma.subscription.create({
        data: {
          userId: user.id,
          status: "trial",
          trialEndsAt,
          trialDays: license.durationDays,
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

    // Mark license as used
    await prisma.license.update({
      where: { id: license.id },
      data: {
        isUsed: true,
        usedBy: user.id,
        usedAt: now,
      },
    });

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
