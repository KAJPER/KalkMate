import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

// GET - Get conversation with messages
// Query: ?limit=<1..200>&before=<messageId> — ostatnie N wiadomosci (domyslnie 200).
//
// K8: panel (src/app/panel/page.tsx) czyta data.conversation.messages[] z
// polami role/content/attachments[{filename,mimeType,fileSize,fileData}] —
// wczesniej API zwracalo tylko ChatMessage[]/Attachment[] (TypeError w
// panelu). Stary klucz ChatMessage zostaje dla kompatybilnosci, ale BEZ
// fileData (inaczej base64 szlyby w odpowiedzi dwa razy).
// fileData wiekszych niz ATTACHMENT_INLINE_MAX nie zwracamy (fileData: null,
// fileDataOmitted: true).
const MESSAGE_PAGE_MAX = 200;
const ATTACHMENT_INLINE_MAX = 3 * 1024 * 1024; // znaki data URL

type AttachmentRow = {
  id: string;
  messageId: string;
  filename: string;
  mimeType: string;
  fileSize: number | bigint;
  storageType: string;
  dataLength: number | bigint | null;
  fileData: string | null;
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const conversation = await prisma.conversation.findFirst({
      where: {
        id,
        userId: user.id, // Security: only owner can access
      },
      select: { id: true, userId: true, title: true, createdAt: true, updatedAt: true },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }

    const url = new URL(request.url);
    const limitRaw = parseInt(url.searchParams.get("limit") || "", 10);
    const limit = Math.min(MESSAGE_PAGE_MAX, Math.max(1, Number.isFinite(limitRaw) ? limitRaw : MESSAGE_PAGE_MAX));
    const before = url.searchParams.get("before");
    let createdAtLt: Date | null = null;
    if (before) {
      const ref = await prisma.chatMessage.findFirst({
        where: { id: before, conversationId: id },
        select: { createdAt: true },
      });
      if (ref) createdAtLt = ref.createdAt;
    }

    const totalMessages = await prisma.chatMessage.count({ where: { conversationId: id } });
    const rows = await prisma.chatMessage.findMany({
      where: { conversationId: id, ...(createdAtLt ? { createdAt: { lt: createdAtLt } } : {}) },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      select: { id: true, conversationId: true, role: true, content: true, createdAt: true },
    });
    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit).reverse();

    // Zalaczniki raw SQL-em, zeby nie ladowac do pamieci duzych base64,
    // ktorych i tak nie zwracamy.
    const ids = page.map((m) => m.id);
    const attRows = ids.length
      ? await prisma.$queryRawUnsafe<AttachmentRow[]>(
          `SELECT "id", "messageId", "filename", "mimeType", "fileSize", "storageType",
                  length("fileData") AS "dataLength",
                  CASE WHEN length("fileData") <= ? THEN "fileData" ELSE NULL END AS "fileData"
           FROM "Attachment" WHERE "messageId" IN (${ids.map(() => "?").join(",")})
           ORDER BY "rowid" ASC`,
          ATTACHMENT_INLINE_MAX,
          ...ids
        )
      : [];
    const byMessage = new Map<string, {
      id: string; messageId: string; filename: string; mimeType: string;
      fileSize: number; storageType: string; fileData: string | null; fileDataOmitted: boolean;
    }[]>();
    for (const a of attRows) {
      const list = byMessage.get(a.messageId) ?? [];
      list.push({
        id: a.id,
        messageId: a.messageId,
        filename: a.filename,
        mimeType: a.mimeType,
        fileSize: Number(a.fileSize),
        storageType: a.storageType,
        fileData: a.fileData ?? null,
        fileDataOmitted: a.fileData == null && Number(a.dataLength ?? 0) > 0,
      });
      byMessage.set(a.messageId, list);
    }

    const messages = page.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      createdAt: m.createdAt,
      attachments: byMessage.get(m.id) ?? [],
    }));
    const legacyChatMessage = page.map((m) => ({
      ...m,
      Attachment: (byMessage.get(m.id) ?? []).map((a) => ({
        id: a.id,
        messageId: a.messageId,
        filename: a.filename,
        mimeType: a.mimeType,
        fileSize: a.fileSize,
        storageType: a.storageType,
      })),
    }));

    return NextResponse.json({
      conversation: {
        ...conversation,
        messages,
        ChatMessage: legacyChatMessage,
        hasMore,
        totalMessages,
        nextBefore: hasMore && page.length ? page[0].id : null,
      },
    });
  } catch (error) {
    console.error("Get conversation error:", error);
    return NextResponse.json(
      { error: "Failed to fetch conversation" },
      { status: 500 }
    );
  }
}

// DELETE - Delete conversation
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Security: Verify ownership before deleting
    const conversation = await prisma.conversation.findFirst({
      where: {
        id,
        userId: user.id,
      },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: "Conversation not found or access denied" },
        { status: 404 }
      );
    }

    // Delete conversation (messages will be cascade deleted)
    await prisma.conversation.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete conversation error:", error);
    return NextResponse.json(
      { error: "Failed to delete conversation" },
      { status: 500 }
    );
  }
}

// PATCH - Update conversation title
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { title } = await request.json();

    // Sanitize title
    const sanitizedTitle = (title || "")
      .substring(0, 100)
      .replace(/<[^>]*>/g, "")
      .replace(/[^\w\s\u0100-\u017F\u0400-\u04FF?!.,()-]/g, "")
      .trim();

    if (!sanitizedTitle) {
      return NextResponse.json({ error: "Invalid title" }, { status: 400 });
    }

    // Security: Verify ownership
    const conversation = await prisma.conversation.findFirst({
      where: {
        id,
        userId: user.id,
      },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: "Conversation not found or access denied" },
        { status: 404 }
      );
    }

    const updated = await prisma.conversation.update({
      where: { id },
      data: { title: sanitizedTitle },
    });

    return NextResponse.json({ conversation: updated });
  } catch (error) {
    console.error("Update conversation error:", error);
    return NextResponse.json(
      { error: "Failed to update conversation" },
      { status: 500 }
    );
  }
}
