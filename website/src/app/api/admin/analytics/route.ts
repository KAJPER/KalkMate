import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";
import { cachedStats, lastWarsawDays, warsawDay, warsawDayStartMs } from "../_lib/stats";

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
//
// Semantyka (audyt 2026-10-16 — wczesniej przychod liczyl zwrocone zamowienia,
// a "Zwrocono" liczylo porzucone koszyki):
//   sprzedaz/przychod = status 'paid' AND fulfillmentStatus <> 'cancelled'
//   zwroty            = status 'paid' AND fulfillmentStatus = 'cancelled'
//                       (reczne anulowanie oplaconego = pieniadze oddane)
//   porzucone         = status 'cancelled' (auto-cleanup nieoplaconych) albo
//                       'pending' starsze niz 1 dzien — nikt nie zaplacil,
//                       wiec nic nie oddano (pola abandoned*)
//   nieudane          = status 'failed'
// Dzienny przychod: dzien oplacenia (paidAt, fallback createdAt) w strefie
// Europe/Warsaw. Agregacja w SQL (groupBy), wynik w cache 60 s.
const ABANDON_AFTER_MS = 24 * 60 * 60 * 1000;
const SHIPPED = new Set(["shipped", "fulfilled"]);

async function computeAnalytics() {
  const now = Date.now();
  const staleBefore = new Date(now - ABANDON_AFTER_MS);

  const [groups, stalePending] = await Promise.all([
    prisma.order.groupBy({
      by: ["status", "fulfillmentStatus", "currency"],
      _count: { _all: true },
      _sum: { amount: true },
    }),
    prisma.order.groupBy({
      by: ["currency"],
      where: { status: "pending", createdAt: { lt: staleBefore } },
      _count: { _all: true },
      _sum: { amount: true },
    }),
  ]);

  let totalOrders = 0;
  let soldOrders = 0, totalRevenue = 0;
  let refundedOrders = 0, totalRefunded = 0;
  let pendingAll = 0;
  let cancelledUnpaid = 0, cancelledUnpaidAmount = 0;
  let failedOrders = 0;
  let fulfilled = 0;
  for (const g of groups) {
    const n = g._count._all;
    const pln = toPln(g._sum.amount ?? 0, g.currency);
    totalOrders += n;
    if (g.status === "paid") {
      if (g.fulfillmentStatus === "cancelled") {
        refundedOrders += n;
        totalRefunded += pln;
      } else {
        soldOrders += n;
        totalRevenue += pln;
        if (SHIPPED.has(g.fulfillmentStatus)) fulfilled += n;
      }
    } else if (g.status === "pending") {
      pendingAll += n;
    } else if (g.status === "cancelled") {
      cancelledUnpaid += n;
      cancelledUnpaidAmount += pln;
    } else if (g.status === "failed") {
      failedOrders += n;
    }
  }
  const stalePendingCount = stalePending.reduce((s, g) => s + g._count._all, 0);
  const stalePendingAmount = stalePending.reduce((s, g) => s + toPln(g._sum.amount ?? 0, g.currency), 0);
  const abandonedOrders = cancelledUnpaid + stalePendingCount;
  const abandonedAmount = cancelledUnpaidAmount + stalePendingAmount;
  const pendingOrders = pendingAll - stalePendingCount; // swieze, jeszcze moga zostac oplacone

  // Dzienny przychod (ostatnie 30 dni czasu warszawskiego), w PLN po przeliczeniu.
  const days = lastWarsawDays(30, now);
  const dailyOrders: Record<string, { count: number; revenue: number }> = {};
  for (const d of days) dailyOrders[d] = { count: 0, revenue: 0 };
  const since = new Date(warsawDayStartMs(days[0]));
  const recent = await prisma.order.findMany({
    where: {
      status: "paid",
      NOT: { fulfillmentStatus: "cancelled" },
      OR: [{ paidAt: { gte: since } }, { paidAt: null, createdAt: { gte: since } }],
    },
    select: { amount: true, currency: true, paidAt: true, createdAt: true },
  });
  for (const o of recent) {
    const key = warsawDay(o.paidAt ?? o.createdAt);
    if (dailyOrders[key]) {
      dailyOrders[key].count++;
      dailyOrders[key].revenue += toPln(o.amount, o.currency);
    }
  }

  return {
    totalRevenue,
    totalRefunded,
    refundedOrders,
    totalOrders,
    // Sprzedane (oplacone i nie zwrocone).
    succeededOrders: soldOrders,
    // Oczekujace na platnosc mlodsze niz 1 dzien (starsze sa w abandoned*).
    pendingOrders,
    // Wszystko, co nie skonczylo sie sprzedaza: zwroty + porzucone + nieudane.
    canceledOrders: refundedOrders + abandonedOrders + failedOrders,
    fulfilledOrders: fulfilled,
    // Do wysylki: sprzedane, jeszcze nie wyslane (bez anulowanych/zwroconych).
    unfulfilledOrders: soldOrders - fulfilled,
    dailyOrders: Object.entries(dailyOrders)
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    // Nowe pola (2026-10-16):
    abandonedOrders,
    abandonedAmount,
    failedOrders,
    timezone: "Europe/Warsaw",
    cachedAt: new Date(now).toISOString(),
  };
}

export async function GET(request: NextRequest) {
  const authErr = await requireAdminAuth(request); if (authErr) return authErr;
  try {
    return NextResponse.json(await cachedStats("analytics", computeAnalytics));
  } catch (error) {
    console.error("Error fetching analytics:", error);
    return NextResponse.json(
      { error: "Failed to fetch analytics" },
      { status: 500 }
    );
  }
}
