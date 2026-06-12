import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

// GET - List all conversations for user
export async function GET(request: NextRequest) {
  try {
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

    const conversations = await prisma.conversation.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        title: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: { ChatMessage: true },
        },
      },
      take: 50, // Limit to last 50 conversations
    });

    return NextResponse.json({ conversations });
  } catch (error) {
    console.error("Get conversations error:", error);
    return NextResponse.json(
      { error: "Failed to fetch conversations" },
      { status: 500 }
    );
  }
}

// POST - Create new conversation
export async function POST(request: NextRequest) {
  try {
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

    // Sanitize title - remove any potential XSS or SQL injection attempts
    const sanitizedTitle = (title || "Nowa konwersacja")
      .substring(0, 100) // Limit length
      .replace(/<[^>]*>/g, "") // Remove HTML tags
      .replace(/[^\w\s\u0100-\u017F\u0400-\u04FF?!.,()-]/g, "") // Allow only safe characters + Polish characters
      .trim();

    const conversation = await prisma.conversation.create({
      data: {
        id: require("crypto").randomUUID(),
        userId: user.id,
        title: sanitizedTitle || "Nowa konwersacja",
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({ conversation });
  } catch (error) {
    console.error("Create conversation error:", error);
    return NextResponse.json(
      { error: "Failed to create conversation" },
      { status: 500 }
    );
  }
}
