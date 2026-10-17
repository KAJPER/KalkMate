import { prisma } from "@/lib/db";
import { releaseCouponReservation } from "@/lib/coupons";
import { STALE_DAYS, checkP24OrderPayment, settleFromP24Check } from "@/lib/paymentReminders";

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
//
// Audyt 2026-10-16: przed anulowaniem zamowienia P24 pytamy P24 o status
// transakcji (zgubiony webhook = oplacone zamowienie anulowane). Oplacone ->
// domykamy ta sama sciezka co webhook (settleP24OrderPayment); P24 nie
// odpowiada -> pomijamy rekord w tym przebiegu. Anulowanie zwalnia rezerwacje
// kuponu (lib/coupons.ts).

// Stala mieszka w paymentReminders (bez cyklu importow) — re-eksport dla
// dotychczasowych importow z orderCleanup.
export { STALE_DAYS };

export interface StaleCancelResult {
  cancelled: Array<{ id: string; orderNumber: string; createdAt: string; customerEmail: string }>;
  // Platnosc pending, ale zamowienie juz wyslane/dostarczone — nie ruszamy
  // automatycznie, do recznej decyzji w panelu.
  skippedShipped: Array<{ id: string; orderNumber: string; fulfillmentStatus: string }>;
  // P24 zglasza wplate — domkniete zamiast anulowania
  settled?: Array<{ id: string; orderNumber: string; result: string }>;
  // P24 nie odpowiedzial — sprobujemy w nastepnym przebiegu
  deferred?: Array<{ id: string; orderNumber: string }>;
}

interface Row {
  id: string;
  orderNumber: string;
  paymentProvider: string | null;
  p24SessionId: string | null;
  createdAt: string | number | bigint;
  customerEmail: string;
  fulfillmentStatus: string;
}

export async function cancelStaleUnpaidOrders(olderThanDays = STALE_DAYS): Promise<StaleCancelResult> {
  const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
  const cutoffMs = cutoff.getTime();
  const cutoffIso = cutoff.toISOString();

  const rows = await prisma.$queryRaw<Row[]>`
    SELECT id, "orderNumber", "paymentProvider", "p24SessionId", "createdAt", "customerEmail", "fulfillmentStatus"
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

  const settled: NonNullable<StaleCancelResult["settled"]> = [];
  const deferred: NonNullable<StaleCancelResult["deferred"]> = [];
  const result: StaleCancelResult = { cancelled: [], skippedShipped: [], settled, deferred };
  const nowIso = new Date().toISOString();
  // Integer ms dla kolumny "updatedAt" (Prisma/SQLite trzyma DateTime jako
  // INTEGER) — nowIso zostaje tylko do tekstu notatki nizej.
  const nowMs = Date.now();

  for (const row of rows) {
    if (row.fulfillmentStatus === "shipped" || row.fulfillmentStatus === "fulfilled") {
      result.skippedShipped.push({ id: row.id, orderNumber: row.orderNumber, fulfillmentStatus: row.fulfillmentStatus });
      continue;
    }
    if (row.paymentProvider === "p24") {
      const p24 = await checkP24OrderPayment(row.id, row.p24SessionId);
      if (p24.state === "error") {
        console.warn(`[orderCleanup] P24 status check failed for ${row.orderNumber}, skip this run: ${p24.error}`);
        deferred.push({ id: row.id, orderNumber: row.orderNumber });
        continue;
      }
      if (p24.state === "paid") {
        const r = await settleFromP24Check(row.id, p24.info, "cleanup");
        if (r === "verify_failed") deferred.push({ id: row.id, orderNumber: row.orderNumber });
        else settled.push({ id: row.id, orderNumber: row.orderNumber, result: r });
        continue;
      }
    }
    const note = `[auto ${nowIso.slice(0, 10)}] Anulowano automatycznie — brak płatności przez ${olderThanDays} dni.`;
    // `AND status = 'pending'` — gdyby w miedzyczasie wpadl webhook P24 z
    // platnoscia, nie nadpisujemy "paid".
    const changed = await prisma.$executeRaw`
      UPDATE "Order"
      SET status = 'cancelled',
          "fulfillmentStatus" = 'cancelled',
          "updatedAt" = ${nowMs},
          "adminNotes" = CASE
            WHEN "adminNotes" IS NULL OR "adminNotes" = '' THEN ${note}
            ELSE "adminNotes" || char(10) || ${note}
          END
      WHERE id = ${row.id} AND status = 'pending'
    `;
    if (changed > 0) {
      // Kupon zarezerwowany przy tym zamowieniu wraca do puli.
      await releaseCouponReservation({ ref: row.id }).catch((e) => console.error("[orderCleanup] coupon release failed:", e));
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
