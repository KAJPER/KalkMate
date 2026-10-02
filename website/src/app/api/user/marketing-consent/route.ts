import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { clientIp } from "@/lib/rate-limit";
import { consentStatus, giveConsent, withdrawConsent } from "@/lib/newsletter";

// Zgoda marketingowa z panelu klienta (/panel -> Ustawienia). Wycofanie musi
// byc rownie latwe jak wyrazenie zgody (RODO art. 7 ust. 3).

export async function GET() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ ok: false, error: "Nie zalogowany" }, { status: 401 });
  return NextResponse.json({ ok: true, ...(await consentStatus(email)) });
}

// POST { consent: boolean }
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ ok: false, error: "Nie zalogowany" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  if (body?.consent === true) await giveConsent(email, "panel", clientIp(request));
  else await withdrawConsent(email);
  return NextResponse.json({ ok: true, ...(await consentStatus(email)) });
}
