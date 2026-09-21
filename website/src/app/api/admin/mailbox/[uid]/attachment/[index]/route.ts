import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { getAttachment } from "@/lib/contactMailbox";

// GET /api/admin/mailbox/[uid]/attachment/[index]?folder=INBOX
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ uid: string; index: string }> }
) {
  const authErr = await requireAdminAuth(request); if (authErr) return authErr;
  const { uid, index } = await params;
  const uidNum = parseInt(uid, 10);
  const indexNum = parseInt(index, 10);
  if (!Number.isFinite(uidNum) || !Number.isFinite(indexNum)) {
    return NextResponse.json({ ok: false, error: "Nieprawidlowe parametry" }, { status: 400 });
  }
  const folder = request.nextUrl.searchParams.get("folder") || "INBOX";

  try {
    const att = await getAttachment(uidNum, indexNum, folder);
    if (!att) return NextResponse.json({ ok: false, error: "Nie znaleziono zalacznika" }, { status: 404 });
    return new NextResponse(new Uint8Array(att.content), {
      status: 200,
      headers: {
        "Content-Type": att.contentType || "application/octet-stream",
        "Content-Disposition": `inline; filename="${encodeURIComponent(att.filename)}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    console.error("[api/admin/mailbox attachment] failed:", e);
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 502 });
  }
}
