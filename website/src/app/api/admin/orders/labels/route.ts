import { NextRequest, NextResponse } from "next/server";
import { PDFDocument } from "pdf-lib";
import { requireAdminAuth } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";
import { bcGetWaybillPdf } from "@/lib/basecourier";
import { cropToLabel } from "@/lib/labelPdf";

// POST { ids: string[] } -> jeden PDF z etykietami (4x6", strona na etykiete)
// wszystkich zaznaczonych zamowien, ktore maja juz przesylke Base Courier.
// Zamowienia bez przesylki / z bledem pobrania sa pomijane — ich numery KM
// w naglowku X-Skipped (lista w panelu).
export async function POST(request: NextRequest) {
  const authErr = await requireAdminAuth(request); if (authErr) return authErr;
  const body = await request.json().catch(() => ({}));
  const ids: string[] = Array.isArray(body?.ids) ? body.ids.filter((x: unknown) => typeof x === "string").slice(0, 100) : [];
  if (!ids.length) return NextResponse.json({ ok: false, error: "Nie zaznaczono zamówień" }, { status: 400 });

  const orders = await prisma.order.findMany({
    where: { id: { in: ids } },
    select: { id: true, orderNumber: true, furgonetkaStatus: true, furgonetkaPackageId: true },
  });
  // Kolejnosc jak na liscie w panelu.
  orders.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));

  const out = await PDFDocument.create();
  const skipped: string[] = [];
  for (const o of orders) {
    if (o.furgonetkaStatus !== "basecourier" || !o.furgonetkaPackageId) {
      skipped.push(`${o.orderNumber} (brak przesyłki)`);
      continue;
    }
    try {
      const { pdf } = await bcGetWaybillPdf(o.furgonetkaPackageId);
      if (!pdf) { skipped.push(`${o.orderNumber} (etykieta jeszcze niedostępna)`); continue; }
      let label: Buffer = pdf;
      try { label = await cropToLabel(pdf); } catch { /* zostaje oryginal */ }
      const src = await PDFDocument.load(label, { ignoreEncryption: true });
      const pages = await out.copyPages(src, src.getPageIndices());
      pages.forEach((p) => out.addPage(p));
    } catch (e) {
      console.error("[orders/labels]", o.orderNumber, e);
      skipped.push(`${o.orderNumber} (błąd: ${(e as Error).message.slice(0, 60)})`);
    }
  }
  if (!out.getPageCount()) {
    return NextResponse.json({ ok: false, error: "Żadne z zaznaczonych zamówień nie ma etykiety.", skipped }, { status: 400 });
  }
  const bytes = await out.save();
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="etykiety-${new Date().toISOString().slice(0, 10)}.pdf"`,
      "X-Skipped": encodeURIComponent(JSON.stringify(skipped)),
      "Cache-Control": "no-store",
    },
  });
}
