import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { COOKIE_NAME } from "@/lib/admin-auth";

const STOCK_ID = "kalkmate-v1-stock";
const STOCK_NAME = "KalkMate v1.0 — stan magazynowy (strona główna)";

function isAdmin(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  return token === process.env.ADMIN_SESSION_TOKEN;
}

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const rows = await prisma.$queryRaw<{ count: number }[]>`
      SELECT count FROM Inventory WHERE id = ${STOCK_ID} LIMIT 1
    `;
    return NextResponse.json({ stock: rows.length > 0 ? rows[0].count : 11 });
  } catch (e) {
    console.error("[admin/stock GET]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// POST /api/admin/stock — ustaw stan (upsert)
// Body: { stock: number }
export async function POST(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await req.json().catch(() => ({}));
    const stock = Math.max(0, Math.floor(Number(body?.stock)));
    if (!Number.isFinite(stock)) {
      return NextResponse.json({ error: "Nieprawidłowa wartość" }, { status: 400 });
    }

    const exists = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM Inventory WHERE id = ${STOCK_ID} LIMIT 1
    `;

    if (exists.length > 0) {
      await prisma.$executeRaw`
        UPDATE Inventory SET count = ${stock}, updatedAt = CURRENT_TIMESTAMP WHERE id = ${STOCK_ID}
      `;
    } else {
      await prisma.$executeRaw`
        INSERT INTO Inventory (id, name, count, notes) VALUES (${STOCK_ID}, ${STOCK_NAME}, ${stock}, NULL)
      `;
    }

    return NextResponse.json({ ok: true, stock });
  } catch (e) {
    console.error("[admin/stock POST]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
