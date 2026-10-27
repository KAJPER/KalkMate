import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { composeNewsletter } from "@/lib/translate";

// POST { brief, serviceNotice? } -> { draft: { subject, preheader, eyebrow, title, body, ctaText, ctaUrl } }
// "Napisz z AI" w /admin/newsletter — szkic do przejrzenia/poprawki, nic nie wysyla.
export async function POST(request: NextRequest) {
  const authErr = await requireAdminAuth(request); if (authErr) return authErr;
  const rl = rateLimit(`newsletter-compose:${clientIp(request)}`, 20, 10 * 60_000);
  if (!rl.ok) return NextResponse.json({ ok: false, error: "Za dużo generowań. Poczekaj chwilę." }, { status: 429 });

  const body = await request.json().catch(() => ({}));
  const brief = typeof body?.brief === "string" ? body.brief.trim() : "";
  if (brief.length < 5) return NextResponse.json({ ok: false, error: "Opisz krótko, co chcesz wysłać." }, { status: 400 });
  try {
    const draft = await composeNewsletter(brief, body?.serviceNotice === true);
    return NextResponse.json({ ok: true, draft });
  } catch (e) {
    console.error("[api/admin/newsletter/compose]", e);
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 502 });
  }
}
