import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { listRentals, RENTAL_PLANS, RENTAL_DEPOSIT_GROSZE, RENTAL_SHIPPING_BUFFER_DAYS } from "@/lib/rentals";

// GET /api/admin/rentals — lista wypozyczen (nieoplacone tylko z ostatnich 7 dni).
export async function GET(request: NextRequest) {
  const authErr = await requireAdminAuth(request); if (authErr) return authErr;
  return NextResponse.json({
    ok: true,
    rentals: await listRentals(),
    config: { plans: RENTAL_PLANS, deposit: RENTAL_DEPOSIT_GROSZE, bufferDays: RENTAL_SHIPPING_BUFFER_DAYS },
  });
}
