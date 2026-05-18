import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

interface VerifyRow {
  id: string;
  userId: string;
  expiresAt: string;
  verifiedAt: string | null;
}

// GET sprawdza status (przed pokazaniem przycisku)
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const token = (url.searchParams.get("token") || "").trim();
  if (!token) return NextResponse.json({ ok: false, valid: false, error: "Brak tokenu" });

  const rows = await prisma.$queryRaw<VerifyRow[]>`
    SELECT "id","userId","expiresAt","verifiedAt"
    FROM "EmailVerification" WHERE "token" = ${token} LIMIT 1
  `;
  if (!rows || rows.length === 0) {
    return NextResponse.json({ ok: true, valid: false, error: "Nieznany token" });
  }
  if (rows[0].verifiedAt) {
    return NextResponse.json({ ok: true, valid: false, alreadyVerified: true });
  }
  if (new Date(rows[0].expiresAt).getTime() < Date.now()) {
    return NextResponse.json({ ok: true, valid: false, error: "Link wygasl" });
  }
  return NextResponse.json({ ok: true, valid: true });
}

// POST faktycznie weryfikuje (klikniecie potwierdz)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const token = String(body?.token || "").trim();
    if (!token) return NextResponse.json({ ok: false, error: "Brak tokenu" }, { status: 400 });

    const rows = await prisma.$queryRaw<VerifyRow[]>`
      SELECT "id","userId","expiresAt","verifiedAt"
      FROM "EmailVerification" WHERE "token" = ${token} LIMIT 1
    `;
    if (!rows || rows.length === 0) {
      return NextResponse.json({ ok: false, error: "Nieprawidlowy link" }, { status: 400 });
    }
    const r = rows[0];
    if (r.verifiedAt) {
      return NextResponse.json({ ok: true, alreadyVerified: true });
    }
    if (new Date(r.expiresAt).getTime() < Date.now()) {
      return NextResponse.json({ ok: false, error: "Link wygasl" }, { status: 400 });
    }

    // Mark user emailVerified + token used
    await prisma.user.update({
      where: { id: r.userId },
      data: { emailVerified: new Date() },
    });
    await prisma.$executeRaw`
      UPDATE "EmailVerification" SET "verifiedAt" = CURRENT_TIMESTAMP WHERE "id" = ${r.id}
    `;

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[verify-email]", e);
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}
