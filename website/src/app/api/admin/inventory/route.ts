import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { COOKIE_NAME } from "@/lib/admin-auth";

// Inventory NIE jest w Prisma schemie (kolumny tylko w sqlite) — wszystko raw SQL.
// Tabela: id TEXT PK, name TEXT, count INT, notes TEXT, updatedAt DATETIME.

interface InventoryRow {
  id: string;
  name: string;
  count: number;
  notes: string | null;
  updatedAt: string;
}

function isAdmin(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  return token === process.env.ADMIN_SESSION_TOKEN;
}

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48) || `item-${Date.now()}`;
}

// GET /api/admin/inventory — lista pozycji magazynu
export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const rows = await prisma.$queryRaw<InventoryRow[]>`
      SELECT id, name, count, notes, updatedAt FROM Inventory ORDER BY name ASC
    `;
    const totalUnits = rows.reduce((sum, r) => sum + (r.count || 0), 0);
    return NextResponse.json({ ok: true, items: rows, stats: { totalItems: rows.length, totalUnits } });
  } catch (e) {
    console.error("[admin/inventory GET]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// POST /api/admin/inventory — dodaj nowa pozycje
// Body: { name: string, count?: number, notes?: string }
export async function POST(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await req.json().catch(() => ({}));
    const name = String(body?.name || "").trim();
    if (!name) return NextResponse.json({ ok: false, error: "Brak nazwy" }, { status: 400 });
    const count = Number.isFinite(Number(body?.count)) ? Math.max(0, Math.floor(Number(body.count))) : 0;
    const notes = body?.notes ? String(body.notes).trim().slice(0, 500) : null;

    // Wygeneruj unikalne id (slug). Jezeli istnieje, dorzuc suffix.
    let id = slugify(name);
    let suffix = 1;
    while (true) {
      const exists = await prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM Inventory WHERE id = ${id} LIMIT 1
      `;
      if (exists.length === 0) break;
      suffix++;
      id = `${slugify(name)}-${suffix}`;
      if (suffix > 50) {
        id = `item-${Date.now()}`;
        break;
      }
    }

    await prisma.$executeRaw`
      INSERT INTO Inventory (id, name, count, notes) VALUES (${id}, ${name}, ${count}, ${notes})
    `;
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    console.error("[admin/inventory POST]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// PATCH /api/admin/inventory?id=... — zmien pozycje
// Body: { count?: number, name?: string, notes?: string, delta?: number }
// delta = inkrement/dekrement (np. +1, -1) — wygodne dla przyciskow
export async function PATCH(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return NextResponse.json({ ok: false, error: "Brak id" }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const existing = await prisma.$queryRaw<InventoryRow[]>`
      SELECT id, name, count, notes, updatedAt FROM Inventory WHERE id = ${id} LIMIT 1
    `;
    if (existing.length === 0) {
      return NextResponse.json({ ok: false, error: "Nie znaleziono" }, { status: 404 });
    }
    const row = existing[0];

    let newCount = row.count;
    if (Number.isFinite(Number(body?.delta))) {
      newCount = Math.max(0, row.count + Math.floor(Number(body.delta)));
    } else if (Number.isFinite(Number(body?.count))) {
      newCount = Math.max(0, Math.floor(Number(body.count)));
    }
    const newName = body?.name !== undefined ? String(body.name).trim().slice(0, 100) || row.name : row.name;
    const newNotes = body?.notes !== undefined
      ? (String(body.notes).trim().slice(0, 500) || null)
      : row.notes;

    await prisma.$executeRaw`
      UPDATE Inventory
      SET name = ${newName}, count = ${newCount}, notes = ${newNotes}, updatedAt = CURRENT_TIMESTAMP
      WHERE id = ${id}
    `;
    return NextResponse.json({ ok: true, id, count: newCount });
  } catch (e) {
    console.error("[admin/inventory PATCH]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// DELETE /api/admin/inventory?id=... — usun pozycje
export async function DELETE(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return NextResponse.json({ ok: false, error: "Brak id" }, { status: 400 });
    await prisma.$executeRaw`DELETE FROM Inventory WHERE id = ${id}`;
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[admin/inventory DELETE]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
