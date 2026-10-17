import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { getMessage, isMailboxFolder, preferredReplyAddress } from "@/lib/contactMailbox";
import { findOrdersByEmail, generateReplyDraft } from "@/lib/mailReply";

// POST /api/admin/mailbox/[uid]/draft-reply — { folder?, instruction? }
// Zwraca SZKIC odpowiedzi (po polsku) do przejrzenia/edycji przed wyslaniem —
// nie wysyla niczego samo. Model dostaje realne zamowienia klienta z bazy
// (po adresie nadawcy), zeby nie zmyslal statusow. `instruction` = tekst,
// ktory admin wpisal juz w pole odpowiedzi — AI robi z niego odpowiedz.
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
  const folder = body?.folder === undefined || body?.folder === null || body?.folder === "" ? "INBOX" : body.folder;
  if (!isMailboxFolder(folder)) return NextResponse.json({ ok: false, error: "Nieznany folder" }, { status: 400 });
  const instruction = typeof body?.instruction === "string" ? body.instruction : "";

  try {
    const original = await getMessage(uidNum, folder);
    if (!original) return NextResponse.json({ ok: false, error: "Nie znaleziono wiadomosci" }, { status: 404 });

    const text = original.text && original.text.trim()
      ? original.text
      : (original.html || "").replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (!text) return NextResponse.json({ ok: false, error: "Pusta tresc oryginalnej wiadomosci" }, { status: 400 });

    // Klient = Reply-To (formularz kontaktowy wysyla z noreply@), inaczej From.
    const customer = preferredReplyAddress(original);
    const orders = customer?.address ? await findOrdersByEmail(customer.address) : [];
    const draft = await generateReplyDraft({ customerEmailText: text, customerName: customer?.name || original.from?.name, orders, instruction });

    return NextResponse.json({ ok: true, draft, ordersFound: orders.length });
  } catch (e) {
    console.error("[api/admin/mailbox draft-reply]", e);
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 502 });
  }
}
