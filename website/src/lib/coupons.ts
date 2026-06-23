import { prisma } from "@/lib/db";

// Coupon NIE jest w Prisma schemie (kolumny tylko w sqlite) — wszystko raw SQL,
// wzorem tabeli Inventory. Tabela tworzona lazy przez ensureCouponTable().
//
// type:  'percent' = rabat procentowy (value = 1..100)
//        'fixed'   = rabat kwotowy w GROSZACH (value = np. 5000 = 50 zł), tylko PLN
// value: jak wyzej
// maxUses: NULL = bez limitu; inaczej max liczba uzyc
// usedCount: zliczane po OPLACENIU (webhook), nie przy probie
// expiresAt: ISO string (np. "2026-12-31") lub NULL

export interface CouponRow {
  id: string;
  code: string;
  type: "percent" | "fixed";
  value: number;
  active: number; // 0/1 (sqlite boolean)
  maxUses: number | null;
  usedCount: number;
  expiresAt: string | null;
  createdAt: string;
}

let _tableReady = false;

export async function ensureCouponTable(): Promise<void> {
  if (_tableReady) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS Coupon (
      id        TEXT PRIMARY KEY,
      code      TEXT UNIQUE NOT NULL,
      type      TEXT NOT NULL DEFAULT 'percent',
      value     INTEGER NOT NULL DEFAULT 0,
      active    INTEGER NOT NULL DEFAULT 1,
      maxUses   INTEGER,
      usedCount INTEGER NOT NULL DEFAULT 0,
      expiresAt TEXT,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  _tableReady = true;
}

// Normalizacja kodu: wielkie litery, bez spacji/bialych znakow.
export function normalizeCode(code: string): string {
  return String(code || "").toUpperCase().replace(/\s+/g, "").trim();
}

export async function getCoupon(code: string): Promise<CouponRow | null> {
  await ensureCouponTable();
  const norm = normalizeCode(code);
  if (!norm) return null;
  const rows = await prisma.$queryRaw<CouponRow[]>`
    SELECT id, code, type, value, active, maxUses, usedCount, expiresAt, createdAt
    FROM Coupon WHERE code = ${norm} LIMIT 1
  `;
  return rows[0] || null;
}

export interface DiscountResult {
  ok: boolean;
  reason?: string;          // komunikat bledu (PL) gdy !ok
  discountCents: number;    // ile odjac od ceny produktu (w minor units waluty)
  finalCents: number;       // produkt - rabat (BEZ wysylki)
  coupon?: { code: string; type: "percent" | "fixed"; value: number };
}

// Minimalna kwota do pobrania przez Stripe (zeby total nie spadl ponizej progu).
const MIN_CHARGE_CENTS = 200; // ~2 zł / 2 EUR

// Oblicza rabat dla danej ceny PRODUKTU (bez wysylki) w danej walucie.
// productCents = cena produktu w groszach (PLN) lub centach (EUR).
export function computeDiscount(
  coupon: CouponRow | null,
  productCents: number,
  currency: string,
): DiscountResult {
  const cur = (currency || "pln").toLowerCase();
  const noDiscount: DiscountResult = { ok: false, discountCents: 0, finalCents: productCents };

  if (!coupon) return { ...noDiscount, reason: "Kupon nie istnieje." };
  if (!coupon.active) return { ...noDiscount, reason: "Kupon jest nieaktywny." };

  if (coupon.expiresAt) {
    // Porownanie po dacie (expiresAt traktujemy jako koniec dnia).
    const exp = new Date(coupon.expiresAt + (coupon.expiresAt.length <= 10 ? "T23:59:59" : ""));
    if (!isNaN(exp.getTime()) && Date.now() > exp.getTime()) {
      return { ...noDiscount, reason: "Kupon wygasl." };
    }
  }
  if (coupon.maxUses != null && coupon.usedCount >= coupon.maxUses) {
    return { ...noDiscount, reason: "Kupon zostal juz wykorzystany." };
  }

  let discount = 0;
  if (coupon.type === "percent") {
    const pct = Math.max(0, Math.min(100, coupon.value));
    discount = Math.floor((productCents * pct) / 100);
  } else {
    // fixed = grosze (PLN). Dla EUR nie ma sensownego przelicznika — odrzucamy.
    if (cur !== "pln") {
      return { ...noDiscount, reason: "Kupon kwotowy dziala tylko dla zamowien w PLN." };
    }
    discount = Math.max(0, coupon.value);
  }

  // Rabat nie moze przekroczyc ceny produktu ani zejsc ponizej progu Stripe.
  discount = Math.min(discount, Math.max(0, productCents - MIN_CHARGE_CENTS));
  const finalCents = productCents - discount;

  return {
    ok: discount > 0,
    reason: discount > 0 ? undefined : "Kupon nie obniza ceny tego zamowienia.",
    discountCents: discount,
    finalCents,
    coupon: { code: coupon.code, type: coupon.type, value: coupon.value },
  };
}

// Zlicza uzycie kuponu (po oplaceniu). Bezpieczne gdy kod nie istnieje.
export async function incrementCouponUsage(code: string): Promise<void> {
  const norm = normalizeCode(code);
  if (!norm) return;
  await ensureCouponTable();
  await prisma.$executeRaw`
    UPDATE Coupon SET usedCount = usedCount + 1 WHERE code = ${norm}
  `;
}
