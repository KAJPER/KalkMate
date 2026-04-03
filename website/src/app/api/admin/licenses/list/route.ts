import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";

const COOKIE_NAME = process.env.NODE_ENV === "production" ? "__Secure-admin_session" : "admin_session";
const ADMIN_SESSION_TOKEN = process.env.ADMIN_SESSION_TOKEN;

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get(COOKIE_NAME)?.value;

    if (!sessionToken || sessionToken !== ADMIN_SESSION_TOKEN) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");
    const filter = searchParams.get("filter") || "all"; // all, used, unused

    // Build filter condition
    let whereCondition: any = {};
    if (filter === "used") {
      whereCondition.isUsed = true;
    } else if (filter === "unused") {
      whereCondition.isUsed = false;
    }

    // Fetch licenses
    const [licenses, total] = await Promise.all([
      prisma.license.findMany({
        where: whereCondition,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.license.count({ where: whereCondition }),
    ]);

    // Fetch user info for used licenses
    const userIds = licenses
      .filter((l) => l.usedBy)
      .map((l) => l.usedBy as string);

    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, email: true, name: true },
    });

    const userMap = new Map(users.map((u) => [u.id, u]));

    // Enrich licenses with user data
    const enrichedLicenses = licenses.map((license) => ({
      ...license,
      usedByUser: license.usedBy ? userMap.get(license.usedBy) : null,
    }));

    return NextResponse.json({
      licenses: enrichedLicenses,
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    });
  } catch (error) {
    console.error("Failed to fetch licenses:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
