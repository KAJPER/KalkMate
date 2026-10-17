import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdminAuth } from "@/lib/admin-auth";
import { randomInt } from "crypto";

// Generator licencji: 16 znaków, więcej cyfr i znaków specjalnych niż liter.
// Losowanie z crypto.randomInt (CSPRNG) — Math.random jest przewidywalny, a kod
// licencji = dostep do platnej uslugi.
function generateLicenseCode(): string {
  const letters = "abcdefghijklmnopqrstuvwxyz"; // 26 znaków
  const digits = "123456789"; // 9 cyfr
  const special = "-+=%"; // 4 znaki specjalne

  const chars: string[] = [];

  // Dodaj 5 małych liter (mniej niż połowa)
  for (let i = 0; i < 5; i++) {
    chars.push(letters[randomInt(letters.length)]);
  }

  // Dodaj 7 cyfr
  for (let i = 0; i < 7; i++) {
    chars.push(digits[randomInt(digits.length)]);
  }

  // Dodaj 4 znaki specjalne
  for (let i = 0; i < 4; i++) {
    chars.push(special[randomInt(special.length)]);
  }

  // Pomieszaj (Fisher-Yates shuffle)
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join("");
}

export async function POST(req: NextRequest) {
  const authErr = await requireAdminAuth(req); if (authErr) return authErr;
  try {
    const { count = 1, durationDays = 30, description } = await req.json();

    // Walidacja
    if (count < 1 || count > 100) {
      return NextResponse.json(
        { error: "Count must be between 1 and 100" },
        { status: 400 }
      );
    }

    const codes: string[] = [];
    const createdLicenses = [];

    // Generuj licencje
    for (let i = 0; i < count; i++) {
      let code = generateLicenseCode();

      // Sprawdź czy kod już istnieje (bardzo mało prawdopodobne)
      let exists = await prisma.license.findUnique({
        where: { code },
      });

      while (exists) {
        code = generateLicenseCode();
        exists = await prisma.license.findUnique({
          where: { code },
        });
      }

      const license = await prisma.license.create({
        data: {
          id: require("crypto").randomUUID(),
          code,
          durationDays,
          description: description || `Generated ${new Date().toISOString()}`,
        },
      });

      codes.push(code);
      createdLicenses.push(license);
    }

    return NextResponse.json({
      success: true,
      codes,
      count: codes.length,
      details: createdLicenses,
    });
  } catch (error) {
    console.error("License generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate licenses" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const authErr = await requireAdminAuth(req); if (authErr) return authErr;
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "50");
    const showUsed = searchParams.get("showUsed") === "true";

    const licenses = await prisma.license.findMany({
      where: showUsed ? {} : { isUsed: false },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return NextResponse.json({
      codes: licenses,
      count: licenses.length,
    });
  } catch (error) {
    console.error("Licenses fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch licenses" },
      { status: 500 }
    );
  }
}
