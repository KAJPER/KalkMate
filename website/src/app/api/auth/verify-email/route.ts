import { NextRequest, NextResponse } from "next/server";
import { linkGuestOrders } from "@/lib/guestOrders";
import { prisma } from "@/lib/db";
import { HASHED_TOKEN_ID_PREFIX, hashMailToken, isMailTokenFormat } from "@/lib/linkTokens";
import { purgeExpiredAuthTokens } from "@/lib/auth";

interface VerifyRow {
  id: string;
  userId: string;
  expiresAt: string;
  verifiedAt: string | null;
  targetEmail: string | null;
}

// Nowe wiersze: "token" = sha256(token) i id z prefiksem HASHED_TOKEN_ID_PREFIX.
// Stare wiersze (sprzed audytu 2026-10-16): token jawnym tekstem, id bez prefiksu.
async function findVerification(token: string): Promise<VerifyRow | null> {
  const hash = hashMailToken(token);
  const p = HASHED_TOKEN_ID_PREFIX;
  const rows = await prisma.$queryRaw<VerifyRow[]>`
    SELECT "id", "userId", "expiresAt", "verifiedAt", "targetEmail"
    FROM "EmailVerification"
    WHERE ("token" = ${hash} AND substr("id", 1, ${p.length}) = ${p})
       OR ("token" = ${token} AND substr("id", 1, ${p.length}) != ${p})
    LIMIT 1
  `;
  return rows?.[0] ?? null;
}

const EMAIL_TAKEN_ERROR = "Ten adres e-mail jest juz uzywany przez inne konto. Zmiana adresu nie zostala wykonana.";

// GET sprawdza status (przed pokazaniem przycisku)
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const token = (url.searchParams.get("token") || "").trim();
  if (!token) return NextResponse.json({ ok: false, valid: false, error: "Brak tokenu" });
  if (!isMailTokenFormat(token)) {
    return NextResponse.json({ ok: true, valid: false, error: "Nieznany token" });
  }

  const row = await findVerification(token);
  if (!row) {
    return NextResponse.json({ ok: true, valid: false, error: "Nieznany token" });
  }
  if (row.verifiedAt) {
    return NextResponse.json({ ok: true, valid: false, alreadyVerified: true });
  }
  if (new Date(row.expiresAt).getTime() < Date.now()) {
    return NextResponse.json({ ok: true, valid: false, error: "Link wygasl" });
  }
  return NextResponse.json({ ok: true, valid: true });
}

// POST faktycznie weryfikuje (klikniecie potwierdz)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const token = typeof body?.token === "string" ? body.token.trim() : "";
    if (!token) return NextResponse.json({ ok: false, error: "Brak tokenu" }, { status: 400 });
    if (!isMailTokenFormat(token)) {
      return NextResponse.json({ ok: false, error: "Nieprawidlowy link" }, { status: 400 });
    }

    const r = await findVerification(token);
    if (!r) {
      return NextResponse.json({ ok: false, error: "Nieprawidlowy link" }, { status: 400 });
    }
    if (r.verifiedAt) {
      return NextResponse.json({ ok: true, alreadyVerified: true });
    }
    if (new Date(r.expiresAt).getTime() < Date.now()) {
      return NextResponse.json({ ok: false, error: "Link wygasl" }, { status: 400 });
    }

    // M8: zmiana e-maila — adres mogl zostac zajety po wyslaniu linku.
    // Sprawdzamy PRZED zuzyciem tokenu (czytelny blad zamiast 500 z P2002).
    if (r.targetEmail) {
      const taken = await prisma.user.findUnique({ where: { email: r.targetEmail }, select: { id: true } });
      if (taken && taken.id !== r.userId) {
        return NextResponse.json({ ok: false, error: EMAIL_TAKEN_ERROR }, { status: 409 });
      }
    }

    // Zuzycie tokenu ATOMOWO (dwa klikniecia naraz = jedna zmiana).
    const consumed = await prisma.$executeRaw`
      UPDATE "EmailVerification" SET "verifiedAt" = ${new Date().toISOString()}
      WHERE "id" = ${r.id} AND "verifiedAt" IS NULL
    `;
    if (consumed !== 1) {
      return NextResponse.json({ ok: true, alreadyVerified: true });
    }

    // M8: jeśli targetEmail ustawiony — to jest potwierdzenie zmiany emaila.
    // Zaktualizuj email i ustaw emailVerified; w przeciwnym razie tylko emailVerified.
    if (r.targetEmail) {
      try {
        await prisma.user.update({
          where: { id: r.userId },
          data: { email: r.targetEmail, emailVerified: new Date() },
        });
      } catch (e: any) {
        if (e?.code === "P2002") {
          // Wyscig: ktos zajal adres miedzy sprawdzeniem a zapisem — oddaj token.
          await prisma.$executeRaw`UPDATE "EmailVerification" SET "verifiedAt" = NULL WHERE "id" = ${r.id}`;
          return NextResponse.json({ ok: false, error: EMAIL_TAKEN_ERROR }, { status: 409 });
        }
        throw e;
      }
      // Pozostale niewykorzystane linki zmiany adresu tego konta — niewazne.
      await prisma.$executeRaw`
        DELETE FROM "EmailVerification"
        WHERE "userId" = ${r.userId} AND "verifiedAt" IS NULL AND "targetEmail" IS NOT NULL
      `;
    } else {
      await prisma.user.update({
        where: { id: r.userId },
        data: { emailVerified: new Date() },
      });
    }
    // Adres potwierdzony — zamowienia zlozone na niego bez konta trafiaja do panelu.
    const verified = await prisma.user.findUnique({ where: { id: r.userId }, select: { email: true } });
    await linkGuestOrders(r.userId, verified?.email).catch((e) => console.error("[verify-email] order link failed:", e));
    void purgeExpiredAuthTokens().catch(() => {});

    return NextResponse.json({ ok: true, emailChanged: !!r.targetEmail });
  } catch (e) {
    console.error("[verify-email]", e);
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}
