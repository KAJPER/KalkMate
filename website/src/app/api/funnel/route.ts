import { NextRequest, NextResponse } from "next/server";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { BOT_UA, deviceFromUserAgent, isClientFunnelEvent, recordFunnelEvent } from "@/lib/funnel";

// Anonimowe zdarzenia lejka z przegladarki (lib/funnelClient.ts, sendBeacon).
// Bez cookies i bez zapisu IP — IP sluzy tylko do limitu w pamieci.
// payment_start / oplacone liczy serwer, tu ich nie przyjmujemy.
const noContent = () => new NextResponse(null, { status: 204 });

export async function POST(req: NextRequest) {
  try {
    if (!rateLimit(`funnel:${clientIp(req)}`, 30, 60_000).ok) {
      return new NextResponse(null, { status: 429 });
    }
    const ua = (req.headers.get("user-agent") || "").slice(0, 300);
    if (!ua || BOT_UA.test(ua)) return noContent();

    // sendBeacon moze wyslac text/plain — parsujemy tekst recznie.
    const raw = await req.text().catch(() => "");
    if (!raw || raw.length > 2000) return noContent();
    let body: Record<string, unknown> | null = null;
    try { body = JSON.parse(raw); } catch { return noContent(); }
    if (!body || typeof body !== "object" || !isClientFunnelEvent(body.event)) return noContent();

    const device = body.device === "mobile" || body.device === "desktop" ? body.device : deviceFromUserAgent(ua);
    await recordFunnelEvent({ event: body.event, lang: body.lang, country: body.country, device });
  } catch (e) {
    console.error("[funnel] record failed:", e);
  }
  return noContent();
}
