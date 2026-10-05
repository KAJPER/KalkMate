import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { ensureOrderPersonalizationColumns } from "@/lib/orderPersonalization";

const PAYMENT_STATUS: Record<string, string> = {
  pending: "requires_payment_method",
  paid: "succeeded",
  cancelled: "canceled",
  refunded: "refunded",
};

// Zakladki listy zamowien (/admin/orders).
const VIEWS: Record<string, Prisma.OrderWhereInput> = {
  all: {},
  to_ship: { status: "paid", fulfillmentStatus: { in: ["unfulfilled", "in_progress"] } },
  unpaid: { status: "pending", fulfillmentStatus: { not: "cancelled" } },
  shipped: { fulfillmentStatus: "shipped" },
};

// Szukanie po WSZYSTKICH zamowieniach (wczesniej filtr dzialal tylko na 50
// wczytanych): numer KM-..., nazwisko, e-mail, telefon (tez bez spacji),
// numer przesylki, id. SQLite LIKE = bez rozrozniania wielkosci liter (ASCII).
async function searchWhere(q: string): Promise<Prisma.OrderWhereInput> {
  const t = q.trim();
  if (!t) return {};
  // Telefon: porownanie samych cyfr ("600111222" znajduje "+48 600 111 222").
  const digits = t.replace(/[\s+()-]/g, "");
  let phoneIds: string[] = [];
  if (digits.length >= 5 && /^\d+$/.test(digits)) {
    const rows = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM "Order"
      WHERE REPLACE(REPLACE(REPLACE(REPLACE(REPLACE("customerPhone", ' ', ''), '-', ''), '+', ''), '(', ''), ')', '')
            LIKE ${"%" + digits.slice(-9) + "%"}`;
    phoneIds = rows.map((r) => r.id);
  }
  return {
    OR: [
      { orderNumber: { contains: t } },
      { customerName: { contains: t } },
      { customerEmail: { contains: t } },
      { customerPhone: { contains: t } },
      ...(phoneIds.length ? [{ id: { in: phoneIds } }] : []),
      { trackingNumber: { contains: t } },
      { id: t },
    ],
  };
}

export async function GET(request: NextRequest) {
  const authErr = await requireAdminAuth(request); if (authErr) return authErr;
  const searchParams = request.nextUrl.searchParams;
  const limit = Math.min(200, Math.max(1, parseInt(searchParams.get("limit") || "50") || 50));
  const offset = Math.max(0, parseInt(searchParams.get("offset") || "0") || 0);
  const view = VIEWS[searchParams.get("view") || "all"] ? searchParams.get("view") || "all" : "all";
  const search = await searchWhere(searchParams.get("q") || "");

  try {
    const where: Prisma.OrderWhereInput = { AND: [VIEWS[view], search] };
    const counts = Object.fromEntries(
      await Promise.all(
        Object.entries(VIEWS).map(async ([k, w]) => [k, await prisma.order.count({ where: { AND: [w, search] } })] as const)
      )
    );
    const rows = await prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: offset,
      take: limit + 1,
    });

    const has_more = rows.length > limit;
    const page = rows.slice(0, limit);

    // Personalizacja (kod AI wgrywany do sztuki + imie na etykiete) — kolumny
    // poza Prisma schema, patrz lib/orderPersonalization.ts. Potrzebne tutaj
    // zeby realizujący zamówienie widział co wgrać/wydrukować przed wysyłką.
    await ensureOrderPersonalizationColumns();
    const persMap = new Map<string, { code: string | null; name: string | null }>();
    if (page.length) {
      const placeholders = page.map(() => "?").join(",");
      const persRows = await prisma.$queryRawUnsafe<
        { id: string; personalizedCode: string | null; personalizedName: string | null }[]
      >(
        `SELECT id, "personalizedCode", "personalizedName" FROM "Order" WHERE id IN (${placeholders})`,
        ...page.map((o) => o.id)
      );
      for (const r of persRows) persMap.set(r.id, { code: r.personalizedCode, name: r.personalizedName });
    }

    const orders = page.map((o) => ({
      id: o.id,
      order_number: o.orderNumber,
      amount: o.amount,
      currency: o.currency,
      status: PAYMENT_STATUS[o.status] || o.status,
      created: Math.floor(o.createdAt.getTime() / 1000),
      customer_name: o.customerName || "",
      customer_email: o.customerEmail || "",
      customer_phone: o.customerPhone || "",
      pickup_point: o.pickupPoint || "",
      pickup_point_address: o.pickupPointAddress || "",
      product: "KalkMate v3.0",
      fulfillment_status: o.fulfillmentStatus || "unfulfilled",
      shipped_at: o.shippedAt ? o.shippedAt.toISOString() : null,
      tracking_number: o.trackingNumber || "",
      payment_provider: o.paymentProvider,
      personalized_code: persMap.get(o.id)?.code || null,
      personalized_name: persMap.get(o.id)?.name || null,
    }));

    return NextResponse.json({
      orders,
      counts,
      has_more,
      next_offset: offset + limit,
    });
  } catch (error) {
    console.error("Error fetching orders:", error);
    return NextResponse.json(
      { error: "Failed to fetch orders" },
      { status: 500 }
    );
  }
}
