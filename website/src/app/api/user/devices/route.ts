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

// POST /api/user/devices — sparuj device (body: { deviceId })
// Wymaga: user ma claim'd licencje
export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Nie zalogowany" }, { status: 401 });

  // Sprawdz czy user ma licencje
  const license = await prisma.license.findFirst({
    where: { claimedByUserId: user.id },
  });
  if (!license) {
    return NextResponse.json(
      { ok: false, error: "Najpierw przypisz licencje do konta" },
      { status: 400 }
    );
  }

  const body = await req.json();
  const deviceId = String(body?.deviceId || "").trim().toUpperCase();
  if (!deviceId || deviceId.length < 6) {
    return NextResponse.json({ ok: false, error: "Nieprawidlowy device ID" }, { status: 400 });
  }

  // Pair: znajdz lub utworz device
  const existing = await prisma.device.findUnique({ where: { deviceId } });
  if (existing) {
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
  } else {
    const created = await prisma.device.create({
      data: {
        deviceId,
        userId: user.id,
      },
    });
    return NextResponse.json({ ok: true, device: created, action: "created" });
  }
}

// DELETE /api/user/devices?deviceId=... — odepnij urzadzenie
export async function DELETE(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Nie zalogowany" }, { status: 401 });

  const url = new URL(req.url);
  const deviceId = (url.searchParams.get("deviceId") || "").trim().toUpperCase();
  if (!deviceId) return NextResponse.json({ ok: false, error: "Brak deviceId" }, { status: 400 });

  const device = await prisma.device.findUnique({ where: { deviceId } });
  if (!device || device.userId !== user.id) {
    return NextResponse.json({ ok: false, error: "Nie znaleziono" }, { status: 404 });
  }

  await prisma.device.update({
    where: { id: device.id },
    data: { userId: null },
  });

  return NextResponse.json({ ok: true });
}
