import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";

/**
 * POST /api/admin/orders/[id]/furgonetka — WYLACZONE (410 Gone).
 *
 * Nadawanie przez Furgonetke zastapil Base Courier
 * (/api/admin/orders/[id]/basecourier). Panel admina juz tego endpointu nie
 * wola, a stara wersja nie miala zadnej ochrony przed nadaniem paczki dla
 * zamowienia anulowanego/juz wyslanego ani przed podwojnym nadaniem
 * (audyt 2026-10-16). Zamiast utrzymywac martwa, niebezpieczna sciezke —
 * odmawiamy. Kod klienta API zostaje w src/lib/furgonetka.ts.
 */
export async function POST(request: NextRequest) {
  const authErr = await requireAdminAuth(request); if (authErr) return authErr;
  return NextResponse.json(
    { error: "Nadawanie przez Furgonetke jest wylaczone — uzyj Base Courier." },
    { status: 410 }
  );
}

/**
 * GET /api/admin/orders/[id]/furgonetka — tylko odczyt zapisanych pol
 * (bez wolania API Furgonetki), zostawione dla zgodnosci.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authErr = await requireAdminAuth(request); if (authErr) return authErr;
  const { id } = await params;

  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) {
    return NextResponse.json({ error: "Nie znaleziono zamówienia" }, { status: 404 });
  }

  return NextResponse.json({
    package_id: order.furgonetkaPackageId || null,
    order_uuid: order.furgonetkaOrderUuid || null,
    status: order.furgonetkaStatus || null,
  });
}
