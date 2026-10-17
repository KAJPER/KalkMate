import { NextRequest, NextResponse } from "next/server";
import { agentReport, agentAuthorized, normalizeAgentId, type AgentReport } from "@/lib/fiscal";

const STATES = new Set(["queued", "printing", "printed", "failed", "uncertain"]);

// POST /api/fiscal/agent/jobs/[id] — agent odsyła wynik zlecenia
// (numer paragonu albo błąd). Ten sam raport można wysłać wielokrotnie.
// Body: AgentReport + opcjonalnie agentId (K6). Odpowiedź:
//   { ok: true, state: <stan po raporcie>, accepted: boolean }
// accepted=false → zlecenie anulowane / już wydrukowane / pobrane przez innego
// agenta: agent porzuca je BEZ drukowania. Nieznane id → 404 { error, state: "unknown" }.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await agentAuthorized(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as (AgentReport & { agentId?: unknown; agent_id?: unknown }) | null;
  if (!body || !STATES.has(body.state)) {
    return NextResponse.json({ error: "Bad report" }, { status: 400 });
  }
  if (body.state === "printed" && !(Number.isInteger(body.receipt_number) && Number(body.receipt_number) > 0)) {
    return NextResponse.json({ error: "Missing receipt_number" }, { status: 400 });
  }
  const agentId = normalizeAgentId(body.agentId ?? body.agent_id ?? request.headers.get("x-fiscal-agent-id"));
  const result = await agentReport(id, body, agentId);
  if (!result.found) return NextResponse.json({ error: "Not found", state: "unknown" }, { status: 404 });
  return NextResponse.json({ ok: true, state: result.state, accepted: result.accepted });
}
