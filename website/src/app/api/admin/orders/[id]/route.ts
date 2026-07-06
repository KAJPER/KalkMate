import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { stripe } from "@/lib/stripe";
import { sendMail } from "@/lib/mailer";
import {
  statusInProgressEmail,
  statusShippedEmail,
  statusFulfilledEmail,
  statusCancelledEmail,
  localeFromCountry,
  EMAIL_SUBJECTS,
} from "@/lib/email-templates";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authErr = requireAdminAuth(request); if (authErr) return authErr;
  const { id } = await params;

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
