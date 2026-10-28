import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { alertAdmin } from "@/lib/checkoutPricing";
import { affiliateBalance, getAffiliateForUser, normalizeIban, redeemAffiliate } from "@/lib/affiliates";

// POST /api/user/affiliate/redeem
// Body: { kind: "tokens" | "cash", amountCents, iban?, holder?, adult? }
// Tokeny trafiaja na konto od razu; wyplata na konto = zlecenie dla admina
// (/admin/partnerzy, przelew reczny).

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const email = session?.user?.email;
    if (!email) return NextResponse.json({ ok: false, error: "Nie zalogowany" }, { status: 401 });
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true, emailVerified: true } });
    if (!user) return NextResponse.json({ ok: false, error: "Nie zalogowany" }, { status: 401 });
    if (!user.emailVerified) {
      return NextResponse.json({ ok: false, error: "Najpierw potwierdz adres e-mail." }, { status: 403 });
    }

    const rl = rateLimit(`affiliate-redeem:${user.id}`, 10, 10 * 60_000);
    if (!rl.ok) {
      return NextResponse.json(
        { ok: false, error: `Za duzo prob. Sprobuj za ${Math.ceil(rl.resetMs / 1000)}s.` },
        { status: 429 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const kind = body?.kind === "cash" ? "cash" : body?.kind === "tokens" ? "tokens" : null;
    if (!kind) return NextResponse.json({ ok: false, error: "Nieprawidlowy rodzaj wyplaty." }, { status: 400 });

    // Bez kodu nie ma prowizji — nie ma czego wyplacac.
    if (!(await getAffiliateForUser(user.id))) {
      return NextResponse.json({ ok: false, error: "Nie masz kodu partnerskiego." }, { status: 400 });
    }

    const res = await redeemAffiliate(user.id, {
      kind,
      amountCents: Number(body?.amountCents),
      iban: body?.iban,
      holder: body?.holder,
      adult: body?.adult,
    });
    if (!res.ok) {
      return NextResponse.json({ ok: false, reason: res.reason, error: res.error }, { status: 400 });
    }

    if (kind === "cash") {
      const amount = Math.floor(Number(body?.amountCents));
      const zl = (amount / 100).toFixed(2);
      const holder = typeof body?.holder === "string" ? body.holder.trim().slice(0, 120) : "";
      await alertAdmin(`Program partnerski: wyplata ${zl} zl`, [
        `Uzytkownik: ${user.email}`,
        `Kwota: ${zl} zl`,
        `Wlasciciel konta: ${holder}`,
        `IBAN: ${normalizeIban(body?.iban) ?? ""}`,
        `ID zlecenia: ${res.payoutId}`,
        "",
        "https://kalkmate.pl/admin/partnerzy",
      ]);
    }

    let tokenBalance: number | null = null;
    if (res.tokens) {
      // tokenBalance to kolumna raw (poza schema Prisma)
      const rows = await prisma.$queryRaw<{ tokenBalance: bigint | number | null }[]>`
        SELECT "tokenBalance" FROM "User" WHERE "id" = ${user.id} LIMIT 1`.catch(() => []);
      tokenBalance = rows[0]?.tokenBalance != null ? Number(rows[0].tokenBalance) : null;
    }

    return NextResponse.json({
      ok: true,
      kind,
      payoutId: res.payoutId,
      tokens: res.tokens ?? null,
      tokenBalance,
      balance: await affiliateBalance(user.id),
    });
  } catch (e) {
    console.error("[user/affiliate/redeem]", e);
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}
