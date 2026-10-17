import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdminAuth } from "@/lib/admin-auth";
import { cachedStats, lastWarsawDays, warsawDay } from "../_lib/stats";

// Statystyki czatu AI dla dashboardu (/admin). Nazwa "gemini" historyczna —
// czat idzie dzis przez OpenRouter (rozne modele).
//
// KOSZTY: dawniej liczone ze stalych cen "Gemini 1.5 Flash" i sredniej
// dlugosci wiadomosci — calkowicie fikcyjne. Pola zostaja (null + flaga
// deprecated), zeby panel sie nie wywrocil; realne koszty i zuzycie tokenow
// sa w /admin/gemini (/api/admin/openrouter-stats: stan konta OpenRouter).
// Szacunek tokenow ze sredniej dlugosci wiadomosci tez jest oznaczony.
//
// Agregacja w SQL (bez ladowania wszystkich konwersacji/wiadomosci), dni w
// strefie Europe/Warsaw, wynik w cache 60 s.

const AVG_TOKENS_PER_USER_MESSAGE = 100;
const AVG_TOKENS_PER_ASSISTANT_MESSAGE = 200;

const n = (v: number | bigint | null | undefined) => Number(v ?? 0);

async function computeGeminiStats() {
  const dayKeys = lastWarsawDays(7);
  const sinceMs = Date.now() - 8 * 24 * 60 * 60 * 1000;

  const [roleRows, uniqueRows, topRows, hourRows] = await Promise.all([
    prisma.$queryRawUnsafe<{ role: string; cnt: bigint }[]>(
      `SELECT "role" AS role, COUNT(*) AS cnt FROM "ChatMessage" GROUP BY "role"`),
    prisma.$queryRawUnsafe<{ cnt: bigint }[]>(
      `SELECT COUNT(DISTINCT "userId") AS cnt FROM "Conversation"`),
    prisma.$queryRawUnsafe<{ userId: string; cnt: bigint }[]>(
      `SELECT c."userId" AS userId, COUNT(m."id") AS cnt
       FROM "Conversation" c JOIN "ChatMessage" m ON m."conversationId" = c."id"
       GROUP BY c."userId" ORDER BY cnt DESC LIMIT 10`),
    // Godzina UTC (offset Warszawy to pelne godziny) -> dzien liczony w JS.
    prisma.$queryRawUnsafe<{ b: bigint | number; role: string; cnt: bigint }[]>(
      `SELECT CAST("createdAt" / 3600000 AS INTEGER) AS b, "role" AS role, COUNT(*) AS cnt
       FROM "ChatMessage" WHERE "createdAt" >= ? GROUP BY b, "role"`, sinceMs),
  ]);

  let totalMessages = 0, userMessages = 0, assistantMessages = 0;
  for (const r of roleRows) {
    const c = n(r.cnt);
    totalMessages += c;
    if (r.role === "user") userMessages += c;
    else if (r.role === "assistant") assistantMessages += c;
  }
  const uniqueUsersUsingChat = n(uniqueRows[0]?.cnt);

  // Szacunek tokenow (srednia dlugosc wiadomosci — NIE realne zuzycie)
  const estimatedUserTokens = userMessages * AVG_TOKENS_PER_USER_MESSAGE;
  const estimatedAssistantTokens = assistantMessages * AVG_TOKENS_PER_ASSISTANT_MESSAGE;
  const totalEstimatedTokens = estimatedUserTokens + estimatedAssistantTokens;

  // Wiadomosci per dzien (ostatnie 7 dni, czas warszawski)
  const messagesByDay: Record<string, { user: number; assistant: number }> = {};
  for (const d of dayKeys) messagesByDay[d] = { user: 0, assistant: 0 };
  for (const r of hourRows) {
    const key = warsawDay(Number(r.b) * 3_600_000);
    if (!messagesByDay[key]) continue;
    if (r.role === "user") messagesByDay[key].user += n(r.cnt);
    else if (r.role === "assistant") messagesByDay[key].assistant += n(r.cnt);
  }

  // Dane top userow
  const topUserIds = topRows.map((r) => r.userId);
  const userDetails = topUserIds.length
    ? await prisma.user.findMany({ where: { id: { in: topUserIds } }, select: { id: true, email: true, name: true } })
    : [];
  const topUsersWithDetails = topRows.map((r) => {
    const user = userDetails.find((u) => u.id === r.userId);
    return {
      userId: r.userId,
      email: user?.email || "Unknown",
      name: user?.name || null,
      messageCount: n(r.cnt),
    };
  });

  return {
    overview: {
      totalRequests: userMessages, // Each user message = 1 API request
      totalMessages,
      userMessages,
      assistantMessages,
      uniqueUsersUsingChat,
      uniqueUsers: uniqueUsersUsingChat, // alias — tej nazwy uzywa dashboard
    },
    tokens: {
      totalEstimated: totalEstimatedTokens,
      userMessagesEstimated: estimatedUserTokens,
      assistantMessagesEstimated: estimatedAssistantTokens,
      avgTokensPerRequest: userMessages > 0 ? Math.round(totalEstimatedTokens / userMessages) : 0,
      averagePerRequest: userMessages > 0 ? Math.round(totalEstimatedTokens / userMessages) : 0,
      isEstimate: true,
      note: "Szacunek ze średniej długości wiadomości (100/200 tokenów), nie realne zużycie.",
    },
    cost: {
      totalEstimated: null,
      totalEstimatedUSD: null,
      currency: "USD",
      costPer1KTokens: null,
      perThousandTokens: null,
      deprecated: true,
      note: "Usunięte: dawny koszt liczony ze stałych cen Gemini 1.5 Flash był fikcyjny. Realne koszty: /admin/gemini (konto OpenRouter).",
    },
    topUsers: topUsersWithDetails,
    dailyActivity: Object.entries(messagesByDay)
      .map(([date, data]) => ({
        date,
        userMessages: data.user,
        assistantMessages: data.assistant,
        totalMessages: data.user + data.assistant,
        total: data.user + data.assistant,
      }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    timezone: "Europe/Warsaw",
  };
}

export async function GET(req: NextRequest) {
  const authErr = await requireAdminAuth(req); if (authErr) return authErr;
  try {
    return NextResponse.json(await cachedStats("gemini-stats", computeGeminiStats));
  } catch (error) {
    console.error("Gemini stats error:", error);
    return NextResponse.json(
      { error: "Failed to get Gemini stats" },
      { status: 500 }
    );
  }
}
