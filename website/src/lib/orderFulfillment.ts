import { prisma } from "@/lib/db";
import { sendMail } from "@/lib/mailer";
import {
  statusInProgressEmail,
  statusLabelCreatedEmail,
  statusShippedEmail,
  statusFulfilledEmail,
  statusCancelledEmail,
  localeFromCountry,
  EMAIL_SUBJECTS,
} from "@/lib/email-templates";
import { cancelOpenFiscalJobsForOrder } from "@/lib/fiscal";
import { carrierEmailFields } from "@/lib/carriers";
import { reverseAffiliateCommission, restoreAffiliateCommission } from "@/lib/affiliates";

// Jedno miejsce, w ktorym zmienia sie fulfillmentStatus zamowienia i wysyla
// maila do klienta. Uzywane przez:
//   - PATCH /api/admin/orders/[id]   (reczna zmiana w panelu)
//   - src/lib/inpostTracking.ts      (automat na podstawie sledzenia InPost)
// Dzieki temu automat wysyla dokladnie te same maile co reczna zmiana.

export type FulfillmentStatus =
  | "unfulfilled"
  | "in_progress"
  | "shipped"
  | "fulfilled"
  | "cancelled";

// Allowlista dla PATCH /api/admin/orders/[id] (kontrakt K7).
export const FULFILLMENT_STATUSES: readonly FulfillmentStatus[] = [
  "unfulfilled",
  "in_progress",
  "shipped",
  "fulfilled",
  "cancelled",
];

export function isFulfillmentStatus(v: unknown): v is FulfillmentStatus {
  return typeof v === "string" && (FULFILLMENT_STATUSES as readonly string[]).includes(v);
}

// Kolejnosc "postepu" — automat ze sledzenia nigdy nie cofa statusu
// (np. z fulfilled na shipped, gdy InPost zwroci starszy status) i nigdy nie
// nadpisuje recznego cancelled.
const RANK: Record<FulfillmentStatus, number> = {
  unfulfilled: 0,
  in_progress: 1,
  shipped: 2,
  fulfilled: 3,
  cancelled: 99,
};

export function isForwardTransition(from: string, to: FulfillmentStatus): boolean {
  if (from === "cancelled") return false;
  const f = RANK[(from as FulfillmentStatus)] ?? 0;
  return RANK[to] > f;
}

interface ApplyOptions {
  // undefined = bez zmian, null/"" = wyczysc numer, tekst = ustaw
  trackingNumber?: string | null;
  adminNotes?: string | null;
  // "manual" = admin w panelu (moze cofac statusy), "tracking" = automat
  source: "manual" | "tracking";
  // Status, ktory widzial admin przy zaladowaniu (K7). Inny niz aktualny →
  // nic nie zmieniamy, wynik ma conflict=true (route zwraca 409).
  expectedStatus?: string;
}

export interface ApplyResult {
  changed: boolean;
  emailSent: boolean;
  previousStatus: string;
  newStatus: string;
  // true = status zmienil sie w miedzyczasie (expectedStatus albo rownolegla
  // zmiana cron vs panel) — nic nie wyslano.
  conflict?: boolean;
}

export async function applyFulfillmentStatus(
  orderId: string,
  newStatus: FulfillmentStatus | undefined,
  opts: ApplyOptions
): Promise<ApplyResult | null> {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return null;

  const previousStatus = order.fulfillmentStatus || "unfulfilled";
  const now = new Date();

  if (opts.expectedStatus !== undefined && opts.expectedStatus !== previousStatus) {
    return { changed: false, emailSent: false, previousStatus, newStatus: previousStatus, conflict: true };
  }

  const statusData: {
    fulfillmentStatus?: string;
    shippedAt?: Date;
    deliveredAt?: Date;
  } = {};
  const data: {
    trackingNumber?: string | null;
    adminNotes?: string | null;
  } = {};

  let statusChanged = false;
  if (newStatus && newStatus !== previousStatus) {
    // Automat nie cofa i nie odwolywuje zamowien.
    if (opts.source === "tracking" && !isForwardTransition(previousStatus, newStatus)) {
      newStatus = undefined;
    } else {
      statusData.fulfillmentStatus = newStatus;
      statusChanged = true;
      if (newStatus === "shipped" && !order.shippedAt) statusData.shippedAt = now;
      if (newStatus === "fulfilled") {
        if (!order.shippedAt) statusData.shippedAt = now;
        if (!order.deliveredAt) statusData.deliveredAt = now;
      }
    }
  }

  if (opts.trackingNumber !== undefined) {
    const t = typeof opts.trackingNumber === "string" ? opts.trackingNumber.trim() : "";
    // Pusty string / null = admin wyczyscil pole (K7).
    data.trackingNumber = t || null;
  }
  if (opts.adminNotes !== undefined) data.adminNotes = opts.adminNotes;

  let conflict = false;
  if (statusChanged) {
    // Warunkowo wzgledem statusu, ktory przeczytalismy: cron sledzenia i reczny
    // PATCH w tym samym momencie nie zmienia statusu dwa razy (dwa maile).
    const r = await prisma.order.updateMany({
      where: { id: orderId, fulfillmentStatus: order.fulfillmentStatus },
      data: { ...statusData, ...data },
    });
    if (r.count === 0) {
      statusChanged = false;
      conflict = true;
      // Status przegral wyscig — pozostale pola (notatka/numer) i tak zapisujemy,
      // chyba ze admin wyraznie oczekiwal konkretnego statusu.
      if (opts.expectedStatus === undefined && Object.keys(data).length > 0) {
        await prisma.order.update({ where: { id: orderId }, data });
      }
    }
  } else if (Object.keys(data).length > 0) {
    await prisma.order.update({ where: { id: orderId }, data });
  }

  // Anulowane = pieniadze zwrocone: paragon fiskalny nie moze sie juz wydrukowac.
  // Prowizja partnera: anulowanie = zwrot pieniedzy -> cofnieta; cofniecie
  // anulowania przez admina -> przywrocona (lib/affiliates.ts).
  if (statusChanged && newStatus === "cancelled") {
    await reverseAffiliateCommission(orderId, "Zamowienie anulowane").catch((e) => console.error(`[fulfillment] affiliate reverse failed ${orderId}:`, e));
  } else if (statusChanged && previousStatus === "cancelled") {
    await restoreAffiliateCommission(orderId).catch((e) => console.error(`[fulfillment] affiliate restore failed ${orderId}:`, e));
  }
  if (statusChanged && newStatus === "cancelled") {
    await cancelOpenFiscalJobsForOrder(orderId, "Zamówienie anulowane (zwrot) — paragon wstrzymany");
  }

  let emailSent = false;
  if (statusChanged && newStatus && order.customerEmail) {
    const locale = localeFromCountry(order.customerCountry);
    const trackingForEmail = (data.trackingNumber !== undefined ? data.trackingNumber : order.trackingNumber) || "";
    const emailData = {
      customerName: order.customerName || "Customer",
      product: "KalkMate v3.0",
      trackingNumber: trackingForEmail,
      pickupPoint: order.pickupPoint || "",
      pickupPointAddress: order.pickupPointAddress || "",
      // Przewoznik + link sledzenia + adres drzwi-drzwi (lib/carriers.ts) —
      // wczesniej maile zawsze mowily "InPost", takze o paczkach DPD/UPS.
      ...(await carrierEmailFields(order, trackingForEmail)),
    };

    let html: string | null = null;
    let subject = "";
    if (newStatus === "in_progress") {
      html = statusInProgressEmail(emailData, locale);
      subject = EMAIL_SUBJECTS.orderInProgress[locale];
    } else if (newStatus === "shipped") {
      html = statusShippedEmail(emailData, locale);
      subject = EMAIL_SUBJECTS.orderShipped[locale];
    } else if (newStatus === "fulfilled") {
      html = statusFulfilledEmail(emailData, locale);
      subject = EMAIL_SUBJECTS.orderFulfilled[locale];
    } else if (newStatus === "cancelled") {
      html = statusCancelledEmail(emailData, locale);
      subject = EMAIL_SUBJECTS.orderCancelled[locale];
    }

    if (html) {
      // sendMail nie rzuca — zwraca { ok:false } (patrz lib/mailer.ts).
      const r = await sendMail({ to: order.customerEmail, subject, html }).catch((err) => ({ ok: false, error: String(err) }));
      emailSent = r.ok;
      if (!r.ok) console.error(`[fulfillment] email failed for order ${orderId}:`, r.error);
    }
  }

  return {
    changed: statusChanged,
    emailSent,
    previousStatus,
    newStatus: statusChanged && newStatus ? newStatus : previousStatus,
    ...(conflict ? { conflict: true } : {}),
  };
}

// Mail "Pakujemy i wysylamy" z numerem przesylki — wysylany RAZ na numer:
//   - po nadaniu z panelu (basecourier/route.ts) i po "Powiaz zlecenie",
//   - przy kazdym sprawdzeniu statusu (przycisk + cron), jesli wczesniej nie
//     poszedl (np. numer wpisany recznie, blad SMTP, zamowienia sprzed tej funkcji).
// Znacznik z numerem w adminNotes (jak flagi zwrotow — bez nowej kolumny):
// zajmowany atomowo PRZED wysylka (cron i przycisk naraz nie wysla dwoch),
// zdejmowany, gdy wysylka sie nie uda (nastepne sprawdzenie ponowi). Nowy
// numer przesylki = nowy znacznik = nowy mail.
// Tylko dla "unfulfilled"/"in_progress": po odbiorze przez kuriera klient ma
// numer w mailu "W drodze". unfulfilled -> in_progress BEZ zwyklego maila
// "w realizacji" (bylby drugim mailem w tej samej chwili).
export async function ensureLabelEmail(orderId: string): Promise<boolean> {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return false;
  const status = order.fulfillmentStatus || "unfulfilled";
  const trackingNumber = (order.trackingNumber || "").trim();
  if (status !== "unfulfilled" && status !== "in_progress") return false;
  if (!trackingNumber) return false;

  if (status === "unfulfilled") {
    await prisma.order.updateMany({
      where: { id: orderId, fulfillmentStatus: order.fulfillmentStatus },
      data: { fulfillmentStatus: "in_progress" },
    });
  }
  if (!order.customerEmail) return false;

  const marker = `[mail „Pakujemy i wysyłamy”: ${trackingNumber}]`;
  const line = `${marker} ${new Date().toISOString().slice(0, 16)}`;
  const claimed = await prisma.$executeRaw`
    UPDATE "Order" SET "adminNotes" = CASE
      WHEN "adminNotes" IS NULL OR "adminNotes" = '' THEN ${line}
      ELSE "adminNotes" || char(10) || ${line}
    END
    WHERE id = ${orderId} AND ("adminNotes" IS NULL OR instr("adminNotes", ${marker}) = 0)`;
  if (Number(claimed) === 0) return false; // juz wyslany (albo wysylany wlasnie teraz)

  const locale = localeFromCountry(order.customerCountry);
  const html = statusLabelCreatedEmail({
    customerName: order.customerName || "Customer",
    product: "KalkMate v3.0",
    trackingNumber,
    pickupPoint: order.pickupPoint || "",
    pickupPointAddress: order.pickupPointAddress || "",
    ...(await carrierEmailFields(order, trackingNumber)),
  }, locale);
  const r = await sendMail({ to: order.customerEmail, subject: EMAIL_SUBJECTS.orderLabelCreated[locale], html })
    .catch((err) => ({ ok: false, error: String(err) }));
  if (!r.ok) {
    console.error(`[fulfillment] label email failed for order ${orderId}:`, r.error);
    await prisma.$executeRaw`
      UPDATE "Order" SET "adminNotes" = replace(replace("adminNotes", char(10) || ${line}, ''), ${line}, '')
      WHERE id = ${orderId}`.catch((e) => console.error(`[fulfillment] label email marker rollback failed ${orderId}:`, e));
  }
  return r.ok;
}
