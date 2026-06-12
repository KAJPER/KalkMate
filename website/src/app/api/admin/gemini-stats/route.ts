import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { COOKIE_NAME } from "@/lib/admin-auth";

// Gemini API pricing (as of 2024)
// Gemini 1.5 Flash: ~$0.00001875 per 1K tokens (input), ~$0.000075 per 1K tokens (output)
// Average estimate: ~$0.00005 per 1K tokens (combined input/output)
const COST_PER_1K_TOKENS = 0.00005;

// Rough estimation: average message ~100 tokens, average response ~200 tokens
const AVG_TOKENS_PER_USER_MESSAGE = 100;
const AVG_TOKENS_PER_ASSISTANT_MESSAGE = 200;

export async function GET(req: NextRequest) {
  try {
    // Verify admin using cookie
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (token !== process.env.ADMIN_SESSION_TOKEN) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get all chat message statistics
    const [
      totalMessages,
      userMessages,
      assistantMessages,
      uniqueUsersWithMessages,
      recentMessages,
    ] = await Promise.all([
      // Total messages count
      prisma.chatMessage.count(),

      // User messages count
      prisma.chatMessage.count({
        where: { role: "user" },
      }),

      // Assistant messages count
      prisma.chatMessage.count({
        where: { role: "assistant" },
      }),

      // Unique users who have conversations
      prisma.conversation.findMany({
        select: { userId: true },
        distinct: ["userId"],
      }),

      // Recent messages (last 7 days grouped by day)
      prisma.chatMessage.findMany({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
        select: {
          createdAt: true,
          role: true,
        },
      }),
    ]);

    // Get messages per user (top 10) - manually aggregate via conversations
    const allConversations = await prisma.conversation.findMany({
      select: {
        userId: true,
        _count: {
          select: { ChatMessage: true },
        },
      },
    });

    // Aggregate message counts by user
    const userMessageCounts = new Map<string, number>();
    allConversations.forEach((conv) => {
      const current = userMessageCounts.get(conv.userId) || 0;
      userMessageCounts.set(conv.userId, current + conv._count.ChatMessage);
    });

    // Sort and get top 10
    const messagesPerUser = Array.from(userMessageCounts.entries())
      .map(([userId, count]) => ({ userId, _count: { messages: count } }))
      .sort((a, b) => b._count.messages - a._count.messages)
      .slice(0, 10);

    // Calculate token estimates
    const estimatedUserTokens = userMessages * AVG_TOKENS_PER_USER_MESSAGE;
    const estimatedAssistantTokens = assistantMessages * AVG_TOKENS_PER_ASSISTANT_MESSAGE;
    const totalEstimatedTokens = estimatedUserTokens + estimatedAssistantTokens;

    // Calculate estimated cost
    const estimatedCost = (totalEstimatedTokens / 1000) * COST_PER_1K_TOKENS;

    // Group recent messages by day
    const messagesByDay: Record<string, { user: number; assistant: number }> = {};
    for (let d = 0; d < 7; d++) {
      const date = new Date(Date.now() - d * 24 * 60 * 60 * 1000);
      const key = date.toISOString().slice(0, 10);
      messagesByDay[key] = { user: 0, assistant: 0 };
    }

    recentMessages.forEach((msg) => {
      const key = msg.createdAt.toISOString().slice(0, 10);
      if (messagesByDay[key]) {
        if (msg.role === "user") {
          messagesByDay[key].user++;
        } else if (msg.role === "assistant") {
          messagesByDay[key].assistant++;
        }
      }
    });

    // Get user details for top users
    const topUserIds = messagesPerUser.map((m) => m.userId);
    const userDetails = await prisma.user.findMany({
      where: {
        id: { in: topUserIds },
      },
      select: {
        id: true,
        email: true,
        name: true,
      },
    });

    const topUsersWithDetails = messagesPerUser.map((stat) => {
      const user = userDetails.find((u) => u.id === stat.userId);
      return {
        userId: stat.userId,
        email: user?.email || "Unknown",
        name: user?.name || null,
        messageCount: stat._count.messages,
      };
    });

    return NextResponse.json({
      overview: {
        totalRequests: userMessages, // Each user message = 1 API request
        totalMessages: totalMessages,
        userMessages: userMessages,
        assistantMessages: assistantMessages,
        uniqueUsersUsingChat: uniqueUsersWithMessages.length,
      },
      tokens: {
        totalEstimated: totalEstimatedTokens,
        userMessagesEstimated: estimatedUserTokens,
        assistantMessagesEstimated: estimatedAssistantTokens,
        avgTokensPerRequest: userMessages > 0 ? Math.round(totalEstimatedTokens / userMessages) : 0,
      },
      cost: {
        totalEstimated: estimatedCost,
        currency: "USD",
        note: "Estimated based on average token usage. Actual costs may vary.",
        costPer1KTokens: COST_PER_1K_TOKENS,
      },
      topUsers: topUsersWithDetails,
      dailyActivity: Object.entries(messagesByDay)
        .map(([date, data]) => ({
          date,
          userMessages: data.user,
          assistantMessages: data.assistant,
          totalMessages: data.user + data.assistant,
        }))
        .sort((a, b) => a.date.localeCompare(b.date)),
    });
  } catch (error) {
    console.error("Gemini stats error:", error);
    return NextResponse.json(
      { error: "Failed to get Gemini stats" },
      { status: 500 }
    );
  }
}
