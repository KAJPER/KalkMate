import { NextRequest, NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { rateLimit, clientIp } from "@/lib/rate-limit";

async function getUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;
  return await prisma.user.findUnique({ where: { email: session.user.email } });
}

// K11: przegladarka NIGDY nie dostaje deviceToken (sekret urzadzenia),
// unlockCode (kod AI) ani lastIp — tylko pola potrzebne w panelu.
const DEVICE_PUBLIC_SELECT = {
  id: true,
  deviceId: true,
  userId: true,
  licenseCode: true,
  firstSeen: true,
  lastSeen: true,
  requestCount: true,
  firmwareVersion: true,
} as const;

const PAIR_LOCK_THRESHOLD = 5;
const PAIR_LOCK_MS = 15 * 60 * 1000;
// Kod fabryczny z firmware (settings_screen.h). Znaja go wszyscy, wiec nie
// moze sluzyc za dowod posiadania urzadzenia.
const DEFAULT_UNLOCK_CODE = "1111";
// Jedna odpowiedz dla: brak urzadzenia / zly kod / sparowane z innym kontem
// — inaczej endpoint zdradza, ktore Device ID istnieja i ktore sa wolne.
const PAIR_GENERIC_ERROR =
  "Nieprawidlowe urzadzenie lub kod (albo urzadzenie jest juz sparowane z innym kontem).";

function codesEqual(a: string, b: string): boolean {
  const x = createHash("sha256").update(a).digest();
  const y = createHash("sha256").update(b).digest();
  return timingSafeEqual(x, y);
}

// GET /api/user/devices — lista sparowanych urzadzen + status licencji konta
export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Nie zalogowany" }, { status: 401 });

  const devices = await prisma.device.findMany({
    where: { userId: user.id },
    orderBy: { lastSeen: "desc" },
    select: DEVICE_PUBLIC_SELECT,
  });

  // Aktualna licencja konta
  const license = await prisma.license.findFirst({
    where: { claimedByUserId: user.id },
  });

  // Model tokenowy (2026-10): licencja nie wygasa — to jednorazowe
  // doladowanie tokenow. "active" = aktywowana na tym koncie.
  const licenseStatus = license ? "active" : "none";

  return NextResponse.json({
    ok: true,
    devices,
    license: license
      ? {
          code: license.code,
          activatedAt: license.usedAt,
          status: licenseStatus,
        }
      : null,
  });
}

// POST /api/user/devices — sparuj device (body: { deviceId, unlockCode })
// Wymaga: unlockCode pasuje do zapisanego przez kalkulator (POST /api/device/register).
export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Nie zalogowany" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const deviceId = String(body?.deviceId || "").trim().toUpperCase();
  const unlockCode = String(body?.unlockCode || "").trim();
  if (!deviceId || deviceId.length < 6 || deviceId.length > 64) {
    return NextResponse.json({ ok: false, error: "Nieprawidlowy Device ID" }, { status: 400 });
  }
  if (!unlockCode || unlockCode.length > 16) {
    return NextResponse.json(
      { ok: false, error: "Wpisz kod odblokowania (Ustawienia -> Bezpieczenstwo -> Kod AI w kalkulatorze)" },
      { status: 400 }
    );
  }

  // Audyt 2026-10-16: Device ID to MAC (sekwencyjny), a kod AI ma kilka cyfr —
  // bez limitow per konto/IP mozna bylo przechodzic po kolejnych urzadzeniach.
  const rlUser = rateLimit(`pair-user:${user.id}`, 10, 60 * 60_000);
  const rlIp = rateLimit(`pair-ip:${clientIp(req)}`, 10, 60 * 60_000);
  if (!rlUser.ok || !rlIp.ok) {
    const waitMs = Math.max(rlUser.ok ? 0 : rlUser.resetMs, rlIp.ok ? 0 : rlIp.resetMs);
    return NextResponse.json(
      { ok: false, error: `Za duzo prob parowania. Sprobuj ponownie za ${Math.max(1, Math.ceil(waitMs / 60_000))} min.` },
      { status: 429 }
    );
  }

  // Anty brute-force: unlockCode + failedPairs + lockedUntil (raw SQL, kolumn
  // nie ma w Prisma schemie).
  const rows = await prisma.$queryRaw<
    { id: string; userId: string | null; unlockCode: string | null; lockedUntil: string | null }[]
  >`
    SELECT "id", "userId", "unlockCode", "lockedUntil"
    FROM "Device" WHERE "deviceId" = ${deviceId} LIMIT 1
  `;
  const row = rows?.[0];
  if (!row) {
    return NextResponse.json({ ok: false, error: PAIR_GENERIC_ERROR }, { status: 403 });
  }

  // Czy device jest zablokowany po 5 nieudanych probach?
  if (row.lockedUntil) {
    const lockedUntilTs = new Date(row.lockedUntil).getTime();
    if (lockedUntilTs > Date.now()) {
      const minsLeft = Math.ceil((lockedUntilTs - Date.now()) / 60_000);
      return NextResponse.json(
        { ok: false, error: `Za duzo nieudanych prob. Sprobuj ponownie za ${minsLeft} min.` },
        { status: 429 }
      );
    }
  }

  // Sparowane z innym kontem — odmowa PRZED porownaniem kodu (bez wyroczni
  // "kod dobry, ale urzadzenie zajete") i z ta sama odpowiedzia co zly kod.
  if (row.userId && row.userId !== user.id) {
    return NextResponse.json({ ok: false, error: PAIR_GENERIC_ERROR }, { status: 403 });
  }

  const storedUnlock = row.unlockCode || null;
  if (!storedUnlock) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Brak zapisanego kodu odblokowania. Zaktualizuj firmware kalkulatora i polacz z WiFi.",
      },
      { status: 400 }
    );
  }

  if (!codesEqual(storedUnlock, unlockCode)) {
    // Licznik ATOMOWO w bazie (wczesniej odczyt + zapis -> rownolegle proby
    // nie zwiekszaly licznika). Przy 5. nieudanej probie blokada na 15 min.
    const nowIso = new Date().toISOString();
    const lockedUntil = new Date(Date.now() + PAIR_LOCK_MS).toISOString();
    await prisma.$executeRaw`
      UPDATE "Device"
      SET "failedPairs" = COALESCE("failedPairs", 0) + 1,
          "lockedUntil" = CASE WHEN COALESCE("failedPairs", 0) + 1 >= ${PAIR_LOCK_THRESHOLD}
                               THEN ${lockedUntil} ELSE "lockedUntil" END
      WHERE "id" = ${row.id}
    `;
    const after = await prisma.$queryRaw<{ failedPairs: number | bigint | null; lockedUntil: string | null }[]>`
      SELECT "failedPairs", "lockedUntil" FROM "Device" WHERE "id" = ${row.id} LIMIT 1
    `;
    const fails = Number(after?.[0]?.failedPairs ?? 0);
    const lockedNow = after?.[0]?.lockedUntil && after[0].lockedUntil > nowIso;
    if (fails >= PAIR_LOCK_THRESHOLD || lockedNow) {
      // Po blokadzie licznik od zera (kolejna seria = kolejna blokada).
      await prisma.$executeRaw`UPDATE "Device" SET "failedPairs" = 0 WHERE "id" = ${row.id}`;
      console.warn(`[devices/pair] lockout deviceId=${deviceId} user=${user.id}`);
      return NextResponse.json(
        { ok: false, error: "Za duzo nieudanych prob. Parowanie tego urzadzenia zablokowane na 15 minut." },
        { status: 429 }
      );
    }
    return NextResponse.json({ ok: false, error: PAIR_GENERIC_ERROR }, { status: 403 });
  }

  // Juz sparowane z tym kontem — nic do zrobienia.
  if (row.userId === user.id) {
    await prisma.$executeRaw`UPDATE "Device" SET "failedPairs" = 0, "lockedUntil" = NULL WHERE "id" = ${row.id}`;
    const device = await prisma.device.findUnique({ where: { id: row.id }, select: DEVICE_PUBLIC_SELECT });
    return NextResponse.json({ ok: true, device, action: "paired" });
  }

  // Kod fabryczny = kazdy zna "kod" — parowanie tylko po ustawieniu wlasnego.
  // Kalkulator zglasza nowy kod przy otwarciu ekranu Konto / Device ID + QR
  // (accountRegister w firmware), wiec swieze urzadzenie da sie sparowac.
  if (storedUnlock === DEFAULT_UNLOCK_CODE) {
    return NextResponse.json(
      {
        ok: false,
        code: "default_unlock_code",
        error:
          "Zmien kod AI na urzadzeniu (Ustawienia -> Bezpieczenstwo -> Kod AI) przed sparowaniem. Potem otworz na kalkulatorze Ustawienia -> WiFi i konto -> Status konta (polaczony z WiFi), zeby zglosil nowy kod, i sprobuj ponownie.",
      },
      { status: 400 }
    );
  }

  // Sukces — sparuj ATOMOWO (tylko jesli nadal wolne) i wyczysc licznik.
  const paired = await prisma.$executeRaw`
    UPDATE "Device" SET "userId" = ${user.id}, "failedPairs" = 0, "lockedUntil" = NULL
    WHERE "id" = ${row.id} AND ("userId" IS NULL OR "userId" = ${user.id})
  `;
  if (paired !== 1) {
    return NextResponse.json({ ok: false, error: PAIR_GENERIC_ERROR }, { status: 403 });
  }
  const updated = await prisma.device.findUnique({ where: { id: row.id }, select: DEVICE_PUBLIC_SELECT });
  return NextResponse.json({ ok: true, device: updated, action: "paired" });
}

// PATCH /api/user/devices?deviceId=... — zmien ustawienia urzadzenia
// Body: { promptMode: "matura" | "raw" }
// "matura" (default) — system prompt pod zadania CKE
// "raw" — bez ograniczenia do przedmiotow maturalnych (np. elektronika)
export async function PATCH(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Nie zalogowany" }, { status: 401 });

  const url = new URL(req.url);
  const deviceId = (url.searchParams.get("deviceId") || "").trim().toUpperCase();
  if (!deviceId) return NextResponse.json({ ok: false, error: "Brak deviceId" }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const promptMode = String(body?.promptMode || "").trim().toLowerCase();
  if (promptMode !== "matura" && promptMode !== "raw") {
    return NextResponse.json(
      { ok: false, error: "Nieprawidlowy promptMode (matura/raw)" },
      { status: 400 }
    );
  }

  const device = await prisma.device.findUnique({
    where: { deviceId },
    select: { id: true, userId: true, licenseCode: true },
  });
  if (!device) {
    return NextResponse.json({ ok: false, error: "Nie znaleziono" }, { status: 404 });
  }

  // Wlasciciel (jak w DELETE)
  let owned = device.userId === user.id;
  if (!owned && device.licenseCode) {
    const license = await prisma.license.findFirst({
      where: { claimedByUserId: user.id, code: device.licenseCode },
    });
    if (license) owned = true;
  }
  if (!owned) {
    return NextResponse.json({ ok: false, error: "Nie znaleziono" }, { status: 404 });
  }

  // promptMode nie ma w Prisma schemie wiec raw SQL. "matura" zapisujemy
  // jako NULL zeby pozbyc sie szumu (NULL = default).
  const stored = promptMode === "raw" ? "raw" : null;
  await prisma.$executeRaw`
    UPDATE "Device" SET "promptMode" = ${stored} WHERE "id" = ${device.id}
  `;

  return NextResponse.json({ ok: true, promptMode });
}

// DELETE /api/user/devices?deviceId=... — odepnij urzadzenie
export async function DELETE(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Nie zalogowany" }, { status: 401 });

  const url = new URL(req.url);
  const deviceId = (url.searchParams.get("deviceId") || "").trim().toUpperCase();
  if (!deviceId) return NextResponse.json({ ok: false, error: "Brak deviceId" }, { status: 400 });

  const device = await prisma.device.findUnique({
    where: { deviceId },
    select: { id: true, userId: true, licenseCode: true },
  });
  if (!device) {
    return NextResponse.json({ ok: false, error: "Nie znaleziono" }, { status: 404 });
  }

  // Wlasciciel: bezposrednio przez Device.userId, albo posrednio przez licencje
  // (Device.licenseCode pasuje do licencji aktualnie zaclaimowanej przez usera).
  // To drugie pokrywa device'y wyswietlane w panelu przez fallback po licenseCode
  // (urzadzenie rozwiazywalo na licencji usera, ale nie bylo formalnie sparowane).
  let owned = device.userId === user.id;
  if (!owned && device.licenseCode) {
    const license = await prisma.license.findFirst({
      where: { claimedByUserId: user.id, code: device.licenseCode },
    });
    if (license) owned = true;
  }
  if (!owned) {
    return NextResponse.json({ ok: false, error: "Nie znaleziono" }, { status: 404 });
  }

  await prisma.device.update({
    where: { id: device.id },
    data: { userId: null, licenseCode: null },
    select: { id: true },
  });

  return NextResponse.json({ ok: true });
}
