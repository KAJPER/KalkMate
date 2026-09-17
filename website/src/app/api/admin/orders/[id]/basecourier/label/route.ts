import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";
import { bcGetWaybillPdf } from "@/lib/basecourier";
import { PDFDocument } from "pdf-lib";

// Base Courier zwraca etykiete InPost jako strone A4 (595x842 pt) z etykieta
// 4x6 cala (288x432 pt) w lewym gornym rogu (printer_type "A6" nie dziala dla
// InPost). Do druku na drukarce etykiet 100x150 mm przycinamy strone do samej
// etykiety — bez tego drukarka skaluje cala kartke A4 i etykieta wychodzi malutka.
const LABEL_W_PT = 300; // 4 cale + margines bezpieczenstwa
const LABEL_H_PT = 432; // 6 cali

async function cropToLabel(pdf: Buffer): Promise<Buffer> {
  const doc = await PDFDocument.load(pdf, { ignoreEncryption: true });
  for (const page of doc.getPages()) {
    const { width, height } = page.getSize();
    if (width <= LABEL_W_PT + 20 && height <= LABEL_H_PT + 20) continue; // juz jest sama etykieta
    const w = Math.min(LABEL_W_PT, width);
    const h = Math.min(LABEL_H_PT, height);
    const y = height - h; // PDF liczy od dolu — etykieta jest na gorze strony
    page.setMediaBox(0, y, w, h);
    page.setCropBox(0, y, w, h);
  }
  return Buffer.from(await doc.save());
}

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
