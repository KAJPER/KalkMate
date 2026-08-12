// Generator arkuszy PDF do druku i wycięcia — karty licencyjne KalkMate.
// Strona 1: przód każdej karty (kod licencji). Strona 2: tył (instrukcja
// aktywacji) — identyczna we wszystkich komórkach, więc kierunek obrotu przy
// druku dwustronnym nie ma znaczenia dla poprawności tresci.
// Karta: 35mm x 50mm, siatka wyśrodkowana na A4, linie cięcia przerywane.

import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from "pdf-lib";

const MM = 72 / 25.4; // 1mm w punktach PDF
const mm = (v: number) => v * MM;

const PAGE_W = mm(210);
const PAGE_H = mm(297);
const CARD_W = mm(35);
const CARD_H = mm(50);
const MIN_MARGIN = mm(5);

const COLS = Math.floor((PAGE_W - 2 * MIN_MARGIN) / CARD_W);
const ROWS = Math.floor((PAGE_H - 2 * MIN_MARGIN) / CARD_H);
export const CARDS_PER_SHEET = COLS * ROWS;

const MARGIN_X = (PAGE_W - COLS * CARD_W) / 2;
const MARGIN_Y = (PAGE_H - ROWS * CARD_H) / 2;

const INK = rgb(0.08, 0.08, 0.08);
const MUTED = rgb(0.4, 0.4, 0.4);
const ACCENT = rgb(0.15, 0.35, 0.85);

function centerX(text: string, size: number, font: PDFFont, cardX: number): number {
  const w = font.widthOfTextAtSize(text, size);
  return cardX + (CARD_W - w) / 2;
}

// Rysuje pełną siatkę przerywanych linii cięcia (obwód + wewnętrzne).
function drawCutGrid(page: PDFPage) {
  const dashArray = [mm(1.2), mm(1)];
  const color = rgb(0.6, 0.6, 0.6);
  const gridW = COLS * CARD_W;
  const gridH = ROWS * CARD_H;
  const left = MARGIN_X;
  const top = PAGE_H - MARGIN_Y;

  for (let c = 0; c <= COLS; c++) {
    const x = left + c * CARD_W;
    page.drawLine({
      start: { x, y: top },
      end: { x, y: top - gridH },
      thickness: 0.5,
      color,
      dashArray,
    });
  }
  for (let r = 0; r <= ROWS; r++) {
    const y = top - r * CARD_H;
    page.drawLine({
      start: { x: left, y },
      end: { x: left + gridW, y },
      thickness: 0.5,
      color,
      dashArray,
    });
  }
}

function drawPrintNote(page: PDFPage, font: PDFFont, text: string) {
  const size = 6.5;
  const w = font.widthOfTextAtSize(text, size);
  page.drawText(text, {
    x: (PAGE_W - w) / 2,
    y: mm(3),
    size,
    font,
    color: MUTED,
  });
}

export async function buildLicenseSheetPdf(
  codes: string[],
  durationDays: number
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const reg = await doc.embedFont(StandardFonts.Helvetica);
  const mono = await doc.embedFont(StandardFonts.CourierBold);

  const sheetCount = Math.max(1, Math.ceil(codes.length / CARDS_PER_SHEET));
  const durationLabel =
    durationDays === 7 ? "7 dni dostepu" : durationDays === 90 ? "90 dni dostepu" : `${durationDays} dni dostepu`;

  for (let s = 0; s < sheetCount; s++) {
    const sheetCodes = codes.slice(s * CARDS_PER_SHEET, (s + 1) * CARDS_PER_SHEET);

    // === Strona przednia (kody) ===
    const front = doc.addPage([PAGE_W, PAGE_H]);
    drawCutGrid(front);
    sheetCodes.forEach((code, i) => {
      const r = Math.floor(i / COLS);
      const c = i % COLS;
      const cardX = MARGIN_X + c * CARD_W;
      const cardTop = PAGE_H - MARGIN_Y - r * CARD_H;

      front.drawText("KalkMate", {
        x: centerX("KalkMate", 7, bold, cardX),
        y: cardTop - mm(7),
        size: 7,
        font: bold,
        color: ACCENT,
      });

      // Kod licencji — zmniejsz font jesli za dlugi na szerokosc karty.
      let codeSize = 9;
      const maxCodeW = CARD_W - mm(4);
      while (codeSize > 5 && mono.widthOfTextAtSize(code, codeSize) > maxCodeW) codeSize -= 0.5;
      front.drawText(code, {
        x: centerX(code, codeSize, mono, cardX),
        y: cardTop - mm(25),
        size: codeSize,
        font: mono,
        color: INK,
      });

      const caption = "To jest Twoja licencja";
      front.drawText(caption, {
        x: centerX(caption, 5, reg, cardX),
        y: cardTop - mm(31),
        size: 5,
        font: reg,
        color: MUTED,
      });
      front.drawText(durationLabel, {
        x: centerX(durationLabel, 5, reg, cardX),
        y: cardTop - mm(36),
        size: 5,
        font: reg,
        color: MUTED,
      });

      const url = "kalkmate.pl";
      front.drawText(url, {
        x: centerX(url, 5.5, bold, cardX),
        y: cardTop - CARD_H + mm(5),
        size: 5.5,
        font: bold,
        color: ACCENT,
      });
    });
    drawPrintNote(
      front,
      reg,
      "Strona 1/2: PRZOD (kod licencji). Drukuj dwustronnie ze str. 2 (TYL) - potnij wzdluz linii przerywanych."
    );

    // === Strona tylna (instrukcja aktywacji, identyczna w kazdej karcie) ===
    const back = doc.addPage([PAGE_W, PAGE_H]);
    drawCutGrid(back);
    for (let i = 0; i < sheetCodes.length; i++) {
      const r = Math.floor(i / COLS);
      const c = i % COLS;
      const cardX = MARGIN_X + c * CARD_W;
      const cardTop = PAGE_H - MARGIN_Y - r * CARD_H;

      const title = "Jak aktywowac?";
      back.drawText(title, {
        x: centerX(title, 6, bold, cardX),
        y: cardTop - mm(7),
        size: 6,
        font: bold,
        color: INK,
      });

      const steps = [
        "1. Wejdz na kalkmate.pl",
        "2. Zaloguj sie / zaloz konto",
        "3. Panel -> Subskrypcja",
        "4. Wpisz kod licencji",
        "5. Kliknij Aktywuj",
      ];
      steps.forEach((line, li) => {
        back.drawText(line, {
          x: cardX + mm(3),
          y: cardTop - mm(15) - li * mm(5.2),
          size: 5,
          font: reg,
          color: INK,
        });
      });

      const url = "kalkmate.pl/panel";
      back.drawText(url, {
        x: centerX(url, 5.5, bold, cardX),
        y: cardTop - CARD_H + mm(5),
        size: 5.5,
        font: bold,
        color: ACCENT,
      });
    }
    drawPrintNote(back, reg, "Strona 2/2: TYL (instrukcja aktywacji) - jednakowa dla kazdej karty.");
  }

  return doc.save();
}

export async function downloadLicenseSheetPdf(codes: string[], durationDays: number) {
  const bytes = await buildLicenseSheetPdf(codes, durationDays);
  const blob = new Blob([bytes as unknown as BlobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `kalkmate-licencje-${codes.length}szt-${stamp}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
