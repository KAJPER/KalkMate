import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { sendMail } from "@/lib/mailer";
import {
  statusInProgressEmail,
  statusShippedEmail,
  statusFulfilledEmail,
} from "@/lib/email-templates";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const pi = await stripe.paymentIntents.retrieve(id);
    return NextResponse.json({
      order: {
        id: pi.id,
        amount: pi.amount,
        currency: pi.currency,
        status: pi.status,
        created: pi.created,
        metadata: pi.metadata,
        customer_name: pi.metadata.customer_name || "",
        customer_email: pi.metadata.customer_email || "",
        customer_phone: pi.metadata.customer_phone || "",
        pickup_point: pi.metadata.pickup_point || "",
        pickup_point_address: pi.metadata.pickup_point_address || "",
        product: pi.metadata.product || "",
        fulfillment_status: pi.metadata.fulfillment_status || "unfulfilled",
        shipped_at: pi.metadata.shipped_at || null,
        tracking_number: pi.metadata.tracking_number || "",
        admin_notes: pi.metadata.admin_notes || "",
      },
    });
  } catch (error) {
    console.error("Error fetching order:", error);
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
}

const statusSubjects: Record<string, string> = {
  in_progress: "Twoje zamówienie jest realizowane",
  shipped: "Twoja paczka została wysłana!",
  fulfilled: "Zamówienie zrealizowane",
};

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
    if (tracking_number !== undefined) metadata.tracking_number = tracking_number;
    if (notes !== undefined) metadata.admin_notes = notes;

    const updated = await stripe.paymentIntents.update(id, { metadata });

    // Send email notification if fulfillment status changed
    if (
      fulfillment_status &&
      fulfillment_status !== previousStatus &&
      pi.metadata.customer_email
    ) {
      const emailData = {
        customerName: pi.metadata.customer_name || "Kliencie",
        product: pi.metadata.product || "KalkMate v1.0",
        trackingNumber: tracking_number || pi.metadata.tracking_number || "",
        pickupPoint: pi.metadata.pickup_point || "",
        pickupPointAddress: pi.metadata.pickup_point_address || "",
      };

      let html: string | null = null;

      if (fulfillment_status === "in_progress") {
        html = statusInProgressEmail(emailData);
      } else if (fulfillment_status === "shipped") {
        html = statusShippedEmail(emailData);
      } else if (fulfillment_status === "fulfilled") {
        html = statusFulfilledEmail(emailData);
      }

      if (html) {
        try {
          await sendMail({
            to: pi.metadata.customer_email,
            subject: statusSubjects[fulfillment_status] || "Aktualizacja zamówienia",
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
