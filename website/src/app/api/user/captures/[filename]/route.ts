import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { readCapture, isSafeFilename, canUserAccessCapture } from "@/lib/captures";

// GET /api/user/captures/[filename] — serwuje JPEG, ale tylko gdy zdjecie
// nalezy do usera wg tabeli Capture (userId = wlasciciel urzadzenia w chwili
// zdjecia). Pliki legacy bez znanego wlasciciela — jak dotychczas: urzadzenie
// z nazwy pliku musi byc obecnie sparowane z tym userem.
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

  const allowed = await canUserAccessCapture(user.id, filename, async (deviceId) => {
    const owned = await prisma.device.findFirst({
      where: { userId: user.id, deviceId },
      select: { id: true },
    });
    return !!owned;
  });
  if (!allowed) return new NextResponse("Forbidden", { status: 403 });

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
