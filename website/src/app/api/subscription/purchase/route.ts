import { NextResponse } from "next/server";

// Model tokenowy (2026-10): subskrypcje wycofane — dostep do AI dziala
// wylacznie na tokenach z konta (doladowanie w panelu albo licencja z pudelka).
// Stara logika Stripe (subskrypcja miesieczna) — patrz historia gita.
export async function POST() {
  return NextResponse.json(
    { error: "Subskrypcje zostały wycofane — dostęp do AI działa na tokenach. Doładuj w panelu." },
    { status: 410 }
  );
}
