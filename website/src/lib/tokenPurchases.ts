import { prisma } from "@/lib/db";

// Historia doladowan tokenow AI, oba dostawcy platnosci (P24 dla PLN, Stripe
// dla innych walut). Osobna tabela od "Order" bo Order ma kolumny dla
// fizycznej wysylki (adres, paczkomat...), ktore tu nie maja sensu — wzorem
// Coupon (lib/coupons.ts), tabela poza Prisma schema, tworzona lazy raw SQL.
//
// provider: 'p24' | 'stripe'
// status:   'pending' | 'paid'  (Stripe loguje od razu jako 'paid' — webhook
//           odpala sie tylko po potwierdzonej platnosci, bez fazy pending)

export interface TokenPurchaseRow {
  id: string;
  sessionId: string;
  provider: string;
  userId: string;
  tokens: number;
  amount: number; // najmniejsza jednostka waluty (grosze/centy)
  currency: string;
  status: string;
  createdAt: string;
  paidAt: string | null;
}

let _tableReady = false;

export async function ensureTokenPurchaseTable(): Promise<void> {
  if (_tableReady) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS TokenPurchase (
      id        TEXT PRIMARY KEY,
      sessionId TEXT UNIQUE NOT NULL,
      provider  TEXT NOT NULL DEFAULT 'p24',
      userId    TEXT NOT NULL,
      tokens    INTEGER NOT NULL,
      amount    INTEGER NOT NULL,
      currency  TEXT NOT NULL DEFAULT 'pln',
      status    TEXT NOT NULL DEFAULT 'pending',
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      paidAt    TEXT
    )
  `);
  _tableReady = true;
}

export async function createPendingTokenPurchase(row: {
  id: string; sessionId: string; provider: string; userId: string; tokens: number; amount: number; currency: string;
}): Promise<void> {
  await ensureTokenPurchaseTable();
  await prisma.$executeRaw`
    INSERT INTO TokenPurchase (id, sessionId, provider, userId, tokens, amount, currency, status, createdAt)
    VALUES (${row.id}, ${row.sessionId}, ${row.provider}, ${row.userId}, ${row.tokens}, ${row.amount}, ${row.currency}, 'pending', ${new Date().toISOString()})
  `;
}

// Stripe: webhook odpala sie dopiero po potwierdzonej platnosci, wiec logujemy
// od razu jako 'paid' (bez oddzielnej fazy pending jak w P24).
export async function createPaidTokenPurchase(row: {
  id: string; sessionId: string; provider: string; userId: string; tokens: number; amount: number; currency: string;
}): Promise<void> {
  await ensureTokenPurchaseTable();
  const now = new Date().toISOString();
  await prisma.$executeRaw`
    INSERT OR IGNORE INTO TokenPurchase (id, sessionId, provider, userId, tokens, amount, currency, status, createdAt, paidAt)
    VALUES (${row.id}, ${row.sessionId}, ${row.provider}, ${row.userId}, ${row.tokens}, ${row.amount}, ${row.currency}, 'paid', ${now}, ${now})
  `;
}

export async function findTokenPurchaseBySession(sessionId: string): Promise<TokenPurchaseRow | null> {
  await ensureTokenPurchaseTable();
  const rows = await prisma.$queryRaw<TokenPurchaseRow[]>`
    SELECT id, sessionId, provider, userId, tokens, amount, currency, status, createdAt, paidAt
    FROM TokenPurchase WHERE sessionId = ${sessionId} LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function markTokenPurchasePaid(id: string): Promise<void> {
  await prisma.$executeRaw`
    UPDATE TokenPurchase SET status = 'paid', paidAt = ${new Date().toISOString()} WHERE id = ${id}
  `;
}

export async function sumTokensPurchasedByUser(userId: string): Promise<{ tokens: number; count: number }> {
  await ensureTokenPurchaseTable();
  const rows = await prisma.$queryRaw<{ tokens: number | null; count: number }[]>`
    SELECT SUM(tokens) as tokens, COUNT(*) as count FROM TokenPurchase WHERE userId = ${userId} AND status = 'paid'
  `;
  return { tokens: Number(rows[0]?.tokens ?? 0), count: Number(rows[0]?.count ?? 0) };
}

export async function listTokenPurchasesByUser(userId: string): Promise<TokenPurchaseRow[]> {
  await ensureTokenPurchaseTable();
  return prisma.$queryRaw<TokenPurchaseRow[]>`
    SELECT id, sessionId, provider, userId, tokens, amount, currency, status, createdAt, paidAt
    FROM TokenPurchase WHERE userId = ${userId} AND status = 'paid' ORDER BY paidAt DESC
  `;
}
