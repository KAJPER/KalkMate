import { NextRequest, NextResponse } from "next/server";
import { syncAllPendingOrders } from "@/lib/inpostTracking";

// GET /api/cron/tracking — wolane co godzine z crona na serwerze
// (/home/ubuntu/kalkulator/tracking-cron.sh) z naglowkiem x-cron-secret.
//
// Historia: poprzednia wersja iterowala po Stripe PaymentIntents (zamowienia
// ida dzis przez P24 -> nic nie znajdowala), odpytywala zly URL InPost
// (/trackings/ -> 404) i nigdy nie zmieniala statusu zamowienia. Teraz:
// tabela Order + src/lib/inpostTracking.ts + wspolna logika maili z panelu.

const CRON_SECRET = process.env.CRON_SECRET || "";

export async function GET(req: NextRequest) {
  // Fail-secure: brak skonfigurowanego sekretu = brak dostepu. Tylko naglowek
  // (nie URL param) — sekrety w URL trafiaja do logow nginx.
  const secret = req.headers.get("x-cron-secret");
  if (!CRON_SECRET || secret !== CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const results = await syncAllPendingOrders();
    const changed = results.filter((r) => r.changed);
    const summary = {
      ok: true,
      checked: results.length,
      changed: changed.length,
      emailsSent: results.filter((r) => r.emailSent).length,
      unavailable: results.filter((r) => r.note === "inpost_unavailable").length,
      returnsFlagged: results.filter((r) => r.note === "return_flagged").length,
      changes: changed.map((r) => ({
        orderId: r.orderId,
        tracking: r.trackingNumber,
        inpost: r.inpostStatus,
        from: r.previousStatus,
        to: r.newStatus,
      })),
    };
    console.log(
      `[cron/tracking] checked=${summary.checked} changed=${summary.changed} emails=${summary.emailsSent} unavailable=${summary.unavailable}`
    );
    return NextResponse.json(summary);
  } catch (e) {
    console.error("[cron/tracking]", e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
