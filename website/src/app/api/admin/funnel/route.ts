import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { funnelStats, lastDaysRange } from "@/lib/funnel";
import { cachedStats } from "../_lib/stats";

// GET /api/admin/funnel?days=14 — lejek zakupowy (lib/funnel.ts) dla
// components/admin/FunnelPanel.tsx. days: 1..90, domyslnie 14.
export async function GET(request: NextRequest) {
  const authErr = await requireAdminAuth(request); if (authErr) return authErr;
  try {
    const n = Math.floor(Number(request.nextUrl.searchParams.get("days")) || 14);
    const days = Math.min(90, Math.max(1, n));
    const data = await cachedStats(`funnel:${days}`, () => {
      const { fromMs, toMs } = lastDaysRange(days);
      return funnelStats(fromMs, toMs);
    });
    return NextResponse.json(data);
  } catch (error) {
    console.error("[admin/funnel] error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
