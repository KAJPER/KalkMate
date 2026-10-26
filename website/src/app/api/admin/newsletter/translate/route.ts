import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { sourceTexts, NL_TRANSLATED_LANGS, isNlLang, type NlTranslatedLang } from "@/lib/newsletter";
import { parseContent } from "@/lib/newsletterInput";
import { translateNewsletter } from "@/lib/translate";

// POST { content, langs? } -> { translations: { en, de, cs, sk, ... } } — tlumaczenie
// polskiej tresci newslettera do podgladu i recznej poprawki w panelu przed
// wysylka. Bez `langs` tlumaczy na wszystkie jezyki strony poza PL.
export async function POST(request: NextRequest) {
  const authErr = await requireAdminAuth(request); if (authErr) return authErr;
  const rl = rateLimit(`newsletter-translate:${clientIp(request)}`, 30, 10 * 60_000);
  if (!rl.ok) return NextResponse.json({ ok: false, error: "Za dużo tłumaczeń. Poczekaj chwilę." }, { status: 429 });

  const body = await request.json().catch(() => ({}));
  const parsed = parseContent(body?.content);
  if (!parsed.ok) return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
  try {
    const src = sourceTexts(parsed.content);
    const requested: NlTranslatedLang[] = Array.isArray(body?.langs)
      ? NL_TRANSLATED_LANGS.filter((l) => (body.langs as unknown[]).some((x) => isNlLang(x) && x === l))
      : [...NL_TRANSLATED_LANGS];
    const langs = requested.length ? requested : [...NL_TRANSLATED_LANGS];
    const done = await Promise.all(langs.map((l) => translateNewsletter(src, l)));
    const translations = Object.fromEntries(langs.map((l, i) => [l, done[i]]));
    return NextResponse.json({ ok: true, translations });
  } catch (e) {
    console.error("[api/admin/newsletter/translate]", e);
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 502 });
  }
}
