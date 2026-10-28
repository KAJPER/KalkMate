import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { listReviewsForAdmin, moderateReview } from "@/lib/reviews";

// GET /api/admin/reviews — do moderacji (submitted) + historia + statystyki
export async function GET(req: NextRequest) {
  const authErr = await requireAdminAuth(req); if (authErr) return authErr;
  try {
    const data = await listReviewsForAdmin();
    return NextResponse.json({ ok: true, ...data });
  } catch (e) {
    console.error("[admin/reviews GET]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// PATCH /api/admin/reviews?id=... — Body: { status: 'approved' | 'rejected' }
export async function PATCH(req: NextRequest) {
  const authErr = await requireAdminAuth(req); if (authErr) return authErr;
  try {
    const id = req.nextUrl.searchParams.get("id") || "";
    const body = await req.json().catch(() => ({}));
    const status = body?.status;
    if (!id) return NextResponse.json({ error: "Brak id" }, { status: 400 });
    if (status !== "approved" && status !== "rejected") {
      return NextResponse.json({ error: "Status: approved albo rejected" }, { status: 400 });
    }
    const ok = await moderateReview(id, status);
    if (!ok) return NextResponse.json({ error: "Nie znaleziono opinii do moderacji" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[admin/reviews PATCH]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
