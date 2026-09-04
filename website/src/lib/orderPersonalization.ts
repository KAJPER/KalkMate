import { prisma } from "@/lib/db";

// Personalizacja fizycznego zamówienia (kod odblokowania AI wgrywany do TEJ
// konkretnej sztuki przed wysylka + imie/nick na etykiecie) — podstawa dla
// wylaczenia prawa odstapienia od umowy zgodnie z art. 38 pkt 3 ustawy o
// prawach konsumenta ("rzecz ... wyprodukowana wedlug specyfikacji konsumenta
// lub sluzaca zaspokojeniu jego zindywidualizowanych potrzeb"). Kolumny poza
// Prisma schema (jak Device.promptMode, User.tokenBalance) — raw SQL,
// ALTER TABLE wykonywany raz, duplikat kolumny po prostu ignorujemy.
//
// WAZNE: to dziala jako prawna podstawa TYLKO jesli personalizacja jest
// realna — administrator faktycznie wgrywa wybrany kod do tej sztuki i
// drukuje wybrane imie na etykiecie PRZED wyslka. Patrz panel
// /admin/orders — tam widac oba pola do realizacji zamowienia.

let _columnsReady = false;

export async function ensureOrderPersonalizationColumns(): Promise<void> {
  if (_columnsReady) return;
  for (const col of ["personalizedCode", "personalizedName"]) {
    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE "Order" ADD COLUMN "${col}" TEXT`);
    } catch {
      // kolumna juz istnieje — ok
    }
  }
  _columnsReady = true;
}

// Walidacja wspolna dla P24/Stripe route'ow — kod to dokladnie 4 cyfry
// (to samo pole co kalkSettings.aiUnlockCode na urzadzeniu), imie 1-40 znakow.
export function validatePersonalization(unlockCode: unknown, personalizeName: unknown):
  | { ok: true; code: string; name: string }
  | { ok: false; error: string } {
  const code = String(unlockCode ?? "").trim();
  const name = String(personalizeName ?? "").trim();
  if (!/^\d{4}$/.test(code)) {
    return { ok: false, error: "Kod odblokowania AI musi mieć dokładnie 4 cyfry." };
  }
  if (!name || name.length > 40) {
    return { ok: false, error: "Podaj imię/nick do etykiety (max 40 znaków)." };
  }
  return { ok: true, code, name };
}

export async function setOrderPersonalization(orderId: string, code: string, name: string): Promise<void> {
  await ensureOrderPersonalizationColumns();
  await prisma.$executeRaw`
    UPDATE "Order" SET "personalizedCode" = ${code}, "personalizedName" = ${name} WHERE id = ${orderId}
  `;
}
