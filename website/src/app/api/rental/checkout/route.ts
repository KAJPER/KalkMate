import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { registerTransaction, paymentUrl } from "@/lib/przelewy24";
import { createPendingRental, depositFor, getRentalPlan } from "@/lib/rentals";

// POST /api/rental/checkout -> { url } (przekierowanie do Przelewy24)
// Body: { planId, name, email, phone, street, postcode, city, pickupPoint,
//         pickupPointAddress, adult: true, terms: true }
// Tylko dostawa w Polsce (Paczkomat), tylko PLN. Platnosc TYLKO BLIK +
// przelewy (bez kart): przy wypozyczeniu karta = ryzyko chargebacku po
// tygodniach, gdy kalkulator jest juz u klienta.
//
// Kanaly P24 (bitmaska): 2 = przelewy, 64 = pay-by-link (szybkie przelewy
// bankow), 8192 = BLIK. Sprawdz w sandboxie P24 po zmianie umowy.
const P24_CHANNEL_NO_CARDS = 2 | 64 | 8192;

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export async function POST(request: NextRequest) {
  const rl = rateLimit(`rental-checkout:${clientIp(request)}`, 8, 60 * 60_000);
  if (!rl.ok) return NextResponse.json({ ok: false, error: "Za dużo prób. Spróbuj za godzinę." }, { status: 429 });

  const b = await request.json().catch(() => ({}));
  const plan = getRentalPlan(b?.planId);
  if (!plan) return NextResponse.json({ ok: false, error: "Wybierz okres najmu." }, { status: 400 });

  const name = str(b?.name, 120);
  const email = str(b?.email, 200).toLowerCase();
  const phone = str(b?.phone, 20).replace(/[\s-]/g, "").replace(/^\+?48/, "");
  const street = str(b?.street, 160);
  const postcode = str(b?.postcode, 6);
  const city = str(b?.city, 80);
  const pickupPoint = str(b?.pickupPoint, 20).toUpperCase();
  const pickupPointAddress = str(b?.pickupPointAddress, 200);

  if (name.split(/\s+/).length < 2) return NextResponse.json({ ok: false, error: "Podaj imię i nazwisko najemcy." }, { status: 400 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return NextResponse.json({ ok: false, error: "Podaj poprawny e-mail." }, { status: 400 });
  if (!/^\d{9}$/.test(phone)) return NextResponse.json({ ok: false, error: "Podaj numer telefonu (9 cyfr) — potrzebny do Paczkomatu." }, { status: 400 });
  if (street.length < 3 || !/^\d{2}-\d{3}$/.test(postcode) || city.length < 2) {
    return NextResponse.json({ ok: false, error: "Podaj pełny adres zamieszkania najemcy." }, { status: 400 });
  }
  if (!/^[A-Z]{3}\d{2,3}[A-Z0-9]*$/.test(pickupPoint) || !pickupPointAddress) {
    return NextResponse.json({ ok: false, error: "Wybierz Paczkomat." }, { status: 400 });
  }
  if (b?.adult !== true) return NextResponse.json({ ok: false, error: "Umowę najmu może zawrzeć tylko osoba pełnoletnia." }, { status: 400 });
  if (b?.terms !== true) return NextResponse.json({ ok: false, error: "Zaakceptuj regulamin wypożyczeń." }, { status: 400 });

  const deposit = depositFor(false);
  const amount = plan.feeGrosze + deposit;
  const sessionId = `km-rent-${randomUUID()}`;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://kalkmate.pl";

  try {
    // Najpierw zapis — webhook P24 musi znalezc najem po sesji (nieoplacony
    // wiersz bez platnosci jest nieszkodliwy; lista w adminie pokazuje go 7 dni).
    await createPendingRental({
      sessionId, plan, depositGrosze: deposit,
      customerName: name, customerEmail: email, customerPhone: phone,
      addressStreet: street, addressPostcode: postcode, addressCity: city,
      pickupPoint, pickupPointAddress,
    });
    const token = await registerTransaction({
      sessionId,
      amount,
      currency: "PLN",
      description: `KalkMate — wypożyczenie ${plan.days} dni + kaucja`,
      email,
      client: name,
      phone,
      address: street,
      zip: postcode,
      city,
      country: "PL",
      language: "pl",
      urlReturn: `${appUrl}/wypozyczenie?p24_session=${encodeURIComponent(sessionId)}`,
      urlStatus: `${appUrl}/api/webhooks/p24`,
      channel: P24_CHANNEL_NO_CARDS,
      regulationAccept: false,
    });
    return NextResponse.json({ ok: true, url: paymentUrl(token) });
  } catch (e) {
    console.error("[api/rental/checkout]", e);
    return NextResponse.json({ ok: false, error: "Nie udało się rozpocząć płatności. Spróbuj ponownie." }, { status: 502 });
  }
}
