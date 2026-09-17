import { prisma } from "@/lib/db";
import { applyFulfillmentStatus, type FulfillmentStatus } from "@/lib/orderFulfillment";

// Sledzenie InPost przez publiczne API ShipX (bez klucza):
//   GET https://api-shipx-pl.easypack24.net/v1/tracking/{numer}
// UWAGA: sciezka to /tracking/ (liczba pojedyncza). Stary kod uzywal
// /trackings/ i dostawal 404 "routing_not_found" — dlatego automat nigdy
// nie dzialal.

const INPOST_TRACKING_URL = "https://api-shipx-pl.easypack24.net/v1/tracking";

export interface InPostTrackingEvent {
  status: string;
  origin_status: string | null;
  datetime: string;
}

export interface InPostTracking {
  trackingNumber: string;
  status: string;            // aktualny status InPost, np. "ready_to_pickup"
  service: string | null;
  targetMachineId: string | null;
  events: InPostTrackingEvent[];
  updatedAt: string | null;
}

// Numery InPost to 24 cyfry. Inne formaty (Furgonetka/DHL itp.) pomijamy —
// nie ma sensu odpytywac API InPost o cudze numery.
export function looksLikeInPostNumber(n: string | null | undefined): boolean {
  return !!n && /^\d{24}$/.test(n.trim());
}

export async function fetchInPostTracking(trackingNumber: string): Promise<InPostTracking | null> {
  const n = trackingNumber.trim();
  try {
    const res = await fetch(`${INPOST_TRACKING_URL}/${encodeURIComponent(n)}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || typeof data.status !== "string") return null;
    const events: InPostTrackingEvent[] = Array.isArray(data.tracking_details)
      ? data.tracking_details.map((e: { status?: string; origin_status?: string; datetime?: string }) => ({
          status: String(e.status ?? ""),
          origin_status: e.origin_status ?? null,
          datetime: String(e.datetime ?? ""),
        }))
      : [];
    return {
      trackingNumber: n,
      status: data.status,
      service: data.service ?? null,
      targetMachineId: data.custom_attributes?.target_machine_id ?? null,
      events,
      updatedAt: data.updated_at ?? null,
    };
  } catch {
    return null;
  }
}

// Mapowanie statusow InPost -> status realizacji zamowienia.
// Decyzja wlasciciela: "fulfilled" juz gdy paczka LEZY w Paczkomacie
// (ready_to_pickup), nie dopiero po odbiorze.
const SHIPPED_STATUSES = new Set([
  "dispatched_by_sender",
  "dispatched_by_sender_to_pok",
  "taken_by_courier",
  "collected_from_sender",
  "adopted_at_source_branch",
  "sent_from_source_branch",
  "adopted_at_sorting_center",
  "sent_from_sorting_center",
  "adopted_at_sorting_hub",
  "sent_from_sorting_hub",
  "adopted_at_target_branch",
  "out_for_delivery",
  "ready_to_pickup_from_branch",
  "redirect_to_box",
  "stack_in_box_machine",
  "stack_in_customer_service_point",
]);

const FULFILLED_STATUSES = new Set([
  "ready_to_pickup",
  "delivered",
  "pickup_reminder_sent",
  "pickup_time_expired",       // nieodebrana — i tak byla dostarczona do Paczkomatu
]);

// Zwrot/odmowa — nie ruszamy statusu automatycznie, tylko flagujemy w notatce
// (to wymaga recznej decyzji: zwrot pieniedzy, ponowna wysylka itd.).
const RETURN_STATUSES = new Set([
  "returned_to_sender",
  "return_pickup_confirmation_to_sender",
  "canceled",
  "undelivered",
  "avizo",
  "claimed",
]);

export function mapInPostStatus(status: string): FulfillmentStatus | "return" | null {
  if (FULFILLED_STATUSES.has(status)) return "fulfilled";
  if (SHIPPED_STATUSES.has(status)) return "shipped";
  if (RETURN_STATUSES.has(status)) return "return";
  // "created", "confirmed", "offer_selected" itp. = etykieta istnieje, kurier
  // jeszcze nie odebral -> nic nie zmieniamy.
  return null;
}

export interface SyncResult {
  orderId: string;
  trackingNumber: string;
  inpostStatus: string | null;
  previousStatus: string;
  newStatus: string;
  changed: boolean;
  emailSent: boolean;
  note?: string;
}

// Synchronizacja jednego zamowienia. Bezpieczna do wywolania wielokrotnie.
export async function syncOrderTracking(orderId: string): Promise<SyncResult | null> {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || !order.trackingNumber) return null;

  const base: SyncResult = {
    orderId,
    trackingNumber: order.trackingNumber,
    inpostStatus: null,
    previousStatus: order.fulfillmentStatus || "unfulfilled",
    newStatus: order.fulfillmentStatus || "unfulfilled",
    changed: false,
    emailSent: false,
  };

  if (!looksLikeInPostNumber(order.trackingNumber)) {
    return { ...base, note: "not_inpost_number" };
  }

  const tracking = await fetchInPostTracking(order.trackingNumber);
  if (!tracking) return { ...base, note: "inpost_unavailable" };
  base.inpostStatus = tracking.status;

  const mapped = mapInPostStatus(tracking.status);
  if (mapped === null) return { ...base, note: "no_change" };

  if (mapped === "return") {
    const marker = `[InPost ${tracking.status}]`;
    if (!(order.adminNotes || "").includes(marker)) {
      await prisma.order.update({
        where: { id: orderId },
        data: {
          adminNotes: `${order.adminNotes ? order.adminNotes + "\n" : ""}${marker} ${new Date().toISOString().slice(0, 16)} — wymaga recznej decyzji (zwrot/awizo).`,
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

// Wszystkie zamowienia z numerem InPost, ktore nie sa jeszcze zamkniete.
export async function syncAllPendingOrders(limit = 200): Promise<SyncResult[]> {
  const orders = await prisma.order.findMany({
    where: {
      trackingNumber: { not: null },
      fulfillmentStatus: { in: ["unfulfilled", "in_progress", "shipped"] },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { id: true, trackingNumber: true },
  });

  const results: SyncResult[] = [];
  for (const o of orders) {
    if (!looksLikeInPostNumber(o.trackingNumber)) continue;
    const r = await syncOrderTracking(o.id);
    if (r) results.push(r);
  }
  return results;
}
