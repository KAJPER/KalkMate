import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { sourceTexts } from "@/lib/newsletter";
import { parseContent } from "@/lib/newsletterInput";
import { translateNewsletter } from "@/lib/translate";

// POST { content } -> { translations: { en, de } } — tlumaczenie polskiej tresci
// newslettera do podgladu i recznej poprawki w panelu przed wysylka.
export async function POST(request: NextRequest) {
  const authErr = await requireAdminAuth(request); if (authErr) return authErr;
  const rl = rateLimit(`newsletter-translate:${clientIp(request)}`, 30, 10 * 60_000);
  if (!rl.ok) return NextResponse.json({ ok: false, error: "Za dużo tłumaczeń. Poczekaj chwilę." }, { status: 429 });

  const body = await request.json().catch(() => ({}));
  const parsed = parseContent(body?.content);
  if (!parsed.ok) return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
  try {
    const src = sourceTexts(parsed.content);
    const [en, de] = await Promise.all([translateNewsletter(src, "en"), translateNewsletter(src, "de")]);
    return NextResponse.json({ ok: true, translations: { en, de } });
  } catch (e) {
    console.error("[api/admin/newsletter/translate]", e);
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 502 });
  }
}
