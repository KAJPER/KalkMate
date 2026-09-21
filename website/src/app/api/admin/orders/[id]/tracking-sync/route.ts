import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";
import { fetchInPostTracking, looksLikeInPostNumber, syncOrderTracking } from "@/lib/inpostTracking";
import { syncBaseCourierOrder } from "@/lib/basecourierTracking";
import { bcGetOrderDetails } from "@/lib/basecourier";

// POST /api/admin/orders/[id]/tracking-sync — "Sprawdz status" w panelu.
// InPost (Paczkomat) — odpytuje publiczne API InPost. Inny kurier nadany przez
// Base Courier (DPD, GLS, UPS...) — odpytuje Base Courier (getOrderDetails.json),
// bo to jedyne miejsce, gdzie mamy do tego dostep (nie mamy osobnych kont u
// tych przewoznikow). W obu przypadkach ewentualnie przesuwa status
// zamowienia (i wysyla maila jak przy recznej zmianie).
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authErr = await requireAdminAuth(request); if (authErr) return authErr;
  const { id } = await params;

  const order = await prisma.order.findUnique({
    where: { id },
    select: { trackingNumber: true, furgonetkaStatus: true, furgonetkaPackageId: true },
  });
  if (!order) {
    return NextResponse.json({ ok: false, error: "Order not found" }, { status: 404 });
  }

  if (order.trackingNumber && looksLikeInPostNumber(order.trackingNumber)) {
    const sync = await syncOrderTracking(id);
    const tracking = await fetchInPostTracking(order.trackingNumber);
    return NextResponse.json({
      ok: true,
      courier: "inpost",
      sync,
      tracking: tracking
        ? {
            status: tracking.status,
            service: tracking.service,
            targetMachineId: tracking.targetMachineId,
            updatedAt: tracking.updatedAt,
            events: tracking.events,
          }
        : null,
    });
  }

  if (order.furgonetkaStatus === "basecourier" && order.furgonetkaPackageId) {
    const sync = await syncBaseCourierOrder(id);
    let details = null;
    try {
      details = await bcGetOrderDetails(order.furgonetkaPackageId);
    } catch (e) {
      console.error("[tracking-sync] bcGetOrderDetails failed:", e);
    }
    return NextResponse.json({
      ok: true,
      courier: "basecourier",
      sync,
      tracking: details
        ? {
            courierName: details.courierName,
            events: details.events,
          }
        : null,
    });
  }

  return NextResponse.json(
    { ok: false, error: "Zamowienie nie ma numeru sledzenia InPost ani przesylki Base Courier" },
    { status: 400 }
  );
}
