import { NextRequest, NextResponse } from "next/server";
import { createReadStream, existsSync, statSync } from "fs";
import { join } from "path";
import { Readable } from "stream";
import { requireAdminAuth } from "@/lib/admin-auth";
import { BACKUP_DIR, isBackupName } from "@/lib/dbBackup";

// GET — pobranie pliku kopii (nazwa sprawdzana wzorcem — bez wychodzenia poza katalog).
export async function GET(request: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  const authErr = await requireAdminAuth(request); if (authErr) return authErr;
  const { name } = await params;
  if (!isBackupName(name)) return NextResponse.json({ error: "Nieprawidłowa nazwa" }, { status: 400 });
  const file = join(BACKUP_DIR, name);
  if (!existsSync(file)) return NextResponse.json({ error: "Nie ma takiej kopii" }, { status: 404 });
  const stream = Readable.toWeb(createReadStream(file)) as ReadableStream;
  return new NextResponse(stream, {
    headers: {
      "Content-Type": "application/gzip",
      "Content-Length": String(statSync(file).size),
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}
