import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { sendTest } from "@/lib/newsletter";
import { parseContent } from "@/lib/newsletterInput";

const EMAIL_RE = /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/;

// POST — { content, to } — jedna wiadomosc testowa ("[TEST] ...") przed masowa wysylka
export async function POST(request: NextRequest) {
  const authErr = await requireAdminAuth(request); if (authErr) return authErr;
  const rl = rateLimit(`newsletter-test:${clientIp(request)}`, 20, 10 * 60_000);
  if (!rl.ok) return NextResponse.json({ ok: false, error: "Za dużo testów. Poczekaj chwilę." }, { status: 429 });

  const body = await request.json().catch(() => ({}));
  const to = typeof body?.to === "string" ? body.to.trim() : "";
  if (!EMAIL_RE.test(to)) return NextResponse.json({ ok: false, error: "Podaj poprawny adres testowy." }, { status: 400 });
  const parsed = parseContent(body?.content);
  if (!parsed.ok) return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });

  const result = await sendTest(parsed.content, to);
  if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 502 });
  return NextResponse.json({ ok: true });
}
