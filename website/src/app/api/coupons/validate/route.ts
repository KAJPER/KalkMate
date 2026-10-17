import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { checkCouponForCheckout } from "@/lib/coupons";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { PRODUCT_CENTS, currencyForCountry, parseOrderQuantity, type CheckoutCurrency } from "@/lib/checkoutPricing";

// POST /api/coupons/validate — podglad rabatu w sklepie (nie pobiera platnosci).
// Body: { code: string, country?: string, currency?: 'pln'|'eur', quantity?: 1..5 }
// Cena produktu z lib/checkoutPricing.ts (spojna z create-payment-intent i
// p24/create-transaction). Waluta: z kraju gdy podany (K1), inaczej z
// `currency` (stary front) — tylko pln/eur.
// Komunikaty: nieistniejacy / nieaktywny / wygasly = JEDEN ogolny komunikat
// (anty-enumeracja kodow), "wykorzystany" osobno.
export async function POST(req: NextRequest) {
  try {
    // Rate limit per IP: 10 prob/min — zgadywanie kodow kuponow.
    const rl = rateLimit(`coupon-validate:${clientIp(req)}`, 10, 60_000);
    if (!rl.ok) {
      return NextResponse.json(
        { ok: false, error: `Za duzo prob. Sprobuj za ${Math.ceil(rl.resetMs / 1000)}s.` },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const code = String(body?.code || "");
    if (!code.trim()) {
      return NextResponse.json({ ok: false, error: "Podaj kod kuponu." }, { status: 400 });
    }

    let currency: CheckoutCurrency;
    if (body?.country) {
      currency = currencyForCountry(body.country);
    } else {
      const c = String(body?.currency || "pln").trim().toLowerCase();
      currency = c === "eur" ? "eur" : "pln";
    }

    // Wlasne rezerwacje zalogowanego klienta (poprzednia proba platnosci) nie
    // licza sie do limitu — i tak zwolnimy je przy nowej platnosci.
    let userId: string | null = null;
    try {
      const session = await getServerSession(authOptions);
      if (session?.user?.email) {
        const u = await prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true } });
        userId = u?.id ?? null;
      }
    } catch {
      userId = null;
    }

    // Ilosc sztuk (opcjonalna, brak = 1) — rabat liczony od calego subtotalu,
    // tak samo jak w quoteCheckout (create-payment-intent / p24).
    const q = parseOrderQuantity(body?.quantity);
    if (!q.ok) {
      return NextResponse.json({ ok: false, error: q.error, reason: "quantity" }, { status: 400 });
    }
    const quantity = q.quantity;
    const unitCents = PRODUCT_CENTS[currency];
    const subtotalCents = unitCents * quantity;
    const res = await checkCouponForCheckout(code, subtotalCents, currency, userId);

    if (!res.ok) {
      return NextResponse.json({ ok: false, error: res.reason || "Nieprawidlowy kupon.", reason: res.reasonCode || "invalid" });
    }

    return NextResponse.json({
      ok: true,
      code: res.coupon!.code,
      type: res.coupon!.type,
      value: res.coupon!.value,
      discountCents: res.discountCents,
      finalCents: res.finalCents, // subtotal - rabat (BEZ wysylki)
      currency,
      quantity,
      unitCents,
      subtotalCents,
    });
  } catch (e) {
    console.error("[coupons/validate]", e);
    return NextResponse.json({ ok: false, error: "Blad serwera." }, { status: 500 });
  }
}
