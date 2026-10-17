import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { listUserCaptures, parseCapturePage } from "@/lib/captures";

// GET /api/user/captures?limit=200&before=<ms|ISO> — lista zdjec zrobionych
// przez urzadzenia usera. Z tabeli Capture (bez skanu katalogu): zdjecia
// zrobione gdy urzadzenie bylo sparowane z TYM kontem + pliki legacy
// (sprzed tabeli) z urzadzen, ktore obecnie naleza do usera.
// Odpowiedz: { ok, items: [{filename, deviceId, timestamp, sizeKB}], stats, nextBefore (string|null), hasMore }
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ ok: false, error: "Nie zalogowany" }, { status: 401 });
  }
  try {
    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user) {
      return NextResponse.json({ ok: false, error: "Brak konta" }, { status: 401 });
    }

    const devices = await prisma.device.findMany({
      where: { userId: user.id },
      select: { deviceId: true },
    });

    const page = parseCapturePage(new URL(request.url), 200, 500);
    const { items, nextBefore } = await listUserCaptures(
      user.id,
      devices.map((d) => d.deviceId),
      page
    );

    return NextResponse.json({
      ok: true,
      items,
      stats: { total: items.length },
      nextBefore,
      hasMore: nextBefore !== null,
    });
  } catch (e) {
    console.error("[user/captures]", e);
    return NextResponse.json({ ok: false, error: "Blad serwera" }, { status: 503 });
  }
}
