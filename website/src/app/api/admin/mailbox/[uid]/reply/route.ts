import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { getMessage, sendReply } from "@/lib/contactMailbox";

// POST /api/admin/mailbox/[uid]/reply
// Body: { folder?, toAddress?, toName?, subject?, html }
// Bez toAddress/subject — dociaga je z oryginalnej wiadomosci (odpowiedz "Re:").
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ uid: string }> }
) {
  const authErr = await requireAdminAuth(request); if (authErr) return authErr;

  // Wysylka prawdziwych maili — ochrona przed przypadkowym/automatycznym spamem
  // z panelu (np. skryptem po skradzionej sesji).
  const rl = rateLimit(`mailbox-reply:${clientIp(request)}`, 20, 10 * 60_000);
  if (!rl.ok) {
    return NextResponse.json({ ok: false, error: "Za duzo wysylek. Poczekaj chwile." }, { status: 429 });
  }

  const { uid } = await params;
  const uidNum = parseInt(uid, 10);
  if (!Number.isFinite(uidNum)) return NextResponse.json({ ok: false, error: "Nieprawidlowe uid" }, { status: 400 });

  const body = await request.json().catch(() => ({} as Record<string, unknown>));
  const folder = typeof body?.folder === "string" ? body.folder : "INBOX";
  const html = typeof body?.html === "string" ? body.html.trim() : "";
  if (!html) return NextResponse.json({ ok: false, error: "Brak tresci odpowiedzi" }, { status: 400 });

  try {
    const original = await getMessage(uidNum, folder);
    if (!original) return NextResponse.json({ ok: false, error: "Nie znaleziono oryginalnej wiadomosci" }, { status: 404 });

    const toAddress = typeof body?.toAddress === "string" && body.toAddress ? body.toAddress : original.from?.address;
    if (!toAddress) return NextResponse.json({ ok: false, error: "Brak adresu odbiorcy" }, { status: 400 });
    const toName = typeof body?.toName === "string" ? body.toName : original.from?.name;
    const subject =
      typeof body?.subject === "string" && body.subject
        ? body.subject
        : original.subject.toLowerCase().startsWith("re:")
          ? original.subject
          : `Re: ${original.subject}`;

    const result = await sendReply({
      toAddress,
      toName,
      subject,
      html,
      inReplyToMessageId: original.messageId,
      priorReferences: original.references,
    });

    if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 502 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[api/admin/mailbox/:uid/reply] failed:", e);
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 502 });
  }
}
