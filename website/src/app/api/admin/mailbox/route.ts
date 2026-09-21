import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { listMessages, MAILBOX_FOLDERS } from "@/lib/contactMailbox";

const VALID_FOLDERS = new Set(MAILBOX_FOLDERS.map((f) => f.path));

// GET /api/admin/mailbox?folder=INBOX&limit=100 — lista wiadomosci (kontakt@kalkmate.pl)
export async function GET(request: NextRequest) {
  const authErr = await requireAdminAuth(request); if (authErr) return authErr;

  const folder = request.nextUrl.searchParams.get("folder") || "INBOX";
  if (!VALID_FOLDERS.has(folder as (typeof MAILBOX_FOLDERS)[number]["path"])) {
    return NextResponse.json({ ok: false, error: "Nieznany folder" }, { status: 400 });
  }
  const limit = Math.min(300, Math.max(1, parseInt(request.nextUrl.searchParams.get("limit") || "100", 10) || 100));

  try {
    const result = await listMessages(folder, limit);
    return NextResponse.json({ ok: true, folders: MAILBOX_FOLDERS, ...result });
  } catch (e) {
    console.error("[api/admin/mailbox] list failed:", e);
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 502 });
  }
}
