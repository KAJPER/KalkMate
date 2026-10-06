import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { requireAdminAuth } from "@/lib/admin-auth";

export async function GET(request: NextRequest) {
  const authErr = await requireAdminAuth(request); if (authErr) return authErr;
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get("limit") || "50") || 50));
    const offset = Math.max(0, parseInt(searchParams.get("offset") || "0") || 0);
    const filter = searchParams.get("filter") || "all"; // all, used, unused
    const q = (searchParams.get("q") || "").trim().slice(0, 100);

    // Szukanie: fragment kodu, opisu albo e-mail uzytkownika, ktory jej uzyl.
    let search: Prisma.LicenseWhereInput = {};
    if (q) {
      const users = await prisma.user.findMany({
        where: { email: { contains: q } },
        select: { id: true },
        take: 200,
      });
      search = {
        OR: [
          { code: { contains: q } },
          { description: { contains: q } },
          ...(users.length ? [{ usedBy: { in: users.map((u) => u.id) } }] : []),
        ],
      };
    }
    const status: Prisma.LicenseWhereInput =
      filter === "used" ? { isUsed: true } : filter === "unused" ? { isUsed: false } : {};
    const whereCondition: Prisma.LicenseWhereInput = { AND: [status, search] };

    const [licenses, total, used, all] = await Promise.all([
      prisma.license.findMany({
        where: whereCondition,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.license.count({ where: whereCondition }),
      prisma.license.count({ where: { isUsed: true } }),
      prisma.license.count(),
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
      counts: { total: all, used, unused: all - used },
    });
  } catch (error) {
    console.error("Failed to fetch licenses:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
