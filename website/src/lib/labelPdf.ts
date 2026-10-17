// Etykiety Base Courier jako PDF 4x6" — wspolne dla pojedynczej etykiety
// (/api/admin/orders/[id]/basecourier/label) i zbiorczej (/api/admin/orders/labels).

import { PDFDocument } from "pdf-lib";

// bcGetWaybillPdf uzywa printer_type "LBL" (patrz basecourier.ts) — zwraca juz
// gotowa, pojedyncza etykiete ok. A6, wiec ponizsze przyciecie jest dzis tylko
// zabezpieczeniem (np. gdyby BASECOURIER_PRINTER w .env wymusil kiedys "A4",
// gdzie etykieta InPost siedzi w lewym-gornym rogu strony — dla A4 z UPS/
// international ten mediabox-crop NIE jest poprawny, bo tam etykieta bywa
// obrocona i w innym rogu; "A4" nie powinno juz byc uzywane, patrz basecourier.ts).
const LABEL_W_PT = 300; // 4 cale + margines bezpieczenstwa
const LABEL_H_PT = 432; // 6 cali

export async function cropToLabel(pdf: Buffer): Promise<Buffer> {
  const doc = await PDFDocument.load(pdf, { ignoreEncryption: true });
  for (const page of doc.getPages()) {
    // MediaBox nie musi zaczynac sie w (0,0) — dawniej przyciecie liczone od 0
    // ucinalo zla czesc strony, gdy PDF mial przesuniety poczatek ukladu.
    const mb = page.getMediaBox();
    const width = mb.width;
    const height = mb.height;
    if (width <= LABEL_W_PT + 20 && height <= LABEL_H_PT + 20) continue; // juz jest sama etykieta
    // Strona obrocona (/Rotate 90/270) — "gora-lewo" w ukladzie strony to nie gora
    // wydruku; przyciecie dawaloby pusty/zly fragment. Zostawiamy oryginal.
    const rot = ((page.getRotation().angle % 360) + 360) % 360;
    if (rot !== 0) continue;
    const w = Math.min(LABEL_W_PT, width);
    const h = Math.min(LABEL_H_PT, height);
    const x = mb.x;
    const y = mb.y + height - h; // PDF liczy od dolu — etykieta jest na gorze strony
    page.setMediaBox(x, y, w, h);
    page.setCropBox(x, y, w, h);
  }
  return Buffer.from(await doc.save());
}

