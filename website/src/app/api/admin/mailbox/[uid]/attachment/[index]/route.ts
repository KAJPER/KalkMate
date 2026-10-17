import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { getAttachment, isMailboxFolder } from "@/lib/contactMailbox";

// Zalacznik pochodzi od DOWOLNEGO nadawcy, a jest serwowany z domeny
// kalkmate.pl z sesja admina. Content-Type z maila + "inline" pozwalaly
// wyslac .html/.svg ze skryptem, ktory wykonywal sie jako panel admina
// (stored XSS, audyt 2026-10-16). Dlatego:
// - inline TYLKO obrazki z allowlisty, z Content-Type ustawionym przez NAS
//   (nie z maila), wszystko inne = pobranie jako application/octet-stream;
// - PDF tez jako pobranie: wbudowana przegladarka PDF w Chromium nie dziala
//   w dokumencie z CSP sandbox (pusta/zablokowana strona), a bez sandboxa
//   nie chcemy serwowac obcych dokumentow inline;
// - zawsze nosniff + CSP sandbox (bez skryptow, bez wlasnego originu).
//   UWAGA: Next (send-response.js) NIE nadpisuje naglowkow ustawionych juz
//   przez headers() z next.config.ts — globalny CSP strony wygrywa z tym
//   ponizej, dopoki next.config.ts nie dostanie osobnej, pozniejszej reguly
//   dla tej sciezki. Ochrona przed XSS opiera sie wiec przede wszystkim na
//   wymuszonym Content-Type/Content-Disposition, CSP to druga warstwa.
const INLINE_TYPES: Record<string, string> = {
  "image/png": "image/png",
  "image/jpeg": "image/jpeg",
  "image/jpg": "image/jpeg",
  "image/pjpeg": "image/jpeg",
  "image/gif": "image/gif",
  "image/webp": "image/webp",
};

const SANDBOX_CSP = "sandbox; default-src 'none'; img-src data:; style-src 'unsafe-inline'";

// RFC 5987/6266: ASCII-owy fallback w filename="..." (bez cudzyslowow,
// backslashy, CR/LF i znakow sterujacych) + pelna nazwa w filename*=UTF-8''.
function contentDisposition(kind: "inline" | "attachment", rawName: string): string {
  const name = (rawName || "zalacznik").replace(/[\u0000-\u001f\u007f]/g, "").trim() || "zalacznik";
  const ascii = name
    .normalize("NFKD")
    .replace(/[^\x20-\x7e]/g, "")
    .replace(/["\\;]/g, "_")
    .trim()
    .slice(0, 150) || "zalacznik";
  const encoded = encodeURIComponent(name).replace(/['()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());
  return `${kind}; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}

// GET /api/admin/mailbox/[uid]/attachment/[index]?folder=INBOX
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ uid: string; index: string }> }
) {
  const authErr = await requireAdminAuth(request); if (authErr) return authErr;
  const { uid, index } = await params;
  const uidNum = parseInt(uid, 10);
  const indexNum = parseInt(index, 10);
  if (!Number.isFinite(uidNum) || !Number.isFinite(indexNum) || indexNum < 0) {
    return NextResponse.json({ ok: false, error: "Nieprawidlowe parametry" }, { status: 400 });
  }
  const folder = request.nextUrl.searchParams.get("folder") || "INBOX";
  if (!isMailboxFolder(folder)) return NextResponse.json({ ok: false, error: "Nieznany folder" }, { status: 400 });

  try {
    const att = await getAttachment(uidNum, indexNum, folder);
    if (!att) return NextResponse.json({ ok: false, error: "Nie znaleziono zalacznika" }, { status: 404 });

    const declared = (att.contentType || "").split(";")[0].trim().toLowerCase();
    const inlineType = INLINE_TYPES[declared];
    let contentType: string;
    let disposition: string;
    if (inlineType) {
      contentType = inlineType;
      disposition = contentDisposition("inline", att.filename);
    } else if (declared === "application/pdf") {
      contentType = "application/pdf";
      disposition = contentDisposition("attachment", att.filename);
    } else {
      contentType = "application/octet-stream";
      disposition = contentDisposition("attachment", att.filename);
    }

    return new NextResponse(new Uint8Array(att.content), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": disposition,
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": SANDBOX_CSP,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    console.error("[api/admin/mailbox attachment] failed:", e);
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 502 });
  }
}
