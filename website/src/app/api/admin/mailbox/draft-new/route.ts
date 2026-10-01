import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { findOrdersByEmail, generateNewMailDraft } from "@/lib/mailReply";

const EMAIL_RE = /<?([^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+)>?/;

// POST /api/admin/mailbox/draft-new — { to?, subject?, instruction? }
// SZKIC nowej wiadomosci ("Nowa wiadomosc" w /admin/mailbox). Nic nie wysyla.
// `instruction` = to, co admin wpisal w tresc (notatki do rozwiniecia).
export async function POST(request: NextRequest) {
  const authErr = await requireAdminAuth(request); if (authErr) return authErr;

  const rl = rateLimit(`mailbox-draft:${clientIp(request)}`, 30, 5 * 60_000);
  if (!rl.ok) {
    return NextResponse.json({ ok: false, error: "Za duzo generowan. Poczekaj chwile." }, { status: 429 });
  }

  const body = await request.json().catch(() => ({} as Record<string, unknown>));
  const subject = typeof body?.subject === "string" ? body.subject.trim() : "";
  const instruction = typeof body?.instruction === "string" ? body.instruction.trim() : "";
  if (!subject && !instruction) {
    return NextResponse.json({ ok: false, error: "Wpisz temat albo kilka słów w treści — AI zrobi z tego maila." }, { status: 400 });
  }

  // Zamowienia pierwszego odbiorcy — kontekst, jesli to nasz klient.
  const firstTo = typeof body?.to === "string" ? body.to.split(/[,;\n]+/)[0]?.match(EMAIL_RE)?.[1] : undefined;

  try {
    const orders = firstTo ? await findOrdersByEmail(firstTo) : [];
    const draft = await generateNewMailDraft({ subject, instruction, orders });
    return NextResponse.json({ ok: true, draft, ordersFound: orders.length });
  } catch (e) {
    console.error("[api/admin/mailbox draft-new]", e);
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 502 });
  }
}
