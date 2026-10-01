import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { listRecipients } from "@/lib/newsletter";
import { parseFilter } from "@/lib/newsletterInput";

// GET /api/admin/newsletter/recipients?registered=1&verifiedOnly=0&buyers=1&country=all
export async function GET(request: NextRequest) {
  const authErr = await requireAdminAuth(request); if (authErr) return authErr;
  const q = request.nextUrl.searchParams;
  const filter = parseFilter({
    registered: q.get("registered") ?? "1",
    verifiedOnly: q.get("verifiedOnly") ?? "0",
    buyers: q.get("buyers") ?? "1",
    country: q.get("country") ?? "all",
  });
  try {
    const recipients = await listRecipients(filter);
    return NextResponse.json({ ok: true, recipients });
  } catch (e) {
    console.error("[api/admin/newsletter/recipients]", e);
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
