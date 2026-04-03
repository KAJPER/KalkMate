import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// API endpoint dla kalkulatora do synchronizacji wiadomości
// Kalkulator będzie wysyłał zapytania z API key

const CALCULATOR_API_KEY = process.env.CALCULATOR_API_KEY;

export async function POST(request: NextRequest) {
  try {
    // Verify API key
    const apiKey = request.headers.get("x-api-key");

    if (!apiKey || apiKey !== CALCULATOR_API_KEY) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { userId, messages } = await request.json();

    if (!userId || !messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    // Verify user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Find or create a conversation for this sync (use a default title for calculator syncs)
    let conversation = await prisma.conversation.findFirst({
      where: {
        userId,
        title: "Calculator Sync",
      },
    });

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          userId,
          title: "Calculator Sync",
        },
      });
    }

    // Save messages to the conversation
    await prisma.chatMessage.createMany({
      data: messages.map((msg: any) => ({
        conversationId: conversation.id,
        role: msg.role,
        content: msg.content,
      })),
    });

    return NextResponse.json({ success: true, conversationId: conversation.id });
  } catch (error) {
    console.error("Sync messages error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Verify API key
    const apiKey = request.headers.get("x-api-key");

    if (!apiKey || apiKey !== CALCULATOR_API_KEY) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const userId = request.nextUrl.searchParams.get("userId");
    const limit = parseInt(request.nextUrl.searchParams.get("limit") || "50");

    if (!userId) {
      return NextResponse.json(
        { error: "Missing userId parameter" },
        { status: 400 }
      );
    }

    // Get user's chat history from all their conversations
    const conversations = await prisma.conversation.findMany({
      where: { userId },
      include: {
        messages: {
          orderBy: { createdAt: "desc" },
          take: limit,
          select: {
            role: true,
            content: true,
            createdAt: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    // Flatten all messages from all conversations
    const allMessages = conversations.flatMap((conv) => conv.messages);

    // Sort by date and limit
    const messages = allMessages
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);

    return NextResponse.json({
      messages: messages.reverse(), // Return in chronological order
    });
  } catch (error) {
    console.error("Get messages error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
