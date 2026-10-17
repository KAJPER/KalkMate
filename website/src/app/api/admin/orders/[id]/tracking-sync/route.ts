import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";
import { fetchInPostTracking, looksLikeInPostNumber, syncOrderTracking } from "@/lib/inpostTracking";
import { syncBaseCourierOrder } from "@/lib/basecourierTracking";
import { bcGetOrderDetails, type BcOrderDetails } from "@/lib/basecourier";

// POST /api/admin/orders/[id]/tracking-sync — "Sprawdz status" w panelu.
// InPost (Paczkomat) — odpytuje publiczne API InPost. Inny kurier nadany przez
// Base Courier (DPD, GLS, UPS...) — odpytuje Base Courier (getOrderDetails.json),
// bo to jedyne miejsce, gdzie mamy do tego dostep (nie mamy osobnych kont u
// tych przewoznikow). W obu przypadkach ewentualnie przesuwa status
// zamowienia (i wysyla maila jak przy recznej zmianie).
//
// Stan przesylki pobieramy RAZ i przekazujemy do syncOrderTracking /
// syncBaseCourierOrder (parametr prefetched) — ta sama logika co w cronie
// (bez kopii w route), a przewoznik nie jest pytany dwa razy.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authErr = await requireAdminAuth(request); if (authErr) return authErr;
  const { id } = await params;

  try {
    const order = await prisma.order.findUnique({
      where: { id },
      select: { trackingNumber: true, furgonetkaStatus: true, furgonetkaPackageId: true },
    });
    if (!order) {
      return NextResponse.json({ ok: false, error: "Order not found" }, { status: 404 });
    }

    if (order.trackingNumber && looksLikeInPostNumber(order.trackingNumber)) {
      const tracking = await fetchInPostTracking(order.trackingNumber); // jedno zapytanie do InPost
      const sync = await syncOrderTracking(id, tracking);
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
      let details: BcOrderDetails | null = null;
      try {
        details = await bcGetOrderDetails(order.furgonetkaPackageId); // jedno zapytanie do Base Courier
      } catch (e) {
        console.error("[tracking-sync] bcGetOrderDetails failed:", e);
      }
      const sync = await syncBaseCourierOrder(id, details);
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
  } catch (e) {
    console.error("[tracking-sync] failed:", id, e);
    return NextResponse.json({ ok: false, error: `Sprawdzanie statusu nie powiodlo sie: ${(e as Error).message}` }, { status: 502 });
  }
}
