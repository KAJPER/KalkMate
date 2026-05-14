import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

const MAX_TITLE_LEN = 100;
const MAX_CONTENT_LEN = 30000;       // pojedynczy sprawdzian do 30 KB
const MAX_TESTS_PER_USER = 50;
const MAX_TOTAL_BYTES = 200 * 1024;  // 200 KB lacznie

async function getUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;
  return await prisma.user.findUnique({ where: { email: session.user.email } });
}

export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Nie zalogowany" }, { status: 401 });

  const testModel = (prisma as any).test;
  if (!testModel) return NextResponse.json({ ok: true, tests: [] });

  const tests = await testModel.findMany({
    where: { userId: user.id },
    orderBy: [{ position: "asc" }, { updatedAt: "desc" }],
  });
  return NextResponse.json({ ok: true, tests });
}

export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Nie zalogowany" }, { status: 401 });
  const body = await req.json();
  const title = String(body?.title || "").slice(0, MAX_TITLE_LEN);
  const content = String(body?.content || "").slice(0, MAX_CONTENT_LEN);

  const existing = await prisma.test.findMany({ where: { userId: user.id } });
  if (existing.length >= MAX_TESTS_PER_USER) {
    return NextResponse.json({ ok: false, error: `Limit ${MAX_TESTS_PER_USER} sprawdzianow` }, { status: 400 });
  }
  const totalBytes = existing.reduce((s, n) => s + n.title.length + n.content.length, 0);
  if (totalBytes + title.length + content.length > MAX_TOTAL_BYTES) {
    return NextResponse.json({ ok: false, error: `Limit ${MAX_TOTAL_BYTES / 1024} KB lacznie` }, { status: 400 });
  }

  const maxPos = existing.reduce((m, n) => Math.max(m, n.position), -1);
  const test = await prisma.test.create({
    data: { userId: user.id, title, content, position: maxPos + 1 },
  });
  return NextResponse.json({ ok: true, test });
}

export async function PUT(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Nie zalogowany" }, { status: 401 });
  const body = await req.json();
  const id = String(body?.id || "");
  const test = await prisma.test.findUnique({ where: { id } });
  if (!test || test.userId !== user.id) {
    return NextResponse.json({ ok: false, error: "Nie znaleziono" }, { status: 404 });
  }
  const updates: any = {};
  if (typeof body.title === "string") updates.title = body.title.slice(0, MAX_TITLE_LEN);
  if (typeof body.content === "string") updates.content = body.content.slice(0, MAX_CONTENT_LEN);
  if (typeof body.position === "number") updates.position = body.position;

  if ("content" in updates || "title" in updates) {
    const others = await prisma.test.findMany({ where: { userId: user.id, NOT: { id } } });
    const otherBytes = others.reduce((s, n) => s + n.title.length + n.content.length, 0);
    const newSize = (updates.title ?? test.title).length + (updates.content ?? test.content).length;
    if (otherBytes + newSize > MAX_TOTAL_BYTES) {
      return NextResponse.json({ ok: false, error: `Limit ${MAX_TOTAL_BYTES / 1024} KB lacznie` }, { status: 400 });
    }
  }

  const updated = await prisma.test.update({ where: { id }, data: updates });
  return NextResponse.json({ ok: true, test: updated });
}

export async function DELETE(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Nie zalogowany" }, { status: 401 });
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, error: "Brak id" }, { status: 400 });
  const test = await prisma.test.findUnique({ where: { id } });
  if (!test || test.userId !== user.id) {
    return NextResponse.json({ ok: false, error: "Nie znaleziono" }, { status: 404 });
  }
  await prisma.test.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
