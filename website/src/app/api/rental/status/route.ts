import { NextRequest, NextResponse } from "next/server";
import { findRentalBySession } from "@/lib/rentals";

// GET /api/rental/status?session=km-rent-... — stan po powrocie z Przelewy24.
// Sesja to losowy UUID znany tylko placacemu; zwracamy minimum (bez danych osobowych).
export async function GET(request: NextRequest) {
  const session = request.nextUrl.searchParams.get("session") || "";
  if (!/^km-rent-[0-9a-f-]{36}$/.test(session)) return NextResponse.json({ ok: false }, { status: 400 });
  const r = await findRentalBySession(session);
  if (!r) return NextResponse.json({ ok: false }, { status: 404 });
  return NextResponse.json(
    { ok: true, status: r.status, rentalNumber: r.rentalNumber, days: r.days },
    { headers: { "Cache-Control": "no-store" } }
  );
}
