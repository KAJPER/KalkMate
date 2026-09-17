import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";
import { fetchInPostTracking, looksLikeInPostNumber, syncOrderTracking } from "@/lib/inpostTracking";

// POST /api/admin/orders/[id]/tracking-sync — "Sprawdz status InPost" w panelu.
// Odpytuje InPost, ewentualnie przesuwa status zamowienia (i wysyla maila
// jak przy recznej zmianie), zwraca pelna historie zdarzen do wyswietlenia.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authErr = await requireAdminAuth(request); if (authErr) return authErr;
  const { id } = await params;

  const order = await prisma.order.findUnique({ where: { id }, select: { trackingNumber: true } });
  if (!order) {
    return NextResponse.json({ ok: false, error: "Order not found" }, { status: 404 });
  }
  if (!order.trackingNumber) {
    return NextResponse.json({ ok: false, error: "Zamowienie nie ma numeru sledzenia" }, { status: 400 });
  }
  if (!looksLikeInPostNumber(order.trackingNumber)) {
    return NextResponse.json({
      ok: false,
      error: "To nie wyglada na numer InPost (24 cyfry) — automatyczne sledzenie dziala tylko dla InPost",
    }, { status: 400 });
  }

  const sync = await syncOrderTracking(id);
  const tracking = await fetchInPostTracking(order.trackingNumber);

  return NextResponse.json({
    ok: true,
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
