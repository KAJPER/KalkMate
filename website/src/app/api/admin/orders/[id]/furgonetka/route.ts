import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import {
  createFurgonetkaPackage,
  orderFurgonetkaShipment,
  getFurgonetkaCommandStatus,
  requestFurgonetkaDocuments,
  getFurgonetkaDocumentUrl,
} from "@/lib/furgonetka";

// Your sender address (configure in env or hardcode your own)
const SENDER = {
  name: process.env.FURGONETKA_SENDER_NAME || "KalkMate",
  company: process.env.FURGONETKA_SENDER_COMPANY || "KalkMate",
  street: process.env.FURGONETKA_SENDER_STREET || "",
  postcode: process.env.FURGONETKA_SENDER_POSTCODE || "",
  city: process.env.FURGONETKA_SENDER_CITY || "",
  phone: process.env.FURGONETKA_SENDER_PHONE || "",
  email: process.env.FURGONETKA_SENDER_EMAIL || "",
  country_code: "PL",
};

// Default InPost paczkomat service_id (from Furgonetka panel)
const INPOST_SERVICE_ID = parseInt(process.env.FURGONETKA_INPOST_SERVICE_ID || "0", 10);

/**
 * POST /api/admin/orders/[id]/furgonetka
 * Creates a shipment label for a given Stripe payment intent.
 * Body: { action: "create" | "documents" | "status", commandUuid?: string }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const { action = "create", commandUuid, serviceId } = body;

  try {
    // Fetch order from Stripe
    const pi = await stripe.paymentIntents.retrieve(id);
    const meta = pi.metadata;

    if (!meta.customer_name || !meta.customer_phone) {
      return NextResponse.json({ error: "Brak danych klienta w zamówieniu" }, { status: 400 });
    }

    if (action === "status" && commandUuid) {
      // Check command status
      const status = await getFurgonetkaCommandStatus(commandUuid);
      return NextResponse.json(status);
    }

    if (action === "documents" && commandUuid) {
      // Get document URL
      try {
        const url = await getFurgonetkaDocumentUrl(commandUuid, 30_000);
        return NextResponse.json({ url });
      } catch (e) {
        return NextResponse.json({ pending: true, message: (e as Error).message });
      }
    }

    if (action === "request_documents") {
      // Get the package_id from metadata
      const packageId = meta.furgonetka_package_id;
      if (!packageId) {
        return NextResponse.json({ error: "Najpierw utwórz przesyłkę" }, { status: 400 });
      }
      const uuid = await requestFurgonetkaDocuments([packageId]);
      return NextResponse.json({ uuid });
    }

    // action === "create" - create new package
    // Extract receiver address from Stripe metadata
    // Address fields: customer_address_street, customer_address_postcode, customer_address_city
    // (or parse from pickup_point_address for legacy orders)
    const receiverStreet = meta.customer_address_street || "";
    const receiverPostcode = meta.customer_address_postcode || "";
    const receiverCity = meta.customer_address_city || "";
    const pickupPointId = meta.pickup_point || "";

    // Determine service_id
    const resolvedServiceId = serviceId || INPOST_SERVICE_ID;
    if (!resolvedServiceId) {
      return NextResponse.json(
        { error: "Brak skonfigurowanego service_id. Ustaw FURGONETKA_INPOST_SERVICE_ID lub przekaż serviceId w body." },
        { status: 400 }
      );
    }

    // Build receiver
    const receiver: {
      name: string;
      phone: string;
      email: string;
      country_code: string;
      point?: string;
      street: string;
      postcode: string;
      city: string;
    } = {
      name: meta.customer_name,
      phone: meta.customer_phone,
      email: meta.customer_email || "",
      country_code: "PL",
      street: "",
      postcode: "",
      city: "",
    };

    // For paczkomat delivery, use the point ID
    if (pickupPointId) {
      receiver.point = pickupPointId;
      // Street/postcode/city not required when delivering to point
      receiver.street = receiverStreet || "—";
      receiver.postcode = receiverPostcode || "00-000";
      receiver.city = receiverCity || "—";
    } else {
      if (!receiverStreet || !receiverPostcode || !receiverCity) {
        return NextResponse.json(
          { error: "Brak adresu odbiorcy. Uzupełnij adres w zamówieniu." },
          { status: 400 }
        );
      }
      receiver.street = receiverStreet;
      receiver.postcode = receiverPostcode;
      receiver.city = receiverCity;
    }


    // Create package in Furgonetka cart
    const pkg = await createFurgonetkaPackage({
      pickup: SENDER,
      receiver,
      service_id: resolvedServiceId,
      parcels: [{ weight: 0.5, width: 20, height: 10, depth: 15 }],
      user_reference_number: pi.metadata.product ? `KalkMate #${id.slice(-8)}` : undefined,
    });

    // Order/confirm the shipment
    const orderResult = await orderFurgonetkaShipment([pkg.package_id]);

    // Wait for command to complete (up to 30s)
    let commandStatus: { status: string; details?: unknown; errors?: unknown[] } = { status: "queueing" };
    const deadline = Date.now() + 30_000;
    while (Date.now() < deadline && commandStatus.status === "queueing") {
      await new Promise((r) => setTimeout(r, 2000));
      commandStatus = await getFurgonetkaCommandStatus(orderResult.uuid);
    }

    // Save package_id and order uuid to Stripe metadata
    await stripe.paymentIntents.update(id, {
      metadata: {
        furgonetka_package_id: pkg.package_id,
        furgonetka_order_uuid: orderResult.uuid,
        furgonetka_status: commandStatus.status,
      },
    });

    return NextResponse.json({
      package_id: pkg.package_id,
      order_uuid: orderResult.uuid,
      command_status: commandStatus,
    });
  } catch (error) {
    console.error("Furgonetka error:", error);
    return NextResponse.json(
      { error: (error as Error).message || "Nieznany błąd Furgonetka" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/orders/[id]/furgonetka
 * Returns current Furgonetka status for this order.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const pi = await stripe.paymentIntents.retrieve(id);
    const meta = pi.metadata;

    return NextResponse.json({
      package_id: meta.furgonetka_package_id || null,
      order_uuid: meta.furgonetka_order_uuid || null,
      status: meta.furgonetka_status || null,
    });
  } catch (error) {
    console.error("Furgonetka GET error:", error);
    return NextResponse.json({ error: "Nie znaleziono zamówienia" }, { status: 404 });
  }
}
