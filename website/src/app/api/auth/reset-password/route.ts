import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { HASHED_TOKEN_ID_PREFIX, hashMailToken, isMailTokenFormat } from "@/lib/linkTokens";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, bumpSessionVersion, purgeExpiredAuthTokens } from "@/lib/auth";

interface ResetRow {
  id: string;
  userId: string;
  expiresAt: string;
  usedAt: string | null;
}

// Nowe wiersze: "token" = sha256(token) i id z prefiksem HASHED_TOKEN_ID_PREFIX.
// Stare wiersze (sprzed audytu 2026-10-16): token jawnym tekstem, id bez prefiksu.
async function findReset(token: string): Promise<ResetRow | null> {
  const hash = hashMailToken(token);
  const p = HASHED_TOKEN_ID_PREFIX;
  const rows = await prisma.$queryRaw<ResetRow[]>`
    SELECT "id", "userId", "expiresAt", "usedAt"
    FROM "PasswordReset"
    WHERE ("token" = ${hash} AND substr("id", 1, ${p.length}) = ${p})
       OR ("token" = ${token} AND substr("id", 1, ${p.length}) != ${p})
    LIMIT 1
  `;
  return rows?.[0] ?? null;
}

export async function POST(req: NextRequest) {
  try {
    const rl = rateLimit(`reset-pw:${clientIp(req)}`, 5, 15 * 60_000);
    if (!rl.ok) {
      return NextResponse.json(
        { ok: false, error: `Za dużo prób. Spróbuj za ${Math.ceil(rl.resetMs / 60000)} min.` },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => null);
    const token = typeof body?.token === "string" ? body.token.trim() : "";
    const newPassword = typeof body?.password === "string" ? body.password : "";

    if (!isMailTokenFormat(token)) {
      return NextResponse.json({ ok: false, error: "Nieprawidlowy token" }, { status: 400 });
    }
    if (newPassword.length < PASSWORD_MIN_LENGTH) {
      return NextResponse.json(
        { ok: false, error: `Haslo musi miec min. ${PASSWORD_MIN_LENGTH} znakow` },
        { status: 400 }
      );
    }
    if (newPassword.length > PASSWORD_MAX_LENGTH) {
      return NextResponse.json(
        { ok: false, error: `Haslo moze miec max. ${PASSWORD_MAX_LENGTH} znakow` },
        { status: 400 }
      );
    }

    const reset = await findReset(token);
    if (!reset) {
      return NextResponse.json(
        { ok: false, error: "Link wygasl lub jest nieprawidlowy" },
        { status: 400 }
      );
    }
    if (reset.usedAt) {
      return NextResponse.json(
        { ok: false, error: "Link zostal juz wykorzystany" },
        { status: 400 }
      );
    }
    if (new Date(reset.expiresAt).getTime() < Date.now()) {
      return NextResponse.json(
        { ok: false, error: "Link wygasl, popros o nowy" },
        { status: 400 }
      );
    }

    // Hash nowego hasla
    const hash = await bcrypt.hash(newPassword, 10);

    // Zuzycie tokenu ATOMOWO — dwa rownolegle zadania z tym samym linkiem nie
    // ustawia dwoch roznych hasel (wczesniej SELECT, potem osobny UPDATE).
    const consumed = await prisma.$executeRaw`
      UPDATE "PasswordReset"
      SET "usedAt" = ${new Date().toISOString()}
      WHERE "id" = ${reset.id} AND "usedAt" IS NULL
    `;
    if (consumed !== 1) {
      return NextResponse.json(
        { ok: false, error: "Link zostal juz wykorzystany" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({ where: { id: reset.userId }, select: { emailVerified: true } });
    if (!user) {
      return NextResponse.json({ ok: false, error: "Link wygasl lub jest nieprawidlowy" }, { status: 400 });
    }
    await prisma.user.update({
      where: { id: reset.userId },
      // Link z maila dowodzi wlasnosci adresu — konto staje sie zweryfikowane.
      data: { password: hash, ...(user.emailVerified ? {} : { emailVerified: new Date() }) },
    });

    // Pozostale niewykorzystane linki resetu tego konta przestaja dzialac,
    // a wszystkie dotychczasowe sesje (np. kogos, kto znal stare haslo) — tez.
    await prisma.$executeRaw`
      DELETE FROM "PasswordReset" WHERE "userId" = ${reset.userId} AND "usedAt" IS NULL
    `;
    await bumpSessionVersion(reset.userId);
    void purgeExpiredAuthTokens().catch(() => {});

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
  if (!isMailTokenFormat(token)) {
    return NextResponse.json({ ok: true, valid: false, error: "Nieznany token" });
  }

  const reset = await findReset(token);
  if (!reset) {
    return NextResponse.json({ ok: true, valid: false, error: "Nieznany token" });
  }
  if (reset.usedAt) {
    return NextResponse.json({ ok: true, valid: false, error: "Token wykorzystany" });
  }
  if (new Date(reset.expiresAt).getTime() < Date.now()) {
    return NextResponse.json({ ok: true, valid: false, error: "Token wygasl" });
  }
  return NextResponse.json({ ok: true, valid: true });
}
