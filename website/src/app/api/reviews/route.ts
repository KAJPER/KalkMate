import { NextResponse } from "next/server";
import { getApprovedReviews } from "@/lib/reviews";

// GET /api/reviews — zatwierdzone opinie zweryfikowanych kupujacych
// (najnowsze, max 50). Bez e-maili i numerow zamowien.
export async function GET() {
  try {
    const reviews = await getApprovedReviews();
    return NextResponse.json(
      { reviews },
      { headers: { "Cache-Control": "public, max-age=60, s-maxage=300" } },
    );
  } catch (e) {
    console.error("[api/reviews]", e);
    return NextResponse.json({ reviews: [] }, { status: 500 });
  }
}
