import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, EMAIL_MAX_LENGTH, EMAIL_RE, normalizeEmail } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { clientIp, rateLimit } from "@/lib/rate-limit";

// Kto placi — wspolne dla /api/create-payment-intent (Stripe) i
// /api/p24/create-transaction (Przelewy24).
//
// Zakup bez konta (od 2026-10-28): wczesniej oba endpointy zwracaly 401 bez
// sesji, a przycisk "Zamow" odsylal na /auth/signin (Clarity: ~0 s na tej
// stronie, a nowy klient musial przejsc rejestracje + weryfikacje maila +
// ponowne logowanie). Teraz:
//  - zalogowany ze zweryfikowanym mailem -> email z konta (body ignorowane),
//  - kazdy inny -> gosc, email z formularza. Zamowienie dostaje userId
//    istniejacego zweryfikowanego konta z tym adresem (tak jak fallback po
//    emailu w webhooku Stripe), inaczej null — potwierdzenie maila /
//    logowanie Google podpina je potem po customerEmail (lib/guestOrders.ts).
//
// Podpiecie do cudzego konta niczego nie ujawnia ponad to, co i tak idzie
// mailem z potwierdzeniem na ten sam adres.
// couponOwner — klucz "wlasciciela" rezerwacji kuponu (lib/coupons.ts): przy
// ponownej probie platnosci wlasne niedokonczone rezerwacje sa zwalniane.
// Gosc bez konta nie ma userId, wiec kluczem jest jego email.
export type CheckoutBuyer = { userId: string | null; email: string; guest: boolean; couponOwner: string };

export async function resolveCheckoutBuyer(
  request: NextRequest,
  bodyEmail: unknown,
): Promise<{ ok: true; buyer: CheckoutBuyer } | { ok: false; res: NextResponse }> {
  const session = await getServerSession(authOptions);
  if (session?.user?.email) {
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, email: true, emailVerified: true },
    });
    if (user?.email && user.emailVerified) {
      return { ok: true, buyer: { userId: user.id, email: user.email, guest: false, couponOwner: user.id } };
    }
  }

  // Gosc: limit per IP (tworzenie platnosci to wywolania Stripe/P24 + wiersze
  // w bazie; zalogowanych chroni weryfikacja maila).
  if (!rateLimit(`checkout-guest:${clientIp(request)}`, 10, 10 * 60_000).ok) {
    return {
      ok: false,
      res: NextResponse.json({ error: "Za duzo prob. Sprobuj ponownie za kilka minut." }, { status: 429 }),
    };
  }
  const email = normalizeEmail(bodyEmail);
  if (!email || email.length > EMAIL_MAX_LENGTH || !EMAIL_RE.test(email)) {
    return {
      ok: false,
      res: NextResponse.json({ error: "Podaj poprawny adres email.", reason: "email" }, { status: 400 }),
    };
  }
  // Per adres: kazda proba P24 to zamowienie "pending", a po 3 h idzie na ten
  // adres przypomnienie o platnosci — nie pozwalamy zasypac cudzej skrzynki.
  if (!rateLimit(`checkout-email:${email}`, 6, 60 * 60_000).ok) {
    return {
      ok: false,
      res: NextResponse.json({ error: "Za duzo prob dla tego adresu. Sprobuj ponownie pozniej." }, { status: 429 }),
    };
  }
  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true, emailVerified: true },
  });
  const userId = existing?.emailVerified ? existing.id : null;
  return {
    ok: true,
    buyer: { userId, email, guest: true, couponOwner: userId ?? `guest:${email}` },
  };
}
