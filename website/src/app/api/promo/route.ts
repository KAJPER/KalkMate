import { NextResponse } from "next/server";
import { getPromoState } from "@/lib/promo";

// GET /api/promo — stan Black Friday dla strony (pasek, ceny, licznik sztuk).
// Bez danych osobowych; krotki cache, zeby licznik byl w miare swiezy.
export async function GET() {
  const state = await getPromoState();
  return NextResponse.json(state, { headers: { "Cache-Control": "public, max-age=20, s-maxage=20" } });
}
