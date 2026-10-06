import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";
import { buildOrderReceipt, enqueueOrderReceipt, FiscalError, listJobsForOrder } from "@/lib/fiscal";

// GET  /api/admin/orders/[id]/fiscal — zlecenia paragonu dla zamówienia + podgląd pozycji
// POST /api/admin/orders/[id]/fiscal — dodaj paragon do kolejki agenta fiskalnego
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authErr = await requireAdminAuth(request); if (authErr) return authErr;
  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id },
    select: { id: true, orderNumber: true, status: true, amount: true, currency: true, paymentProvider: true },
  });
  if (!order) return NextResponse.json({ ok: false, error: "Order not found" }, { status: 404 });
  const jobs = await listJobsForOrder(id);
  let preview = null;
  let previewError: string | null = null;
  try {
    preview = await buildOrderReceipt(order);
  } catch (e) {
    previewError = e instanceof Error ? e.message : String(e);
  }
  return NextResponse.json({ ok: true, jobs, preview, previewError, configured: Boolean(process.env.FISCAL_AGENT_TOKEN) });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authErr = await requireAdminAuth(request); if (authErr) return authErr;
  const { id } = await params;
  try {
    const job = await enqueueOrderReceipt(id, "admin");
    return NextResponse.json({ ok: true, job });
  } catch (e) {
    if (e instanceof FiscalError) return NextResponse.json({ ok: false, error: e.message }, { status: e.status });
    console.error("[admin/orders/fiscal]", e);
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}
