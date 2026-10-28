import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { PRODUCT_CENTS } from "@/lib/checkoutPricing";
import {
  AFFILIATE_TIERS,
  BUYER_DISCOUNT_PCT,
  HOLD_DAYS,
  MIN_CASH_PAYOUT_CENTS,
  MIN_TOKEN_REDEEM_CENTS,
  TOKENS_PER_GROSZ,
  affiliateBalance,
  createAffiliateCode,
  getAffiliateForUser,
  listCommissions,
  listPayouts,
  nextTier,
  tierForUnits,
} from "@/lib/affiliates";

// Program partnerski — panel klienta (/panel -> Partner).
// GET: kod, poziom, saldo, historia prowizji i wyplat.
// POST { code }: utworzenie wlasnego kodu (raz na konto).

export const dynamic = "force-dynamic";

async function sessionUser() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) return null;
  return prisma.user.findUnique({ where: { email }, select: { id: true, email: true, emailVerified: true } });
}

// IBAN w odpowiedzi tylko z ostatnimi 4 cyframi.
function maskIban(iban: string | null): string | null {
  if (!iban) return null;
  return `•••• ${iban.slice(-4)}`;
}

export async function GET() {
  try {
    const user = await sessionUser();
    if (!user) return NextResponse.json({ ok: false, error: "Nie zalogowany" }, { status: 401 });

    const aff = await getAffiliateForUser(user.id);
    const [balance, commissions, payouts] = await Promise.all([
      affiliateBalance(user.id),
      aff ? listCommissions(user.id) : Promise.resolve([]),
      aff ? listPayouts(user.id) : Promise.resolve([]),
    ]);
    const now = Date.now();
    const units = balance.units;

    return NextResponse.json({
      ok: true,
      code: aff?.code ?? null,
      active: aff ? !!Number(aff.active) : false,
      tiers: AFFILIATE_TIERS,
      tier: tierForUnits(units),
      next: nextTier(units),
      units,
      balance,
      commissions: commissions.map((c) => ({
        orderNumber: c.orderNumber,
        units: c.units,
        pct: c.pct,
        amountCents: c.amountCents,
        status: c.status === "reversed" ? "reversed" : c.availableAt > now ? "pending" : "available",
        createdAt: c.createdAt,
        availableAt: c.availableAt,
      })),
      payouts: payouts.map((p) => ({
        kind: p.kind,
        amountCents: p.amountCents,
        tokens: p.tokens,
        status: p.status,
        createdAt: p.createdAt,
        processedAt: p.processedAt,
        ...(p.kind === "cash" ? { iban: maskIban(p.iban) } : {}),
      })),
      config: {
        buyerDiscountPct: BUYER_DISCOUNT_PCT,
        holdDays: HOLD_DAYS,
        minCashCents: MIN_CASH_PAYOUT_CENTS,
        minTokenCents: MIN_TOKEN_REDEEM_CENTS,
        tokensPerGrosz: TOKENS_PER_GROSZ,
        productCents: PRODUCT_CENTS.pln,
      },
      shareUrl: aff ? `https://kalkmate.pl/?ref=${aff.code}` : null,
    });
  } catch (e) {
    console.error("[user/affiliate GET]", e);
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await sessionUser();
    if (!user) return NextResponse.json({ ok: false, error: "Nie zalogowany" }, { status: 401 });
    if (!user.emailVerified) {
      return NextResponse.json({ ok: false, error: "Najpierw potwierdz adres e-mail." }, { status: 403 });
    }
    const rl = rateLimit(`affiliate-create:${user.id}`, 10, 60 * 60_000);
    if (!rl.ok) {
      return NextResponse.json(
        { ok: false, error: `Za duzo prob. Sprobuj za ${Math.ceil(rl.resetMs / 60_000)} min.` },
        { status: 429 }
      );
    }
    const body = await request.json().catch(() => ({}));
    const res = await createAffiliateCode(user.id, typeof body?.code === "string" ? body.code : "");
    if (!res.ok) {
      return NextResponse.json(
        { ok: false, reason: res.reason, error: res.error },
        { status: res.reason === "format" ? 400 : 409 }
      );
    }
    return NextResponse.json({ ok: true, code: res.code, shareUrl: `https://kalkmate.pl/?ref=${res.code}` });
  } catch (e) {
    console.error("[user/affiliate POST]", e);
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}
