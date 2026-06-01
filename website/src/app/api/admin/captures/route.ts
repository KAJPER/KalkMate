import { NextRequest, NextResponse } from "next/server";
import { listAllCaptures } from "@/lib/captures";

// GET /api/admin/captures — wszystkie zdjecia z wszystkich urzadzen.
// Auth: middleware sprawdza admin_session.
// Query: ?device=AABBCCDDEEFF — filtruj po deviceId
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const deviceFilter = (url.searchParams.get("device") || "").trim().toUpperCase();

  const all = await listAllCaptures();
  const filtered = deviceFilter
    ? all.filter((c) => c.deviceId.toUpperCase() === deviceFilter)
    : all;

  // Stats: per-device count
  const byDevice = new Map<string, number>();
  for (const c of all) {
    byDevice.set(c.deviceId, (byDevice.get(c.deviceId) || 0) + 1);
  }
  const deviceStats = Array.from(byDevice.entries())
    .map(([deviceId, count]) => ({ deviceId, count }))
    .sort((a, b) => b.count - a.count);

  const totalSizeKB = filtered.reduce((sum, c) => sum + c.sizeKB, 0);

  return NextResponse.json({
    ok: true,
    items: filtered,
    stats: {
      total: all.length,
      filtered: filtered.length,
      totalSizeKB,
      uniqueDevices: deviceStats.length,
      byDevice: deviceStats,
    },
  });
}
