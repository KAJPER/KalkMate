import { NextRequest, NextResponse } from "next/server";
import { PDFDocument } from "pdf-lib";
import { requireAdminAuth } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";
import { bcGetWaybillPdf } from "@/lib/basecourier";
import { cropToLabel } from "@/lib/labelPdf";

// Dawniej: sekwencyjnie do 100 zamowien x 25 s timeoutu Base Courier = request
// trwajacy dziesiatki minut. Teraz najwyzej 4 pobrania naraz i calkowity
// budzet czasu — czego nie zdazymy pobrac, idzie do X-Skipped.
const CONCURRENCY = 4;
const TOTAL_BUDGET_MS = 90_000;

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

  const deadline = Date.now() + TOTAL_BUDGET_MS;
  // Wynik per zamowienie (w kolejnosci listy): PDF etykiety albo powod pominiecia.
  const results: ({ label: Buffer } | { skip: string })[] = new Array(orders.length);
  let next = 0;
  const worker = async () => {
    while (next < orders.length) {
      const i = next++;
      const o = orders[i];
      if (o.furgonetkaStatus !== "basecourier" || !o.furgonetkaPackageId) {
        results[i] = { skip: `${o.orderNumber} (brak przesyłki)` };
        continue;
      }
      if (Date.now() > deadline) {
        results[i] = { skip: `${o.orderNumber} (przekroczono limit czasu — pobierz ponownie)` };
        continue;
      }
      try {
        const { pdf } = await bcGetWaybillPdf(o.furgonetkaPackageId);
        if (!pdf) { results[i] = { skip: `${o.orderNumber} (etykieta jeszcze niedostępna)` }; continue; }
        let label: Buffer = pdf;
        try { label = await cropToLabel(pdf); } catch { /* zostaje oryginal */ }
        results[i] = { label };
      } catch (e) {
        console.error("[orders/labels]", o.orderNumber, e);
        results[i] = { skip: `${o.orderNumber} (błąd: ${(e as Error).message.slice(0, 60)})` };
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, orders.length) }, worker));

  const out = await PDFDocument.create();
  const skipped: string[] = [];
  for (let i = 0; i < orders.length; i++) {
    const r = results[i];
    if (!r) continue;
    if ("skip" in r) { skipped.push(r.skip); continue; }
    try {
      const src = await PDFDocument.load(r.label, { ignoreEncryption: true });
      const pages = await out.copyPages(src, src.getPageIndices());
      pages.forEach((p) => out.addPage(p));
    } catch (e) {
      console.error("[orders/labels] pdf merge", orders[i].orderNumber, e);
      skipped.push(`${orders[i].orderNumber} (błąd PDF: ${(e as Error).message.slice(0, 60)})`);
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
