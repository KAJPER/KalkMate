import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

// POST /api/user/license/claim
// Body: { code: string }
// Wymaga: zalogowany user
// Logika: jesli licencja istnieje i nie jest zaclaimowana przez innego user'a,
// przypisuje ja do tego user'a. Wczesniejsze konwersacje z tego device
// (po claimcie) beda widoczne w panelu.
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json(
        { ok: false, error: "Nie zalogowany" },
        { status: 401 }
      );
    }
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });
    if (!user) {
      return NextResponse.json(
        { ok: false, error: "Brak konta" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const code = String(body?.code || "").trim().toLowerCase();
    if (!code) {
      return NextResponse.json(
        { ok: false, error: "Brak kodu licencji" },
        { status: 400 }
      );
    }

    const license = await prisma.license.findUnique({ where: { code } });
    if (!license) {
      return NextResponse.json(
        { ok: false, error: "Nieprawidlowy kod licencji" },
        { status: 404 }
      );
    }

    // Jesli juz zaclaimowana przez kogos innego — odrzuc
    if (license.claimedByUserId && license.claimedByUserId !== user.id) {
      return NextResponse.json(
        { ok: false, error: "Licencja juz przypisana do innego konta" },
        { status: 409 }
      );
    }

    // Sprawdz czy ten user nie ma juz zaclaimowanej innej licencji
    const existingClaim = await prisma.license.findFirst({
      where: { claimedByUserId: user.id, NOT: { id: license.id } },
    });
    if (existingClaim) {
      return NextResponse.json(
        {
          ok: false,
          error: "Masz juz przypisana inna licencje. Jedno konto = jedna licencja.",
          existingCode: existingClaim.code,
        },
        { status: 409 }
      );
    }

    // Claim
    const now = new Date();
    await prisma.license.update({
      where: { id: license.id },
      data: {
        claimedByUserId: user.id,
        isUsed: true,
        usedBy: user.id,
        usedAt: license.usedAt ?? now,
      },
    });

    // Aktywuj subskrypcje na podstawie czasu z licencji.
    // Jesli user juz ma aktywna subskrypcje konczaca sie pozniej — zachowaj te dluzsza.
    const licenseEndsAt = new Date(now.getTime() + license.durationDays * 24 * 60 * 60 * 1000);
    const existingSub = await prisma.subscription.findUnique({ where: { userId: user.id } });
    const currentEnd = existingSub ? new Date(existingSub.trialEndsAt) : new Date(0);
    const newEnd = licenseEndsAt > currentEnd ? licenseEndsAt : currentEnd;

    await prisma.subscription.upsert({
      where: { userId: user.id },
      update: {
        status: "active",
        trialEndsAt: newEnd,
        trialDays: license.durationDays,
      },
      create: {
        userId: user.id,
        status: "active",
        trialEndsAt: newEnd,
        trialDays: license.durationDays,
      },
    });

    // Linkuj wszystkie poprzednie DeviceSolve z tej licencji do user'a
    // (model moze nie byc jeszcze w schemie — pomin gracefully)
    try {
      const ds = (prisma as any).deviceSolve;
      if (ds) {
        await ds.updateMany({
          where: { licenseCode: code, userId: null },
          data: { userId: user.id },
        });
      }
    } catch {}

    return NextResponse.json({
      ok: true,
      code: license.code,
      durationDays: license.durationDays,
      activatedAt: license.usedAt ?? now,
      subscriptionEndsAt: newEnd,
    });
  } catch (e) {
    console.error("[user/license/claim]", e);
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}

// GET /api/user/license/claim — zwraca aktualnie zaclaimowana licencje + device
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ ok: false, error: "Nie zalogowany" }, { status: 401 });
    }
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });
    if (!user) {
      return NextResponse.json({ ok: false, error: "Brak konta" }, { status: 401 });
    }

    const license = await prisma.license.findFirst({
      where: {
        OR: [
          { claimedByUserId: user.id },
          { usedBy: user.id },
        ],
      },
    });
    // Self-heal claimedByUserId jesli ustawiony jest tylko usedBy
    if (license && !license.claimedByUserId) {
      await prisma.license.update({
        where: { id: license.id },
        data: { claimedByUserId: user.id },
      });
    }
    let subscription = await prisma.subscription.findUnique({
      where: { userId: user.id },
    });

    // Self-heal: jesli user ma claimed licencje ale subscription jest na trial,
    // upgrade do active z czasem z licencji (dla userow ktorzy claimowali przed
    // wprowadzeniem auto-aktywacji)
    if (license && subscription && subscription.status === "trial") {
      const nowH = new Date();
      const licenseEndsAt = new Date(nowH.getTime() + license.durationDays * 24 * 60 * 60 * 1000);
      const currentEnd = new Date(subscription.trialEndsAt);
      const newEnd = licenseEndsAt > currentEnd ? licenseEndsAt : currentEnd;
      subscription = await prisma.subscription.update({
        where: { userId: user.id },
        data: {
          status: "active",
          trialEndsAt: newEnd,
          trialDays: license.durationDays,
        },
      });
    }

    // Parowanie kalkulatora jest niezalezne od licencji — kazdy zalogowany user
    // moze sparowac urzadzenie. Licencja/sub kontroluje tylko AI Chat w panelu.

    // Znajdz device sparowane z tym kontem (nowy model: Device.userId).
    // Model Device moze nie byc jeszcze w schemie — gracefully fallback do null.
    let device: any = null;
    try {
      const deviceModel = (prisma as any).device;
      if (deviceModel) {
        device = await deviceModel.findFirst({
          where: { userId: user.id },
          orderBy: { lastSeen: "desc" },
        });
        if (!device && license) {
          device = await deviceModel.findFirst({
            where: { licenseCode: license.code },
            orderBy: { lastSeen: "desc" },
          });
        }
      }
    } catch {
      device = null;
    }

    return NextResponse.json({
      ok: true,
      claimed: true, // historyczna nazwa = "ma aktywny dostep"
      license: license
        ? {
            code: license.code,
            durationDays: license.durationDays,
            activatedAt: license.usedAt,
          }
        : null,
      subscription: subscription
        ? {
            status: subscription.status,
            trialEndsAt: subscription.trialEndsAt,
            trialDays: subscription.trialDays,
          }
        : null,
      device: device
        ? {
            deviceId: device.deviceId,
            firstSeen: device.firstSeen,
            lastSeen: device.lastSeen,
            requestCount: device.requestCount,
            firmwareVersion: device.firmwareVersion,
          }
        : null,
    });
  } catch (e) {
    console.error("[user/license/claim GET]", e);
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}

// DELETE /api/user/license/claim — odepnij aktualnie zaclaimowana licencje
// (NIE usuwa licencji ani danych — pozwala na claim innej)
export async function DELETE() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ ok: false, error: "Nie zalogowany" }, { status: 401 });
    }
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });
    if (!user) {
      return NextResponse.json({ ok: false, error: "Brak konta" }, { status: 401 });
    }

    const license = await prisma.license.findFirst({
      where: { claimedByUserId: user.id },
    });

    if (!license) {
      return NextResponse.json(
        { ok: false, error: "Brak zaclaimowanej licencji" },
        { status: 404 }
      );
    }

    // Odepnij licencje — zostaw rekord (i historie konwersacji), tylko zwolnij claim
    await prisma.license.update({
      where: { id: license.id },
      data: { claimedByUserId: null },
    });

    // Notatki/sprawdziany/konwersacje zostaja przy userze (dane nie znikaja)
    // Aby je przeniesc do innego konta, user musi je usunac/zmigrowac recznie

    return NextResponse.json({ ok: true, code: license.code });
  } catch (e) {
    console.error("[user/license/claim DELETE]", e);
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}
