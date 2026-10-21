import { prisma } from "@/lib/db";
import { applyFulfillmentStatus, ensureLabelEmail, isForwardTransition, type FulfillmentStatus } from "@/lib/orderFulfillment";

// Atomowe dopisanie linii do Order.adminNotes (jedno UPDATE w SQL). Dawniej
// read-modify-write: notatka admina zapisana w panelu miedzy odczytem a zapisem
// crona/nadania ginela. marker (opcjonalny) = nie dopisuj, jesli ten tekst juz
// jest w notatkach (deduplikacja flag zwrotu przy kolejnych przebiegach crona).
// Zwraca true, gdy dopisano.
export async function appendOrderNoteOnce(orderId: string, line: string, marker = ""): Promise<boolean> {
  const n = await prisma.$executeRaw`
    UPDATE "Order" SET "adminNotes" = CASE
      WHEN "adminNotes" IS NULL OR "adminNotes" = '' THEN ${line}
      ELSE COALESCE("adminNotes", '') || char(10) || ${line}
    END
    WHERE id = ${orderId}
      AND (${marker} = '' OR "adminNotes" IS NULL OR instr("adminNotes", ${marker}) = 0)`;
  return Number(n) > 0;
}

// Wspolny straznik automatu sledzenia (InPost i Base Courier): nie ruszamy
// statusu ustawionego recznie na "cancelled" i nigdy go nie cofamy (np.
// fulfilled -> shipped, gdy przewoznik zwroci starsze zdarzenie). To samo
// sprawdza applyFulfillmentStatus(source:"tracking") — tu dodatkowo, zeby nie
// robic zbednego zapisu i miec czytelna notatke w wyniku.
export function trackingSkipReason(current: string | null | undefined, target: FulfillmentStatus): string | null {
  const cur = current || "unfulfilled";
  if (cur === "cancelled") return "cancelled_skip";
  if (cur === target) return "no_change";
  if (!isForwardTransition(cur, target)) return "no_downgrade";
  return null;
}

// Sledzenie InPost przez publiczne API ShipX (bez klucza):
//   GET https://api-shipx-pl.easypack24.net/v1/tracking/{numer}
// UWAGA: sciezka to /tracking/ (liczba pojedyncza). Stary kod uzywal
// /trackings/ i dostawal 404 "routing_not_found" — dlatego automat nigdy
// nie dzialal.

const INPOST_TRACKING_URL = "https://api-shipx-pl.easypack24.net/v1/tracking";
const INPOST_TIMEOUT_MS = 20_000;

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
      signal: AbortSignal.timeout(INPOST_TIMEOUT_MS),
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
  labelEmailSent?: boolean;
  note?: string;
}

// Synchronizacja jednego zamowienia. Bezpieczna do wywolania wielokrotnie.
// prefetched — stan przesylki JUZ pobrany przez wywolujacego (np. przycisk
// "Sprawdz status" pokazuje tez zdarzenia, wiec nie pytamy InPost drugi raz):
//   undefined = pobierz samodzielnie, null = InPost niedostepny (bez ponownej proby).
// Jesli prefetched dotyczy innego numeru niz aktualny w zamowieniu (zmiana w
// miedzyczasie), pobieramy od nowa.
// + brakujacy mail "Pakujemy i wysylamy" (ensureLabelEmail) — PO zmianie statusu,
// zeby paczka juz odebrana przez kuriera dostala tylko "W drodze".
export async function syncOrderTracking(orderId: string, prefetched?: InPostTracking | null): Promise<SyncResult | null> {
  const r = await syncOrderTrackingInner(orderId, prefetched);
  let labelEmailSent = false;
  // Przewoznik nie odpowiedzial = nie wiemy, czy paczka juz nie jedzie/nie lezy
  // w Paczkomacie (status mogl nie zdazyc sie przesunac) — mail przy nastepnym sprawdzeniu.
  if (r?.note?.endsWith("_unavailable")) return r;
  try { labelEmailSent = await ensureLabelEmail(orderId); } catch (e) { console.error("[tracking] label email failed", orderId, e); }
  return r ? { ...r, labelEmailSent } : r;
}

async function syncOrderTrackingInner(orderId: string, prefetched?: InPostTracking | null): Promise<SyncResult | null> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { trackingNumber: true, fulfillmentStatus: true },
  });
  if (!order || !order.trackingNumber) return null;

  const current = order.fulfillmentStatus || "unfulfilled";
  const base: SyncResult = {
    orderId,
    trackingNumber: order.trackingNumber,
    inpostStatus: null,
    previousStatus: current,
    newStatus: current,
    changed: false,
    emailSent: false,
  };

  if (!looksLikeInPostNumber(order.trackingNumber)) {
    return { ...base, note: "not_inpost_number" };
  }

  const number = order.trackingNumber.trim();
  const tracking =
    prefetched === undefined || (prefetched !== null && prefetched.trackingNumber !== number)
      ? await fetchInPostTracking(number)
      : prefetched;
  if (!tracking) return { ...base, note: "inpost_unavailable" };
  base.inpostStatus = tracking.status;

  const mapped = mapInPostStatus(tracking.status);
  if (mapped === null) return { ...base, note: "no_change" };

  if (mapped === "return") {
    const marker = `[InPost ${tracking.status}]`;
    await appendOrderNoteOnce(
      orderId,
      `${marker} ${new Date().toISOString().slice(0, 16)} — wymaga recznej decyzji (zwrot/awizo).`,
      marker
    );
    return { ...base, note: "return_flagged" };
  }

  const skip = trackingSkipReason(current, mapped);
  if (skip) return { ...base, note: skip };

  const result = await applyFulfillmentStatus(orderId, mapped, { source: "tracking" });
  if (!result) return null;
  return {
    ...base,
    newStatus: result.newStatus,
    changed: result.changed,
    emailSent: result.emailSent,
    note: result.changed ? "updated" : result.conflict ? "conflict" : "no_change",
  };
}

// Prosta pula: najwyzej `concurrency` zadan naraz, wyniki w kolejnosci wejscia.
// Bledy pojedynczych zadan nie przerywaja reszty (null + log).
export async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R | null>,
  label = "tracking"
): Promise<(R | null)[]> {
  const out: (R | null)[] = new Array(items.length).fill(null);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      try {
        out[i] = await fn(items[i]);
      } catch (e) {
        console.error(`[${label}] item ${i} failed:`, e);
        out[i] = null;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(concurrency, items.length)) }, worker));
  return out;
}

// Wszystkie zamowienia z numerem InPost, ktore nie sa jeszcze zamkniete.
// Do 4 zapytan naraz: sekwencyjnie 200 x 20 s timeoutu przekraczalo 30-minutowy
// zamek crona, gdy InPost nie odpowiadal.
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

  const inpost = orders.filter((o) => looksLikeInPostNumber(o.trackingNumber));
  const results = await mapWithConcurrency(inpost, 4, (o) => syncOrderTracking(o.id), "inpostTracking");
  return results.filter((r): r is SyncResult => r !== null);
}
