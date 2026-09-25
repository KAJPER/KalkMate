import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { sendNewMail } from "@/lib/contactMailbox";

const EMAIL_RE = /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/;
const MAX_RECIPIENTS = 20;

// "a@x.pl, Jan <b@y.com>; c@z.org" -> ["a@x.pl","b@y.com","c@z.org"]
function parseAddresses(raw: unknown): { ok: true; list: string[] } | { ok: false; bad: string } {
  if (typeof raw !== "string" || !raw.trim()) return { ok: true, list: [] };
  const list: string[] = [];
  for (const part of raw.split(/[,;\n]+/)) {
    const t = part.trim();
    if (!t) continue;
    const angle = t.match(/<([^<>]+)>\s*$/);
    const addr = (angle ? angle[1] : t).trim();
    if (!EMAIL_RE.test(addr)) return { ok: false, bad: t };
    list.push(addr);
  }
  return { ok: true, list: Array.from(new Set(list)) };
}

// POST /api/admin/mailbox/send — { to, cc?, subject, html }
// Nowa wiadomosc do dowolnych adresow z kontakt@kalkmate.pl (jak "Nowa
// wiadomosc" w zwyklej poczcie); trafia tez do folderu "Sent".
export async function POST(request: NextRequest) {
  const authErr = await requireAdminAuth(request); if (authErr) return authErr;

  // Wysylka prawdziwych maili — ochrona przed przypadkowym/automatycznym spamem
  // z panelu (np. skryptem po skradzionej sesji).
  const rl = rateLimit(`mailbox-send:${clientIp(request)}`, 20, 10 * 60_000);
  if (!rl.ok) {
    return NextResponse.json({ ok: false, error: "Za duzo wysylek. Poczekaj chwile." }, { status: 429 });
  }

  const body = await request.json().catch(() => ({} as Record<string, unknown>));
  const to = parseAddresses(body?.to);
  if (!to.ok) return NextResponse.json({ ok: false, error: `Nieprawidłowy adres odbiorcy: ${to.bad}` }, { status: 400 });
  if (to.list.length === 0) return NextResponse.json({ ok: false, error: "Podaj adres odbiorcy." }, { status: 400 });
  const cc = parseAddresses(body?.cc);
  if (!cc.ok) return NextResponse.json({ ok: false, error: `Nieprawidłowy adres DW: ${cc.bad}` }, { status: 400 });
  if (to.list.length + cc.list.length > MAX_RECIPIENTS) {
    return NextResponse.json({ ok: false, error: `Maksymalnie ${MAX_RECIPIENTS} odbiorców.` }, { status: 400 });
  }

  const subject = typeof body?.subject === "string" ? body.subject.trim() : "";
  const html = typeof body?.html === "string" ? body.html.trim() : "";
  if (!subject) return NextResponse.json({ ok: false, error: "Podaj temat." }, { status: 400 });
  if (subject.length > 250) return NextResponse.json({ ok: false, error: "Temat jest za długi." }, { status: 400 });
  if (!html) return NextResponse.json({ ok: false, error: "Wpisz treść wiadomości." }, { status: 400 });
  if (html.length > 200_000) return NextResponse.json({ ok: false, error: "Wiadomość jest za długa." }, { status: 400 });

  try {
    const result = await sendNewMail({ to: to.list, cc: cc.list, subject, html });
    if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 502 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[api/admin/mailbox/send] failed:", e);
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 502 });
  }
}
