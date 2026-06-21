import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { AI_MODELS, AI_MODEL_IDS } from "@/lib/aiModels";

// Ustawienia AI per-user: wybor modelu (przez OpenRouter) + tryb prompta
// (Matura/CKE vs Czysty AI). Kolumny User.aiModel / User.aiMode NIE sa w
// Prisma schema (jak Device.promptMode) -> raw SQL.

async function getUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;
  return await prisma.user.findUnique({ where: { email: session.user.email } });
}

// GET /api/user/ai-settings — aktualny wybor usera + dostepne modele
export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Nie zalogowany" }, { status: 401 });

  const rows = await prisma.$queryRaw<{ aiModel: string | null; aiMode: string | null }[]>`
    SELECT "aiModel", "aiMode" FROM "User" WHERE "id" = ${user.id} LIMIT 1
  `;
  const row = rows?.[0];
  return NextResponse.json({
    ok: true,
    aiModel: row?.aiModel || "default",
    aiMode: row?.aiMode === "raw" ? "raw" : "matura",
    models: AI_MODELS,
  });
}

// PATCH /api/user/ai-settings — { aiModel?, aiMode? }
export async function PATCH(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Nie zalogowany" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const updates: { aiModel?: string; aiMode?: string } = {};

  if (body?.aiModel !== undefined) {
    const m = String(body.aiModel);
    if (!AI_MODEL_IDS.includes(m)) {
      return NextResponse.json({ ok: false, error: "Nieznany model" }, { status: 400 });
    }
    updates.aiModel = m;
  }
  if (body?.aiMode !== undefined) {
    const md = String(body.aiMode).toLowerCase();
    if (md !== "matura" && md !== "raw") {
      return NextResponse.json({ ok: false, error: "Nieprawidlowy tryb (matura/raw)" }, { status: 400 });
    }
    updates.aiMode = md;
  }
  if (updates.aiModel === undefined && updates.aiMode === undefined) {
    return NextResponse.json({ ok: false, error: "Brak zmian" }, { status: 400 });
  }

  // raw SQL — osobne UPDATE'y zeby aktualizowac tylko podane pola
  if (updates.aiModel !== undefined) {
    await prisma.$executeRaw`UPDATE "User" SET "aiModel" = ${updates.aiModel} WHERE "id" = ${user.id}`;
  }
  if (updates.aiMode !== undefined) {
    await prisma.$executeRaw`UPDATE "User" SET "aiMode" = ${updates.aiMode} WHERE "id" = ${user.id}`;
  }

  return NextResponse.json({ ok: true, ...updates });
}
