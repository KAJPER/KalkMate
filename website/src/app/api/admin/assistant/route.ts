import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { askAssistant, type AssistantMessage } from "@/lib/adminAssistant";

// POST /api/admin/assistant — { messages: [{ role, content }] }
// Czat z baza wiedzy KalkMate (/admin/asystent). Historie trzyma przegladarka;
// serwer tylko dociaga dane z bazy i pyta model. Niczego nie wysyla ani nie zmienia.
export async function POST(request: NextRequest) {
  const authErr = await requireAdminAuth(request); if (authErr) return authErr;

  const rl = rateLimit(`admin-assistant:${clientIp(request)}`, 40, 5 * 60_000);
  if (!rl.ok) {
    return NextResponse.json({ ok: false, error: "Za dużo zapytań. Poczekaj chwilę." }, { status: 429 });
  }

  const body = await request.json().catch(() => ({} as Record<string, unknown>));
  const raw = Array.isArray(body?.messages) ? body.messages : [];
  const messages: AssistantMessage[] = raw
    .filter((m: unknown): m is AssistantMessage => {
      const r = m as AssistantMessage;
      return (r?.role === "user" || r?.role === "assistant") && typeof r?.content === "string" && !!r.content.trim();
    })
    .map((m: AssistantMessage) => ({ role: m.role, content: m.content }));
  if (!messages.length || messages[messages.length - 1].role !== "user") {
    return NextResponse.json({ ok: false, error: "Brak pytania" }, { status: 400 });
  }

  try {
    const { reply, lookups } = await askAssistant(messages);
    return NextResponse.json({ ok: true, reply, lookups });
  } catch (e) {
    console.error("[api/admin/assistant]", e);
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 502 });
  }
}
