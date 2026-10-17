import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { campaignFailures, getCampaignContent, resumeCampaign, retryFailedDeliveries, stopCampaign } from "@/lib/newsletter";

// GET  — tresc kampanii (do "Uzyj ponownie") + lista nieudanych adresow
// POST — { action: "stop" | "resume" | "retry_failed" }
//   retry_failed: nieudani odbiorcy (poza wypisanymi) wracaja do kolejki i
//   kampania wznawia wysylke; odpowiedz { ok, requeued }.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authErr = await requireAdminAuth(request); if (authErr) return authErr;
  const { id } = await params;
  const content = await getCampaignContent(id);
  if (!content) return NextResponse.json({ ok: false, error: "Nie ma takiej kampanii" }, { status: 404 });
  return NextResponse.json({ ok: true, content, failures: await campaignFailures(id) });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authErr = await requireAdminAuth(request); if (authErr) return authErr;
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  if (!(await getCampaignContent(id))) return NextResponse.json({ ok: false, error: "Nie ma takiej kampanii" }, { status: 404 });
  if (body?.action === "stop") await stopCampaign(id);
  else if (body?.action === "resume") await resumeCampaign(id);
  else if (body?.action === "retry_failed") {
    const requeued = await retryFailedDeliveries(id);
    return NextResponse.json({ ok: true, requeued });
  } else return NextResponse.json({ ok: false, error: "Nieznana akcja" }, { status: 400 });
  return NextResponse.json({ ok: true });
}
