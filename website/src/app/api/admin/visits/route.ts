import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";

// Licznik wizyt na dashboardzie admina. Liczy z tabeli Visit (zapisuje ja
// /api/track). Wczesniej licznik siedzial w metadanych produktu Stripe, a
// publiczny POST przy KAZDYM wejsciu na strone glowna wolal Stripe
// products.search + update kluczem sekretnym — kazdy mogl wyczerpac limity
// API Stripe sklepu (audyt 2026-10-16). POST usuniety.
//
// GET (admin): { page_visits, last_reset } — ten sam ksztalt co wczesniej;
// last_reset = najstarsza zapisana wizyta (od kiedy liczymy; patrz retencja
// w lib/attribution.ts).
export async function GET(request: NextRequest) {
  const authErr = await requireAdminAuth(request); if (authErr) return authErr;
  try {
    const [count, oldest] = await Promise.all([
      prisma.visit.count(),
      prisma.visit.aggregate({ _min: { createdAt: true } }),
    ]);
    const first = oldest._min.createdAt;
    return NextResponse.json({
      page_visits: count,
      last_reset: first ? new Date(first).toISOString() : null,
    });
  } catch (error) {
    console.error("Visit read error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
