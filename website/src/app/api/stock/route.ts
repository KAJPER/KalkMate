import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const STOCK_ID = "kalkmate-v1-stock";

// Stan magazynu do licznika na stronie. Brak wiersza / blad bazy = stock: null
// (nieznany) — front pokazuje wtedy dostepnosc bez liczby. Wczesniej zwracalismy
// fikcyjne "11", co przy pustym magazynie wprowadzalo klientow w blad.
export async function GET() {
  try {
    const rows = await prisma.$queryRaw<{ count: number | bigint | null }[]>`
      SELECT count FROM Inventory WHERE id = ${STOCK_ID} LIMIT 1
    `;
    const raw = rows.length > 0 ? rows[0].count : null;
    const stock = raw === null || raw === undefined ? null : Number(raw);
    return NextResponse.json({ stock: Number.isFinite(stock) ? stock : null }, {
      headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=120" },
    });
  } catch {
    return NextResponse.json({ stock: null }, { headers: { "Cache-Control": "no-store" } });
  }
}
