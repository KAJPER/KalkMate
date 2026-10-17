import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { listAdminCaptures, parseCapturePage } from "@/lib/captures";

// GET /api/admin/captures — wszystkie zdjecia z wszystkich urzadzen.
// Auth: middleware sprawdza admin_session (defense-in-depth: sprawdzamy tez tutaj).
// Query: ?device=AABBCCDDEEFF — filtruj po deviceId; ?limit=500&before=<ms|ISO> — paginacja.
// Dane z tabeli Capture (bez skanu katalogu na kazde zadanie).
export async function GET(req: NextRequest) {
  const authErr = await requireAdminAuth(req); if (authErr) return authErr;
  const url = new URL(req.url);
  const deviceFilter = (url.searchParams.get("device") || "").trim().toUpperCase() || null;
  const page = parseCapturePage(url, 500, 2000);

  try {
    const r = await listAdminCaptures(deviceFilter, page);
    return NextResponse.json({
      ok: true,
      items: r.items,
      nextBefore: r.nextBefore,
      hasMore: r.nextBefore !== null,
      stats: {
        total: r.total,
        filtered: deviceFilter ? r.filtered : r.total,
        totalSizeKB: r.totalSizeKB,
        uniqueDevices: r.byDevice.length,
        byDevice: r.byDevice,
      },
    });
  } catch (e) {
    console.error("[admin/captures]", e);
    return NextResponse.json({ ok: false, error: "Blad serwera" }, { status: 503 });
  }
}
