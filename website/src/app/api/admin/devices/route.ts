import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdminAuth } from "@/lib/admin-auth";
import { getRentalInfo, getRentalInfoBatch, setDeviceRental } from "@/lib/deviceRental";

// Pola urzadzenia zwracane do panelu. Jawny select: deviceToken (sekret
// uwierzytelniajacy kalkulator) i unlockCode NIE wychodza poza serwer —
// dawniej lista zwracala je dla wszystkich urzadzen (audyt 2026-10-16).
const DEVICE_PUBLIC_SELECT = {
  id: true,
  deviceId: true,
  userId: true,
  licenseCode: true,
  firstSeen: true,
  lastSeen: true,
  requestCount: true,
  firmwareVersion: true,
  lastIp: true,
} as const;

async function deviceHasColumn(name: string): Promise<boolean> {
  const cols = await prisma.$queryRawUnsafe<{ name: string }[]>(`PRAGMA table_info("Device")`);
  return cols.some((c) => c.name === name);
}

// deviceId urzadzen, ktore maja zapisany token (plaintext albo hash) — sam
// fakt posiadania, bez wartosci (do przycisku "Resetuj token" w panelu).
async function devicesWithToken(): Promise<Set<string>> {
  const hasHash = await deviceHasColumn("deviceTokenHash");
  const rows = hasHash
    ? await prisma.$queryRawUnsafe<{ deviceId: string }[]>(
        `SELECT "deviceId" FROM "Device" WHERE "deviceToken" IS NOT NULL OR "deviceTokenHash" IS NOT NULL`
      )
    : await prisma.$queryRawUnsafe<{ deviceId: string }[]>(`SELECT "deviceId" FROM "Device" WHERE "deviceToken" IS NOT NULL`);
  return new Set(rows.map((r) => r.deviceId));
}

// GET /api/admin/devices — lista urzadzen + dane sparowanego usera
export async function GET(req: NextRequest) {
  const authErr = await requireAdminAuth(req); if (authErr) return authErr;
  try {
    const devices = await prisma.device.findMany({
      orderBy: { lastSeen: "desc" },
      select: DEVICE_PUBLIC_SELECT,
    });

    // Pobierz userow w jednej kwerendzie (bez .include — schema serwerowa nie ma
    // relation Device.User w Prisma modelu, choc kolumna userId istnieje)
    const userIds = Array.from(
      new Set(devices.map((d) => d.userId).filter((x): x is string => !!x))
    );
    const users = userIds.length
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, email: true, name: true },
        })
      : [];
    const userMap = new Map(users.map((u) => [u.id, u]));
    const rentalMap = await getRentalInfoBatch(devices.map((d) => d.deviceId));
    const withToken = await devicesWithToken();

    const enriched = devices.map((d) => ({
      ...d,
      User: d.userId ? userMap.get(d.userId) ?? null : null,
      rentalUntil: rentalMap.get(d.deviceId)?.rentalUntil ?? null,
      rentalLocked: rentalMap.get(d.deviceId)?.rentalLocked ?? false,
      hasToken: withToken.has(d.deviceId),
    }));

    const totalRequests = devices.reduce((sum, d) => sum + d.requestCount, 0);
    const activeNow = devices.filter(
      (d) => Date.now() - new Date(d.lastSeen).getTime() < 5 * 60 * 1000
    ).length;
    const pairedCount = devices.filter((d) => d.userId).length;

    return NextResponse.json({
      ok: true,
      stats: {
        totalDevices: devices.length,
        totalRequests,
        activeNow,
        pairedCount,
      },
      devices: enriched,
    });
  } catch (e) {
    console.error("[admin/devices GET]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

const PATCH_ACTIONS = new Set(["unpair", "rental", "reset_token"]);

// PATCH /api/admin/devices?deviceId=... (albo &action=unpair) — odepnij
// urzadzenie (zostaw rekord). Czysci userId + licenseCode zeby kalkulator mogl
// byc sparowany ponownie. Brak action = unpair (zgodnosc z panelem), NIEZNANA
// action = 400 (dawniej literowka w action po cichu odpinala urzadzenie).
//
// PATCH /api/admin/devices?deviceId=...&action=rental — ustaw/zmien najem.
// Body: { rentalUntil?: string|null (ISO), rentalLocked?: boolean }
// Pole pominiete w body = bez zmian (dawniej brak rentalLocked odblokowywal).
//
// PATCH /api/admin/devices?deviceId=...&action=reset_token — kasuje zapisany
// token urzadzenia (deviceToken + deviceTokenHash). Kalkulator dostanie nowy
// token przy nastepnym /register. Potwierdzenie po stronie panelu.
//
// Odpowiedz: { ok, deviceId, action, ... } — bez danych urzadzenia (tokenow).
export async function PATCH(req: NextRequest) {
  const authErr = await requireAdminAuth(req); if (authErr) return authErr;
  try {
    const url = new URL(req.url);
    const deviceId = (url.searchParams.get("deviceId") || "").trim().toUpperCase();
    const action = url.searchParams.get("action") || "unpair";
    if (!deviceId) {
      return NextResponse.json({ ok: false, error: "Brak deviceId" }, { status: 400 });
    }
    if (!PATCH_ACTIONS.has(action)) {
      return NextResponse.json({ ok: false, error: `Nieznana akcja: ${action}` }, { status: 400 });
    }

    const device = await prisma.device.findUnique({ where: { deviceId }, select: { id: true, deviceId: true } });
    if (!device) {
      return NextResponse.json({ ok: false, error: "Nie znaleziono" }, { status: 404 });
    }

    if (action === "rental") {
      const body = await req.json().catch(() => ({}));
      const current = await getRentalInfo(deviceId);

      let rentalUntil = current.rentalUntil;
      if (body?.rentalUntil !== undefined) {
        if (body.rentalUntil === null || body.rentalUntil === "") {
          rentalUntil = null;
        } else if (typeof body.rentalUntil === "string") {
          const d = new Date(body.rentalUntil);
          if (Number.isNaN(d.getTime())) {
            return NextResponse.json({ ok: false, error: "Nieprawidlowa data konca najmu (oczekiwany ISO, np. 2027-05-15T23:59:59Z)" }, { status: 400 });
          }
          rentalUntil = d.toISOString();
        } else {
          return NextResponse.json({ ok: false, error: "Nieprawidlowa data konca najmu" }, { status: 400 });
        }
      }

      let rentalLocked = current.rentalLocked;
      if (body?.rentalLocked !== undefined) {
        if (typeof body.rentalLocked !== "boolean") {
          return NextResponse.json({ ok: false, error: "rentalLocked musi byc true/false" }, { status: 400 });
        }
        rentalLocked = body.rentalLocked;
      }

      await setDeviceRental(deviceId, rentalUntil, rentalLocked);
      return NextResponse.json({ ok: true, action: "rental", deviceId, rentalUntil, rentalLocked });
    }

    if (action === "reset_token") {
      if (await deviceHasColumn("deviceTokenHash")) {
        await prisma.$executeRaw`UPDATE "Device" SET "deviceToken" = NULL, "deviceTokenHash" = NULL WHERE "id" = ${device.id}`;
      } else {
        await prisma.$executeRaw`UPDATE "Device" SET "deviceToken" = NULL WHERE "id" = ${device.id}`;
      }
      console.info(`[admin/devices] token urzadzenia ${deviceId} zresetowany przez admina`);
      return NextResponse.json({ ok: true, action: "token_reset", deviceId });
    }

    await prisma.device.update({
      where: { id: device.id },
      data: { userId: null, licenseCode: null },
    });

    return NextResponse.json({ ok: true, action: "unpaired", deviceId });
  } catch (e) {
    console.error("[admin/devices PATCH]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// DELETE /api/admin/devices?deviceId=... — usun urzadzenie z bazy
// Kaskadowo usuwa DeviceSolve (relacja onDelete: Cascade w schemacie)
export async function DELETE(req: NextRequest) {
  const authErr = await requireAdminAuth(req); if (authErr) return authErr;
  try {
    const url = new URL(req.url);
    const deviceId = (url.searchParams.get("deviceId") || "").trim().toUpperCase();
    if (!deviceId) {
      return NextResponse.json({ ok: false, error: "Brak deviceId" }, { status: 400 });
    }

    const device = await prisma.device.findUnique({ where: { deviceId }, select: { id: true } });
    if (!device) {
      return NextResponse.json({ ok: false, error: "Nie znaleziono" }, { status: 404 });
    }

    await prisma.device.delete({ where: { id: device.id } });

    return NextResponse.json({ ok: true, deletedDeviceId: deviceId });
  } catch (e) {
    console.error("[admin/devices DELETE]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
