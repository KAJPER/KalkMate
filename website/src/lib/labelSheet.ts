// Krajalnica etykiet InPost — tnie arkusz A4 z siatka 2x2 etykiet
// (standardowy eksport InPost: kazda cwiartka ~105x148.5mm, wypelniana w
// kolejnosci gora-lewo, gora-prawo, dol-lewo, dol-prawo) na osobne strony
// PDF, kazda dopasowana (scale-to-fit, wysrodkowana) do max 100mm x 150mm —
// gotowe do wydruku na drukarce etykiet.
//
// UWAGA: nie ma proby wykrycia "pustej" cwiartki na ostatnim, czesciowo
// zapelnionym arkuszu (wymagaloby to parsowania tekstu PDF) — jesli
// ostatni arkusz zrodlowy ma mniej niz 4 etykiety, wynikowy PDF bedzie
// mial 1-3 dodatkowe, puste strony na koncu. Latwo je pominac przy druku.

import { PDFDocument } from "pdf-lib";

const MM = 72 / 25.4;
const mm = (v: number) => v * MM;

export const LABEL_MAX_W_MM = 100;
export const LABEL_MAX_H_MM = 150;

export async function splitLabelSheet(inputBytes: Uint8Array): Promise<Uint8Array> {
  // ignoreEncryption: eksporty PDF bywaja "zaszyfrowane" pustym haslem (tylko
  // uprawnienia) — bez tego pdf-lib odmawia wczytania (tak samo jak w labelPdf.ts).
  const srcDoc = await PDFDocument.load(inputBytes, { ignoreEncryption: true });
  const outDoc = await PDFDocument.create();
  const outW = mm(LABEL_MAX_W_MM);
  const outH = mm(LABEL_MAX_H_MM);

  const srcPages = srcDoc.getPages();
  for (const srcPage of srcPages) {
    // Cwiartki liczone od poczatku MediaBox (nie zawsze (0,0)).
    const { x: ox, y: oy, width: pw, height: ph } = srcPage.getMediaBox();
    const halfW = pw / 2;
    const halfH = ph / 2;

    // Kolejnosc jak w standardowym arkuszu InPost: gora-lewo, gora-prawo,
    // dol-lewo, dol-prawo.
    const quadrants = [
      { left: ox, bottom: oy + halfH, right: ox + halfW, top: oy + ph },
      { left: ox + halfW, bottom: oy + halfH, right: ox + pw, top: oy + ph },
      { left: ox, bottom: oy, right: ox + halfW, top: oy + halfH },
      { left: ox + halfW, bottom: oy, right: ox + pw, top: oy + halfH },
    ];

    for (const box of quadrants) {
      const embedded = await outDoc.embedPage(srcPage, box);
      const cropW = box.right - box.left;
      const cropH = box.top - box.bottom;
      const scale = Math.min(outW / cropW, outH / cropH);
      const drawW = cropW * scale;
      const drawH = cropH * scale;

      const page = outDoc.addPage([outW, outH]);
      page.drawPage(embedded, {
        x: (outW - drawW) / 2,
        y: (outH - drawH) / 2,
        width: drawW,
        height: drawH,
      });
    }
  }

  return outDoc.save();
}

export async function downloadSplitLabelSheet(inputBytes: Uint8Array, sourceName: string) {
  const bytes = await splitLabelSheet(inputBytes);
  const blob = new Blob([bytes as unknown as BlobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const base = sourceName.replace(/\.pdf$/i, "");
  a.href = url;
  a.download = `${base}-etykiety-pociete.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Natychmiastowe revoke potrafi przerwac pobieranie (Firefox/Safari).
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
