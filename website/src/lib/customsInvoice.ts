import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";

// Faktura handlowa (Commercial Invoice) do przesylek poza UE — wersja
// papierowa dokumentow celnych (Base Courier: CourierSearch.paper_customs_docs).
// Wydrukowac w 3 egzemplarzach i dolaczyc do paczki (w kieszeni na dokumenty).
// Po angielsku i tylko ASCII: czcionki standardowe PDF nie maja polskich
// znakow, a dokument i tak czyta zagraniczny urzad celny.

export interface CustomsParty {
  name: string;
  company?: string;
  street: string;
  postal: string;
  city: string;
  country: string; // kod ISO lub pelna nazwa
  phone: string;
  email: string;
}

export interface CustomsInvoiceInput {
  invoiceNo: string;
  date: string; // YYYY-MM-DD
  shipper: CustomsParty;
  consignee: CustomsParty;
  goods: {
    description: string;
    hsCode: string;
    originCountry: string;
    quantity: number;
    unitValue: number;
    currency: string;
    weightKg: number;
  };
}

const COUNTRY_NAMES: Record<string, string> = {
  PL: "Poland", US: "United States", GB: "United Kingdom", CH: "Switzerland", NO: "Norway",
  CA: "Canada", AU: "Australia", DE: "Germany", OTHER: "United States",
};

function countryName(code: string): string {
  const c = (code || "").trim();
  return COUNTRY_NAMES[c.toUpperCase()] || c;
}

function ascii(s: string): string {
  return (s || "")
    .replace(/ł/g, "l")
    .replace(/Ł/g, "L")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\x20-\x7E]/g, "?");
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = ascii(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (font.widthOfTextAtSize(next, size) <= maxWidth || !cur) cur = next;
    else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [""];
}

export async function buildCustomsInvoicePdf(input: CustomsInvoiceInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]); // A4
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const black = rgb(0, 0, 0);
  const grey = rgb(0.35, 0.35, 0.35);
  const M = 40; // margines
  const W = 595 - 2 * M;

  const text = (s: string, x: number, y: number, size = 10, b = false, color = black) =>
    page.drawText(ascii(s), { x, y, size, font: b ? bold : font, color });
  const hline = (y: number, x1 = M, x2 = M + W) =>
    page.drawLine({ start: { x: x1, y }, end: { x: x2, y }, thickness: 0.7, color: grey });

  // Naglowek
  text("COMMERCIAL INVOICE", M, 795, 20, true);
  text(`Invoice No: ${input.invoiceNo}`, 380, 800, 10, true);
  text(`Date: ${input.date}`, 380, 785, 10);
  hline(775);

  text("Reason for export: Sale of goods", M, 758, 10);
  text(`Currency: ${input.goods.currency}`, 380, 758, 10);
  hline(745);

  // Nadawca / odbiorca
  const party = (title: string, p: CustomsParty, x: number, top: number) => {
    let y = top;
    text(title, x, y, 10, true);
    y -= 15;
    const lines = [
      p.name,
      ...(p.company ? [p.company] : []),
      ...wrap(p.street, font, 10, 240),
      `${p.postal} ${p.city}`,
      countryName(p.country),
      `Tel: ${p.phone}`,
      `Email: ${p.email}`,
    ];
    for (const l of lines) {
      text(l, x, y, 10);
      y -= 13;
    }
    return y;
  };
  const yLeft = party("SHIPPER / EXPORTER", input.shipper, M, 727);
  const yRight = party("CONSIGNEE", input.consignee, 320, 727);
  let y = Math.min(yLeft, yRight) - 12;
  hline(y + 6);

  // Tabela towarow
  const g = input.goods;
  const total = g.quantity * g.unitValue;
  const cols = { desc: M, hs: 250, origin: 320, qty: 390, unit: 430, total: 505 };
  y -= 8;
  text("Description of goods", cols.desc, y, 9, true);
  text("HS code", cols.hs, y, 9, true);
  text("Origin", cols.origin, y, 9, true);
  text("Qty", cols.qty, y, 9, true);
  text(`Unit (${g.currency})`, cols.unit, y, 9, true);
  text(`Total (${g.currency})`, cols.total, y, 9, true);
  y -= 6;
  hline(y);
  y -= 14;
  const descLines = wrap(g.description, font, 10, 200);
  text(descLines[0], cols.desc, y, 10);
  text(g.hsCode, cols.hs, y, 10);
  text(countryName(g.originCountry), cols.origin, y, 10);
  text(String(g.quantity), cols.qty, y, 10);
  text(g.unitValue.toFixed(2), cols.unit, y, 10);
  text(total.toFixed(2), cols.total, y, 10);
  for (const extra of descLines.slice(1)) {
    y -= 13;
    text(extra, cols.desc, y, 10);
  }
  y -= 10;
  hline(y);
  y -= 18;
  text(`TOTAL DECLARED VALUE: ${total.toFixed(2)} ${g.currency}`, M, y, 11, true);
  y -= 16;
  text(`Packages: 1     Net weight: ${g.weightKg.toFixed(1)} kg     Gross weight: ${g.weightKg.toFixed(1)} kg`, M, y, 10);
  y -= 30;

  // Oswiadczenie + podpis
  for (const l of wrap(
    "I declare that the information on this invoice is true and correct and that the contents of this shipment are as stated above.",
    font,
    10,
    W
  )) {
    text(l, M, y, 10);
    y -= 13;
  }
  y -= 40;
  hline(y, M, M + 220);
  text("Signature", M, y - 12, 9, false, grey);
  hline(y, 320, 320 + 200);
  text(`Name / Date: ${input.shipper.name} / ${input.date}`, 320, y - 12, 9, false, grey);

  return doc.save();
}
