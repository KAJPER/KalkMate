import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET /api/device/notes
// Headers: x-api-key, x-license-key (lub x-device-id)
// Zwraca notatki user'a ktory zaclaimowal licencje uzywana przez device
export async function GET(request: NextRequest) {
  try {
    const apiKey = request.headers.get("x-api-key");
    if (!apiKey || apiKey !== process.env.CALCULATOR_API_KEY) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const licenseKey = request.headers.get("x-license-key")?.trim().toLowerCase();
    if (!licenseKey) {
      return NextResponse.json(
        { ok: false, error: "Brak licencji" },
        { status: 400 }
      );
    }

    const license = await prisma.license.findUnique({ where: { code: licenseKey } });
    if (!license) {
      return NextResponse.json({ ok: false, error: "Nieprawidlowa licencja" }, { status: 404 });
    }

    if (!license.claimedByUserId) {
      // Licencja nie jest jeszcze przypisana do konta — zwroc pusta liste
      return NextResponse.json({ ok: true, notes: [], userClaimed: false });
    }

    const notes = await prisma.note.findMany({
      where: { userId: license.claimedByUserId },
      orderBy: [{ position: "asc" }, { updatedAt: "desc" }],
      select: {
        id: true,
        title: true,
        content: true,
        position: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ ok: true, notes, userClaimed: true });
  } catch (e) {
    console.error("[device/notes]", e);
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}
