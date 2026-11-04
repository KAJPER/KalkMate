import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { createPendingRental, depositFor, getRentalPlan, setRentalIdentityPending } from "@/lib/rentals";
import { appUrl, startRentalPayment } from "@/lib/rentalPayment";
import { createDiditSession, diditConfigured } from "@/lib/didit";

// POST /api/rental/checkout -> { url }
// Body: { planId, name, email, phone, street, postcode, city, pickupPoint,
//         pickupPointAddress, adult: true, terms: true,
//         mode?: "deposit" | "identity", biometricConsent?: true }
// mode "deposit" (domyslnie): od razu Przelewy24 (najem + kaucja 300 zl).
// mode "identity": najpierw weryfikacja tozsamosci w Didit (dowod + selfie),
//   potem /api/rental/pay — bez kaucji, jesli dowod zgadza sie z najemca.
// Tylko dostawa w Polsce (Paczkomat), tylko PLN, tylko BLIK + przelewy
// (lib/rentalPayment.ts).

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
  const identity = b?.mode === "identity";

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
  if (identity) {
    if (!diditConfigured()) return NextResponse.json({ ok: false, error: "Weryfikacja tożsamości jest chwilowo niedostępna — wybierz wariant z kaucją." }, { status: 503 });
    if (b?.biometricConsent !== true) {
      return NextResponse.json({ ok: false, error: "Wyraź zgodę na weryfikację tożsamości (zdjęcie dokumentu i selfie)." }, { status: 400 });
    }
  }

  try {
    // Najpierw zapis — webhook P24 musi znalezc najem po sesji (nieoplacony
    // wiersz bez platnosci jest nieszkodliwy; lista w adminie pokazuje go 7 dni).
    const rental = await createPendingRental({
      sessionId: `km-rent-${randomUUID()}`, plan, depositGrosze: depositFor(identity),
      customerName: name, customerEmail: email, customerPhone: phone,
      addressStreet: street, addressPostcode: postcode, addressCity: city,
      pickupPoint, pickupPointAddress,
    });
    if (!identity) return NextResponse.json({ ok: true, url: await startRentalPayment(rental) });

    const parts = name.split(/\s+/);
    const didit = await createDiditSession({
      vendorData: rental.id,
      callback: `${appUrl()}/wypozyczenie?r=${rental.id}&t=${rental.accessToken}`,
      firstName: parts.slice(0, -1).join(" "),
      lastName: parts[parts.length - 1],
      email,
    });
    await setRentalIdentityPending(rental.id, didit.sessionId);
    return NextResponse.json({ ok: true, url: didit.url });
  } catch (e) {
    console.error("[api/rental/checkout]", e);
    return NextResponse.json({ ok: false, error: identity ? "Nie udało się rozpocząć weryfikacji. Spróbuj ponownie albo wybierz wariant z kaucją." : "Nie udało się rozpocząć płatności. Spróbuj ponownie." }, { status: 502 });
  }
}
