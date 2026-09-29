import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";
import { bcGetOrderDetails } from "@/lib/basecourier";

// POST /api/admin/orders/[id]/basecourier/link — { basecourierOrderId }
// Wiaze z zamowieniem przesylke nadana RECZNIE w panelu Base Courier (np. do
// USA, gdzie API nie pozwala podac stanu wymaganego przez UPS). Po powiazaniu
// dzialaja: etykieta, sledzenie (cron + przycisk) i automatyczne statusy —
// tak samo jak dla przesylek nadanych z tego panelu przez API.
// Nic nie kosztuje i niczego nie nadaje: tylko odczyt zlecenia po ID. UWAGA: getOrderDetails
// nie zwraca numeru listu (waybill_no jest zawsze null) — admin wpisuje go recznie; sledzenie
// statusu dziala i tak po ID zlecenia (basecourierTracking.ts).
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
      { ok: false, error: `To zamówienie ma już przesyłkę Base Courier (ID ${order.furgonetkaPackageId}).` },
      { status: 409 }
    );
  }

  const body = await request.json().catch(() => ({} as Record<string, unknown>));
  const raw = String(body?.basecourierOrderId ?? "").trim();
  if (!/^\d{4,12}$/.test(raw)) {
    return NextResponse.json({ ok: false, error: "Podaj numeryczne ID zlecenia z panelu Base Courier (np. 23675005)." }, { status: 400 });
  }

  try {
    const details = await bcGetOrderDetails(raw);
    const bcOrder = ((details.raw as { Order?: Record<string, unknown> } | null)?.Order ?? {}) as Record<string, unknown>;
    const waybill = typeof bcOrder.waybill_no === "string" && bcOrder.waybill_no.trim() ? bcOrder.waybill_no.trim() : null;
    const takerEmail = typeof bcOrder.taker_email === "string" ? bcOrder.taker_email.trim().toLowerCase() : "";

    await prisma.order.update({
      where: { id },
      data: {
        furgonetkaPackageId: raw,
        furgonetkaStatus: "basecourier",
        ...(waybill ? { trackingNumber: waybill } : {}),
      },
    });

    // Ostrzezenie, gdy zlecenie jest na innego odbiorce niz zamowienie (pomylone ID).
    const mismatch = takerEmail && takerEmail !== (order.customerEmail || "").trim().toLowerCase();
    return NextResponse.json({
      ok: true,
      basecourierOrderId: raw,
      trackingNumber: waybill,
      courierName: details.courierName,
      warning: mismatch
        ? `Uwaga: odbiorca w tym zleceniu Base Courier (${takerEmail}) ma inny e-mail niż zamówienie (${order.customerEmail}). Sprawdź, czy podałeś właściwe ID.`
        : null,
    });
  } catch (e) {
    console.error("[basecourier/link] failed", id, raw, e);
    return NextResponse.json(
      { ok: false, error: `Nie znaleziono zlecenia ${raw} na koncie Base Courier: ${(e as Error).message}` },
      { status: 404 }
    );
  }
}
