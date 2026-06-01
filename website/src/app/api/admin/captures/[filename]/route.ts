import { NextResponse } from "next/server";
import { readCapture } from "@/lib/captures";

// GET /api/admin/captures/[filename] — serwuje JPEG.
// Auth: middleware sprawdza admin_session (caly /api/admin/* oprocz auth/visits).
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ filename: string }> },
) {
  const { filename } = await params;
  const buf = await readCapture(filename);
  if (!buf) return new NextResponse("Not found", { status: 404 });

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "image/jpeg",
      "Content-Length": String(buf.length),
      "Cache-Control": "private, max-age=600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
