import { NextRequest, NextResponse } from "next/server";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { getRentalByAccess, prepareRentalPayment, RENTAL_DEPOSIT_GROSZE } from "@/lib/rentals";
import { startRentalPayment } from "@/lib/rentalPayment";

// POST /api/rental/pay { r, t, withDeposit? } -> { url } (Przelewy24)
// Platnosc po weryfikacji Didit (strona powrotu /wypozyczenie?r=&t=).
// Bez kaucji tylko przy identityStatus "approved"; w kazdym innym stanie
// klient moze zaplacic z kaucja (withDeposit: true).
export async function POST(request: NextRequest) {
  const rl = rateLimit(`rental-pay:${clientIp(request)}`, 10, 60 * 60_000);
  if (!rl.ok) return NextResponse.json({ ok: false, error: "Za dużo prób. Spróbuj za godzinę." }, { status: 429 });
  const b = await request.json().catch(() => ({}));
  const rental = await getRentalByAccess(b?.r, b?.t);
  if (!rental) return NextResponse.json({ ok: false, error: "Nie znaleziono wypożyczenia." }, { status: 404 });
  if (rental.status !== "pending") return NextResponse.json({ ok: false, error: "To wypożyczenie jest już opłacone." }, { status: 409 });

  const withDeposit = b?.withDeposit === true;
  if (!withDeposit && rental.identityStatus !== "approved") {
    return NextResponse.json({ ok: false, error: "Weryfikacja tożsamości nie jest zakończona pozytywnie — możesz zapłacić z kaucją." }, { status: 409 });
  }
  try {
    const ready = await prepareRentalPayment(rental, withDeposit ? RENTAL_DEPOSIT_GROSZE : 0);
    if (!ready) return NextResponse.json({ ok: false, error: "To wypożyczenie jest już opłacone." }, { status: 409 });
    return NextResponse.json({ ok: true, url: await startRentalPayment(ready) });
  } catch (e) {
    console.error("[api/rental/pay]", rental.rentalNumber, e);
    return NextResponse.json({ ok: false, error: "Nie udało się rozpocząć płatności. Spróbuj ponownie." }, { status: 502 });
  }
}
