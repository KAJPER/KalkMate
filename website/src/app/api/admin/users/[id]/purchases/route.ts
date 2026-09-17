import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdminAuth } from "@/lib/admin-auth";
import { listTokenPurchasesByUser } from "@/lib/tokenPurchases";

// GET /api/admin/users/[id]/purchases — pelna historia zakupow uzytkownika:
// zamowienia fizyczne (kalkulator, "Order") + doladowania tokenow AI.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authErr = await requireAdminAuth(request); if (authErr) return authErr;

  const { id } = await params;

  const [orders, tokenPurchases, licenses] = await Promise.all([
    prisma.order.findMany({
      where: { userId: id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true, orderNumber: true, status: true, amount: true, currency: true,
        paymentProvider: true, createdAt: true, paidAt: true, fulfillmentStatus: true,
      },
    }),
    listTokenPurchasesByUser(id),
    prisma.license.findMany({
      where: { usedBy: id },
      select: { code: true, durationDays: true, usedAt: true, description: true },
      orderBy: { usedAt: "desc" },
    }),
  ]);

  return NextResponse.json({ orders, tokenPurchases, licenses });
}
