import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { createCampaign, isRunning, listCampaigns } from "@/lib/newsletter";
import { parseContent, parseFilter } from "@/lib/newsletterInput";

// GET  — historia kampanii z postepem (panel odpytuje co kilka sekund w trakcie wysylki)
// POST — { content, filter } -> tworzy kampanie i startuje wysylke w tle
export async function GET(request: NextRequest) {
  const authErr = await requireAdminAuth(request); if (authErr) return authErr;
  try {
    const campaigns = (await listCampaigns()).map((c) => ({ ...c, running: isRunning(c.id) }));
    return NextResponse.json({ ok: true, campaigns });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const authErr = await requireAdminAuth(request); if (authErr) return authErr;
  // Masowa wysylka — kilka kampanii na godzine to az nadto.
  const rl = rateLimit(`newsletter-send:${clientIp(request)}`, 5, 60 * 60_000);
  if (!rl.ok) return NextResponse.json({ ok: false, error: "Za dużo kampanii w krótkim czasie." }, { status: 429 });

  const body = await request.json().catch(() => ({}));
  const parsed = parseContent(body?.content);
  if (!parsed.ok) return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
  try {
    const result = await createCampaign(parsed.content, parseFilter(body?.filter));
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 400 });
  }
}
