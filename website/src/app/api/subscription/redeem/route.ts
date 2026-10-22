import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { rateLimit, clientIp } from "@/lib/rate-limit";

import { activateLicenseForTokens, LICENSE_INVALID_MSG } from "@/lib/licenseTokens";

// Ujednolicony komunikat dla wszystkich "nieudanych" przypadkow zeby nie
// dawac sygnalu czy kod istnieje czy nalezy do kogos innego (anty-enumeracja).
const INVALID_CODE_MSG = LICENSE_INVALID_MSG;

export async function POST(request: NextRequest) {
  try {
    // Rate limit per IP: 5 prob/min — chroni przed brute-force genratora kodow
    const ip = clientIp(request);
    const rl = rateLimit(`redeem:${ip}`, 5, 60_000);
    if (!rl.ok) {
      return NextResponse.json(
        { error: `Za duzo prob. Sprobuj za ${Math.ceil(rl.resetMs / 1000)}s.` },
        { status: 429 }
      );
    }

    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { licenseCode } = body;

    if (!licenseCode || typeof licenseCode !== "string") {
      return NextResponse.json(
        { error: "Kod licencji jest wymagany" },
        { status: 400 }
      );
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Model tokenowy (2026-10): licencja = jednorazowe LICENSE_TOKENS na
    // konto (wspolna logika z /api/user/license/claim — lib/licenseTokens.ts).
    const act = await activateLicenseForTokens(user.id, licenseCode)
    if (!act.ok) {
      return NextResponse.json({ ok: false, error: INVALID_CODE_MSG }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      success: true, // pole czytane przez starszy panel
      code: act.code,
      tokensGranted: act.tokensGranted,
      tokenBalance: act.tokenBalance,
      alreadyActivated: act.alreadyActivated,
      message: act.message,
    });
  } catch (error) {
    console.error("Redeem license error:", error);
    return NextResponse.json(
      { error: "Nie udało się zrealizować licencji" },
      { status: 500 }
    );
  }
}
