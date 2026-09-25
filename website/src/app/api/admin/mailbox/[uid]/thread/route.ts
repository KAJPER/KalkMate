import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { getRelatedMessages, MAILBOX_FOLDERS } from "@/lib/contactMailbox";

const VALID_FOLDERS = new Set<string>(MAILBOX_FOLDERS.map((f) => f.path));

// GET /api/admin/mailbox/[uid]/thread?folder=INBOX — wiadomosci powiazane z
// otwartym mailem (nasze odpowiedzi z "Sent", kolejne maile klienta, oryginal
// dla maila z "Sent"), od najstarszej. Osobne wywolanie od tresci maila, zeby
// mail otwieral sie od razu, a rozmowa doladowywala sie po chwili.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ uid: string }> }
) {
  const authErr = await requireAdminAuth(request); if (authErr) return authErr;
  const { uid } = await params;
  const uidNum = parseInt(uid, 10);
  if (!Number.isFinite(uidNum)) return NextResponse.json({ ok: false, error: "Nieprawidlowe uid" }, { status: 400 });

  const folder = request.nextUrl.searchParams.get("folder") || "INBOX";
  if (!VALID_FOLDERS.has(folder)) return NextResponse.json({ ok: false, error: "Nieznany folder" }, { status: 400 });

  try {
    const messages = await getRelatedMessages(uidNum, folder);
    return NextResponse.json({ ok: true, messages });
  } catch (e) {
    console.error("[api/admin/mailbox/:uid/thread] failed:", e);
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 502 });
  }
}
