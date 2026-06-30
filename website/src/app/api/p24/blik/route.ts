import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { blikChargeByCode } from "@/lib/przelewy24";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Brak autoryzacji." }, { status: 401 });
    }

    const { token, blikCode } = await request.json();

    if (!token || !blikCode || String(blikCode).length !== 6) {
      return NextResponse.json(
        { error: "Wymagany token i 6-cyfrowy kod BLIK." },
        { status: 400 }
      );
    }

    const result = await blikChargeByCode(String(token), String(blikCode));

    return NextResponse.json({ orderId: result.orderId, message: result.message });
  } catch (error: any) {
    console.error("[P24] BLIK charge error:", error);

    const msg = error?.message || "";
    if (msg.includes("400")) {
      return NextResponse.json(
        { error: "Nieprawidłowy kod BLIK. Sprawdź kod i spróbuj ponownie." },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Błąd płatności BLIK. Spróbuj ponownie." },
      { status: 500 }
    );
  }
}
