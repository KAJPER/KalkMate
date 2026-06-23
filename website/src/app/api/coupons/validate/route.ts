import { NextRequest, NextResponse } from "next/server";
import { getCoupon, computeDiscount } from "@/lib/coupons";

// Cena produktu (bez wysylki) zalezna od waluty — zrodlo prawdy po stronie serwera,
// musi byc spojne z create-payment-intent.
function productCentsFor(currency: string): number {
  return currency.toLowerCase() === "eur" ? 16900 : 69900;
}

// POST /api/coupons/validate — podglad rabatu w sklepie (nie pobiera platnosci).
// Body: { code: string, currency?: 'pln'|'eur' }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const code = String(body?.code || "");
    const currency = (String(body?.currency || "pln")).toLowerCase();
    if (!code.trim()) {
      return NextResponse.json({ ok: false, error: "Podaj kod kuponu." }, { status: 400 });
    }

    const productCents = productCentsFor(currency);
    const coupon = await getCoupon(code);
    const res = computeDiscount(coupon, productCents, currency);

    if (!res.ok) {
      return NextResponse.json({ ok: false, error: res.reason || "Nieprawidlowy kupon." });
    }

    return NextResponse.json({
      ok: true,
      code: res.coupon!.code,
      type: res.coupon!.type,
      value: res.coupon!.value,
      discountCents: res.discountCents,
      finalCents: res.finalCents,
      currency,
    });
  } catch (e) {
    console.error("[coupons/validate]", e);
    return NextResponse.json({ ok: false, error: "Blad serwera." }, { status: 500 });
  }
}
