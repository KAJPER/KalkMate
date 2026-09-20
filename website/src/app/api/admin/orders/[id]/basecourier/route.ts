import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";
import { bcCreateLockerShipment, bcValuation, bcValuationInternational } from "@/lib/basecourier";
import { syncOrderTracking } from "@/lib/inpostTracking";

// GET  /api/admin/orders/[id]/basecourier  — wycena + podglad danych, ktore
//                                            poleca do Base Courier (bez nadania)
// POST /api/admin/orders/[id]/basecourier  — NADANIE przesylki InPost Paczkomat
//                                            (kosztuje realne pieniadze na koncie
//                                            Base Courier). Zapisuje numer
//                                            sledzenia w zamowieniu i od razu
//                                            odpytuje InPost.
//
// Identyfikator zlecenia Base Courier trzymamy w istniejacych kolumnach
// furgonetka* (furgonetkaPackageId = blpaczka_order_id, furgonetkaStatus =
// "basecourier"), zeby nie dokladac kolejnych kolumn poza schema Prisma.

function receiverFromOrder(o: {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  pickupPoint: string;
  customerAddressStreet: string | null;
  customerAddressPostcode: string | null;
  customerAddressCity: string | null;
  customerCountry: string | null;
}) {
  return {
    name: o.customerName,
    email: o.customerEmail,
    phone: o.customerPhone,
    lockerCode: (o.pickupPoint || "").trim().toUpperCase(),
    street: o.customerAddressStreet || undefined,
    postal: o.customerAddressPostcode || undefined,
    city: o.customerAddressCity || undefined,
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authErr = await requireAdminAuth(request); if (authErr) return authErr;
  const { id } = await params;
  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) return NextResponse.json({ ok: false, error: "Order not found" }, { status: 404 });

  const country = (order.customerCountry || "PL").toUpperCase();
  const isDomestic = country === "PL" || country === "";

  // Zamowienia zagraniczne (np. DE, US) nie jada InPost Paczkomatem — tylko
  // szacujemy koszt kilkoma kurierami Base Courier, bez mozliwosci nadania
  // z tego panelu (patrz POST nizej — zostaje ograniczone do PL). Admin i tak
  // widzi orientacyjna cene zeby wiedziec ile doliczyc / czy sie oplaca.
  if (!isDomestic) {
    try {
      const quotes = await bcValuationInternational(country);
      return NextResponse.json({
        ok: true,
        international: true,
        country,
        receiver: receiverFromOrder(order),
        quotes,
        alreadyCreated: order.furgonetkaStatus === "basecourier" ? order.furgonetkaPackageId : null,
        trackingNumber: order.trackingNumber,
      });
    } catch (e) {
      return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 502 });
    }
  }

  try {
    const valuation = await bcValuation();
    return NextResponse.json({
      ok: true,
      international: false,
      receiver: receiverFromOrder(order),
      valuation: { price: valuation.price, courierSearchId: valuation.courierSearchId },
      alreadyCreated: order.furgonetkaStatus === "basecourier" ? order.furgonetkaPackageId : null,
      trackingNumber: order.trackingNumber,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 502 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authErr = await requireAdminAuth(request); if (authErr) return authErr;
  const { id } = await params;
  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) return NextResponse.json({ ok: false, error: "Order not found" }, { status: 404 });

  if (order.furgonetkaStatus === "basecourier" && order.furgonetkaPackageId) {
    return NextResponse.json(
      { ok: false, error: `Przesylka Base Courier juz istnieje dla tego zamowienia (ID ${order.furgonetkaPackageId})` },
      { status: 409 }
    );
  }
  if ((order.customerCountry || "PL") !== "PL") {
    return NextResponse.json({ ok: false, error: "Base Courier / InPost Paczkomat: tylko dostawa w Polsce" }, { status: 400 });
  }
  const receiver = receiverFromOrder(order);
  if (!/^[A-Z]{3}\d{2,3}[A-Z0-9]*$/.test(receiver.lockerCode)) {
    return NextResponse.json({ ok: false, error: `Brak poprawnego kodu Paczkomatu w zamowieniu (pickupPoint="${order.pickupPoint}")` }, { status: 400 });
  }

  try {
    const created = await bcCreateLockerShipment(receiver, `KalkMate ${order.orderNumber}`);
    console.log("[basecourier] created", id, JSON.stringify(created.raw).slice(0, 2000));

    await prisma.order.update({
      where: { id },
      data: {
        furgonetkaPackageId: created.orderId ?? undefined,
        furgonetkaStatus: "basecourier",
        ...(created.trackingNumber ? { trackingNumber: created.trackingNumber } : {}),
      },
    });

    let trackingSync = null;
    if (created.trackingNumber) {
      try { trackingSync = await syncOrderTracking(id); } catch { /* InPost moze jeszcze nie znac numeru */ }
    }

    return NextResponse.json({
      ok: true,
      basecourierOrderId: created.orderId,
      trackingNumber: created.trackingNumber,
      waybillLink: created.waybillLink,
      trackingSync,
      raw: created.raw,
    });
  } catch (e) {
    console.error("[basecourier] create failed", id, e);
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 502 });
  }
}
