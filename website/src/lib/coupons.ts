import { prisma } from "@/lib/db";
import { randomUUID } from "crypto";
import { affiliateDiscountFor } from "@/lib/affiliates";

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

// reasonCode — do odpowiedzi API (409 {error, reason}):
//   invalid   = nie istnieje / nieaktywny / wygasl (JEDEN komunikat — anty-enumeracja)
//   used_up   = limit uzyc wyczerpany (wliczajac aktywne rezerwacje)
//   currency  = kupon kwotowy (PLN) przy zamowieniu w EUR
//   no_effect = kupon nie obniza ceny
export type CouponReasonCode = "invalid" | "used_up" | "currency" | "no_effect";

export interface DiscountResult {
  ok: boolean;
  reason?: string;          // komunikat bledu (PL) gdy !ok
  reasonCode?: CouponReasonCode;
  discountCents: number;    // ile odjac od ceny produktu (w minor units waluty)
  finalCents: number;       // produkt - rabat (BEZ wysylki)
  coupon?: { code: string; type: "percent" | "fixed"; value: number };
  // Kod partnera (lib/affiliates.ts), nie kupon — bez limitu uzyc/rezerwacji.
  affiliate?: boolean;
}

// Minimalna kwota do pobrania przez Stripe (zeby total nie spadl ponizej progu).
const MIN_CHARGE_CENTS = 200; // ~2 zł / 2 EUR

export const COUPON_INVALID_MSG = "Nieprawidlowy lub nieaktywny kod kuponu.";
export const COUPON_USED_UP_MSG = "Kupon zostal juz wykorzystany.";

// Sama matematyka rabatu (bez sprawdzania active/expiresAt/maxUses) — uzywana
// tez przez webhook do przeliczenia oczekiwanej kwoty juz OPLACONEJ platnosci
// (kupon mogl w miedzyczasie wygasnac — to nie powod, zeby kwota "nie pasowala").
// null = kupon nie ma zastosowania (kwotowy przy EUR).
export function discountForCoupon(
  coupon: Pick<CouponRow, "type" | "value">,
  productCents: number,
  currency: string,
): number | null {
  const cur = (currency || "pln").toLowerCase();
  let discount = 0;
  if (coupon.type === "percent") {
    const pct = Math.max(0, Math.min(100, coupon.value));
    discount = Math.floor((productCents * pct) / 100);
  } else {
    // fixed = grosze (PLN). Dla EUR nie ma sensownego przelicznika — odrzucamy.
    if (cur !== "pln") return null;
    discount = Math.max(0, coupon.value);
  }
  // Rabat nie moze przekroczyc ceny produktu ani zejsc ponizej progu Stripe.
  return Math.min(discount, Math.max(0, productCents - MIN_CHARGE_CENTS));
}

// Oblicza rabat dla danej ceny PRODUKTU (bez wysylki) w danej walucie.
// productCents = cena produktu w groszach (PLN) lub centach (EUR).
// reservedCount = aktywne (niewygasle, nieskonsumowane) rezerwacje INNYCH
// klientow — wliczane do limitu maxUses (patrz CouponReservation nizej).
export function computeDiscount(
  coupon: CouponRow | null,
  productCents: number,
  currency: string,
  reservedCount = 0,
): DiscountResult {
  const noDiscount: DiscountResult = { ok: false, discountCents: 0, finalCents: productCents };
  const invalid: DiscountResult = { ...noDiscount, reason: COUPON_INVALID_MSG, reasonCode: "invalid" };

  if (!coupon) return invalid;
  if (!coupon.active) return invalid;

  if (coupon.expiresAt) {
    // Porownanie po dacie (expiresAt traktujemy jako koniec dnia).
    const exp = new Date(coupon.expiresAt + (coupon.expiresAt.length <= 10 ? "T23:59:59" : ""));
    if (!isNaN(exp.getTime()) && Date.now() > exp.getTime()) return invalid;
  }
  if (coupon.maxUses != null && Number(coupon.usedCount) + reservedCount >= coupon.maxUses) {
    return { ...noDiscount, reason: COUPON_USED_UP_MSG, reasonCode: "used_up" };
  }

  const discount = discountForCoupon(coupon, productCents, currency);
  if (discount === null) {
    return { ...noDiscount, reason: "Kupon kwotowy dziala tylko dla zamowien w PLN.", reasonCode: "currency" };
  }
  const finalCents = productCents - discount;

  return {
    ok: discount > 0,
    reason: discount > 0 ? undefined : "Kupon nie obniza ceny tego zamowienia.",
    reasonCode: discount > 0 ? undefined : "no_effect",
    discountCents: discount,
    finalCents,
    coupon: { code: coupon.code, type: coupon.type, value: coupon.value },
  };
}

// === Rezerwacje kuponow (audyt 2026-10-16) ===
// Wczesniej usedCount rosl dopiero w webhooku, a sprawdzenie bylo przy
// tworzeniu platnosci — kupon jednorazowy mozna bylo uzyc N razy otwierajac N
// platnosci naraz. Teraz przy tworzeniu platnosci zakladamy rezerwacje:
// dostepnosc = usedCount + aktywne rezerwacje < maxUses, sprawdzane i zapisane
// JEDNYM warunkowym INSERT-em (atomowo w SQLite). Webhook po oplaceniu
// konsumuje rezerwacje (usedCount + 1, raz), anulowanie zamowienia ja zwalnia.
//
// ref = orderId (P24) albo id PaymentIntentu (Stripe). Czasy = ms od epoki.
export const COUPON_RESERVATION_TTL_P24_MS = 35 * 24 * 60 * 60 * 1000;   // zamowienie P24 mozna oplacic do 30 dni
export const COUPON_RESERVATION_TTL_STRIPE_MS = 24 * 60 * 60 * 1000;     // PaymentIntent

let _reservationReady = false;
async function ensureCouponReservationTable(): Promise<void> {
  if (_reservationReady) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "CouponReservation" (
      "id"         TEXT PRIMARY KEY,
      "code"       TEXT NOT NULL,
      "ref"        TEXT NOT NULL,
      "userId"     TEXT,
      "expiresAt"  INTEGER NOT NULL,
      "createdAt"  INTEGER NOT NULL,
      "consumedAt" INTEGER,
      "releasedAt" INTEGER
    )`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "CouponReservation_code" ON "CouponReservation" ("code")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "CouponReservation_ref" ON "CouponReservation" ("ref")`);
  _reservationReady = true;
}

// Aktywne rezerwacje kuponu (opcjonalnie bez rezerwacji danego usera — jego
// wlasne i tak zwalniamy przy nowej probie, patrz reserveCoupon).
export async function countActiveReservations(code: string, excludeUserId?: string | null): Promise<number> {
  const norm = normalizeCode(code);
  if (!norm) return 0;
  await ensureCouponReservationTable();
  const now = Date.now();
  const rows = await prisma.$queryRaw<{ n: bigint | number }[]>`
    SELECT COUNT(*) AS n FROM "CouponReservation"
    WHERE "code" = ${norm} AND "consumedAt" IS NULL AND "releasedAt" IS NULL AND "expiresAt" > ${now}
      AND (${excludeUserId ?? null} IS NULL OR "userId" IS NULL OR "userId" <> ${excludeUserId ?? null})`;
  return Number(rows[0]?.n ?? 0);
}

// Walidacja kuponu do zamowienia — z uwzglednieniem rezerwacji innych klientow.
export async function checkCouponForCheckout(
  code: string,
  productCents: number,
  currency: string,
  userId?: string | null,
): Promise<DiscountResult> {
  const coupon = await getCoupon(code);
  if (!coupon) {
    // Nie kupon — moze kod partnera (to samo pole w formularzu). userId =
    // buyer.couponOwner (userId albo "guest:email") — wlasnego kodu nie wolno.
    const aff = await affiliateDiscountFor(code, userId);
    if (aff?.ok) {
      const res = computeDiscount(
        { id: "", createdAt: "", code: aff.code, type: "percent", value: aff.pct, active: 1, maxUses: null, usedCount: 0, expiresAt: null } as CouponRow,
        productCents, currency, 0,
      );
      return { ...res, affiliate: res.ok };
    }
    if (aff && !aff.ok && aff.self) {
      return { ok: false, reason: "Nie mozesz uzyc wlasnego kodu partnerskiego.", reasonCode: "invalid", discountCents: 0, finalCents: productCents };
    }
  }
  const reserved = coupon && coupon.maxUses != null ? await countActiveReservations(coupon.code, userId) : 0;
  return computeDiscount(coupon, productCents, currency, reserved);
}

// Atomowa rezerwacja. Zwraca id rezerwacji albo null (limit wyczerpany /
// kupon nieaktywny). Wczesniejsze, niedokonczone rezerwacje TEGO SAMEGO usera
// na ten kod sa zwalniane — inaczej powrot do formularza i ponowna proba
// platnosci blokowalaby kupon jednorazowy na 1-35 dni.
export async function reserveCoupon(opts: {
  code: string;
  ref: string;
  userId?: string | null;
  ttlMs: number;
  id?: string;
}): Promise<string | null> {
  const norm = normalizeCode(opts.code);
  if (!norm) return null;
  await ensureCouponTable();
  await ensureCouponReservationTable();
  const now = Date.now();
  const id = opts.id || randomUUID();
  if (opts.userId) {
    await prisma.$executeRaw`
      UPDATE "CouponReservation" SET "releasedAt" = ${now}
      WHERE "code" = ${norm} AND "userId" = ${opts.userId} AND "consumedAt" IS NULL AND "releasedAt" IS NULL`;
  }
  const inserted = await prisma.$executeRaw`
    INSERT INTO "CouponReservation" ("id", "code", "ref", "userId", "expiresAt", "createdAt")
    SELECT ${id}, c.code, ${opts.ref}, ${opts.userId ?? null}, ${now + opts.ttlMs}, ${now}
    FROM Coupon c
    WHERE c.code = ${norm} AND c.active = 1
      AND (c.maxUses IS NULL OR c.usedCount + (
        SELECT COUNT(*) FROM "CouponReservation" r
        WHERE r."code" = c.code AND r."consumedAt" IS NULL AND r."releasedAt" IS NULL AND r."expiresAt" > ${now}
      ) < c.maxUses)`;
  return Number(inserted) === 1 ? id : null;
}

// Po utworzeniu PaymentIntentu podmieniamy ref na jego id (do wgladu/konsumpcji).
export async function setCouponReservationRef(id: string, ref: string): Promise<void> {
  await ensureCouponReservationTable();
  await prisma.$executeRaw`UPDATE "CouponReservation" SET "ref" = ${ref} WHERE "id" = ${id}`;
}

// Zwolnienie rezerwacji (anulowane zamowienie / nieudane utworzenie platnosci).
export async function releaseCouponReservation(opts: { ref?: string; id?: string }): Promise<void> {
  if (!opts.ref && !opts.id) return;
  await ensureCouponReservationTable();
  const now = Date.now();
  await prisma.$executeRaw`
    UPDATE "CouponReservation" SET "releasedAt" = ${now}
    WHERE ("id" = ${opts.id ?? ""} OR "ref" = ${opts.ref ?? ""})
      AND "consumedAt" IS NULL AND "releasedAt" IS NULL`;
}

// Zliczenie uzycia OPLACONEGO zamowienia: konsumuje rezerwacje i podbija
// usedCount dokladnie raz (powtorzony webhook nic nie dolicza). Rezerwacja
// wygasla/zwolniona tez jest konsumowana — platnosc juz jest, nie odrzucamy jej.
// Brak rezerwacji (platnosc utworzona przed wdrozeniem rezerwacji) = zwykle
// +1; idempotencje zapewnia wtedy wywolujacy (zamowienie tworzone/oplacane raz).
export async function consumeCouponUsage(opts: { code: string; reservationId?: string | null; ref?: string | null }): Promise<void> {
  const norm = normalizeCode(opts.code);
  if (!norm) return;
  await ensureCouponTable();
  await ensureCouponReservationTable();
  const rid = opts.reservationId || "";
  const ref = opts.ref || "";
  const now = Date.now();
  await prisma.$transaction(async (tx) => {
    // Najpierw zapis (blokada zapisu od razu, bez "read -> upgrade" w SQLite).
    const consumed = await tx.$executeRaw`
      UPDATE "CouponReservation" SET "consumedAt" = ${now}
      WHERE "code" = ${norm} AND ("id" = ${rid} OR "ref" = ${ref}) AND "consumedAt" IS NULL`;
    if (Number(consumed) > 0) {
      await tx.$executeRaw`UPDATE Coupon SET usedCount = usedCount + 1 WHERE code = ${norm}`;
      return;
    }
    const existing = await tx.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "CouponReservation" WHERE "code" = ${norm} AND ("id" = ${rid} OR "ref" = ${ref}) LIMIT 1`;
    if (existing.length === 0) {
      await tx.$executeRaw`UPDATE Coupon SET usedCount = usedCount + 1 WHERE code = ${norm}`;
    }
    // else: juz skonsumowana — powtorzone powiadomienie, nic nie robimy
  });
}

// Zlicza uzycie kuponu po oplaceniu. H11: atomowe — nie przekroczy maxUses
// nawet przy równoczesnych żądaniach (wyścig CHECK→webhook).
// (Stara sciezka bez rezerwacji — webhooki uzywaja juz consumeCouponUsage.)
export async function incrementCouponUsage(code: string): Promise<void> {
  const norm = normalizeCode(code);
  if (!norm) return;
  await ensureCouponTable();
  await prisma.$executeRaw`
    UPDATE Coupon
    SET usedCount = usedCount + 1
    WHERE code = ${norm}
      AND (maxUses IS NULL OR usedCount < maxUses)
  `;
}

// === Kupon przypisany do zamowienia P24 ===
// Stripe niesie kod kuponu w metadata PaymentIntentu (webhook Stripe zlicza
// uzycie). Zamowienie P24 powstaje przed platnoscia i nie mialo gdzie zapisac
// kodu, wiec uzycia z BLIK/przelewu NIE byly zliczane — kupon z limitem dzialal
// bez limitu. Teraz: kod zapisany przy zamowieniu, zliczany w webhooku P24.
let _orderCouponReady = false;
async function ensureOrderCouponTable(): Promise<void> {
  if (_orderCouponReady) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "OrderCoupon" (
      "orderId"       TEXT PRIMARY KEY,
      "code"          TEXT NOT NULL,
      "discountCents" INTEGER NOT NULL DEFAULT 0
    )`);
  _orderCouponReady = true;
}

export async function setOrderCoupon(orderId: string, code: string, discountCents: number): Promise<void> {
  await ensureOrderCouponTable();
  await prisma.$executeRaw`
    INSERT OR REPLACE INTO "OrderCoupon" ("orderId", "code", "discountCents") VALUES (${orderId}, ${code}, ${discountCents})`;
}

export async function getOrderCoupon(orderId: string): Promise<{ code: string; discountCents: number } | null> {
  await ensureOrderCouponTable();
  const rows = await prisma.$queryRaw<{ code: string; discountCents: number }[]>`
    SELECT "code", "discountCents" FROM "OrderCoupon" WHERE "orderId" = ${orderId}`;
  return rows[0] ?? null;
}

// Statystyki per kupon z OrderCoupon (Stripe + P24) — tylko oplacone zamowienia.
// Przychod/rabat osobno per waluta (PLN i EUR sie nie sumuja).
export interface CouponStats {
  paidOrders: number;
  unpaidOrders: number;
  byCurrency: Record<string, { revenueCents: number; discountCents: number }>;
  lastUsedAt: number | null;
}

export async function getCouponStats(): Promise<Record<string, CouponStats>> {
  await ensureOrderCouponTable();
  const rows = await prisma.$queryRaw<{
    code: string; currency: string; paid: number; n: bigint | number;
    revenue: bigint | number | null; discount: bigint | number | null; last: bigint | number | string | null;
  }[]>`
    SELECT oc."code" AS code, LOWER(o."currency") AS currency,
           CASE WHEN o."status" = 'paid' THEN 1 ELSE 0 END AS paid,
           COUNT(*) AS n, SUM(o."amount") AS revenue, SUM(oc."discountCents") AS discount,
           MAX(CASE WHEN typeof(o."createdAt") = 'integer' THEN o."createdAt"
                    ELSE CAST(strftime('%s', o."createdAt") AS INTEGER) * 1000 END) AS last
    FROM "OrderCoupon" oc JOIN "Order" o ON o."id" = oc."orderId"
    GROUP BY oc."code", LOWER(o."currency"), paid`;
  const out: Record<string, CouponStats> = {};
  for (const r of rows) {
    const s = (out[r.code] ??= { paidOrders: 0, unpaidOrders: 0, byCurrency: {}, lastUsedAt: null });
    const n = Number(r.n);
    if (!r.paid) { s.unpaidOrders += n; continue; }
    s.paidOrders += n;
    const c = (s.byCurrency[r.currency] ??= { revenueCents: 0, discountCents: 0 });
    c.revenueCents += Number(r.revenue ?? 0);
    c.discountCents += Number(r.discount ?? 0);
    const last = r.last == null ? null : Number(r.last);
    if (last && (!s.lastUsedAt || last > s.lastUsedAt)) s.lastUsedAt = last;
  }
  return out;
}
