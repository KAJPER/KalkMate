import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { COOKIE_NAME } from "@/lib/admin-auth";
import { AI_MODELS } from "@/lib/aiModels";

const TOKEN_GRANT = 1_000_000;
// $1.40 per 1M effective tokens (calibrated baseline — exact regardless of model)
const COST_PER_EFFECTIVE_TOKEN = 1.40 / 1_000_000;

export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (token !== process.env.ADMIN_SESSION_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 1. Users with AI settings (raw SQL — aiModel/aiMode not in Prisma schema)
    const userRows = await prisma.$queryRaw<{
      id: string;
      email: string;
      name: string | null;
      tokenBalance: number | null;
      aiModel: string | null;
      aiMode: string | null;
    }[]>`
      SELECT id, email, name, "tokenBalance", "aiModel", "aiMode" FROM "User"
    `;

    // 2. Chat message counts per user (via Conversation)
    const conversations = await prisma.conversation.findMany({
      select: { userId: true, _count: { select: { ChatMessage: true } } },
    });
    const chatCountByUser = new Map<string, number>();
    for (const c of conversations) {
      chatCountByUser.set(c.userId, (chatCountByUser.get(c.userId) ?? 0) + c._count.ChatMessage);
    }

    // 3. Device solve counts per user
    const solves = await prisma.deviceSolve.groupBy({
      by: ["userId"],
      _count: { _all: true },
      where: { userId: { not: null } },
    });
    const solveCountByUser = new Map<string, number>();
    for (const s of solves) {
      if (s.userId) solveCountByUser.set(s.userId, s._count._all);
    }

    // 4. Daily activity (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [recentChats, recentSolves] = await Promise.all([
      prisma.chatMessage.findMany({
        where: { createdAt: { gte: sevenDaysAgo }, role: "user" },
        select: { createdAt: true },
      }),
      prisma.deviceSolve.findMany({
        where: { createdAt: { gte: sevenDaysAgo } },
        select: { createdAt: true },
      }),
    ]);

    const dailyMap: Record<string, { chat: number; device: number }> = {};
    for (let d = 0; d < 7; d++) {
      const date = new Date(Date.now() - d * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      dailyMap[date] = { chat: 0, device: 0 };
    }
    for (const msg of recentChats) {
      const key = msg.createdAt.toISOString().slice(0, 10);
      if (dailyMap[key]) dailyMap[key].chat++;
    }
    for (const s of recentSolves) {
      const key = s.createdAt.toISOString().slice(0, 10);
      if (dailyMap[key]) dailyMap[key].device++;
    }
    const dailyActivity = Object.entries(dailyMap)
      .map(([date, d]) => ({ date, chat: d.chat, device: d.device, total: d.chat + d.device }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // 5. Build per-user data
    const users = userRows.map((u) => {
      const tokenBalance = u.tokenBalance ?? TOKEN_GRANT;
      const tokensConsumed = Math.max(0, TOKEN_GRANT - tokenBalance);
      const chatMessages = chatCountByUser.get(u.id) ?? 0;
      const deviceSolves = solveCountByUser.get(u.id) ?? 0;
      const estimatedCostUSD = tokensConsumed * COST_PER_EFFECTIVE_TOKEN;
      const modelLabel = AI_MODELS.find((m) => m.id === (u.aiModel || "default"))?.label ?? "Domyślny";
      return {
        id: u.id,
        email: u.email,
        name: u.name,
        tokenBalance,
        tokensConsumed,
        tokenPct: Math.min(100, (tokensConsumed / TOKEN_GRANT) * 100),
        aiModel: u.aiModel || "default",
        modelLabel,
        aiMode: u.aiMode || "matura",
        chatMessages,
        deviceSolves,
        estimatedCostUSD,
      };
    }).sort((a, b) => b.tokensConsumed - a.tokensConsumed);

    // 6. Totals
    const totals = {
      totalUsers: users.length,
      totalTokensConsumed: users.reduce((s, u) => s + u.tokensConsumed, 0),
      totalChatMessages: users.reduce((s, u) => s + u.chatMessages, 0),
      totalDeviceSolves: users.reduce((s, u) => s + u.deviceSolves, 0),
      totalEstimatedCostUSD: users.reduce((s, u) => s + u.estimatedCostUSD, 0),
    };

    return NextResponse.json({ users, totals, dailyActivity });
  } catch (err) {
    console.error("[openrouter-stats]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
