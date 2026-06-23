import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { COOKIE_NAME } from "@/lib/admin-auth";
import {
  ensureCouponTable,
  normalizeCode,
  type CouponRow,
} from "@/lib/coupons";
import { randomUUID } from "crypto";

function isAdmin(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  return token === process.env.ADMIN_SESSION_TOKEN;
}

// GET /api/admin/coupons — lista kuponow
export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    await ensureCouponTable();
    const rows = await prisma.$queryRaw<CouponRow[]>`
      SELECT id, code, type, value, active, maxUses, usedCount, expiresAt, createdAt
      FROM Coupon ORDER BY createdAt DESC
    `;
    return NextResponse.json({ ok: true, coupons: rows });
  } catch (e) {
    console.error("[admin/coupons GET]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// POST /api/admin/coupons — utworz kupon
// Body: { code, type: 'percent'|'fixed', value, maxUses?, expiresAt? }
//   value dla 'percent' = 1..100, dla 'fixed' = kwota w ZL (przeliczamy na grosze)
export async function POST(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    await ensureCouponTable();
    const body = await req.json().catch(() => ({}));

    const code = normalizeCode(body?.code);
    if (!code || code.length < 3) {
      return NextResponse.json({ ok: false, error: "Kod musi miec min. 3 znaki." }, { status: 400 });
    }
    if (!/^[A-Z0-9_-]+$/.test(code)) {
      return NextResponse.json({ ok: false, error: "Kod: tylko A-Z, 0-9, - i _." }, { status: 400 });
    }

    const type = body?.type === "fixed" ? "fixed" : "percent";
    const rawValue = Number(body?.value);
    if (!Number.isFinite(rawValue) || rawValue <= 0) {
      return NextResponse.json({ ok: false, error: "Wartosc musi byc wieksza od 0." }, { status: 400 });
    }

    let value: number;
    if (type === "percent") {
      value = Math.round(rawValue);
      if (value < 1 || value > 100) {
        return NextResponse.json({ ok: false, error: "Procent musi byc 1..100." }, { status: 400 });
      }
    } else {
      // ZL -> grosze
      value = Math.round(rawValue * 100);
      if (value < 1) {
        return NextResponse.json({ ok: false, error: "Kwota musi byc wieksza od 0." }, { status: 400 });
      }
    }

    let maxUses: number | null = null;
    if (body?.maxUses !== undefined && body?.maxUses !== null && body?.maxUses !== "") {
      const m = Math.floor(Number(body.maxUses));
      if (Number.isFinite(m) && m > 0) maxUses = m;
    }

    let expiresAt: string | null = null;
    if (body?.expiresAt) {
      const s = String(body.expiresAt).trim();
      if (/^\d{4}-\d{2}-\d{2}/.test(s) && !isNaN(new Date(s).getTime())) {
        expiresAt = s.slice(0, 10);
      }
    }

    // Unikalnosc kodu
    const exists = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM Coupon WHERE code = ${code} LIMIT 1
    `;
    if (exists.length > 0) {
      return NextResponse.json({ ok: false, error: "Kupon o tym kodzie juz istnieje." }, { status: 409 });
    }

    const id = randomUUID();
    await prisma.$executeRaw`
      INSERT INTO Coupon (id, code, type, value, active, maxUses, usedCount, expiresAt)
      VALUES (${id}, ${code}, ${type}, ${value}, 1, ${maxUses}, 0, ${expiresAt})
    `;
    return NextResponse.json({ ok: true, id, code });
  } catch (e) {
    console.error("[admin/coupons POST]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// PATCH /api/admin/coupons?id=... — wlacz/wylacz kupon
// Body: { active: boolean }
export async function PATCH(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    await ensureCouponTable();
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return NextResponse.json({ ok: false, error: "Brak id" }, { status: 400 });
    const body = await req.json().catch(() => ({}));
    const active = body?.active ? 1 : 0;
    await prisma.$executeRaw`UPDATE Coupon SET active = ${active} WHERE id = ${id}`;
    return NextResponse.json({ ok: true, id, active });
  } catch (e) {
    console.error("[admin/coupons PATCH]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// DELETE /api/admin/coupons?id=... — usun kupon
export async function DELETE(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    await ensureCouponTable();
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return NextResponse.json({ ok: false, error: "Brak id" }, { status: 400 });
    await prisma.$executeRaw`DELETE FROM Coupon WHERE id = ${id}`;
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[admin/coupons DELETE]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
