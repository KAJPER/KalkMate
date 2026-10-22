import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdminAuth } from "@/lib/admin-auth";
import { deleteUserAccount, normalizeEmail, EMAIL_RE } from "@/lib/auth";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authErr = await requireAdminAuth(request); if (authErr) return authErr;
  try {
    const { id } = await params;
    const body = await request.json();
    const { action, data } = body;

    if (action === "updateSubscription") {
      // Model tokenowy (2026-10): subskrypcje wycofane — status Subscription
      // nie wplywa juz na dostep do AI. Uzyj "addTokens".
      return NextResponse.json(
        { error: "Subskrypcje zostały wycofane — dostęp do AI działa na tokenach. Użyj doładowania tokenów." },
        { status: 410 }
      );
    }

    if (action === "updateUser") {
      // Update user details. E-mail malymi literami (tak zapisuje rejestracja
      // i szuka logowanie). Odpowiedz bez hasha hasla.
      const email = data?.email !== undefined ? normalizeEmail(data.email) : undefined;
      if (email !== undefined && !EMAIL_RE.test(email)) {
        return NextResponse.json({ error: "Nieprawidłowy adres email" }, { status: 400 });
      }
      try {
        const updated = await prisma.user.update({
          where: { id },
          data: {
            ...(data.name !== undefined && { name: data.name }),
            ...(email !== undefined && { email }),
          },
          select: { id: true, email: true, name: true, emailVerified: true, image: true, createdAt: true, updatedAt: true },
        });
        return NextResponse.json({ success: true, user: updated });
      } catch (e: any) {
        if (e?.code === "P2002") {
          return NextResponse.json({ error: "Ten email jest już używany przez inne konto" }, { status: 409 });
        }
        throw e;
      }
    }

    if (action === "addTokens") {
      // Reczne doladowanie/korekta tokenow AI przez admina (np. reklamacja,
      // niedoliczona platnosc). tokenBalance nie jest w Prisma schemie.
      const tokens = Number(data?.tokens);
      if (!Number.isFinite(tokens) || tokens === 0) {
        return NextResponse.json({ error: "Nieprawidłowa liczba tokenów" }, { status: 400 });
      }
      await prisma.$executeRaw`
        UPDATE "User" SET "tokenBalance" = MAX(0, COALESCE("tokenBalance", 0) + ${tokens}) WHERE "id" = ${id}
      `;
      const rows = await prisma.$queryRaw<{ tokenBalance: number }[]>`
        SELECT "tokenBalance" FROM "User" WHERE "id" = ${id} LIMIT 1
      `;
      return NextResponse.json({ success: true, tokenBalance: Number(rows[0]?.tokenBalance ?? 0) });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Failed to update user:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authErr = await requireAdminAuth(request); if (authErr) return authErr;
  try {
    const { id } = await params;

    // Wczesniej prisma.user.delete — Order.userId ma w bazie ON DELETE
    // CASCADE, wiec usuniecie konta kasowalo tez OPLACONE zamowienia (dane
    // ksiegowe). deleteUserAccount odpina zamowienia (zostaja), czysci tokeny,
    // zgody, jezyk newslettera i historie z kalkulatora (lib/auth.ts).
    const result = await deleteUserAccount(id);
    if (!result.ok) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete user:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
