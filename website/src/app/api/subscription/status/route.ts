import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { readTokenBalance } from "@/lib/aiCost"
import { MIN_TOKENS_FOR_AI } from "@/lib/tokenGrants"

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    })

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      )
    }

    // Model tokenowy (2026-10): subskrypcje/triale wycofane. Dostep do AI
    // wylacznie na saldzie tokenow. Brak rekordu Subscription to juz nie 404.
    const tokenBalance = (await readTokenBalance(user.id)) ?? 0
    const hasAccess = tokenBalance >= MIN_TOKENS_FOR_AI

    // Czy kupil kalkulator (panel pokazuje sekcje kalkulatora / zakupu)
    const hasPurchasedCalculator = await prisma.order.count({
      where: {
        userId: user.id,
        status: "paid"
      }
    }) > 0

    return NextResponse.json({
      model: "tokens",
      tokenBalance,
      hasAccess,
      minTokensForAi: MIN_TOKENS_FOR_AI,
      canUseChat: hasAccess, // pole czytane przez stary panel
      hasPurchasedCalculator,
    })
  } catch (error) {
    console.error("Get subscription status error:", error)
    return NextResponse.json(
      { error: "Failed to get subscription status" },
      { status: 500 }
    )
  }
}
