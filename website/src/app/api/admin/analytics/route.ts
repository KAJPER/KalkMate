import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";

// Kurs orientacyjny do zsumowania przychodu w jednej walucie (PLN) na
// dashboardzie — realny kurs w dniu transakcji nie jest nigdzie zapisywany
// (Stripe/P24 tego nie zwracaja), wiec to przyblizenie. Nadpisywalne przez
// env bez redeployu kodu.
const EUR_PLN_RATE = Number(process.env.EUR_PLN_RATE) || 4.3;
const USD_PLN_RATE = Number(process.env.USD_PLN_RATE) || 3.9;

function toPln(amountMinor: number, currency: string): number {
  const c = currency.toLowerCase();
  if (c === "pln") return amountMinor;
  if (c === "eur") return Math.round(amountMinor * EUR_PLN_RATE);
  if (c === "usd") return Math.round(amountMinor * USD_PLN_RATE);
  // Nieznana waluta — nie powinno wystapic (dzis w bazie sa tylko pln/eur),
  // ale nie chcemy cichej korupcji sumy: log + fallback 1:1.
  console.warn(`[analytics] nieznana waluta zamowienia: ${currency}, licze 1:1 jako PLN`);
  return amountMinor;
}

// Historia buga (naprawione 2026-09-22): poprzednia wersja liczyla przychod
// WYLACZNIE z surowych Stripe PaymentIntents (stripe.paymentIntents.list) —
// to:
//   1) calkowicie pomijalo zamowienia oplacone przez P24 (Przelewy24), ktory
//      jest teraz glownym kanalem platnosci w Polsce (14 oplaconych zamowien,
//      9786 zl, zero z tego nie bylo widoczne na dashboardzie),
//   2) traktowalo kwote z zamowien zagranicznych (EUR: 189/204 za sztuke) jako
//      zlotowki 1:1 bez przeliczenia kursu (wlasciciel widzial "189 zl" za
//      zamowienie, ktore realnie bylo warte 189 EUR ~ 810 zl).
// Zamiast odpytywac Stripe, liczymy teraz z tabeli Order — tam obie metody
// platnosci (Stripe + P24) sa juz ujednolicone (status/amount/currency), wiec
// to jedno miejsce prawdy zamiast ponownego wnioskowania z surowego API.
export async function GET(request: NextRequest) {
  const authErr = await requireAdminAuth(request); if (authErr) return authErr;
  try {
    const orders = await prisma.order.findMany({
      select: {
        status: true,
        amount: true,
        currency: true,
        createdAt: true,
        fulfillmentStatus: true,
      },
    });

    const succeeded = orders.filter((o) => o.status === "paid");
    const pending = orders.filter((o) => o.status === "pending");
    const canceled = orders.filter((o) => o.status === "cancelled" || o.status === "failed");
    // Tylko "cancelled" (nie "failed") — failed = platnosc nigdy sie nie
    // udala (np. odrzucona karta), wiec nie ma czego zwracac. "cancelled"
    // wg wlasciciela zawsze oznacza, ze pieniadze zostaly juz oddane klientowi
    // recznie (Stripe/P24 nie maja tu integracji zwrotow) — patrz
    // project_cancelled_orders_refunded w pamieci.
    const cancelledOnly = orders.filter((o) => o.status === "cancelled");

    const totalRevenue = succeeded.reduce((sum, o) => sum + toPln(o.amount, o.currency), 0);
    const totalRefunded = cancelledOnly.reduce((sum, o) => sum + toPln(o.amount, o.currency), 0);

    // Dzienny przychod (ostatnie 30 dni), w PLN po przeliczeniu.
    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
    const dailyOrders: Record<string, { count: number; revenue: number }> = {};

    for (let d = 0; d < 30; d++) {
      const date = new Date(now - d * 24 * 60 * 60 * 1000);
      const key = date.toISOString().slice(0, 10);
      dailyOrders[key] = { count: 0, revenue: 0 };
    }

    succeeded
      .filter((o) => o.createdAt.getTime() > thirtyDaysAgo)
      .forEach((o) => {
        const key = o.createdAt.toISOString().slice(0, 10);
        if (dailyOrders[key]) {
          dailyOrders[key].count++;
          dailyOrders[key].revenue += toPln(o.amount, o.currency);
        }
      });

    const fulfilled = succeeded.filter(
      (o) => o.fulfillmentStatus === "fulfilled" || o.fulfillmentStatus === "shipped"
    ).length;

    return NextResponse.json({
      totalRevenue,
      totalRefunded,
      refundedOrders: cancelledOnly.length,
      totalOrders: orders.length,
      succeededOrders: succeeded.length,
      pendingOrders: pending.length,
      canceledOrders: canceled.length,
      fulfilledOrders: fulfilled,
      unfulfilledOrders: succeeded.length - fulfilled,
      dailyOrders: Object.entries(dailyOrders)
        .map(([date, data]) => ({ date, ...data }))
        .sort((a, b) => a.date.localeCompare(b.date)),
    });
  } catch (error) {
    console.error("Error fetching analytics:", error);
    return NextResponse.json(
      { error: "Failed to fetch analytics" },
      { status: 500 }
    );
  }
}
