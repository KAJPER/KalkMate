import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

const MAX_TITLE_LEN = 60;
const MAX_CONTENT_LEN = 4000;
const MAX_NOTES_PER_USER = 50;
const MAX_TOTAL_BYTES = 50 * 1024;  // 50 KB lacznie

async function getUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;
  return await prisma.user.findUnique({ where: { email: session.user.email } });
}

// GET /api/user/notes — lista wszystkich notatek
export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Nie zalogowany" }, { status: 401 });

  const notes = await prisma.note.findMany({
    where: { userId: user.id },
    orderBy: [{ position: "asc" }, { updatedAt: "desc" }],
  });
  return NextResponse.json({ ok: true, notes });
}

// POST /api/user/notes — utworzenie notatki
// Body: { title, content }
export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Nie zalogowany" }, { status: 401 });

  const body = await req.json();
  const title = String(body?.title || "").slice(0, MAX_TITLE_LEN);
  const content = String(body?.content || "").slice(0, MAX_CONTENT_LEN);

  // Limit globalnej liczby + rozmiaru
  const existing = await prisma.note.findMany({ where: { userId: user.id } });
  if (existing.length >= MAX_NOTES_PER_USER) {
    return NextResponse.json(
      { ok: false, error: `Limit ${MAX_NOTES_PER_USER} notatek osiagniety` },
      { status: 400 }
    );
  }
  const totalBytes = existing.reduce((s, n) => s + n.title.length + n.content.length, 0);
  if (totalBytes + title.length + content.length > MAX_TOTAL_BYTES) {
    return NextResponse.json(
      { ok: false, error: `Limit ${MAX_TOTAL_BYTES / 1024} KB lacznie osiagniety` },
      { status: 400 }
    );
  }

  const maxPos = existing.reduce((m, n) => Math.max(m, n.position), -1);
  const note = await prisma.note.create({
    data: {
      userId: user.id,
      title,
      content,
      position: maxPos + 1,
    },
  });
  return NextResponse.json({ ok: true, note });
}

// PUT /api/user/notes — update
// Body: { id, title?, content?, position? }
export async function PUT(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Nie zalogowany" }, { status: 401 });

  const body = await req.json();
  const id = String(body?.id || "");
  const note = await prisma.note.findUnique({ where: { id } });
  if (!note || note.userId !== user.id) {
    return NextResponse.json({ ok: false, error: "Nie znaleziono" }, { status: 404 });
  }

  const updates: any = {};
  if (typeof body.title === "string") updates.title = body.title.slice(0, MAX_TITLE_LEN);
  if (typeof body.content === "string") updates.content = body.content.slice(0, MAX_CONTENT_LEN);
  if (typeof body.position === "number") updates.position = body.position;

  // Sprawdz limit total bytes (jesli content zmieniony)
  if ("content" in updates || "title" in updates) {
    const others = await prisma.note.findMany({ where: { userId: user.id, NOT: { id } } });
    const otherBytes = others.reduce((s, n) => s + n.title.length + n.content.length, 0);
    const newSize = (updates.title ?? note.title).length + (updates.content ?? note.content).length;
    if (otherBytes + newSize > MAX_TOTAL_BYTES) {
      return NextResponse.json(
        { ok: false, error: `Limit ${MAX_TOTAL_BYTES / 1024} KB lacznie osiagniety` },
        { status: 400 }
      );
    }
  }

  const updated = await prisma.note.update({ where: { id }, data: updates });
  return NextResponse.json({ ok: true, note: updated });
}

// DELETE /api/user/notes?id=...
export async function DELETE(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Nie zalogowany" }, { status: 401 });

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, error: "Brak id" }, { status: 400 });

  const note = await prisma.note.findUnique({ where: { id } });
  if (!note || note.userId !== user.id) {
    return NextResponse.json({ ok: false, error: "Nie znaleziono" }, { status: 404 });
  }
  await prisma.note.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
