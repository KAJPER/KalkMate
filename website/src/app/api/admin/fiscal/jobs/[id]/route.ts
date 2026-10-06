import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { adminJobAction, FiscalError } from "@/lib/fiscal";

// POST /api/admin/fiscal/jobs/[id] — { action: "retry" | "cancel" | "mark_printed", receiptNumber? }
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authErr = await requireAdminAuth(request); if (authErr) return authErr;
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  if (!["retry", "cancel", "mark_printed"].includes(body?.action)) {
    return NextResponse.json({ ok: false, error: "Nieznana akcja" }, { status: 400 });
  }
  try {
    const job = await adminJobAction(id, body.action, Number(body.receiptNumber) || undefined);
    return NextResponse.json({ ok: true, job });
  } catch (e) {
    if (e instanceof FiscalError) return NextResponse.json({ ok: false, error: e.message }, { status: e.status });
    console.error("[admin/fiscal/jobs]", e);
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}
