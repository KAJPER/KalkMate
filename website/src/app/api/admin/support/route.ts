import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { listChats } from "@/lib/supportChat";

// GET /api/admin/support — rozmowy z czatu na stronie (najnowsze u gory).
export async function GET(request: NextRequest) {
  const authErr = await requireAdminAuth(request); if (authErr) return authErr;
  return NextResponse.json({ ok: true, chats: await listChats() });
}
