import { prisma } from "@/lib/db";

// Podpina zamowienia zlozone bez konta (userId NULL, lib/checkoutBuyer.ts) pod
// konto z tym samym adresem — bez wzgledu na wielkosc liter (starsze
// zamowienia nie byly normalizowane). Wolane po potwierdzeniu maila
// (/api/auth/verify-email) i przy logowaniu Google, czyli gdy wlasciciel
// adresu jest juz sprawdzony. Osobny modul, bo lib/auth.ts tez go uzywa.
export async function linkGuestOrders(userId: string, email: string | null | undefined): Promise<number> {
  const norm = String(email || "").trim().toLowerCase();
  if (!norm) return 0;
  const n = await prisma.$executeRaw`
    UPDATE "Order" SET "userId" = ${userId}
    WHERE "userId" IS NULL AND lower("customerEmail") = ${norm}`;
  return Number(n);
}

// Znacznik w adminNotes zamowienia P24 (gosc zaznaczyl newsletter) — po
// oplaceniu settleP24OrderPayment zapisuje zgode. Stripe: metadata newsletter_consent.
export const GUEST_NEWSLETTER_NOTE = "[NEWSLETTER] Zgoda na newsletter w formularzu zamowienia (gosc, zapis po oplaceniu)";
