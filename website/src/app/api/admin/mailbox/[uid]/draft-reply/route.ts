import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { getMessage } from "@/lib/contactMailbox";
import { findOrdersByEmail, generateReplyDraft } from "@/lib/mailReply";

// POST /api/admin/mailbox/[uid]/draft-reply — { folder? }
// Zwraca SZKIC odpowiedzi (po polsku) do przejrzenia/edycji przed wyslaniem —
// nie wysyla niczego samo. Model dostaje realne zamowienia klienta z bazy
// (po adresie nadawcy), zeby nie zmyslal statusow.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ uid: string }> }
) {
  const authErr = await requireAdminAuth(request); if (authErr) return authErr;

  const rl = rateLimit(`mailbox-draft:${clientIp(request)}`, 30, 5 * 60_000);
  if (!rl.ok) {
    return NextResponse.json({ ok: false, error: "Za duzo generowan. Poczekaj chwile." }, { status: 429 });
  }

  const { uid } = await params;
  const uidNum = parseInt(uid, 10);
  if (!Number.isFinite(uidNum)) return NextResponse.json({ ok: false, error: "Nieprawidlowe uid" }, { status: 400 });

  const body = await request.json().catch(() => ({} as Record<string, unknown>));
  const folder = typeof body?.folder === "string" ? body.folder : "INBOX";

  try {
    const original = await getMessage(uidNum, folder);
    if (!original) return NextResponse.json({ ok: false, error: "Nie znaleziono wiadomosci" }, { status: 404 });

    const text = original.text && original.text.trim()
      ? original.text
      : (original.html || "").replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (!text) return NextResponse.json({ ok: false, error: "Pusta tresc oryginalnej wiadomosci" }, { status: 400 });

    const orders = original.from?.address ? await findOrdersByEmail(original.from.address) : [];
    const draft = await generateReplyDraft({ customerEmailText: text, customerName: original.from?.name, orders });

    return NextResponse.json({ ok: true, draft, ordersFound: orders.length });
  } catch (e) {
    console.error("[api/admin/mailbox draft-reply]", e);
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 502 });
  }
}
