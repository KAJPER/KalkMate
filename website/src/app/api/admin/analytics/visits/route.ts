import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";

type VisitRow = {
  ipHash: string;
  userAgent: string | null;
  referer: string | null;
  page: string;
  createdAt: Date;
};

// Rozpoznaj typ urządzenia z user-agent
function deviceType(ua: string): "mobile" | "desktop" {
  return /Mobi|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)
    ? "mobile"
    : "desktop";
}

// Czyść referrer do ładnej nazwy źródła
function cleanReferer(ref: string | null): string {
  if (!ref) return "Direct";
  try {
    const url = new URL(ref);
    const host = url.hostname.replace(/^www\./, "");
    if (host.includes("google")) return "Google";
    if (host.includes("facebook")) return "Facebook";
    if (host.includes("instagram")) return "Instagram";
    if (host.includes("tiktok")) return "TikTok";
    if (host.includes("youtube")) return "YouTube";
    if (host.includes("twitter") || host.includes("x.com")) return "Twitter/X";
    if (host.includes("kalkmate.pl")) return "Internal";
    return host || "Direct";
  } catch {
    return "Direct";
  }
}

export async function GET(request: NextRequest) {
  const authErr = requireAdminAuth(request);
  if (authErr) return authErr;

  try {
    const url = new URL(request.url);
    const days = Math.min(parseInt(url.searchParams.get("days") || "30", 10), 90);

    const since = new Date();
    since.setDate(since.getDate() - days);
    since.setHours(0, 0, 0, 0);

    // ----------------------------------------------------------------
    // Pobierz surowe dane z okresu
    // ----------------------------------------------------------------
    const visits: VisitRow[] = await prisma.visit.findMany({
      where: { createdAt: { gte: since } },
      select: { ipHash: true, userAgent: true, referer: true, page: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });

    // ----------------------------------------------------------------
    // Metryki ogólne
    // ----------------------------------------------------------------
    const totalViews = visits.length;
    const uniqueVisitors = new Set(visits.map((v) => v.ipHash)).size;

    // Dzisiaj
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayViews = visits.filter((v) => v.createdAt >= todayStart).length;
    const todayUnique = new Set(
      visits.filter((v) => v.createdAt >= todayStart).map((v) => v.ipHash)
    ).size;

    // Wczoraj
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    const yesterdayViews = visits.filter(
      (v) => v.createdAt >= yesterdayStart && v.createdAt < todayStart
    ).length;

    // ----------------------------------------------------------------
    // Wykres dzienny
    // ----------------------------------------------------------------
    const dailyMap = new Map<string, { views: number; ips: Set<string> }>();
    for (const v of visits) {
      const date = v.createdAt.toISOString().slice(0, 10);
      if (!dailyMap.has(date)) dailyMap.set(date, { views: 0, ips: new Set() });
      const entry = dailyMap.get(date)!;
      entry.views++;
      entry.ips.add(v.ipHash);
    }
    // Wypełnij brakujące dni zerami
    const daily: Array<{ date: string; views: number; unique: number }> = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const date = d.toISOString().slice(0, 10);
      const entry = dailyMap.get(date);
      daily.push({ date, views: entry?.views ?? 0, unique: entry?.ips.size ?? 0 });
    }

    // ----------------------------------------------------------------
    // Top strony
    // ----------------------------------------------------------------
    const pageMap = new Map<string, number>();
    for (const v of visits) {
      pageMap.set(v.page, (pageMap.get(v.page) ?? 0) + 1);
    }
    const topPages = Array.from(pageMap.entries())
      .map(([page, views]) => ({ page, views }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 15);

    // ----------------------------------------------------------------
    // Źródła ruchu
    // ----------------------------------------------------------------
    const refMap = new Map<string, number>();
    for (const v of visits) {
      const src = cleanReferer(v.referer);
      refMap.set(src, (refMap.get(src) ?? 0) + 1);
    }
    const referrers = Array.from(refMap.entries())
      .map(([source, count]) => ({ source, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // ----------------------------------------------------------------
    // Urządzenia
    // ----------------------------------------------------------------
    let mobile = 0;
    let desktop = 0;
    for (const v of visits) {
      if (deviceType(v.userAgent || "")) {
        if (deviceType(v.userAgent || "") === "mobile") mobile++;
        else desktop++;
      }
    }

    // ----------------------------------------------------------------
    // Lejek konwersji (kluczowe strony)
    // ----------------------------------------------------------------
    const funnelPages = ["/", "/sklep", "/zamow", "/auth/register", "/panel"];
    const funnel = funnelPages.map((page) => ({
      page,
      views: visits.filter((v) => v.page === page || v.page.startsWith(page + "?")).length,
      unique: new Set(
        visits
          .filter((v) => v.page === page || v.page.startsWith(page + "?"))
          .map((v) => v.ipHash)
      ).size,
    }));

    // ----------------------------------------------------------------
    // Godziny aktywności (0-23)
    // ----------------------------------------------------------------
    const hourMap = new Array(24).fill(0);
    for (const v of visits) {
      hourMap[v.createdAt.getHours()]++;
    }
    const hourly = hourMap.map((count, hour) => ({ hour, count }));

    return NextResponse.json({
      period: { days, since: since.toISOString() },
      overview: {
        totalViews,
        uniqueVisitors,
        todayViews,
        todayUnique,
        yesterdayViews,
        avgDailyViews: days > 0 ? Math.round(totalViews / days) : 0,
      },
      daily,
      topPages,
      referrers,
      devices: { mobile, desktop },
      funnel,
      hourly,
    });
  } catch (e) {
    console.error("[analytics/visits]", e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
