import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get("sessionId");

  if (!sessionId) {
    return NextResponse.json({ error: "Brak sessionId." }, { status: 400 });
  }

  try {
    const rows = await prisma.$queryRaw<
      Array<{ status: string; orderNumber: string }>
    >`
      SELECT status, "orderNumber"
      FROM "Order"
      WHERE "p24SessionId" = ${sessionId}
      LIMIT 1
    `;

    if (!rows.length) {
      return NextResponse.json({ status: "not_found" });
    }

    return NextResponse.json({
      status: rows[0].status,
      orderNumber: rows[0].orderNumber,
    });
  } catch (error) {
    console.error("[P24] status check error:", error);
    return NextResponse.json({ error: "Błąd serwera." }, { status: 500 });
  }
}
