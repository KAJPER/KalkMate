import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";

// ============================================================================
// Program partnerski (od 2026-10-28)
// ============================================================================
// Klient tworzy w panelu wlasny kod. Kupujacy wpisuje go w polu "Kod rabatowy"
// (to samo pole co kupony — lib/coupons.ts checkCouponForCheckout probuje
// najpierw Coupon, potem kod partnera) i dostaje BUYER_DISCOUNT_PCT rabatu.
// Po OPLACENIU zamowienia (webhook Stripe / settleP24OrderPayment) wlasciciel
// kodu dostaje prowizje — procent zalezy od poziomu (liczba sprzedanych sztuk).
// Prowizja jest "w drodze" przez HOLD_DAYS (reklamacje, chargebacki), potem
// "dostepna": wymiana na tokeny AI (od razu, z bonusem) albo wyplata na konto
// (zlecenie, admin przelewa recznie — /admin/partnerzy).
// Anulowanie zamowienia (zwrot pieniedzy) / zwrot w Stripe / spor = prowizja
// cofnieta. Saldo moze zejsc ponizej zera, jesli cofnieto juz wymieniona
// prowizje — kolejne prowizje to wyrownaja.
//
// Kwoty programu zawsze w groszach PLN (zamowienia EUR przeliczane po
// EUR_TO_PLN), zeby partner mial jedno saldo.
//
// Tabele raw (poza schema Prisma, jak Coupon): AffiliateCode,
// AffiliateCommission, AffiliatePayout. Czasy w ms jako BIGINT — przy INTEGER
// Prisma $queryRaw czyta kolumne jako 32-bit i wywraca sie na znaczniku czasu.

export const BUYER_DISCOUNT_PCT = 7;
export const HOLD_DAYS = 30;
export const MIN_CASH_PAYOUT_CENTS = 10000; // 100 zl
export const MIN_TOKEN_REDEEM_CENTS = 1000; // 10 zl
export const EUR_TO_PLN = 4.25;
// 1 grosz prowizji = 650 tokenow AI. Najtanszy pakiet (tok_10m) to ~503
// tokenow/grosz, wiec wymiana na tokeny daje ok. +30% wiecej niz zakup.
export const TOKENS_PER_GROSZ = 650;

export interface AffiliateTier {
  key: "start" | "bronze" | "silver" | "gold" | "diamond";
  minUnits: number; // od ilu sprzedanych sztuk (lacznie, bez cofnietych)
  pct: number; // prowizja od kwoty za produkty (po rabacie, bez wysylki)
}

export const AFFILIATE_TIERS: AffiliateTier[] = [
  { key: "start", minUnits: 0, pct: 5 },
  { key: "bronze", minUnits: 3, pct: 7 },
  { key: "silver", minUnits: 10, pct: 9 },
  { key: "gold", minUnits: 25, pct: 11 },
  { key: "diamond", minUnits: 50, pct: 13 },
];

export function tierForUnits(units: number): AffiliateTier {
  let t = AFFILIATE_TIERS[0];
  for (const tier of AFFILIATE_TIERS) if (units >= tier.minUnits) t = tier;
  return t;
}

export function nextTier(units: number): AffiliateTier | null {
  return AFFILIATE_TIERS.find((t) => t.minUnits > units) ?? null;
}

// 4-16 znakow A-Z0-9 (bez myslnikow — czytelne do podyktowania).
export const AFFILIATE_CODE_RE = /^[A-Z0-9]{4,16}$/;
export function normalizeAffiliateCode(v: unknown): string {
  return typeof v === "string" ? v.trim().toUpperCase().replace(/\s+/g, "") : "";
}

// ---------------------------------------------------------------------------
// Tabele
// ---------------------------------------------------------------------------
let _ready = false;
export async function ensureAffiliateTables(): Promise<void> {
  if (_ready) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "AffiliateCode" (
      "code"      TEXT PRIMARY KEY,
      "userId"    TEXT NOT NULL UNIQUE,
      "active"    INTEGER NOT NULL DEFAULT 1,
      "createdAt" BIGINT NOT NULL
    )`);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "AffiliateCommission" (
      "id"          TEXT PRIMARY KEY,
      "orderId"     TEXT NOT NULL UNIQUE,
      "orderNumber" TEXT,
      "code"        TEXT NOT NULL,
      "userId"      TEXT NOT NULL,
      "units"       INTEGER NOT NULL,
      "baseCents"   INTEGER NOT NULL,
      "pct"         INTEGER NOT NULL,
      "amountCents" INTEGER NOT NULL,
      "status"      TEXT NOT NULL DEFAULT 'earned',
      "availableAt" BIGINT NOT NULL,
      "createdAt"   BIGINT NOT NULL,
      "reversedAt"  BIGINT,
      "note"        TEXT
    )`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "AffiliateCommission_userId" ON "AffiliateCommission" ("userId")`);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "AffiliatePayout" (
      "id"          TEXT PRIMARY KEY,
      "userId"      TEXT NOT NULL,
      "kind"        TEXT NOT NULL,
      "amountCents" INTEGER NOT NULL,
      "tokens"      INTEGER,
      "status"      TEXT NOT NULL,
      "iban"        TEXT,
      "holder"      TEXT,
      "createdAt"   BIGINT NOT NULL,
      "processedAt" BIGINT,
      "note"        TEXT
    )`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "AffiliatePayout_userId" ON "AffiliatePayout" ("userId")`);
  _ready = true;
}

// ---------------------------------------------------------------------------
// Kody
// ---------------------------------------------------------------------------
export interface AffiliateCodeRow { code: string; userId: string; active: number; createdAt: number }

export async function getAffiliateByCode(code: string): Promise<AffiliateCodeRow | null> {
  const norm = normalizeAffiliateCode(code);
  if (!norm) return null;
  await ensureAffiliateTables();
  const rows = await prisma.$queryRaw<AffiliateCodeRow[]>`
    SELECT "code", "userId", "active", "createdAt" FROM "AffiliateCode" WHERE "code" = ${norm} LIMIT 1`;
  return rows[0] ?? null;
}

export async function getAffiliateForUser(userId: string): Promise<AffiliateCodeRow | null> {
  await ensureAffiliateTables();
  const rows = await prisma.$queryRaw<AffiliateCodeRow[]>`
    SELECT "code", "userId", "active", "createdAt" FROM "AffiliateCode" WHERE "userId" = ${userId} LIMIT 1`;
  return rows[0] ?? null;
}

// Kod nie moze kolidowac z kuponem (to samo pole w formularzu zamowienia).
export async function affiliateCodeTaken(code: string): Promise<boolean> {
  const norm = normalizeAffiliateCode(code);
  await ensureAffiliateTables();
  const a = await prisma.$queryRaw<{ n: bigint | number }[]>`SELECT COUNT(*) AS n FROM "AffiliateCode" WHERE "code" = ${norm}`;
  if (Number(a[0]?.n ?? 0) > 0) return true;
  const c = await prisma
    .$queryRaw<{ n: bigint | number }[]>`SELECT COUNT(*) AS n FROM "Coupon" WHERE "code" = ${norm}`
    .catch(() => [{ n: 0 }]);
  return Number(c[0]?.n ?? 0) > 0;
}

export async function createAffiliateCode(userId: string, rawCode: string): Promise<
  { ok: true; code: string } | { ok: false; reason: "format" | "taken" | "exists"; error: string }
> {
  const code = normalizeAffiliateCode(rawCode);
  if (!AFFILIATE_CODE_RE.test(code)) {
    return { ok: false, reason: "format", error: "Kod: 4-16 znakow, same litery A-Z i cyfry." };
  }
  if (await getAffiliateForUser(userId)) return { ok: false, reason: "exists", error: "Masz juz kod partnerski." };
  if (await affiliateCodeTaken(code)) return { ok: false, reason: "taken", error: "Ten kod jest zajety — wybierz inny." };
  try {
    await prisma.$executeRaw`
      INSERT INTO "AffiliateCode" ("code", "userId", "active", "createdAt") VALUES (${code}, ${userId}, 1, ${Date.now()})`;
  } catch {
    // UNIQUE na code albo userId — rownolegla proba.
    return { ok: false, reason: "taken", error: "Ten kod jest zajety — wybierz inny." };
  }
  return { ok: true, code };
}

// Rabat kupujacego z kodu partnera — dla checkCouponForCheckout. buyerKey =
// buyer.couponOwner (userId albo "guest:email"): wlasnego kodu uzyc nie wolno.
export async function affiliateDiscountFor(code: string, buyerKey: string | null | undefined): Promise<
  { ok: true; code: string; pct: number } | { ok: false; self: boolean } | null
> {
  const aff = await getAffiliateByCode(code);
  if (!aff || !aff.active) return null;
  if (buyerKey) {
    if (buyerKey === aff.userId) return { ok: false, self: true };
    if (buyerKey.startsWith("guest:")) {
      const owner = await prisma.user.findUnique({ where: { id: aff.userId }, select: { email: true } });
      if (owner?.email && `guest:${owner.email.toLowerCase()}` === buyerKey.toLowerCase()) return { ok: false, self: true };
    }
  }
  return { ok: true, code: aff.code, pct: BUYER_DISCOUNT_PCT };
}

// Webhook Stripe (expectedPaidAmount): czy kod z metadata to kod partnera —
// bez sprawdzania active (mogl zostac wylaczony po utworzeniu platnosci).
export async function isAffiliateCode(code: string): Promise<boolean> {
  return !!(await getAffiliateByCode(code));
}

// ---------------------------------------------------------------------------
// Prowizje
// ---------------------------------------------------------------------------
function toPlnCents(cents: number, currency: string): number {
  return String(currency).toLowerCase() === "eur" ? Math.round(cents * EUR_TO_PLN) : cents;
}

async function soldUnits(userId: string): Promise<number> {
  const r = await prisma.$queryRaw<{ n: bigint | number | null }[]>`
    SELECT SUM("units") AS n FROM "AffiliateCommission" WHERE "userId" = ${userId} AND "status" = 'earned'`;
  return Number(r[0]?.n ?? 0);
}

// Po oplaceniu zamowienia z kodem partnera. Idempotentne (orderId UNIQUE).
// productNetCents = cena produktow po rabacie, bez wysylki, w walucie zamowienia.
export async function accrueAffiliateCommission(p: {
  orderId: string;
  orderNumber?: string | null;
  code: string;
  units: number;
  productNetCents: number;
  currency: string;
  buyerUserId?: string | null;
  buyerEmail?: string | null;
}): Promise<{ amountCents: number; pct: number } | null> {
  const aff = await getAffiliateByCode(p.code);
  if (!aff) return null;
  // Samopolecenie (np. gosc na adres partnera) — bez prowizji.
  if (p.buyerUserId && p.buyerUserId === aff.userId) return null;
  if (p.buyerEmail) {
    const owner = await prisma.user.findUnique({ where: { id: aff.userId }, select: { email: true } });
    if (owner?.email && owner.email.toLowerCase() === p.buyerEmail.trim().toLowerCase()) return null;
  }
  const units = Math.max(1, Math.floor(p.units || 1));
  // Poziom z liczby sztuk sprzedanych PRZED tym zamowieniem.
  const tier = tierForUnits(await soldUnits(aff.userId));
  const baseCents = toPlnCents(Math.max(0, p.productNetCents), p.currency);
  const amountCents = Math.floor((baseCents * tier.pct) / 100);
  const now = Date.now();
  const inserted = await prisma.$executeRaw`
    INSERT OR IGNORE INTO "AffiliateCommission"
      ("id", "orderId", "orderNumber", "code", "userId", "units", "baseCents", "pct", "amountCents", "status", "availableAt", "createdAt")
    VALUES (${randomUUID()}, ${p.orderId}, ${p.orderNumber ?? null}, ${aff.code}, ${aff.userId}, ${units},
            ${baseCents}, ${tier.pct}, ${amountCents}, 'earned', ${now + HOLD_DAYS * 86_400_000}, ${now})`;
  return Number(inserted) === 1 ? { amountCents, pct: tier.pct } : null;
}

// Anulowanie / zwrot / spor. Zwraca true, gdy cos cofnieto.
export async function reverseAffiliateCommission(orderId: string, note: string): Promise<boolean> {
  await ensureAffiliateTables();
  const n = await prisma.$executeRaw`
    UPDATE "AffiliateCommission" SET "status" = 'reversed', "reversedAt" = ${Date.now()}, "note" = ${note}
    WHERE "orderId" = ${orderId} AND "status" = 'earned'`;
  return Number(n) > 0;
}

// Admin cofnal anulowanie zamowienia — prowizja wraca.
export async function restoreAffiliateCommission(orderId: string): Promise<boolean> {
  await ensureAffiliateTables();
  const n = await prisma.$executeRaw`
    UPDATE "AffiliateCommission" SET "status" = 'earned', "reversedAt" = NULL, "note" = NULL
    WHERE "orderId" = ${orderId} AND "status" = 'reversed'`;
  return Number(n) > 0;
}

// ---------------------------------------------------------------------------
// Saldo i wymiana
// ---------------------------------------------------------------------------
export interface AffiliateBalance {
  pendingCents: number; // naliczone, jeszcze w okresie HOLD_DAYS
  availableCents: number; // do wymiany/wyplaty (moze byc < 0 po cofnieciu)
  earnedTotalCents: number; // wszystkie niecofniete prowizje
  paidOutCents: number; // wymienione na tokeny + wyplacone/zlecone
  units: number;
}

export async function affiliateBalance(userId: string): Promise<AffiliateBalance> {
  await ensureAffiliateTables();
  const now = Date.now();
  const c = await prisma.$queryRaw<{ pending: bigint | number | null; matured: bigint | number | null; units: bigint | number | null }[]>`
    SELECT
      SUM(CASE WHEN "availableAt" > ${now} THEN "amountCents" ELSE 0 END) AS pending,
      SUM(CASE WHEN "availableAt" <= ${now} THEN "amountCents" ELSE 0 END) AS matured,
      SUM("units") AS units
    FROM "AffiliateCommission" WHERE "userId" = ${userId} AND "status" = 'earned'`;
  const p = await prisma.$queryRaw<{ n: bigint | number | null }[]>`
    SELECT SUM("amountCents") AS n FROM "AffiliatePayout" WHERE "userId" = ${userId} AND "status" <> 'rejected'`;
  const pending = Number(c[0]?.pending ?? 0);
  const matured = Number(c[0]?.matured ?? 0);
  const paidOut = Number(p[0]?.n ?? 0);
  return {
    pendingCents: pending,
    availableCents: matured - paidOut,
    earnedTotalCents: pending + matured,
    paidOutCents: paidOut,
    units: Number(c[0]?.units ?? 0),
  };
}

export type RedeemResult =
  | { ok: true; payoutId: string; tokens?: number }
  | { ok: false; reason: "amount" | "balance" | "iban" | "holder" | "adult" | "pending"; error: string };

// Polskie (i inne) IBAN — sama suma kontrolna mod 97, bez listy krajow.
export function normalizeIban(v: unknown): string | null {
  let s = typeof v === "string" ? v.replace(/\s+/g, "").toUpperCase() : "";
  if (/^\d{26}$/.test(s)) s = `PL${s}`;
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(s)) return null;
  const rearranged = s.slice(4) + s.slice(0, 4);
  let rem = 0;
  for (const ch of rearranged) {
    const d = /[A-Z]/.test(ch) ? String(ch.charCodeAt(0) - 55) : ch;
    for (const x of d) rem = (rem * 10 + Number(x)) % 97;
  }
  return rem === 1 ? s : null;
}

// Zapis wyplaty i saldo sprawdzane w jednej transakcji (dwa klikniecia naraz
// nie wyplaca podwojnie). Tokeny trafiaja na konto od razu.
export async function redeemAffiliate(userId: string, req: {
  kind: "tokens" | "cash";
  amountCents: number;
  iban?: unknown;
  holder?: unknown;
  adult?: unknown;
}): Promise<RedeemResult> {
  await ensureAffiliateTables();
  const amount = Math.floor(Number(req.amountCents));
  const min = req.kind === "cash" ? MIN_CASH_PAYOUT_CENTS : MIN_TOKEN_REDEEM_CENTS;
  if (!Number.isFinite(amount) || amount < min) {
    return { ok: false, reason: "amount", error: `Minimalna kwota: ${(min / 100).toFixed(0)} zl.` };
  }
  let iban: string | null = null;
  let holder = "";
  if (req.kind === "cash") {
    // Wyplata pieniedzy tylko dla pelnoletnich (umowa / rozliczenie podatkowe) —
    // niepelnoletni moga wymieniac prowizje na tokeny.
    if (req.adult !== true) return { ok: false, reason: "adult", error: "Wyplata na konto tylko dla osob pelnoletnich." };
    iban = normalizeIban(req.iban);
    if (!iban) return { ok: false, reason: "iban", error: "Nieprawidlowy numer konta (IBAN)." };
    holder = typeof req.holder === "string" ? req.holder.trim().slice(0, 120) : "";
    if (holder.length < 3) return { ok: false, reason: "holder", error: "Podaj imie i nazwisko wlasciciela konta." };
  }

  const id = randomUUID();
  const tokens = req.kind === "tokens" ? amount * TOKENS_PER_GROSZ : null;
  const res = await prisma.$transaction(async (tx) => {
    if (req.kind === "cash") {
      const open = await tx.$queryRaw<{ n: bigint | number }[]>`
        SELECT COUNT(*) AS n FROM "AffiliatePayout" WHERE "userId" = ${userId} AND "kind" = 'cash' AND "status" = 'requested'`;
      if (Number(open[0]?.n ?? 0) > 0) return "pending" as const;
    }
    const now = Date.now();
    const m = await tx.$queryRaw<{ n: bigint | number | null }[]>`
      SELECT SUM("amountCents") AS n FROM "AffiliateCommission"
      WHERE "userId" = ${userId} AND "status" = 'earned' AND "availableAt" <= ${now}`;
    const p = await tx.$queryRaw<{ n: bigint | number | null }[]>`
      SELECT SUM("amountCents") AS n FROM "AffiliatePayout" WHERE "userId" = ${userId} AND "status" <> 'rejected'`;
    const available = Number(m[0]?.n ?? 0) - Number(p[0]?.n ?? 0);
    if (amount > available) return "balance" as const;
    await tx.$executeRaw`
      INSERT INTO "AffiliatePayout" ("id", "userId", "kind", "amountCents", "tokens", "status", "iban", "holder", "createdAt", "processedAt")
      VALUES (${id}, ${userId}, ${req.kind}, ${amount}, ${tokens}, ${req.kind === "tokens" ? "done" : "requested"},
              ${iban}, ${holder || null}, ${now}, ${req.kind === "tokens" ? now : null})`;
    if (tokens) {
      await tx.$executeRaw`UPDATE "User" SET "tokenBalance" = COALESCE("tokenBalance", 0) + ${tokens} WHERE "id" = ${userId}`;
    }
    return "ok" as const;
  });
  if (res === "pending") return { ok: false, reason: "pending", error: "Masz juz zlecona wyplate w trakcie realizacji." };
  if (res === "balance") return { ok: false, reason: "balance", error: "Za malo dostepnych srodkow." };
  return { ok: true, payoutId: id, ...(tokens ? { tokens } : {}) };
}

// ---------------------------------------------------------------------------
// Listy (panel klienta / admin)
// ---------------------------------------------------------------------------
export interface CommissionRow {
  id: string; orderId: string; orderNumber: string | null; code: string; userId: string; units: number;
  baseCents: number; pct: number; amountCents: number; status: string;
  availableAt: number; createdAt: number; reversedAt: number | null; note: string | null;
}
export interface PayoutRow {
  id: string; userId: string; kind: string; amountCents: number; tokens: number | null; status: string;
  iban: string | null; holder: string | null; createdAt: number; processedAt: number | null; note: string | null;
}

const num = (v: unknown) => (v == null ? v : Number(v));
function fixCommission(r: CommissionRow): CommissionRow {
  return { ...r, units: Number(r.units), baseCents: Number(r.baseCents), pct: Number(r.pct), amountCents: Number(r.amountCents),
    availableAt: Number(r.availableAt), createdAt: Number(r.createdAt), reversedAt: num(r.reversedAt) as number | null };
}
function fixPayout(r: PayoutRow): PayoutRow {
  return { ...r, amountCents: Number(r.amountCents), tokens: num(r.tokens) as number | null,
    createdAt: Number(r.createdAt), processedAt: num(r.processedAt) as number | null };
}

export async function listCommissions(userId: string, limit = 100): Promise<CommissionRow[]> {
  await ensureAffiliateTables();
  const rows = await prisma.$queryRaw<CommissionRow[]>`
    SELECT * FROM "AffiliateCommission" WHERE "userId" = ${userId} ORDER BY "createdAt" DESC LIMIT ${limit}`;
  return rows.map(fixCommission);
}

export async function listPayouts(userId: string, limit = 100): Promise<PayoutRow[]> {
  await ensureAffiliateTables();
  const rows = await prisma.$queryRaw<PayoutRow[]>`
    SELECT * FROM "AffiliatePayout" WHERE "userId" = ${userId} ORDER BY "createdAt" DESC LIMIT ${limit}`;
  return rows.map(fixPayout);
}

export async function listAllPayouts(status?: string, limit = 200): Promise<PayoutRow[]> {
  await ensureAffiliateTables();
  const rows = status
    ? await prisma.$queryRaw<PayoutRow[]>`SELECT * FROM "AffiliatePayout" WHERE "status" = ${status} ORDER BY "createdAt" DESC LIMIT ${limit}`
    : await prisma.$queryRaw<PayoutRow[]>`SELECT * FROM "AffiliatePayout" ORDER BY "createdAt" DESC LIMIT ${limit}`;
  return rows.map(fixPayout);
}

export interface AffiliateSummaryRow {
  code: string; userId: string; email: string | null; active: number; createdAt: number;
  units: number; earnedCents: number; paidOutCents: number;
}

export async function listAffiliates(limit = 500): Promise<AffiliateSummaryRow[]> {
  await ensureAffiliateTables();
  const rows = await prisma.$queryRaw<AffiliateSummaryRow[]>`
    SELECT a."code", a."userId", u."email" AS email, a."active", a."createdAt",
      COALESCE((SELECT SUM(c."units") FROM "AffiliateCommission" c WHERE c."userId" = a."userId" AND c."status" = 'earned'), 0) AS units,
      COALESCE((SELECT SUM(c."amountCents") FROM "AffiliateCommission" c WHERE c."userId" = a."userId" AND c."status" = 'earned'), 0) AS "earnedCents",
      COALESCE((SELECT SUM(p."amountCents") FROM "AffiliatePayout" p WHERE p."userId" = a."userId" AND p."status" <> 'rejected'), 0) AS "paidOutCents"
    FROM "AffiliateCode" a LEFT JOIN "User" u ON u."id" = a."userId"
    ORDER BY units DESC, a."createdAt" DESC LIMIT ${limit}`;
  return rows.map((r) => ({ ...r, active: Number(r.active), createdAt: Number(r.createdAt), units: Number(r.units),
    earnedCents: Number(r.earnedCents), paidOutCents: Number(r.paidOutCents) }));
}

export async function setAffiliateActive(code: string, active: boolean): Promise<boolean> {
  await ensureAffiliateTables();
  const n = await prisma.$executeRaw`UPDATE "AffiliateCode" SET "active" = ${active ? 1 : 0} WHERE "code" = ${normalizeAffiliateCode(code)}`;
  return Number(n) > 0;
}

// Admin: wyplata przelana ("paid") albo odrzucona ("rejected" — kwota wraca do salda).
export async function setPayoutStatus(id: string, status: "paid" | "rejected", note?: string | null): Promise<boolean> {
  await ensureAffiliateTables();
  const n = await prisma.$executeRaw`
    UPDATE "AffiliatePayout" SET "status" = ${status}, "processedAt" = ${Date.now()}, "note" = ${note ?? null}
    WHERE "id" = ${id} AND "kind" = 'cash' AND "status" = 'requested'`;
  return Number(n) > 0;
}

// Usuniecie konta (lib/auth.ts deleteUserAccount) — kod przestaje dzialac,
// historia prowizji/wyplat zostaje bez powiazania (rozliczenia ksiegowe).
export async function detachAffiliateUser(userId: string): Promise<void> {
  await ensureAffiliateTables();
  await prisma.$executeRaw`DELETE FROM "AffiliateCode" WHERE "userId" = ${userId}`;
}
