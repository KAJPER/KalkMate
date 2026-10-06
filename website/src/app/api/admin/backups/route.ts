import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { backupStatus, createBackup } from "@/lib/dbBackup";

// GET  — lista kopii bazy + konfiguracja (katalog, retencja, kopia poza serwerem)
// POST — zrob kopie teraz
export async function GET(request: NextRequest) {
  const authErr = await requireAdminAuth(request); if (authErr) return authErr;
  return NextResponse.json({ ok: true, ...backupStatus() });
}

export async function POST(request: NextRequest) {
  const authErr = await requireAdminAuth(request); if (authErr) return authErr;
  const rl = rateLimit(`backup:${clientIp(request)}`, 6, 60 * 60_000);
  if (!rl.ok) return NextResponse.json({ ok: false, error: "Za dużo kopii w krótkim czasie." }, { status: 429 });
  try {
    const backup = await createBackup();
    return NextResponse.json({ ok: true, backup });
  } catch (e) {
    console.error("[api/admin/backups]", e);
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
