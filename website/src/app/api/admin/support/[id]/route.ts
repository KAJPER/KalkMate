import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { deleteChat, getChat, getMessages, markChatRead } from "@/lib/supportChat";

// GET    — rozmowa + przebieg wizyty (oznacza jako przeczytana)
// DELETE — usuniecie rozmowy (np. zadanie usuniecia danych, RODO art. 17)
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authErr = await requireAdminAuth(request); if (authErr) return authErr;
  const { id } = await params;
  const chat = await getChat(id);
  if (!chat) return NextResponse.json({ ok: false, error: "Nie ma takiej rozmowy." }, { status: 404 });
  const messages = await getMessages(id);
  await markChatRead(id);
  return NextResponse.json({ ok: true, chat, messages });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authErr = await requireAdminAuth(request); if (authErr) return authErr;
  const { id } = await params;
  if (!(await deleteChat(id))) return NextResponse.json({ ok: false, error: "Nie ma takiej rozmowy." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
