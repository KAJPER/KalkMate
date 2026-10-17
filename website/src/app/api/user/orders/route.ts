import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { parseOrderUnitsRow } from "@/lib/orderPersonalization";

// Tylko pola dla klienta — bez adminNotes, identyfikatorow Furgonetki,
// wewnetrznej nazwy pliku faktury, ID platnosci (audyt 2026-10-16).
const CUSTOMER_ORDER_SELECT = {
  id: true,
  orderNumber: true,
  status: true,
  fulfillmentStatus: true,
  customerName: true,
  customerEmail: true,
  customerPhone: true,
  pickupPoint: true,
  pickupPointAddress: true,
  customerAddressStreet: true,
  customerAddressPostcode: true,
  customerAddressCity: true,
  customerCountry: true,
  paymentProvider: true,
  amount: true,
  currency: true,
  trackingNumber: true,
  createdAt: true,
  paidAt: true,
  shippedAt: true,
  deliveredAt: true,
  invoiceSentAt: true,
} as const;

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Pobierz użytkownika
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, email: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Pobierz zamówienia użytkownika (zarówno połączone z kontem jak i po emailu)
    const orders = await prisma.order.findMany({
      where: {
        OR: [
          { userId: user.id },
          { customerEmail: user.email },
        ],
      },
      orderBy: { createdAt: "desc" },
      select: CUSTOMER_ORDER_SELECT,
    });

    // Liczba sztuk + imiona na etykiety — kolumny raw SQL poza Prisma
    // ("quantity", "personalizationJson"). SELECT * dziala tez na starej bazie
    // bez tych kolumn (wtedy quantity 1). Kodow AI klientowi NIE zwracamy.
    const unitsById = new Map<string, { quantity: number; names: string[] }>();
    if (orders.length) {
      try {
        const placeholders = orders.map(() => "?").join(",");
        const rows = await prisma.$queryRawUnsafe<{ id: string; quantity?: unknown; personalizationJson?: unknown; personalizedCode?: unknown; personalizedName?: unknown }[]>(
          `SELECT * FROM "Order" WHERE id IN (${placeholders})`,
          ...orders.map((o) => o.id)
        );
        for (const r of rows) {
          const u = parseOrderUnitsRow(r);
          unitsById.set(r.id, {
            quantity: Math.max(1, Math.floor(Number(u.quantity) || 1)),
            names: (u.units ?? []).map((x) => x.name).filter(Boolean),
          });
        }
      } catch (e) {
        console.error("Orders units fetch error:", e);
      }
    }

    return NextResponse.json({
      orders: orders.map((o) => ({
        ...o,
        quantity: unitsById.get(o.id)?.quantity ?? 1,
        personalizedNames: unitsById.get(o.id)?.names ?? [],
      })),
    });
  } catch (error) {
    console.error("Orders fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch orders" },
      { status: 500 }
    );
  }
}
