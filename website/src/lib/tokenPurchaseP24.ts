import { prisma } from "@/lib/db";

// Doladowania tokenow AI oplacane Przelewy24 (PLN). Osobna tabela od "Order"
// bo Order ma kolumny dla fizycznej wysylki (adres, paczkomat...), ktore tu
// nie maja sensu — wzorem Coupon (lib/coupons.ts), tabela poza Prisma schema,
// tworzona lazy raw SQL.
//
// status: 'pending' | 'paid'

export interface TokenPurchaseP24Row {
  id: string;
  sessionId: string;
  userId: string;
  tokens: number;
  amount: number; // grosze
  currency: string;
  status: string;
  createdAt: string;
  paidAt: string | null;
}

let _tableReady = false;

export async function ensureTokenPurchaseP24Table(): Promise<void> {
  if (_tableReady) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS TokenPurchaseP24 (
      id        TEXT PRIMARY KEY,
      sessionId TEXT UNIQUE NOT NULL,
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

export async function createPendingTokenPurchaseP24(row: {
  id: string; sessionId: string; userId: string; tokens: number; amount: number; currency: string;
}): Promise<void> {
  await ensureTokenPurchaseP24Table();
  await prisma.$executeRaw`
    INSERT INTO TokenPurchaseP24 (id, sessionId, userId, tokens, amount, currency, status, createdAt)
    VALUES (${row.id}, ${row.sessionId}, ${row.userId}, ${row.tokens}, ${row.amount}, ${row.currency}, 'pending', ${new Date().toISOString()})
  `;
}

export async function findTokenPurchaseP24BySession(sessionId: string): Promise<TokenPurchaseP24Row | null> {
  await ensureTokenPurchaseP24Table();
  const rows = await prisma.$queryRaw<TokenPurchaseP24Row[]>`
    SELECT id, sessionId, userId, tokens, amount, currency, status, createdAt, paidAt
    FROM TokenPurchaseP24 WHERE sessionId = ${sessionId} LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function markTokenPurchaseP24Paid(id: string): Promise<void> {
  await prisma.$executeRaw`
    UPDATE TokenPurchaseP24 SET status = 'paid', paidAt = ${new Date().toISOString()} WHERE id = ${id}
  `;
}
