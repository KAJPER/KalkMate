import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { stripe } from "@/lib/stripe";
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

const P24_PAYMENT_STATUS: Record<string, string> = {
  pending: "requires_payment_method",
  paid: "succeeded",
  cancelled: "canceled",
  refunded: "refunded",
};

function p24FulfillmentStatus(order: {
  status: string;
  shippedAt: Date | null;
  deliveredAt: Date | null;
}): string {
  if (order.status === "cancelled") return "cancelled";
  if (order.deliveredAt) return "fulfilled";
  if (order.shippedAt) return "shipped";
  return "unfulfilled";
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authErr = requireAdminAuth(request); if (authErr) return authErr;
  const { id } = await params;

  // Przelewy24 orders don't exist in Stripe at all — they live only in our DB.
  const p24Order = await prisma.order.findFirst({
    where: { id, paymentProvider: "p24" },
  });
  if (p24Order) {
    return NextResponse.json({
      order: {
        id: p24Order.id,
        amount: p24Order.amount,
        currency: p24Order.currency,
        status: P24_PAYMENT_STATUS[p24Order.status] || p24Order.status,
        created: Math.floor(p24Order.createdAt.getTime() / 1000),
        metadata: {},
        customer_name: p24Order.customerName || "",
        customer_email: p24Order.customerEmail || "",
        customer_phone: p24Order.customerPhone || "",
        customer_address_street: "",
        customer_address_postcode: "",
        customer_address_city: "",
        pickup_point: p24Order.pickupPoint || "",
        pickup_point_address: p24Order.pickupPointAddress || "",
        product: "KalkMate v1.0",
        fulfillment_status: p24FulfillmentStatus(p24Order),
        shipped_at: p24Order.shippedAt ? p24Order.shippedAt.toISOString() : null,
        tracking_number: p24Order.trackingNumber || "",
        admin_notes: "",
        furgonetka_package_id: "",
        furgonetka_order_uuid: "",
        furgonetka_status: "",
        invoice_sent_at: p24Order.invoiceSentAt ? p24Order.invoiceSentAt.toISOString() : null,
        invoice_filename: p24Order.invoiceFilename || "",
        payment_provider: "p24",
      },
    });
  }

  try {
    const pi = await stripe.paymentIntents.retrieve(id, {
      expand: ["latest_charge"],
    });

    let mappedStatus = pi.status as string;
    const charge = pi.latest_charge as any;
    
    if (mappedStatus === "succeeded" && charge) {
      if (charge.refunded) {
        mappedStatus = "refunded";
      } else if (charge.amount_refunded && charge.amount_refunded > 0) {
        mappedStatus = "partially_refunded";
      }
    }

    return NextResponse.json({
      order: {
        id: pi.id,
        amount: pi.amount,
        currency: pi.currency,
        status: mappedStatus,
        created: pi.created,
        metadata: pi.metadata,
        customer_name: pi.metadata.customer_name || "",
        customer_email: pi.metadata.customer_email || "",
        customer_phone: pi.metadata.customer_phone || "",
        customer_address_street: pi.metadata.customer_address_street || "",
        customer_address_postcode: pi.metadata.customer_address_postcode || "",
        customer_address_city: pi.metadata.customer_address_city || "",
        pickup_point: pi.metadata.pickup_point || "",
        pickup_point_address: pi.metadata.pickup_point_address || "",
        product: pi.metadata.product || "",
        fulfillment_status: pi.metadata.fulfillment_status || "unfulfilled",
        shipped_at: pi.metadata.shipped_at || null,
        tracking_number: pi.metadata.tracking_number || "",
        admin_notes: pi.metadata.admin_notes || "",
        furgonetka_package_id: pi.metadata.furgonetka_package_id || "",
        furgonetka_order_uuid: pi.metadata.furgonetka_order_uuid || "",
        furgonetka_status: pi.metadata.furgonetka_status || "",
        invoice_sent_at: pi.metadata.invoice_sent_at || null,
        invoice_filename: pi.metadata.invoice_filename || "",
        payment_provider: "stripe",
      },
    });

  } catch (error) {
    console.error("Error fetching order:", error);
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
}


export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authErr = requireAdminAuth(request); if (authErr) return authErr;
  const { id } = await params;
  const body = await request.json();
  const { fulfillment_status, tracking_number, notes } = body;

  const p24Order = await prisma.order.findFirst({
    where: { id, paymentProvider: "p24" },
  });
  if (p24Order) {
    // Note: the Order table has no admin_notes / distinct "in_progress" fulfillment
    // column (that vocabulary only exists in Stripe metadata today), so those two
    // are not persisted for P24 orders yet — only shipped/fulfilled/cancelled are.
    const previousStatus = p24FulfillmentStatus(p24Order);
    const now = new Date();
    const data: { shippedAt?: Date; deliveredAt?: Date; status?: string; trackingNumber?: string } = {};

    if (fulfillment_status === "shipped") data.shippedAt = now;
    if (fulfillment_status === "fulfilled") data.deliveredAt = now;
    if (fulfillment_status === "cancelled") data.status = "cancelled";
    if (tracking_number) data.trackingNumber = tracking_number;

    const updated = Object.keys(data).length
      ? await prisma.order.update({ where: { id }, data })
      : p24Order;

    if (
      fulfillment_status &&
      fulfillment_status !== previousStatus &&
      p24Order.customerEmail
    ) {
      const emailData = {
        customerName: p24Order.customerName || "Kliencie",
        product: "KalkMate v1.0",
        trackingNumber: tracking_number || p24Order.trackingNumber || "",
        pickupPoint: p24Order.pickupPoint || "",
        pickupPointAddress: p24Order.pickupPointAddress || "",
      };

      let html: string | null = null;
      let subject = "";
      const locale = "en" as const;

      if (fulfillment_status === "in_progress") {
        html = statusInProgressEmail(emailData, locale);
        subject = EMAIL_SUBJECTS.orderInProgress[locale];
      } else if (fulfillment_status === "shipped") {
        html = statusShippedEmail(emailData, locale);
        subject = EMAIL_SUBJECTS.orderShipped[locale];
      } else if (fulfillment_status === "fulfilled") {
        html = statusFulfilledEmail(emailData, locale);
        subject = EMAIL_SUBJECTS.orderFulfilled[locale];
      } else if (fulfillment_status === "cancelled") {
        html = statusCancelledEmail(emailData, locale);
        subject = EMAIL_SUBJECTS.orderCancelled[locale];
      }

      if (html) {
        try {
          await sendMail({ to: p24Order.customerEmail, subject, html });
        } catch (emailError) {
          console.error("Failed to send status email:", emailError);
        }
      }
    }

    return NextResponse.json({ order: updated });
  }

  try {
    // Get current order to check previous status and get customer data
    const pi = await stripe.paymentIntents.retrieve(id);
    const previousStatus = pi.metadata.fulfillment_status || "unfulfilled";

    const metadata: Record<string, string> = {};

    if (fulfillment_status) {
      metadata.fulfillment_status = fulfillment_status;
      if (
        fulfillment_status === "shipped" ||
        fulfillment_status === "fulfilled"
      ) {
        metadata.shipped_at = new Date().toISOString();
      }
    }
    if (tracking_number) metadata.tracking_number = tracking_number;
    if (notes !== undefined) metadata.admin_notes = notes;

    const updated = await stripe.paymentIntents.update(id, { metadata });

    // Send email notification if fulfillment status changed
    if (
      fulfillment_status &&
      fulfillment_status !== previousStatus &&
      pi.metadata.customer_email
    ) {
      const locale = localeFromCountry(pi.metadata.customer_country);
      const emailData = {
        customerName: pi.metadata.customer_name || "Customer",
        product: pi.metadata.product || "KalkMate v1.0",
        trackingNumber: tracking_number || pi.metadata.tracking_number || "",
        pickupPoint: pi.metadata.pickup_point || "",
        pickupPointAddress: pi.metadata.pickup_point_address || "",
      };

      let html: string | null = null;
      let subject = "";

      if (fulfillment_status === "in_progress") {
        html = statusInProgressEmail(emailData, locale);
        subject = EMAIL_SUBJECTS.orderInProgress[locale];
      } else if (fulfillment_status === "shipped") {
        html = statusShippedEmail(emailData, locale);
        subject = EMAIL_SUBJECTS.orderShipped[locale];
      } else if (fulfillment_status === "fulfilled") {
        html = statusFulfilledEmail(emailData, locale);
        subject = EMAIL_SUBJECTS.orderFulfilled[locale];
      } else if (fulfillment_status === "cancelled") {
        html = statusCancelledEmail(emailData, locale);
        subject = EMAIL_SUBJECTS.orderCancelled[locale];
      }

      if (html) {
        try {
          await sendMail({
            to: pi.metadata.customer_email,
            subject,
            html,
          });
        } catch (emailError) {
          console.error("Failed to send status email:", emailError);
        }
      }
    }

    return NextResponse.json({ order: updated });
  } catch (error) {
    console.error("Error updating order:", error);
    return NextResponse.json(
      { error: "Failed to update order" },
      { status: 500 }
    );
  }
}
