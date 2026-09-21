import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { translateToPolish, translateMatchingLanguage } from "@/lib/translate";

// POST /api/admin/mailbox/translate
//   { mode: "to-polish", text }                      -> tlumaczy odczytywany mail na polski
//   { mode: "match-language", text, referenceText }  -> tlumaczy szkic odpowiedzi na jezyk oryginalu
export async function POST(request: NextRequest) {
  const authErr = await requireAdminAuth(request); if (authErr) return authErr;

  const rl = rateLimit(`mailbox-translate:${clientIp(request)}`, 30, 5 * 60_000);
  if (!rl.ok) {
    return NextResponse.json({ ok: false, error: "Za duzo tlumaczen. Poczekaj chwile." }, { status: 429 });
  }

  const body = await request.json().catch(() => ({} as Record<string, unknown>));
  const mode = body?.mode === "match-language" ? "match-language" : "to-polish";
  const text = typeof body?.text === "string" ? body.text : "";
  if (!text.trim()) return NextResponse.json({ ok: false, error: "Brak tekstu do tlumaczenia" }, { status: 400 });

  try {
    let translated: string;
    if (mode === "match-language") {
      const referenceText = typeof body?.referenceText === "string" ? body.referenceText : "";
      if (!referenceText.trim()) {
        return NextResponse.json({ ok: false, error: "Brak tekstu oryginalnej wiadomosci" }, { status: 400 });
      }
      translated = await translateMatchingLanguage(text, referenceText);
    } else {
      translated = await translateToPolish(text);
    }
    return NextResponse.json({ ok: true, translated });
  } catch (e) {
    console.error("[api/admin/mailbox/translate]", e);
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 502 });
  }
}
