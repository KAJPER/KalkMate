import { PDFDocument, PDFImage, PDFPage } from "pdf-lib";
import { readFile } from "fs/promises";
import path from "path";

// Obraz podpisu (PNG lub JPG, najlepiej przezroczyste/białe tło) wklejany
// automatycznie w dokumenty celne (faktura, Karta odprawy UPS, upoważnienie).
// Plik NIE jest w repo (Twoje dane osobowe) — wgraj go ręcznie na serwer:
//   /home/ubuntu/kalkulator/website/assets/signature.png
// Bez tego pliku dokumenty wychodzą jak dotychczas (bez podpisu) — funkcje
// poniżej zwracają null zamiast rzucać błąd, żeby reszta panelu dalej działała.
const SIGNATURE_PATH = path.join(process.cwd(), "assets", "signature.png");
const SIGNATURE_PATH_JPG = path.join(process.cwd(), "assets", "signature.jpg");

export async function loadSignatureImage(doc: PDFDocument): Promise<PDFImage | null> {
  let bytes: Buffer;
  let isPng = true;
  try {
    bytes = await readFile(SIGNATURE_PATH);
  } catch {
    try {
      bytes = await readFile(SIGNATURE_PATH_JPG);
      isPng = false;
    } catch {
      return null;
    }
  }
  try {
    return isPng ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
  } catch (e) {
    console.error("[signature] failed to embed image:", e);
    return null;
  }
}

// Rysuje podpis (x,y = lewy-dolny róg) dopasowany proporcjonalnie do maxWidth/maxHeight,
// bez rozciągania (skala <= 1, obraz nigdy nie jest powiększany ponad oryginał).
export function drawSignature(page: PDFPage, image: PDFImage, x: number, y: number, maxWidth: number, maxHeight: number) {
  const scale = Math.min(maxWidth / image.width, maxHeight / image.height, 1);
  page.drawImage(image, { x, y, width: image.width * scale, height: image.height * scale });
}

// Data "dnia podpisania" = dzień pobrania dokumentu z panelu.
export function todayPl(): string {
  return new Intl.DateTimeFormat("pl-PL", { timeZone: "Europe/Warsaw", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date());
}
