import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
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

const PAYMENT_STATUS: Record<string, string> = {
  pending: "requires_payment_method",
  paid: "succeeded",
  cancelled: "canceled",
  refunded: "refunded",
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authErr = requireAdminAuth(request); if (authErr) return authErr;
  const { id } = await params;

  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  return NextResponse.json({
    order: {
      id: order.id,
      amount: order.amount,
      currency: order.currency,
      status: PAYMENT_STATUS[order.status] || order.status,
      created: Math.floor(order.createdAt.getTime() / 1000),
      metadata: {},
      customer_name: order.customerName || "",
      customer_email: order.customerEmail || "",
      customer_phone: order.customerPhone || "",
      customer_address_street: order.customerAddressStreet || "",
      customer_address_postcode: order.customerAddressPostcode || "",
      customer_address_city: order.customerAddressCity || "",
      pickup_point: order.pickupPoint || "",
      pickup_point_address: order.pickupPointAddress || "",
      product: "KalkMate v1.0",
      fulfillment_status: order.fulfillmentStatus || "unfulfilled",
      shipped_at: order.shippedAt ? order.shippedAt.toISOString() : null,
      tracking_number: order.trackingNumber || "",
      admin_notes: order.adminNotes || "",
      furgonetka_package_id: order.furgonetkaPackageId || "",
      furgonetka_order_uuid: order.furgonetkaOrderUuid || "",
      furgonetka_status: order.furgonetkaStatus || "",
      invoice_sent_at: order.invoiceSentAt ? order.invoiceSentAt.toISOString() : null,
      invoice_filename: order.invoiceFilename || "",
      payment_provider: order.paymentProvider,
    },
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authErr = requireAdminAuth(request); if (authErr) return authErr;
  const { id } = await params;
  const body = await request.json();
  const { fulfillment_status, tracking_number, notes } = body;

  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const previousStatus = order.fulfillmentStatus || "unfulfilled";
  const now = new Date();

  const data: {
    fulfillmentStatus?: string;
    shippedAt?: Date;
    trackingNumber?: string;
    adminNotes?: string;
  } = {};

  if (fulfillment_status) {
    data.fulfillmentStatus = fulfillment_status;
    if (fulfillment_status === "shipped" || fulfillment_status === "fulfilled") {
      data.shippedAt = now;
    }
  }
  if (tracking_number) data.trackingNumber = tracking_number;
  if (notes !== undefined) data.adminNotes = notes;

  const updated = await prisma.order.update({ where: { id }, data });

  // Send email notification if fulfillment status changed
  if (
    fulfillment_status &&
    fulfillment_status !== previousStatus &&
    order.customerEmail
  ) {
    const locale = localeFromCountry(order.customerCountry);
    const emailData = {
      customerName: order.customerName || "Customer",
      product: "KalkMate v1.0",
      trackingNumber: tracking_number || order.trackingNumber || "",
      pickupPoint: order.pickupPoint || "",
      pickupPointAddress: order.pickupPointAddress || "",
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
        await sendMail({ to: order.customerEmail, subject, html });
      } catch (emailError) {
        console.error("Failed to send status email:", emailError);
      }
    }
  }

  return NextResponse.json({ order: updated });
}
