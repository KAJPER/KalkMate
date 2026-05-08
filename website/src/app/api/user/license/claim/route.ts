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
    await prisma.license.update({
      where: { id: license.id },
      data: { claimedByUserId: user.id },
    });

    // Linkuj wszystkie poprzednie DeviceSolve z tej licencji do user'a
    await prisma.deviceSolve.updateMany({
      where: { licenseCode: code, userId: null },
      data: { userId: user.id },
    });

    return NextResponse.json({
      ok: true,
      code: license.code,
      durationDays: license.durationDays,
      activatedAt: license.usedAt,
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
      where: { claimedByUserId: user.id },
    });
    const subscription = await prisma.subscription.findUnique({
      where: { userId: user.id },
    });

    // canPair = user moze sparowac kalkulator. Wystarczy jeden z:
    //  - claimed License,
    //  - aktywny trial (Subscription.status='trial' AND trialEndsAt > now),
    //  - aktywna platna (status='active')
    const now = new Date();
    let canPair = false;
    if (license) canPair = true;
    if (subscription) {
      if (subscription.status === "active") canPair = true;
      if (
        subscription.status === "trial" &&
        new Date(subscription.trialEndsAt) > now
      ) {
        canPair = true;
      }
    }

    if (!canPair) {
      return NextResponse.json({ ok: true, claimed: false });
    }

    // Znajdz device sparowane z tym kontem (nowy model: Device.userId).
    let device = await prisma.device.findFirst({
      where: { userId: user.id },
      orderBy: { lastSeen: "desc" },
    });
    if (!device && license) {
      device = await prisma.device.findFirst({
        where: { licenseCode: license.code },
        orderBy: { lastSeen: "desc" },
      });
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
