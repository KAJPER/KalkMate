import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const STOCK_ID = "kalkmate-v1-stock";
const DEFAULT_STOCK = 11;

export async function GET() {
  try {
    const rows = await prisma.$queryRaw<{ count: number }[]>`
      SELECT count FROM Inventory WHERE id = ${STOCK_ID} LIMIT 1
    `;
    const stock = rows.length > 0 ? rows[0].count : DEFAULT_STOCK;
    return NextResponse.json({ stock }, {
      headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=120" },
    });
  } catch {
    return NextResponse.json({ stock: DEFAULT_STOCK });
  }
}
