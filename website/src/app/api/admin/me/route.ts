import { NextRequest, NextResponse } from "next/server";
import { getAdminIdentity } from "@/lib/admin-auth";

// GET /api/admin/me — kto jest zalogowany (AdminShell: ktore kafelki pokazac).
// Wlasciciel: { owner: true }; moderator: { owner: false, username, permissions }.
export async function GET(request: NextRequest) {
  const identity = await getAdminIdentity(request);
  if (!identity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!identity.moderator) return NextResponse.json({ ok: true, owner: true });
  return NextResponse.json({
    ok: true,
    owner: false,
    username: identity.moderator.username,
    permissions: identity.moderator.permissions,
  });
}
