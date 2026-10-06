import { NextRequest, NextResponse } from "next/server";
import { agentClaim, agentAuthorized } from "@/lib/fiscal";

// POST /api/fiscal/agent/claim — lokalny agent fiskalny (fiscal-agent/) pyta
// o następny paragon i przy okazji melduje stan drukarki (heartbeat).
// Auth: nagłówek x-fiscal-agent-token == FISCAL_AGENT_TOKEN albo sesja admina
// (agent wbudowany w aplikację KalkMate Admin).
export async function POST(request: NextRequest) {
  if (!(await agentAuthorized(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await request.json().catch(() => ({}));
  const job = await agentClaim({ version: body?.version, printer: body?.printer });
  return NextResponse.json({ job: job ? { id: job.id, receipt: job.payload } : null });
}
