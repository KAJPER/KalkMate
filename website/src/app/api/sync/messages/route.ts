import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyDeviceAuth } from "@/lib/device-auth";

// H2: userId wyprowadzany z uwierzytelnionego urządzenia (x-device-id + x-device-token),
// nie z body/query — zapobiega IDOR (zapis/odczyt wiadomości dowolnego użytkownika).
async function resolveUserId(request: NextRequest): Promise<
  { ok: true; userId: string } | { ok: false; status: number; error: string }
> {
  const auth = await verifyDeviceAuth(request);
  if (!auth.ok) return auth;

  const deviceRow = await prisma.$queryRaw<{ userId: string | null }[]>`
    SELECT "userId" FROM "Device" WHERE "deviceId" = ${auth.deviceId} LIMIT 1
  `;
  const userId = deviceRow[0]?.userId ?? null;
  if (!userId) {
    return { ok: false, status: 403, error: "Device not paired with any account" };
  }
  return { ok: true, userId };
}

export async function POST(request: NextRequest) {
  try {
    const resolved = await resolveUserId(request);
    if (!resolved.ok) {
      return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    }
    const { userId } = resolved;

    const body = await request.json();
    const { messages } = body;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    // Znajdź lub utwórz konwersację dla tego urządzenia
    let conversation = await prisma.conversation.findFirst({
      where: { userId, title: "Calculator Sync" },
    });

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          id: require("crypto").randomUUID(),
          userId,
          title: "Calculator Sync",
          updatedAt: new Date(),
        },
      });
    }

    await prisma.chatMessage.createMany({
      data: messages.map((msg: any) => ({
        id: require("crypto").randomUUID(),
        conversationId: conversation.id,
        role: msg.role,
        content: msg.content,
      })),
    });

    return NextResponse.json({ success: true, conversationId: conversation.id });
  } catch (error) {
    console.error("Sync messages error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const resolved = await resolveUserId(request);
    if (!resolved.ok) {
      return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    }
    const { userId } = resolved;

    const limit = parseInt(request.nextUrl.searchParams.get("limit") || "50");

    const conversations = await prisma.conversation.findMany({
      where: { userId },
      include: {
        ChatMessage: {
          orderBy: { createdAt: "desc" },
          take: limit,
          select: { role: true, content: true, createdAt: true },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    const allMessages = conversations.flatMap((conv) => conv.ChatMessage);
    const messages = allMessages
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);

    return NextResponse.json({ messages: messages.reverse() });
  } catch (error) {
    console.error("Get messages error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
