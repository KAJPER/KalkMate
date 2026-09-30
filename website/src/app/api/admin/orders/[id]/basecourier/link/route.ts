import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";
import { bcGetOrderDetails, bcFindOrder } from "@/lib/basecourier";

// POST /api/admin/orders/[id]/basecourier/link — { basecourierOrderId }
// Wiaze z zamowieniem przesylke nadana RECZNIE w panelu Base Courier (np. do
// USA, gdzie API nie pozwala podac stanu wymaganego przez UPS). Po powiazaniu
// dzialaja: etykieta, sledzenie (cron + przycisk) i automatyczne statusy —
// tak samo jak dla przesylek nadanych z tego panelu przez API.
// Nic nie kosztuje i niczego nie nadaje: tylko odczyt zlecenia po ID.
//
// Panel Base Courier pokazuje uzytkownikowi "Numer zamowienia" (np. 23729913),
// ktory NIE JEST tym samym co wewnetrzny "Order.id" (np. 23780392) wymagany
// przez getOrderDetails.json/getWaybill.json — admin naturalnie kopiuje ten
// pierwszy (jest najbardziej widoczny), wiec bcFindOrder() szuka po OBU.
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
    return NextResponse.json(
      { ok: false, error: "Podaj numer zlecenia z panelu Base Courier (np. 23729913)." },
      { status: 400 }
    );
  }

  try {
    // Szukaj po "Numer zamowienia" (CartOrder.id_prefix) i po Order.id jednoczesnie.
    const found = await bcFindOrder(raw);
    const resolvedId = found?.orderId ?? raw; // gdyby raw byl juz prawdziwym Order.id spoza listy (zabezpieczenie)

    const details = await bcGetOrderDetails(resolvedId);
    const bcOrder = ((details.raw as { Order?: Record<string, unknown> } | null)?.Order ?? {}) as Record<string, unknown>;
    // getOrderDetails.json miewa waybill_no=null mimo istniejacej etykiety — getOrders.json
    // (bcFindOrder) je zwykle ma, wiec preferujemy to zrodlo.
    const waybill =
      found?.waybillNo ??
      (typeof bcOrder.waybill_no === "string" && bcOrder.waybill_no.trim() ? bcOrder.waybill_no.trim() : null);
    const takerEmail = typeof bcOrder.taker_email === "string" ? bcOrder.taker_email.trim().toLowerCase() : "";
    const takerName = found?.takerName || (typeof bcOrder.taker_name === "string" ? bcOrder.taker_name : "");

    await prisma.order.update({
      where: { id },
      data: {
        furgonetkaPackageId: resolvedId,
        furgonetkaStatus: "basecourier",
        ...(waybill ? { trackingNumber: waybill } : {}),
      },
    });

    // Ostrzezenie, gdy zlecenie jest na innego odbiorce niz zamowienie (pomylone ID).
    const emailMismatch = takerEmail && takerEmail !== (order.customerEmail || "").trim().toLowerCase();
    const nameMismatch = !takerEmail && takerName && takerName.trim().toLowerCase() !== (order.customerName || "").trim().toLowerCase();
    return NextResponse.json({
      ok: true,
      basecourierOrderId: resolvedId,
      trackingNumber: waybill,
      courierName: details.courierName,
      warning: emailMismatch
        ? `Uwaga: odbiorca w tym zleceniu Base Courier (${takerEmail}) ma inny e-mail niż zamówienie (${order.customerEmail}). Sprawdź, czy podałeś właściwy numer.`
        : nameMismatch
          ? `Uwaga: odbiorca w tym zleceniu Base Courier (${takerName}) różni się od zamówienia (${order.customerName}). Sprawdź, czy podałeś właściwy numer.`
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
