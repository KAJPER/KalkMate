import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { prisma } from "@/lib/db";
import { findOrdersByEmail, generateOrderEmailDraft } from "@/lib/mailReply";

// POST /api/admin/orders/[id]/email-draft — { instruction? }
// Zwraca SZKIC nowego maila do klienta (nie wysyla). Uzywa realnych danych
// o WSZYSTKICH zamowieniach tego klienta z bazy, zeby AI nie zmyslalo.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authErr = await requireAdminAuth(request); if (authErr) return authErr;

  const rl = rateLimit(`order-email-draft:${clientIp(request)}`, 30, 5 * 60_000);
  if (!rl.ok) {
    return NextResponse.json({ ok: false, error: "Za duzo generowan. Poczekaj chwile." }, { status: 429 });
  }

  const { id } = await params;
  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) return NextResponse.json({ ok: false, error: "Zamowienie nie znalezione" }, { status: 404 });
  if (!order.customerEmail) {
    return NextResponse.json({ ok: false, error: "Zamowienie nie ma adresu e-mail klienta" }, { status: 400 });
  }

  const body = await request.json().catch(() => ({} as Record<string, unknown>));
  const instruction = typeof body?.instruction === "string" ? body.instruction : undefined;

  try {
    const orders = await findOrdersByEmail(order.customerEmail);
    const draft = await generateOrderEmailDraft({
      customerName: order.customerName,
      orders,
      focusOrderNumber: order.orderNumber,
      instruction,
    });
    return NextResponse.json({ ok: true, draft });
  } catch (e) {
    console.error("[api/admin/orders/:id/email-draft]", e);
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 502 });
  }
}
