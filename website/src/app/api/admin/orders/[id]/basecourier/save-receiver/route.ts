import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";
import { receiverFromOrder, applyReceiverEdits, orderPatchFromReceiver, savedForClient } from "@/lib/basecourierReceiver";

// POST /api/admin/orders/[id]/basecourier/save-receiver — zapisuje poprawki
// danych odbiorcy (formularz Base Courier) w zamowieniu, BEZ nadawania
// przesylki i bez kosztu — w odroznieniu od POST .../basecourier, ktory
// zawsze realnie nadaje paczke. Pozwala poprawic dane "w miedzyczasie",
// zanim admin zdecyduje sie nadac.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authErr = await requireAdminAuth(request); if (authErr) return authErr;
  const { id } = await params;
  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) return NextResponse.json({ ok: false, error: "Order not found" }, { status: 404 });

  const country = (order.customerCountry || "PL").toUpperCase();
  const isDomestic = country === "PL" || country === "";

  const body = await request.json().catch(() => ({} as Record<string, unknown>));
  const edited = applyReceiverEdits(receiverFromOrder(order), body?.receiver, !isDomestic, country);
  if (!edited.ok) return NextResponse.json({ ok: false, error: edited.error }, { status: 400 });

  if (Object.keys(edited.patch).length === 0) {
    return NextResponse.json({ ok: true, saved: {} });
  }

  const orderPatch = orderPatchFromReceiver(edited.patch, edited.receiver);
  await prisma.order.update({ where: { id }, data: orderPatch });

  return NextResponse.json({ ok: true, saved: savedForClient(edited.patch, edited.receiver) });
}
