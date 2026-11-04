import { NextRequest, NextResponse } from "next/server";
import { findRentalPayment, getRentalByAccess } from "@/lib/rentals";
import { diditConfigured } from "@/lib/didit";

// GET /api/rental/status?session=km-rent-...  — po powrocie z Przelewy24
// GET /api/rental/status?r=<id>&t=<token>     — po powrocie z Didit (weryfikacja)
// GET /api/rental/status?options=1            — czy wariant bez kaucji jest dostepny
// Bez danych osobowych w odpowiedzi.
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const noStore = { headers: { "Cache-Control": "no-store" } };
  if (q.get("options")) return NextResponse.json({ ok: true, identityAvailable: diditConfigured() }, noStore);

  const session = q.get("session");
  const r = session
    ? (/^km-rent-[0-9a-f-]{36}$/.test(session) ? (await findRentalPayment(session))?.rental ?? null : null)
    : await getRentalByAccess(q.get("r"), q.get("t"));
  if (!r) return NextResponse.json({ ok: false }, { status: 404 });
  return NextResponse.json({
    ok: true,
    status: r.status,
    rentalNumber: r.rentalNumber,
    days: r.days,
    fee: r.feeGrosze,
    identityStatus: r.identityStatus,
  }, noStore);
}
