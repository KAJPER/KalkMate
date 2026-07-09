import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";
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
 * Creates a shipment label for a given order.
 * Body: { action: "create" | "documents" | "status", commandUuid?: string }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authErr = requireAdminAuth(request); if (authErr) return authErr;
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const { action = "create", commandUuid, serviceId } = body;

  try {
    const order = await prisma.order.findUnique({ where: { id } });
    if (!order) {
      return NextResponse.json({ error: "Nie znaleziono zamówienia" }, { status: 404 });
    }

    if (!order.customerName || !order.customerPhone) {
      return NextResponse.json({ error: "Brak danych klienta w zamówieniu" }, { status: 400 });
    }

    if (action === "status" && commandUuid) {
      const status = await getFurgonetkaCommandStatus(commandUuid);
      return NextResponse.json(status);
    }

    if (action === "documents" && commandUuid) {
      try {
        const url = await getFurgonetkaDocumentUrl(commandUuid, 30_000);
        return NextResponse.json({ url });
      } catch (e) {
        return NextResponse.json({ pending: true, message: (e as Error).message });
      }
    }

    if (action === "request_documents") {
      const packageId = order.furgonetkaPackageId;
      if (!packageId) {
        return NextResponse.json({ error: "Najpierw utwórz przesyłkę" }, { status: 400 });
      }
      const uuid = await requestFurgonetkaDocuments([packageId]);
      return NextResponse.json({ uuid });
    }

    // action === "create" - create new package
    const receiverStreet = order.customerAddressStreet || "";
    const receiverPostcode = order.customerAddressPostcode || "";
    const receiverCity = order.customerAddressCity || "";
    const pickupPointId = order.pickupPoint || "";

    const resolvedServiceId = serviceId || INPOST_SERVICE_ID;
    if (!resolvedServiceId) {
      return NextResponse.json(
        { error: "Brak skonfigurowanego service_id. Ustaw FURGONETKA_INPOST_SERVICE_ID lub przekaż serviceId w body." },
        { status: 400 }
      );
    }

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
      name: order.customerName,
      phone: order.customerPhone,
      email: order.customerEmail || "",
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
      user_reference_number: `KalkMate #${id.slice(-8)}`,
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

    await prisma.order.update({
      where: { id },
      data: {
        furgonetkaPackageId: pkg.package_id,
        furgonetkaOrderUuid: orderResult.uuid,
        furgonetkaStatus: commandStatus.status,
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
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authErr = requireAdminAuth(request); if (authErr) return authErr;
  const { id } = await params;

  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) {
    return NextResponse.json({ error: "Nie znaleziono zamówienia" }, { status: 404 });
  }

  return NextResponse.json({
    package_id: order.furgonetkaPackageId || null,
    order_uuid: order.furgonetkaOrderUuid || null,
    status: order.furgonetkaStatus || null,
  });
}
