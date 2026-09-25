import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { prisma } from "@/lib/db";
import { sendReply } from "@/lib/contactMailbox";

// POST /api/admin/orders/[id]/send-email — { subject, html }
// Wysyla NOWEGO maila do klienta zamowienia przez skrzynke kontakt@kalkmate.pl
// (ten sam mechanizm co odpowiedzi w /admin/mailbox) — trafia tez do folderu
// "Sent" tej skrzynki.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authErr = await requireAdminAuth(request); if (authErr) return authErr;

  // Wysylka prawdziwych maili — ochrona przed przypadkowym/automatycznym spamem.
  const rl = rateLimit(`order-send-email:${clientIp(request)}`, 20, 10 * 60_000);
  if (!rl.ok) {
    return NextResponse.json({ ok: false, error: "Za duzo wysylek. Poczekaj chwile." }, { status: 429 });
  }

  const { id } = await params;
  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) return NextResponse.json({ ok: false, error: "Zamowienie nie znalezione" }, { status: 404 });
  if (!order.customerEmail) {
    return NextResponse.json({ ok: false, error: "Zamowienie nie ma adresu e-mail klienta" }, { status: 400 });
  }

  const body = await request.json().catch(() => ({} as Record<string, unknown>));
  const subject = typeof body?.subject === "string" ? body.subject.trim() : "";
  const html = typeof body?.html === "string" ? body.html.trim() : "";
  if (!subject) return NextResponse.json({ ok: false, error: "Brak tematu" }, { status: 400 });
  if (!html) return NextResponse.json({ ok: false, error: "Brak tresci wiadomosci" }, { status: 400 });

  try {
    const result = await sendReply({
      toAddress: order.customerEmail,
      toName: order.customerName || undefined,
      subject,
      html,
    });
    if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 502 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[api/admin/orders/:id/send-email]", e);
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 502 });
  }
}
