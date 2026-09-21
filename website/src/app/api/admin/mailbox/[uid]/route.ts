import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { getMessage } from "@/lib/contactMailbox";

// GET /api/admin/mailbox/[uid]?folder=INBOX — pelna tresc wiadomosci (oznacza jako przeczytana)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ uid: string }> }
) {
  const authErr = await requireAdminAuth(request); if (authErr) return authErr;
  const { uid } = await params;
  const uidNum = parseInt(uid, 10);
  if (!Number.isFinite(uidNum)) return NextResponse.json({ ok: false, error: "Nieprawidlowe uid" }, { status: 400 });

  const folder = request.nextUrl.searchParams.get("folder") || "INBOX";

  try {
    const message = await getMessage(uidNum, folder);
    if (!message) return NextResponse.json({ ok: false, error: "Nie znaleziono wiadomosci" }, { status: 404 });
    return NextResponse.json({ ok: true, message });
  } catch (e) {
    console.error("[api/admin/mailbox/:uid] failed:", e);
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 502 });
  }
}
