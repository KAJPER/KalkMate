import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { agentInfo, listJobs } from "@/lib/fiscal";

// GET /api/admin/fiscal — stan agenta/drukarki i ostatnie zlecenia paragonów.
export async function GET(request: NextRequest) {
  const authErr = await requireAdminAuth(request); if (authErr) return authErr;
  const [agent, jobs] = await Promise.all([agentInfo(), listJobs(150)]);
  return NextResponse.json({
    agent,
    jobs,
    configured: Boolean(process.env.FISCAL_AGENT_TOKEN),
    autoEnqueue: process.env.FISCAL_AUTO_ENQUEUE === "1",
  });
}
