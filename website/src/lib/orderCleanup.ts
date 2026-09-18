import { prisma } from "@/lib/db";

// Automatyczne anulowanie porzuconych zamowien: platnosc "pending" (klient
// zaczal P24/BLIK i nie zaplacil) starsza niz STALE_DAYS -> status "cancelled"
// + fulfillmentStatus "cancelled". Wolane co godzine z /api/cron/tracking.
//
// Nie wysylamy maila "zamowienie anulowane" — klient nigdy nie zaplacil, mail
// miesiac po porzuconym koszyku tylko by go zdezorientowal.
//
// UWAGA na "createdAt": stare zamowienia (Stripe, przez Prisma) maja INTEGER
// (ms od epoki), nowe (P24, raw INSERT) maja TEXT ISO-8601. Porownanie w SQL
// musi obslugiwac oba typy — zwykle `createdAt < ?` przez Prisma nic nie
// znajduje dla wierszy tekstowych (TEXT > INTEGER w SQLite).

export const STALE_DAYS = 30;

export interface StaleCancelResult {
  cancelled: Array<{ id: string; orderNumber: string; createdAt: string; customerEmail: string }>;
  // Platnosc pending, ale zamowienie juz wyslane/dostarczone — nie ruszamy
  // automatycznie, do recznej decyzji w panelu.
  skippedShipped: Array<{ id: string; orderNumber: string; fulfillmentStatus: string }>;
}

interface Row {
  id: string;
  orderNumber: string;
  createdAt: string | number | bigint;
  customerEmail: string;
  fulfillmentStatus: string;
}

export async function cancelStaleUnpaidOrders(olderThanDays = STALE_DAYS): Promise<StaleCancelResult> {
  const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
  const cutoffMs = cutoff.getTime();
  const cutoffIso = cutoff.toISOString();

  const rows = await prisma.$queryRaw<Row[]>`
    SELECT id, "orderNumber", "createdAt", "customerEmail", "fulfillmentStatus"
    FROM "Order"
    WHERE status = 'pending'
      AND "fulfillmentStatus" <> 'cancelled'
      AND (
        (typeof("createdAt") = 'integer' AND "createdAt" < ${cutoffMs})
        OR (typeof("createdAt") = 'text' AND "createdAt" < ${cutoffIso})
        OR (typeof("createdAt") = 'real' AND "createdAt" < ${cutoffMs})
      )
    ORDER BY "createdAt"
  `;

  const result: StaleCancelResult = { cancelled: [], skippedShipped: [] };
  const nowIso = new Date().toISOString();

  for (const row of rows) {
    if (row.fulfillmentStatus === "shipped" || row.fulfillmentStatus === "fulfilled") {
      result.skippedShipped.push({ id: row.id, orderNumber: row.orderNumber, fulfillmentStatus: row.fulfillmentStatus });
      continue;
    }
    const note = `[auto ${nowIso.slice(0, 10)}] Anulowano automatycznie — brak płatności przez ${olderThanDays} dni.`;
    // `AND status = 'pending'` — gdyby w miedzyczasie wpadl webhook P24 z
    // platnoscia, nie nadpisujemy "paid".
    const changed = await prisma.$executeRaw`
      UPDATE "Order"
      SET status = 'cancelled',
          "fulfillmentStatus" = 'cancelled',
          "updatedAt" = ${nowIso},
          "adminNotes" = CASE
            WHEN "adminNotes" IS NULL OR "adminNotes" = '' THEN ${note}
            ELSE "adminNotes" || char(10) || ${note}
          END
      WHERE id = ${row.id} AND status = 'pending'
    `;
    if (changed > 0) {
      const createdAt =
        typeof row.createdAt === "string" ? row.createdAt : new Date(Number(row.createdAt)).toISOString();
      result.cancelled.push({ id: row.id, orderNumber: row.orderNumber, createdAt, customerEmail: row.customerEmail });
    }
  }

  if (result.cancelled.length > 0) {
    console.log(
      `[orderCleanup] cancelled ${result.cancelled.length} stale unpaid order(s): ${result.cancelled.map((o) => o.orderNumber).join(", ")}`
    );
  }
  return result;
}
