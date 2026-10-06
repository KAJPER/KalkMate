import { NextRequest, NextResponse } from "next/server";
import { agentReport, agentTokenValid, type AgentReport } from "@/lib/fiscal";

const STATES = new Set(["queued", "printing", "printed", "failed", "uncertain"]);

// POST /api/fiscal/agent/jobs/[id] — agent odsyła wynik zlecenia
// (numer paragonu albo błąd). Ten sam raport można wysłać wielokrotnie.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!agentTokenValid(request.headers.get("x-fiscal-agent-token"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as AgentReport | null;
  if (!body || !STATES.has(body.state)) {
    return NextResponse.json({ error: "Bad report" }, { status: 400 });
  }
  if (body.state === "printed" && !(Number.isInteger(body.receipt_number) && Number(body.receipt_number) > 0)) {
    return NextResponse.json({ error: "Missing receipt_number" }, { status: 400 });
  }
  const found = await agentReport(id, body);
  return found ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Not found" }, { status: 404 });
}
