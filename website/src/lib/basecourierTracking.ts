import { prisma } from "@/lib/db";
import { applyFulfillmentStatus, type FulfillmentStatus } from "@/lib/orderFulfillment";
import { bcGetOrderDetails, type BcTrackingEvent } from "@/lib/basecourier";
import { looksLikeInPostNumber } from "@/lib/inpostTracking";

// Sledzenie przesylek zagranicznych (DPD, GLS, UPS...) nadanych przez Base
// Courier — patrz src/app/api/admin/orders/[id]/basecourier/route.ts
// (bcCreateInternationalShipment). Odrebne od inpostTracking.ts, bo te
// przesylki NIE maja numeru InPost (24 cyfry) i sledzimy je przez to samo
// konto Base Courier, ktorym zostaly nadane (getOrderDetails.json), a nie
// przez publiczne API konkretnego przewoznika.
//
// Domyslny Paczkomat-przez-Base-Courier (courier_code "paczkomaty") ma numer
// InPost jako trackingNumber i jest juz w calosci obslugiwany przez
// inpostTracking.ts — tu celowo pomijamy takie zamowienia (looksLikeInPostNumber),
// zeby nie sledzic tego samego zamowienia dwoma mechanizmami naraz.

// Tylko jeden potwierdzony na zywo status ("STATUS_CREATE" — etykieta
// utworzona, jeszcze nie nadana) — reszta ponizej to bezpieczne dopasowanie
// po nazwie, bo Base Courier nie publikuje pelnej listy kodow. W razie
// niepewnosci NIC nie zmieniamy (lepiej przegapic automatyczna aktualizacje
// niz falszywie oznaczyc zamowienie).
function mapBaseCourierStatus(ev: BcTrackingEvent): FulfillmentStatus | "return" | null {
  if (ev.delivered) return "fulfilled";
  const code = (ev.blStatusMapped || ev.status || "").toUpperCase();
  if (/DELIVER/.test(code)) return "fulfilled";
  if (/RETURN|CANCEL|FAIL|PROBLEM|UNDELIVER|REFUS|LOST|DAMAG/.test(code)) return "return";
  if (/TRANSIT|PICKUP|PICKED_UP|COLLECT|DISPATCH|COURIER|SORT|OUT_FOR_DELIVERY|SENT/.test(code)) return "shipped";
  // "STATUS_CREATE" i inne nieznane — etykieta istnieje, nic pewnego sie nie
  // zmienilo, nie ruszamy statusu.
  return null;
}

// Najnowsze zdarzenie z listy Tracking — API nie gwarantuje kolejnosci,
// sortujemy po event_time (format "YYYY-MM-DD HH:MM:SS" sortuje sie
// poprawnie leksykograficznie).
function latestEvent(events: BcTrackingEvent[]): BcTrackingEvent | null {
  if (events.length === 0) return null;
  return [...events].sort((a, b) => (b.eventTime || "").localeCompare(a.eventTime || ""))[0];
}

// Ranga sygnalow wg tego, jak duzo mowia o postepie przesylki — NIE wg
// chronologii. Na zywo (2026-09-23) zdarzenie NAJNOWSZE mialo kod
// STATUS_OMIT ("Powiadomienie mail" — czysta notyfikacja, zero tresci
// logistycznej), a 3 minuty wczesniej bylo juz STATUS_COLLECTED ("Nadanie
// przesylki w punkcie Pickup"). Patrzenie tylko na najnowsze zdarzenie
// (jak wczesniej) gubilo ten sygnal i zamowienie nigdy nie przechodzilo
// na "shipped". Trzeba przejrzec WSZYSTKIE zdarzenia i wziac najlepszy
// (najdalej posunięty) rozpoznany status.
const STATUS_RANK: Record<string, number> = { fulfilled: 3, return: 2, shipped: 1 };

function bestBaseCourierStatus(events: BcTrackingEvent[]): FulfillmentStatus | "return" | null {
  let best: FulfillmentStatus | "return" | null = null;
  let bestRank = 0;
  for (const ev of events) {
    const mapped = mapBaseCourierStatus(ev);
    if (mapped === null) continue;
    const rank = STATUS_RANK[mapped] ?? 0;
    if (rank > bestRank) {
      best = mapped;
      bestRank = rank;
    }
  }
  return best;
}

export interface BcSyncResult {
  orderId: string;
  blpaczkaOrderId: string;
  status: string | null;
  previousStatus: string;
  newStatus: string;
  changed: boolean;
  emailSent: boolean;
  note?: string;
}

export async function syncBaseCourierOrder(orderId: string): Promise<BcSyncResult | null> {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || order.furgonetkaStatus !== "basecourier" || !order.furgonetkaPackageId) return null;

  const base: BcSyncResult = {
    orderId,
    blpaczkaOrderId: order.furgonetkaPackageId,
    status: null,
    previousStatus: order.fulfillmentStatus || "unfulfilled",
    newStatus: order.fulfillmentStatus || "unfulfilled",
    changed: false,
    emailSent: false,
  };

  let details;
  try {
    details = await bcGetOrderDetails(order.furgonetkaPackageId);
  } catch (e) {
    console.error(`[basecourierTracking] getOrderDetails failed for ${order.furgonetkaPackageId}:`, e);
    return { ...base, note: "basecourier_unavailable" };
  }

  const latest = latestEvent(details.events);
  if (!latest) return { ...base, note: "no_tracking_yet" };
  base.status = latest.blStatusMapped || latest.status;

  const mapped = bestBaseCourierStatus(details.events);
  if (mapped === null) return { ...base, note: "no_change" };

  if (mapped === "return") {
    const marker = `[Base Courier ${base.status}]`;
    if (!(order.adminNotes || "").includes(marker)) {
      await prisma.order.update({
        where: { id: orderId },
        data: {
          adminNotes: `${order.adminNotes ? order.adminNotes + "\n" : ""}${marker} ${new Date().toISOString().slice(0, 16)} — ${latest.statusDesc || "wymaga recznej decyzji"} (zwrot/problem z dostawa).`,
        },
      });
    }
    return { ...base, note: "return_flagged" };
  }

  const result = await applyFulfillmentStatus(orderId, mapped, { source: "tracking" });
  if (!result) return null;
  return {
    ...base,
    newStatus: result.newStatus,
    changed: result.changed,
    emailSent: result.emailSent,
    note: result.changed ? "updated" : "no_change",
  };
}

// Wszystkie zamowienia nadane przez Base Courier innym kurierem niz
// Paczkomat/InPost (ten ma juz osobna, dzialajaca sciezke — inpostTracking.ts),
// ktore nie sa jeszcze zamkniete.
export async function syncAllPendingBaseCourierOrders(limit = 200): Promise<BcSyncResult[]> {
  const orders = await prisma.order.findMany({
    where: {
      furgonetkaStatus: "basecourier",
      furgonetkaPackageId: { not: null },
      fulfillmentStatus: { in: ["unfulfilled", "in_progress", "shipped"] },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { id: true, trackingNumber: true },
  });

  const results: BcSyncResult[] = [];
  for (const o of orders) {
    if (looksLikeInPostNumber(o.trackingNumber)) continue; // juz obsluzone przez inpostTracking.ts
    const r = await syncBaseCourierOrder(o.id);
    if (r) results.push(r);
  }
  return results;
}
