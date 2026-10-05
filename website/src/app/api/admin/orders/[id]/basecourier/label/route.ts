import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";
import { bcGetWaybillPdf } from "@/lib/basecourier";
import { cropToLabel } from "@/lib/labelPdf";

// GET /api/admin/orders/[id]/basecourier/label — etykieta PDF z Base Courier
// dla przesylki nadanej przez POST .../basecourier. Proxy przez serwer, zeby
// klucz API nie trafil do przegladarki. Domyslnie przycieta do 4x6"; ?raw=1
// zwraca oryginalna strone A4 z Base Courier.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authErr = await requireAdminAuth(request); if (authErr) return authErr;
  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id },
    select: { furgonetkaPackageId: true, furgonetkaStatus: true, orderNumber: true },
  });
  if (!order) return NextResponse.json({ ok: false, error: "Order not found" }, { status: 404 });
  if (order.furgonetkaStatus !== "basecourier" || !order.furgonetkaPackageId) {
    return NextResponse.json({ ok: false, error: "Brak przesylki Base Courier dla tego zamowienia" }, { status: 400 });
  }

  try {
    const { pdf, link, raw } = await bcGetWaybillPdf(order.furgonetkaPackageId);
    if (pdf) {
      let out: Buffer = pdf;
      if (request.nextUrl.searchParams.get("raw") !== "1") {
        try {
          out = await cropToLabel(pdf);
        } catch (e) {
          console.error("[basecourier] label crop failed, returning A4:", (e as Error).message);
        }
      }
      return new NextResponse(new Uint8Array(out), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="etykieta-${order.orderNumber}.pdf"`,
          "Cache-Control": "private, no-store",
        },
      });
    }
    if (link) return NextResponse.redirect(link);
    console.error("[basecourier] label: unexpected response", JSON.stringify(raw).slice(0, 1000));
    return NextResponse.json({ ok: false, error: "Base Courier nie zwrocil etykiety PDF" }, { status: 502 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 502 });
  }
}
