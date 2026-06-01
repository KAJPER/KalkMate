import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { readCapture, isSafeFilename } from "@/lib/captures";

// GET /api/user/captures/[filename] — serwuje JPEG, ale tylko jezeli
// filename zawiera deviceId sparowany z tym userem.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ filename: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) return new NextResponse("Forbidden", { status: 403 });

  const { filename } = await params;
  if (!isSafeFilename(filename)) {
    return new NextResponse("Bad filename", { status: 400 });
  }

  // Wlasciciel filename = drugi segment po _ musi byc deviceId usera
  const parts = filename.replace(/\.jpg$/, "").split("_");
  if (parts.length < 2) return new NextResponse("Bad filename", { status: 400 });
  const fileDeviceId = parts[1];

  const owned = await prisma.device.findFirst({
    where: { userId: user.id, deviceId: fileDeviceId },
    select: { id: true },
  });
  if (!owned) return new NextResponse("Forbidden", { status: 403 });

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
