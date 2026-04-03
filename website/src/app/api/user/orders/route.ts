import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Pobierz użytkownika
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Pobierz zamówienia użytkownika (zarówno połączone z kontem jak i po emailu)
    const orders = await prisma.order.findMany({
      where: {
        OR: [
          { userId: user.id },
          { customerEmail: session.user.email },
        ],
      },
      orderBy: { createdAt: "desc" },
    });

    console.log(`[Orders API] User: ${session.user.email}, Found ${orders.length} orders`);

    return NextResponse.json({ orders });
  } catch (error) {
    console.error("Orders fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch orders" },
      { status: 500 }
    );
  }
}
