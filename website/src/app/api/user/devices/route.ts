import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

async function getUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;
  return await prisma.user.findUnique({ where: { email: session.user.email } });
}

// GET /api/user/devices — lista sparowanych urzadzen + status licencji konta
export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Nie zalogowany" }, { status: 401 });

  const devices = await prisma.device.findMany({
    where: { userId: user.id },
    orderBy: { lastSeen: "desc" },
  });

  // Aktualna licencja konta
  const license = await prisma.license.findFirst({
    where: { claimedByUserId: user.id },
  });

  let licenseStatus = "none";
  if (license) {
    licenseStatus = "active";
    if (license.usedAt) {
      const expiresAt = new Date(
        new Date(license.usedAt).getTime() + license.durationDays * 24 * 60 * 60 * 1000
      );
      if (new Date() > expiresAt) licenseStatus = "expired";
    }
  }

  return NextResponse.json({
    ok: true,
    devices,
    license: license
      ? {
          code: license.code,
          durationDays: license.durationDays,
          activatedAt: license.usedAt,
          status: licenseStatus,
        }
      : null,
  });
}

// POST /api/user/devices — sparuj device (body: { deviceId, unlockCode })
// Wymaga: user ma claim'd licencje + unlockCode pasuje do zapisanego przez kalkulator
export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Nie zalogowany" }, { status: 401 });

  const body = await req.json();
  const deviceId = String(body?.deviceId || "").trim().toUpperCase();
  const unlockCode = String(body?.unlockCode || "").trim();
  if (!deviceId || deviceId.length < 6) {
    return NextResponse.json({ ok: false, error: "Nieprawidlowy Device ID" }, { status: 400 });
  }
  if (!unlockCode) {
    return NextResponse.json(
      { ok: false, error: "Wpisz kod odblokowania (Settings -> Kod AI w kalkulatorze)" },
      { status: 400 }
    );
  }

  // Sprawdz czy kalkulator zglosil sie do serwera (Device musi istniec)
  const existing = await prisma.device.findUnique({ where: { deviceId } });
  if (!existing) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Kalkulator jeszcze nie zglosil sie do serwera. Polacz go z WiFi i odczekaj chwile.",
      },
      { status: 404 }
    );
  }

  // Walidacja unlockCode (raw SQL bo schema nie ma tej kolumny)
  const rows = await prisma.$queryRaw<{ unlockCode: string | null }[]>`
    SELECT "unlockCode" FROM "Device" WHERE "deviceId" = ${deviceId} LIMIT 1
  `;
  const storedUnlock = rows?.[0]?.unlockCode || null;
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
  if (storedUnlock !== unlockCode) {
    return NextResponse.json(
      { ok: false, error: "Nieprawidlowy kod odblokowania" },
      { status: 403 }
    );
  }

  // Pair
  if (existing.userId && existing.userId !== user.id) {
    return NextResponse.json(
      { ok: false, error: "Urzadzenie sparowane z innym kontem" },
      { status: 409 }
    );
  }
  const updated = await prisma.device.update({
    where: { id: existing.id },
    data: { userId: user.id },
  });
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

  const device = await prisma.device.findUnique({ where: { deviceId } });
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

  const device = await prisma.device.findUnique({ where: { deviceId } });
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
  });

  return NextResponse.json({ ok: true });
}
