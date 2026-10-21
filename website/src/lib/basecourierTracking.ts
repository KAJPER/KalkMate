import { prisma } from "@/lib/db";
import { applyFulfillmentStatus, ensureLabelEmail, type FulfillmentStatus } from "@/lib/orderFulfillment";
import { bcGetOrderDetails, type BcOrderDetails, type BcTrackingEvent } from "@/lib/basecourier";
import { looksLikeInPostNumber, appendOrderNoteOnce, trackingSkipReason, mapWithConcurrency } from "@/lib/inpostTracking";

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
// Kolejnosc sprawdzen ma znaczenie: dawniej /DELIVER/ bylo pierwsze, wiec
// "OUT_FOR_DELIVERY" i "UNDELIVERED"/"NOT_DELIVERED" oznaczaly zamowienie jako
// DOSTARCZONE (mail "dostarczono" do klienta, a paczka jeszcze w drodze / wraca).
function mapBaseCourierStatus(ev: BcTrackingEvent): FulfillmentStatus | "return" | null {
  if (ev.delivered) return "fulfilled";
  const code = (ev.blStatusMapped || ev.status || "").toUpperCase();
  if (/UNDELIVER|NOT_DELIVER|NON_DELIVER|RETURN|CANCEL|FAIL|PROBLEM|REFUS|LOST|DAMAG/.test(code)) return "return";
  if (/OUT_FOR_DELIVERY|FOR_DELIVERY|IN_DELIVERY|DELIVERY_ATTEMPT/.test(code)) return "shipped";
  if (/DELIVERED/.test(code)) return "fulfilled";
  // Zamowiony/umowiony podjazd = kurier jeszcze NIE odebral paczki.
  if (/PICKUP_(ORDER|SCHEDUL|REQUEST|BOOK)/.test(code)) return null;
  if (/TRANSIT|PICKUP|PICKED_UP|COLLECT|DISPATCH|COURIER|SORT|SENT/.test(code)) return "shipped";
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

// Zwraca tez zdarzenie, z ktorego wzial sie status — znacznik flagi zwrotu
// budujemy z JEGO kodu (dawniej z najnowszego zdarzenia, np. STATUS_OMIT, wiec
// kazde kolejne powiadomienie dopisywalo do notatek nowa, zdublowana flage).
function bestBaseCourierStatus(events: BcTrackingEvent[]): { mapped: FulfillmentStatus | "return"; event: BcTrackingEvent } | null {
  let best: { mapped: FulfillmentStatus | "return"; event: BcTrackingEvent } | null = null;
  let bestRank = 0;
  for (const ev of events) {
    const mapped = mapBaseCourierStatus(ev);
    if (mapped === null) continue;
    const rank = STATUS_RANK[mapped] ?? 0;
    if (rank > bestRank) {
      best = { mapped, event: ev };
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
  labelEmailSent?: boolean;
  note?: string;
}

// prefetched — szczegoly zlecenia JUZ pobrane przez wywolujacego (przycisk
// "Sprawdz status" pokazuje tez zdarzenia — bez drugiego zapytania do Base
// Courier): undefined = pobierz samodzielnie, null = Base Courier niedostepny.
// + brakujacy mail "Pakujemy i wysylamy" (ensureLabelEmail) — PO zmianie statusu,
// zeby paczka juz odebrana przez kuriera dostala tylko "W drodze".
export async function syncBaseCourierOrder(orderId: string, prefetched?: BcOrderDetails | null): Promise<BcSyncResult | null> {
  const r = await syncBaseCourierOrderInner(orderId, prefetched);
  let labelEmailSent = false;
  // Przewoznik nie odpowiedzial = nie wiemy, czy paczka juz nie jedzie/nie lezy
  // w Paczkomacie (status mogl nie zdazyc sie przesunac) — mail przy nastepnym sprawdzeniu.
  if (r?.note?.endsWith("_unavailable")) return r;
  try { labelEmailSent = await ensureLabelEmail(orderId); } catch (e) { console.error("[tracking] label email failed", orderId, e); }
  return r ? { ...r, labelEmailSent } : r;
}

async function syncBaseCourierOrderInner(orderId: string, prefetched?: BcOrderDetails | null): Promise<BcSyncResult | null> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { furgonetkaStatus: true, furgonetkaPackageId: true, fulfillmentStatus: true },
  });
  if (!order || order.furgonetkaStatus !== "basecourier" || !order.furgonetkaPackageId) return null;

  const current = order.fulfillmentStatus || "unfulfilled";
  const base: BcSyncResult = {
    orderId,
    blpaczkaOrderId: order.furgonetkaPackageId,
    status: null,
    previousStatus: current,
    newStatus: current,
    changed: false,
    emailSent: false,
  };

  let details: BcOrderDetails | null = prefetched ?? null;
  if (prefetched === undefined) {
    try {
      details = await bcGetOrderDetails(order.furgonetkaPackageId);
    } catch (e) {
      console.error(`[basecourierTracking] getOrderDetails failed for ${order.furgonetkaPackageId}:`, e);
      details = null;
    }
  }
  if (!details) return { ...base, note: "basecourier_unavailable" };

  const latest = latestEvent(details.events);
  if (!latest) return { ...base, note: "no_tracking_yet" };
  base.status = latest.blStatusMapped || latest.status;

  const best = bestBaseCourierStatus(details.events);
  if (best === null) return { ...base, note: "no_change" };

  if (best.mapped === "return") {
    const ev = best.event;
    const marker = `[Base Courier ${ev.blStatusMapped || ev.status}]`;
    await appendOrderNoteOnce(
      orderId,
      `${marker} ${new Date().toISOString().slice(0, 16)} — ${ev.statusDesc || "wymaga recznej decyzji"} (zwrot/problem z dostawa).`,
      marker
    );
    return { ...base, note: "return_flagged" };
  }

  const skip = trackingSkipReason(current, best.mapped);
  if (skip) return { ...base, note: skip };

  const result = await applyFulfillmentStatus(orderId, best.mapped, { source: "tracking" });
  if (!result) return null;
  return {
    ...base,
    newStatus: result.newStatus,
    changed: result.changed,
    emailSent: result.emailSent,
    note: result.changed ? "updated" : result.conflict ? "conflict" : "no_change",
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

  // InPost (24 cyfry) juz obsluzone przez inpostTracking.ts. Do 4 zapytan naraz
  // (bcCall ma 25 s timeoutu — sekwencyjnie 200 zamowien moglo trwac ponad godzine).
  const todo = orders.filter((o) => !looksLikeInPostNumber(o.trackingNumber));
  const results = await mapWithConcurrency(todo, 4, (o) => syncBaseCourierOrder(o.id), "basecourierTracking");
  return results.filter((r): r is BcSyncResult => r !== null);
}
