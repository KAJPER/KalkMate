import { prisma } from "@/lib/db";
import { sendMail } from "@/lib/mailer";
import {
  statusInProgressEmail,
  statusShippedEmail,
  statusFulfilledEmail,
  statusCancelledEmail,
  localeFromCountry,
  EMAIL_SUBJECTS,
} from "@/lib/email-templates";

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
  trackingNumber?: string | null;
  adminNotes?: string;
  // "manual" = admin w panelu (moze cofac statusy), "tracking" = automat
  source: "manual" | "tracking";
}

export interface ApplyResult {
  changed: boolean;
  emailSent: boolean;
  previousStatus: string;
  newStatus: string;
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

  const data: {
    fulfillmentStatus?: string;
    shippedAt?: Date;
    deliveredAt?: Date;
    trackingNumber?: string;
    adminNotes?: string;
  } = {};

  let statusChanged = false;
  if (newStatus && newStatus !== previousStatus) {
    // Automat nie cofa i nie odwolywuje zamowien.
    if (opts.source === "tracking" && !isForwardTransition(previousStatus, newStatus)) {
      newStatus = undefined;
    } else {
      data.fulfillmentStatus = newStatus;
      statusChanged = true;
      if (newStatus === "shipped" && !order.shippedAt) data.shippedAt = now;
      if (newStatus === "fulfilled") {
        if (!order.shippedAt) data.shippedAt = now;
        if (!order.deliveredAt) data.deliveredAt = now;
      }
    }
  }

  if (opts.trackingNumber !== undefined && opts.trackingNumber !== null && opts.trackingNumber !== "") {
    data.trackingNumber = opts.trackingNumber;
  }
  if (opts.adminNotes !== undefined) data.adminNotes = opts.adminNotes;

  if (Object.keys(data).length > 0) {
    await prisma.order.update({ where: { id: orderId }, data });
  }

  let emailSent = false;
  if (statusChanged && newStatus && order.customerEmail) {
    const locale = localeFromCountry(order.customerCountry);
    const emailData = {
      customerName: order.customerName || "Customer",
      product: "KalkMate v3.0",
      trackingNumber: opts.trackingNumber || order.trackingNumber || "",
      pickupPoint: order.pickupPoint || "",
      pickupPointAddress: order.pickupPointAddress || "",
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
      try {
        await sendMail({ to: order.customerEmail, subject, html });
        emailSent = true;
      } catch (err) {
        console.error(`[fulfillment] email failed for order ${orderId}:`, err);
      }
    }
  }

  return {
    changed: statusChanged,
    emailSent,
    previousStatus,
    newStatus: newStatus ?? previousStatus,
  };
}
