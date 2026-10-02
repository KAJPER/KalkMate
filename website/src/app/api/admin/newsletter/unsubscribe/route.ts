import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { addUnsubscribe, removeUnsubscribe } from "@/lib/newsletter";

// POST — { email, unsubscribed: boolean } — reczne wypisanie/przywrocenie z panelu
// (np. klient poprosil mailem). Przywracac tylko na wyrazna prosbe osoby.
export async function POST(request: NextRequest) {
  const authErr = await requireAdminAuth(request); if (authErr) return authErr;
  const body = await request.json().catch(() => ({}));
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  if (!email) return NextResponse.json({ ok: false, error: "Brak adresu" }, { status: 400 });
  if (body?.unsubscribed) await addUnsubscribe(email);
  else await removeUnsubscribe(email);
  return NextResponse.json({ ok: true });
}
