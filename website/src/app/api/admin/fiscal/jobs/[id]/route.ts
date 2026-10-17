import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { adminJobAction, ADMIN_JOB_ACTIONS, FiscalError, type AdminJobActionName } from "@/lib/fiscal";

// POST /api/admin/fiscal/jobs/[id] — { action: "retry" | "cancel" | "mark_printed" | "reassign", receiptNumber? }
// reassign: zlecenie 'sent' wraca do kolejki dla DOWOLNEGO agenta (K6) —
// tylko gdy poprzedni agent na pewno nie drukuje (UI musi to potwierdzić).
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authErr = await requireAdminAuth(request); if (authErr) return authErr;
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  if (!ADMIN_JOB_ACTIONS.includes(body?.action)) {
    return NextResponse.json({ ok: false, error: "Nieznana akcja" }, { status: 400 });
  }
  try {
    const job = await adminJobAction(id, body.action as AdminJobActionName, Number(body.receiptNumber) || undefined);
    return NextResponse.json({ ok: true, job });
  } catch (e) {
    if (e instanceof FiscalError) return NextResponse.json({ ok: false, error: e.message }, { status: e.status });
    console.error("[admin/fiscal/jobs]", e);
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}
