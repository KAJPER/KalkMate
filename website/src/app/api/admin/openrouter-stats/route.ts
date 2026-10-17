import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdminAuth } from "@/lib/admin-auth";
import { AI_MODELS } from "@/lib/aiModels";
import { EFFECTIVE_TOKEN_USD } from "@/lib/aiCost";
import { getOpenRouterAccountUsage } from "@/lib/openrouterAccount";
import { cachedStats, lastWarsawDays, warsawDay } from "../_lib/stats";

const TOKEN_GRANT = 1_000_000;
// $1.40 per 1M effective tokens (calibrated baseline — exact regardless of model)
const COST_PER_EFFECTIVE_TOKEN = EFFECTIVE_TOKEN_USD;

const n = (v: number | bigint | null | undefined) => Number(v ?? 0);

// ZUZYCIE TOKENOW — SZACUNEK. Nie logujemy tokenow per user (ChatMessage /
// DeviceSolve nie maja kolumn z usage; DeviceDailyUsage z lib/aiCost.ts jest
// per urzadzenie/licencja, nie per konto). Dawniej "zuzyte = 1M - saldo", co
// przy doladowaniach dawalo zero/za malo (saldo > 1M). Teraz:
//   zuzyte ≈ startowe 1M + oplacone doladowania (TokenPurchase) - saldo
// Nadal nie widzi recznych korekt salda z panelu (users/[id]) ani innej
// wielkosci startowego grantu — dlatego flaga consumptionIsEstimate.
async function computeStats() {
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

  // 1b. Oplacone doladowania per user (tabela moze jeszcze nie istniec).
  const purchasedByUser = new Map<string, number>();
  try {
    const rows = await prisma.$queryRawUnsafe<{ userId: string; tokens: bigint | number }[]>(
      `SELECT "userId" AS userId, SUM("tokens") AS tokens FROM "TokenPurchase" WHERE "status" = 'paid' GROUP BY "userId"`
    );
    for (const r of rows) purchasedByUser.set(r.userId, n(r.tokens));
  } catch {
    /* brak tabeli TokenPurchase = brak doladowan */
  }

  // 2. Chat message counts per user — GROUP BY w SQL zamiast ladowania
  //    wszystkich konwersacji z _count.
  const chatRows = await prisma.$queryRawUnsafe<{ userId: string; cnt: bigint }[]>(
    `SELECT c."userId" AS userId, COUNT(m."id") AS cnt
     FROM "Conversation" c JOIN "ChatMessage" m ON m."conversationId" = c."id"
     GROUP BY c."userId"`
  );
  const chatCountByUser = new Map(chatRows.map((r) => [r.userId, n(r.cnt)]));

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

  // 4. Daily activity (last 7 days, czas warszawski). Grupowanie po godzinie
  //    UTC w SQL (offset Warszawy to pelne godziny), dzien liczony w JS.
  const dayKeys = lastWarsawDays(7);
  const sinceMs = Date.now() - 8 * 24 * 60 * 60 * 1000;
  const [chatHours, solveHours] = await Promise.all([
    prisma.$queryRawUnsafe<{ b: bigint | number; cnt: bigint }[]>(
      `SELECT CAST("createdAt" / 3600000 AS INTEGER) AS b, COUNT(*) AS cnt FROM "ChatMessage"
       WHERE "role" = 'user' AND "createdAt" >= ? GROUP BY b`, sinceMs),
    prisma.$queryRawUnsafe<{ b: bigint | number; cnt: bigint }[]>(
      `SELECT CAST("createdAt" / 3600000 AS INTEGER) AS b, COUNT(*) AS cnt FROM "DeviceSolve"
       WHERE "createdAt" >= ? GROUP BY b`, sinceMs),
  ]);

  const dailyMap: Record<string, { chat: number; device: number }> = {};
  for (const d of dayKeys) dailyMap[d] = { chat: 0, device: 0 };
  for (const r of chatHours) {
    const key = warsawDay(Number(r.b) * 3_600_000);
    if (dailyMap[key]) dailyMap[key].chat += n(r.cnt);
  }
  for (const r of solveHours) {
    const key = warsawDay(Number(r.b) * 3_600_000);
    if (dailyMap[key]) dailyMap[key].device += n(r.cnt);
  }
  const dailyActivity = Object.entries(dailyMap)
    .map(([date, d]) => ({ date, chat: d.chat, device: d.device, total: d.chat + d.device }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // 5. Build per-user data
  const users = userRows.map((u) => {
    const tokenBalance = Number(u.tokenBalance ?? TOKEN_GRANT);
    const tokensPurchased = purchasedByUser.get(u.id) ?? 0;
    const tokensGranted = TOKEN_GRANT + tokensPurchased;
    const tokensConsumed = Math.max(0, tokensGranted - tokenBalance);
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
      tokensPurchased,
      tokenPct: Math.min(100, (tokensConsumed / tokensGranted) * 100),
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
    totalTokensPurchased: users.reduce((s, u) => s + u.tokensPurchased, 0),
    totalChatMessages: users.reduce((s, u) => s + u.chatMessages, 0),
    totalDeviceSolves: users.reduce((s, u) => s + u.deviceSolves, 0),
    totalEstimatedCostUSD: users.reduce((s, u) => s + u.estimatedCostUSD, 0),
    // Zuzycie to szacunek (patrz komentarz nad computeStats) — realny koszt
    // jest w openrouterAccount (stan konta OpenRouter).
    consumptionIsEstimate: true,
    consumptionMethod: "startowe 1M + opłacone doładowania − saldo (bez ręcznych korekt salda)",
  };

  return { users, totals, dailyActivity, timezone: "Europe/Warsaw" };
}

export async function GET(req: NextRequest) {
  const authErr = await requireAdminAuth(req); if (authErr) return authErr;

  try {
    const stats = await cachedStats("openrouter-stats", computeStats);

    // Realny stan konta OpenRouter — do porownania z totalEstimatedCostUSD
    // (ile MY naliczylismy userom vs ile OpenRouter faktycznie nam policzyl).
    // Duzy rozjazd = albo bledy w naliczaniu (patrz src/lib/aiCost.ts), albo
    // zuzycie spoza tego mechanizmu (np. testy reczne kluczem).
    // (lib/openrouterAccount.ts ma wlasny cache 60 s.)
    const openrouterAccount = await getOpenRouterAccountUsage();

    return NextResponse.json({ ...stats, openrouterAccount });
  } catch (err) {
    console.error("[openrouter-stats]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
