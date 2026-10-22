import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { activateLicenseForTokens, readLicenseTokensGrantedAt, LICENSE_INVALID_MSG } from "@/lib/licenseTokens";
import { LICENSE_TOKENS } from "@/lib/tokenGrants";

// Ujednolicony komunikat — anty-enumeracja (czy kod istnieje czy nie).
const INVALID_CODE_MSG = LICENSE_INVALID_MSG;

// POST /api/user/license/claim
// Body: { code: string }
// Wymaga: zalogowany user
// Logika: licencja jest NA STALE zwiazana z pierwszym kontem, ktore jej uzylo
// (claim tutaj albo /api/subscription/redeem — usedBy). Pierwsza aktywacja
// nieuzytej licencji dodaje LICENSE_TOKENS (jednorazowo); ponowna = 0 tokenow.
// Odpowiedz: { ok, code, tokensGranted, tokenBalance, alreadyActivated, message }.
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

    // Model tokenowy (2026-10): aktywacja = jednorazowe LICENSE_TOKENS na
    // konto (lib/licenseTokens.ts). Limit "jedno konto = jedna licencja"
    // zniesiony — kazda licencja z pudelka to osobne doladowanie.
    const act = await activateLicenseForTokens(user.id, code);
    if (!act.ok) {
      return NextResponse.json({ ok: false, error: INVALID_CODE_MSG }, { status: 400 });
    }

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
      code: act.code,
      tokensGranted: act.tokensGranted,
      tokenBalance: act.tokenBalance,
      alreadyActivated: act.alreadyActivated,
      message: act.message,
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
    const tokensGrantedAt = license ? await readLicenseTokensGrantedAt(license.id).catch(() => null) : null;

    // Parowanie kalkulatora jest niezalezne od licencji — kazdy zalogowany user
    // moze sparowac urzadzenie. Dostep do AI zalezy tylko od salda tokenow.

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
      claimed: true, // historyczna nazwa — panel laduje dane kalkulatora tylko gdy true
      license: license
        ? {
            code: license.code,
            activated: !!license.isUsed,
            activatedAt: license.usedAt,
            // Ile tokenow dala ta licencja (0 = aktywowana w starym modelu
            // czasowym, przed 2026-10 — tokenow wstecz nie przyznajemy).
            tokensGranted: tokensGrantedAt ? LICENSE_TOKENS : 0,
            tokensGrantedAt,
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
  // Model tokenowy (2026-10): licencja to jednorazowe doladowanie tokenow,
  // ktore juz sa na koncie — odpinanie nie ma sensu.
  return NextResponse.json(
    {
      ok: false,
      error: "Odpinanie licencji nie jest już dostępne — licencja jednorazowo doładowała tokeny na Twoje konto.",
    },
    { status: 410 }
  );
}
