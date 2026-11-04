// Rejestracja platnosci Przelewy24 za wypozyczenie (lib/rentals.ts) — wspolne
// dla /api/rental/checkout (z kaucja) i /api/rental/pay (po weryfikacji Didit).
import { registerTransaction, paymentUrl } from "@/lib/przelewy24";
import type { RentalRow } from "@/lib/rentals";

// Kanaly P24 (bitmaska): 2 = przelewy, 64 = pay-by-link (szybkie przelewy
// bankow), 8192 = BLIK — bez kart, wiec bez chargebackow po tygodniach,
// gdy kalkulator jest juz u klienta. Sprawdz w sandboxie P24 po zmianie umowy.
const P24_CHANNEL_NO_CARDS = 2 | 64 | 8192;

export function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || "https://kalkmate.pl";
}

export async function startRentalPayment(rental: RentalRow): Promise<string> {
  const token = await registerTransaction({
    sessionId: rental.sessionId,
    amount: rental.feeGrosze + rental.depositGrosze,
    currency: "PLN",
    description: rental.depositGrosze
      ? `KalkMate — wypożyczenie ${rental.days} dni + kaucja`
      : `KalkMate — wypożyczenie ${rental.days} dni`,
    email: rental.customerEmail,
    client: rental.customerName,
    phone: rental.customerPhone,
    address: rental.addressStreet,
    zip: rental.addressPostcode,
    city: rental.addressCity,
    country: "PL",
    language: "pl",
    urlReturn: `${appUrl()}/wypozyczenie?p24_session=${encodeURIComponent(rental.sessionId)}`,
    urlStatus: `${appUrl()}/api/webhooks/p24`,
    channel: P24_CHANNEL_NO_CARDS,
    regulationAccept: false,
  });
  return paymentUrl(token);
}
