import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { AI_MODELS, AI_MODEL_IDS } from "@/lib/aiModels";
import { AI_CUSTOM_PROMPT_MAX, sanitizeCustomPrompt } from "@/lib/aiCustomPrompt";

// Ustawienia AI per-user: wybor modelu (przez OpenRouter) + tryb prompta
// (Matura/CKE vs Czysty AI vs Wlasny prompt). Kolumny User.aiModel /
// User.aiMode / User.aiCustomPrompt NIE sa w Prisma schema (jak
// Device.promptMode) -> raw SQL.

const AI_MODES = ["matura", "raw", "custom"];

async function getUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;
  return await prisma.user.findUnique({ where: { email: session.user.email } });
}

async function readCustomPrompt(userId: string): Promise<string> {
  const rows = await prisma.$queryRaw<{ aiCustomPrompt: string | null }[]>`
    SELECT "aiCustomPrompt" FROM "User" WHERE "id" = ${userId} LIMIT 1
  `;
  return rows?.[0]?.aiCustomPrompt || "";
}

// GET /api/user/ai-settings — aktualny wybor usera + dostepne modele
export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Nie zalogowany" }, { status: 401 });

  const rows = await prisma.$queryRaw<{ aiModel: string | null; aiMode: string | null; aiCustomPrompt: string | null; tokenBalance: number | null }[]>`
    SELECT "aiModel", "aiMode", "aiCustomPrompt", "tokenBalance" FROM "User" WHERE "id" = ${user.id} LIMIT 1
  `;
  const row = rows?.[0];
  const customPrompt = row?.aiCustomPrompt || "";
  return NextResponse.json({
    ok: true,
    aiModel: row?.aiModel || "default",
    // "custom" bez promptu = matura (tak samo traktuje to /api/device/solve)
    aiMode: row?.aiMode === "raw" ? "raw" : row?.aiMode === "custom" && customPrompt ? "custom" : "matura",
    aiCustomPrompt: customPrompt,
    aiCustomPromptMax: AI_CUSTOM_PROMPT_MAX,
    tokenBalance: Number(row?.tokenBalance ?? 0),
    models: AI_MODELS,
  });
}

// PATCH /api/user/ai-settings — { aiModel?, aiMode?, aiCustomPrompt? }
export async function PATCH(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Nie zalogowany" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const updates: { aiModel?: string; aiMode?: string; aiCustomPrompt?: string } = {};

  if (body?.aiModel !== undefined) {
    const m = String(body.aiModel);
    if (!AI_MODEL_IDS.includes(m)) {
      return NextResponse.json({ ok: false, error: "Nieznany model" }, { status: 400 });
    }
    updates.aiModel = m;
  }
  if (body?.aiCustomPrompt !== undefined) {
    const p = sanitizeCustomPrompt(body.aiCustomPrompt);
    if (p === null) {
      return NextResponse.json({ ok: false, error: `Prompt za dlugi (max ${AI_CUSTOM_PROMPT_MAX} znakow)` }, { status: 400 });
    }
    updates.aiCustomPrompt = p;
  }
  if (body?.aiMode !== undefined) {
    const md = String(body.aiMode).toLowerCase();
    if (!AI_MODES.includes(md)) {
      return NextResponse.json({ ok: false, error: "Nieprawidlowy tryb (matura/raw/custom)" }, { status: 400 });
    }
    if (md === "custom") {
      const prompt = updates.aiCustomPrompt ?? await readCustomPrompt(user.id);
      if (!prompt) {
        return NextResponse.json({ ok: false, error: "Najpierw wpisz wlasny prompt" }, { status: 400 });
      }
    }
    updates.aiMode = md;
  }
  if (updates.aiModel === undefined && updates.aiMode === undefined && updates.aiCustomPrompt === undefined) {
    return NextResponse.json({ ok: false, error: "Brak zmian" }, { status: 400 });
  }
  // Wyczyszczenie promptu przy aktywnym trybie "custom" -> wroc do matura
  if (updates.aiCustomPrompt === "" && updates.aiMode === undefined) {
    await prisma.$executeRaw`UPDATE "User" SET "aiMode" = 'matura' WHERE "id" = ${user.id} AND "aiMode" = 'custom'`;
  }

  // raw SQL — osobne UPDATE'y zeby aktualizowac tylko podane pola
  if (updates.aiModel !== undefined) {
    await prisma.$executeRaw`UPDATE "User" SET "aiModel" = ${updates.aiModel} WHERE "id" = ${user.id}`;
  }
  if (updates.aiCustomPrompt !== undefined) {
    await prisma.$executeRaw`UPDATE "User" SET "aiCustomPrompt" = ${updates.aiCustomPrompt || null} WHERE "id" = ${user.id}`;
  }
  if (updates.aiMode !== undefined) {
    await prisma.$executeRaw`UPDATE "User" SET "aiMode" = ${updates.aiMode} WHERE "id" = ${user.id}`;
  }

  return NextResponse.json({ ok: true, ...updates });
}
