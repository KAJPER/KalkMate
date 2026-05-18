import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";

interface ResetRow {
  id: string;
  userId: string;
  token: string;
  expiresAt: string;
  usedAt: string | null;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const token = String(body?.token || "").trim();
    const newPassword = String(body?.password || "");

    if (!token || token.length < 16) {
      return NextResponse.json({ ok: false, error: "Nieprawidlowy token" }, { status: 400 });
    }
    if (!newPassword || newPassword.length < 6) {
      return NextResponse.json(
        { ok: false, error: "Haslo musi miec min. 6 znakow" },
        { status: 400 }
      );
    }

    const rows = await prisma.$queryRaw<ResetRow[]>`
      SELECT "id", "userId", "token", "expiresAt", "usedAt"
      FROM "PasswordReset"
      WHERE "token" = ${token}
      LIMIT 1
    `;
    if (!rows || rows.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Link wygasl lub jest nieprawidlowy" },
        { status: 400 }
      );
    }
    const reset = rows[0];
    if (reset.usedAt) {
      return NextResponse.json(
        { ok: false, error: "Link zostal juz wykorzystany" },
        { status: 400 }
      );
    }
    if (new Date(reset.expiresAt).getTime() < Date.now()) {
      return NextResponse.json(
        { ok: false, error: "Link wygasl, poprost o nowy" },
        { status: 400 }
      );
    }

    // Hash nowego hasla
    const hash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: reset.userId },
      data: { password: hash },
    });

    // Oznacz token jako uzyty
    await prisma.$executeRaw`
      UPDATE "PasswordReset"
      SET "usedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${reset.id}
    `;

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[reset-password]", e);
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}

// GET — sprawdza czy token jest wciaz wazny (pokazuje formularz albo blad)
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const token = (url.searchParams.get("token") || "").trim();
  if (!token) {
    return NextResponse.json({ ok: false, valid: false, error: "Brak tokenu" });
  }

  const rows = await prisma.$queryRaw<ResetRow[]>`
    SELECT "expiresAt", "usedAt" FROM "PasswordReset" WHERE "token" = ${token} LIMIT 1
  `;
  if (!rows || rows.length === 0) {
    return NextResponse.json({ ok: true, valid: false, error: "Nieznany token" });
  }
  if (rows[0].usedAt) {
    return NextResponse.json({ ok: true, valid: false, error: "Token wykorzystany" });
  }
  if (new Date(rows[0].expiresAt).getTime() < Date.now()) {
    return NextResponse.json({ ok: true, valid: false, error: "Token wygasl" });
  }
  return NextResponse.json({ ok: true, valid: true });
}
