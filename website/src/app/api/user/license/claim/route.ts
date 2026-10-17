import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { randomUUID } from "crypto";

// Ujednolicony komunikat — anty-enumeracja (czy kod istnieje czy nie).
const INVALID_CODE_MSG = "Nieprawidlowy lub niedostepny kod licencji";

// POST /api/user/license/claim
// Body: { code: string }
// Wymaga: zalogowany user
// Logika: licencja jest NA STALE zwiazana z pierwszym kontem, ktore jej uzylo
// (claim tutaj albo /api/subscription/redeem — usedBy). Inne konto nie moze
// jej przejac, takze po odpieciu (DELETE). Ponowny claim przez to samo konto
// nie przedluza dostepu: koniec = usedAt + durationDays (K2), nie "teraz + N".
// Wczesniejsze konwersacje z tego device (po claimcie) beda widoczne w panelu.
export async function POST(request: NextRequest) {
  try {
    // Rate limit per IP: 5 prob/min — chroni przed brute-force kodow
    const ip = clientIp(request);
    const rl = rateLimit(`claim:${ip}`, 5, 60_000);
    if (!rl.ok) {
      return NextResponse.json(
        { ok: false, error: `Za duzo prob. Sprobuj za ${Math.ceil(rl.resetMs / 1000)}s.` },
        { status: 429 }
      );
    }

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
      // Anty-enumeracja: ten sam komunikat jak dla "zaclaimowana przez kogos"
      return NextResponse.json({ ok: false, error: INVALID_CODE_MSG }, { status: 400 });
    }

    // Zaclaimowana albo zrealizowana (redeem) przez kogos innego — ten sam komunikat
    if (
      (license.claimedByUserId && license.claimedByUserId !== user.id) ||
      (license.usedBy && license.usedBy !== user.id)
    ) {
      return NextResponse.json({ ok: false, error: INVALID_CODE_MSG }, { status: 400 });
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

    // Claim — atomowo: warunek w UPDATE, wiec dwa rownolegle zadania z roznych
    // kont nie przypisza tej samej licencji obu (wygrywa jedno, drugie = 0 wierszy).
    const now = new Date();
    const claimed = await prisma.license.updateMany({
      where: {
        id: license.id,
        AND: [
          { OR: [{ claimedByUserId: null }, { claimedByUserId: user.id }] },
          { OR: [{ usedBy: null }, { usedBy: user.id }] },
        ],
      },
      data: {
        claimedByUserId: user.id,
        isUsed: true,
        usedBy: user.id,
        // Pierwsze uzycie ustala start licencji; ponowny claim go nie przesuwa.
        usedAt: license.usedAt ?? now,
      },
    });
    if (claimed.count !== 1) {
      return NextResponse.json({ ok: false, error: INVALID_CODE_MSG }, { status: 400 });
    }

    const fresh = await prisma.license.findUnique({ where: { id: license.id } });
    const usedAt = fresh?.usedAt ? new Date(fresh.usedAt) : now;
    const licenseEndsAt = new Date(usedAt.getTime() + license.durationDays * 24 * 60 * 60 * 1000);

    // Aktywuj subskrypcje (K2: status 'active' + currentPeriodEnd = usedAt + durationDays).
    // Dluzszy istniejacy dostep zostaje; ponowny claim daje ten sam koniec (bez przedluzania).
    const subscriptionEndsAt = await activateLicenseSubscription(user.id, licenseEndsAt, license.durationDays, now);

    // Self-heal przeniesiony z GET (GET nic nie zapisuje): kalkulator, ktory
    // rozwiazywal na tej licencji, ale nie jest sparowany z tym kontem (userId
    // null lub stary wlasciciel sprzed zwiazania licencji na stale) — przejmij.
    // Licencja = zrodlo prawdy o wlascicielu. Bez tego DELETE /api/user/devices
    // zwraca 404 (sprawdza userId === user.id).
    // Jak dawniej w GET: tylko gdy konto nie ma zadnego sparowanego urzadzenia,
    // i tylko ostatnio widziane urzadzenie z tym kodem.
    try {
      const own = await prisma.device.findFirst({ where: { userId: user.id } });
      if (!own) {
        const dev = await prisma.device.findFirst({
          where: { licenseCode: code },
          orderBy: { lastSeen: "desc" },
        });
        if (dev && dev.userId !== user.id) {
          await prisma.device.update({ where: { id: dev.id }, data: { userId: user.id } });
        }
      }
    } catch (e) {
      console.error("[user/license/claim] device takeover failed:", e);
    }

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
      activatedAt: usedAt,
      subscriptionEndsAt,
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

    // Najpierw licencja przypieta do konta; dopiero gdy brak — zrealizowana
    // przez to konto (usedBy, np. /subscription/redeem albo po odpieciu).
    const license =
      (await prisma.license.findFirst({ where: { claimedByUserId: user.id } })) ??
      (await prisma.license.findFirst({ where: { usedBy: user.id } }));
    // GET niczego nie zapisuje (audyt 2026-10-16). Dawne "self-heale"
    // (claimedByUserId z usedBy, trial->active z licencji liczone od TERAZ,
    // przejecie urzadzenia) sa w POST — wystarczy ponowny claim tego kodu.
    const subscription = await prisma.subscription.findUnique({
      where: { userId: user.id },
    });

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
          // Tylko do wyswietlenia — przejecie urzadzenia robi POST claim.
          device = await deviceModel.findFirst({
            where: { licenseCode: license.code },
            orderBy: { lastSeen: "desc" },
          });
        }
      }
    } catch {
      device = null;
    }

    // Doczytaj promptMode (kolumna nie istnieje w Prisma schemie)
    if (device?.id) {
      try {
        const rows = await prisma.$queryRaw<{ promptMode: string | null }[]>`
          SELECT "promptMode" FROM "Device" WHERE "id" = ${device.id} LIMIT 1
        `;
        device.promptMode = rows?.[0]?.promptMode ?? null;
      } catch {
        device.promptMode = null;
      }
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
            // promptMode nie ma w Prisma schemie wiec raw SQL nizej go dolacza
            promptMode: (device as any).promptMode ?? null,
          }
        : null,
    });
  } catch (e) {
    console.error("[user/license/claim GET]", e);
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}

// DELETE /api/user/license/claim — odepnij aktualnie zaclaimowana licencje
// (NIE usuwa licencji ani danych — pozwala temu kontu zaclaimowac inna).
// Kod NIE wraca do puli: usedBy zostaje = to konto, wiec inne konto nie moze
// go aktywowac (wczesniej odpiecie pozwalalo "przekazywac" jeden kod dalej).
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

    // Odepnij licencje — zostaw rekord (i historie konwersacji), tylko zwolnij
    // claim. usedBy/isUsed/usedAt zostaja — kod pozostaje zwiazany z tym kontem.
    await prisma.license.update({
      where: { id: license.id },
      data: {
        claimedByUserId: null,
        isUsed: true,
        usedBy: license.usedBy ?? user.id,
        usedAt: license.usedAt ?? new Date(),
      },
    });

    // Notatki/sprawdziany/konwersacje zostaja przy userze (dane nie znikaja)
    // Aby je przeniesc do innego konta, user musi je usunac/zmigrowac recznie

    return NextResponse.json({ ok: true, code: license.code });
  } catch (e) {
    console.error("[user/license/claim DELETE]", e);
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}

// Subskrypcja z licencji (K2): status 'active' + currentPeriodEnd
// (stripeCurrentPeriodEnd) = koniec licencji. trialEndsAt tez = koniec (panel
// i starsze ekrany licza z niego "dni pozostalo"). Nie skracamy dluzszego
// dostepu, nie ruszamy subskrypcji zarzadzanej przez Stripe. Zwraca efektywny
// koniec dostepu.
async function activateLicenseSubscription(
  userId: string,
  licenseEndsAt: Date,
  durationDays: number,
  now: Date,
): Promise<Date> {
  const existing = await prisma.subscription.findUnique({ where: { userId } });
  if (!existing) {
    await prisma.subscription.create({
      data: {
        id: randomUUID(),
        userId,
        status: "active",
        trialEndsAt: licenseEndsAt,
        trialDays: durationDays,
        stripeCurrentPeriodEnd: licenseEndsAt,
        updatedAt: new Date(),
      },
    });
    return licenseEndsAt;
  }

  const curTrialEnd = existing.trialEndsAt ? new Date(existing.trialEndsAt) : new Date(0);
  const curPeriodEnd = existing.stripeCurrentPeriodEnd ? new Date(existing.stripeCurrentPeriodEnd) : null;
  const isActive = existing.status === "active" || existing.status === "past_due";
  const stripeManaged = !!existing.stripeSubscriptionId && isActive && (!curPeriodEnd || curPeriodEnd > now);

  // Licencja juz wygasla — nic nie dajemy (i nic nie psujemy).
  if (licenseEndsAt <= now) {
    return [curTrialEnd, curPeriodEnd ?? new Date(0)].reduce((a, b) => (a > b ? a : b));
  }

  if (stripeManaged) {
    // Okres rozlicza Stripe — nie nadpisujemy statusu ani stripeCurrentPeriodEnd.
    if (licenseEndsAt > curTrialEnd) {
      await prisma.subscription.update({
        where: { id: existing.id },
        data: { trialEndsAt: licenseEndsAt, trialDays: durationDays },
      });
    }
    return [licenseEndsAt, curPeriodEnd ?? licenseEndsAt].reduce((a, b) => (a > b ? a : b));
  }

  // Najdalszy z: koniec licencji, trwajacy trial, trwajacy okres 'active'.
  const candidates = [licenseEndsAt];
  if (curTrialEnd > now) candidates.push(curTrialEnd);
  if (isActive && curPeriodEnd && curPeriodEnd > now) candidates.push(curPeriodEnd);
  const newEnd = candidates.reduce((a, b) => (a > b ? a : b));

  const unchanged =
    existing.status === "active" &&
    curPeriodEnd && curPeriodEnd.getTime() === newEnd.getTime() &&
    curTrialEnd.getTime() >= newEnd.getTime();
  if (!unchanged) {
    await prisma.subscription.update({
      where: { id: existing.id },
      data: {
        status: "active",
        stripeCurrentPeriodEnd: newEnd,
        ...(newEnd > curTrialEnd ? { trialEndsAt: newEnd, trialDays: durationDays } : {}),
      },
    });
  }
  return newEnd;
}
