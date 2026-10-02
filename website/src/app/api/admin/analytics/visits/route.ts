import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";
import {
  CHANNEL_LABELS, type Channel, internalVisitIdsSince, landingVisitsSince, paidOrdersWithAttribution,
} from "@/lib/attribution";

type VisitRow = {
  id: string;
  ipHash: string;
  userAgent: string | null;
  referer: string | null;
  page: string;
  host: string | null;
  createdAt: Date;
};

// Normalizuje host do jednej z dwoch znanych domen — www./bez www. i wielkosc
// liter nie maja znaczenia. Starsze wpisy (sprzed dodania kolumny "host")
// maja host=null -> licza sie jako kalkmate.pl (caly ruch szedl tam, zanim
// istnialo kalkmate.eu).
function normalizeDomain(host: string | null): string {
  const h = (host || "").toLowerCase().replace(/^www\./, "");
  if (h === "kalkmate.eu") return "kalkmate.eu";
  return "kalkmate.pl";
}

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
  const authErr = await requireAdminAuth(request);
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
      select: { id: true, ipHash: true, userAgent: true, referer: true, page: true, host: true, createdAt: true },
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
    // Tylko wejscia na strone — przejscia wewnatrz (landing = 0) niosly ten sam
    // document.referrer i zawyzaly zrodla. Stare wpisy (bez kolumny) liczone jak dawniej.
    const internalIds = await internalVisitIdsSince(since.getTime());
    const refMap = new Map<string, number>();
    for (const v of visits) {
      if (internalIds.has(v.id)) continue;
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
    const funnelPages = ["/", "/koszyk", "/auth/signin", "/panel"];
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

    // ----------------------------------------------------------------
    // Podzial na domeny (kalkmate.pl vs kalkmate.eu) — patrz Visit.host
    // ----------------------------------------------------------------
    const domainMap = new Map<string, { views: number; ips: Set<string> }>();
    for (const v of visits) {
      const d = normalizeDomain(v.host);
      if (!domainMap.has(d)) domainMap.set(d, { views: 0, ips: new Set() });
      const entry = domainMap.get(d)!;
      entry.views++;
      entry.ips.add(v.ipHash);
    }
    const byDomain = Array.from(domainMap.entries())
      .map(([domain, d]) => ({ domain, views: d.views, unique: d.ips.size }))
      .sort((a, b) => b.views - a.views);

    // ----------------------------------------------------------------
    // Zrodla i sprzedaz (lib/attribution.ts): wejscia vs oplacone zamowienia
    // przypisane do OSTATNIEGO zrodla przed zakupem (last non-direct).
    // ----------------------------------------------------------------
    const landings = await landingVisitsSince(since.getTime());
    const orders = await paidOrdersWithAttribution(since.getTime());
    type Agg = { sessions: number; orders: number; pln: number; eur: number };
    const blank = (): Agg => ({ sessions: 0, orders: 0, pln: 0, eur: 0 });
    const byChannel = new Map<string, Agg>();
    const bySource = new Map<string, Agg & { channel: string; source: string }>();
    const byCampaign = new Map<string, Agg & { campaign: string; source: string }>();
    const bump = <T extends Agg>(m: Map<string, T>, key: string, init: () => T) => {
      if (!m.has(key)) m.set(key, init());
      return m.get(key)!;
    };
    for (const v of landings) {
      const ch = v.channel || "direct";
      bump(byChannel, ch, blank).sessions++;
      bump(bySource, `${ch}|${v.source}`, () => ({ ...blank(), channel: ch, source: v.source || "" })).sessions++;
      if (v.campaign) bump(byCampaign, `${v.campaign}|${v.source}`, () => ({ ...blank(), campaign: v.campaign!, source: v.source || "" })).sessions++;
    }
    let unattributed = 0;
    for (const o of orders) {
      if (!o.lastChannel) { unattributed++; continue; }
      const add = (a: Agg) => {
        a.orders++;
        if ((o.currency || "").toLowerCase() === "eur") a.eur += Number(o.amount); else a.pln += Number(o.amount);
      };
      add(bump(byChannel, o.lastChannel, blank));
      add(bump(bySource, `${o.lastChannel}|${o.lastSource}`, () => ({ ...blank(), channel: o.lastChannel!, source: o.lastSource || "" })));
      if (o.lastCampaign) add(bump(byCampaign, `${o.lastCampaign}|${o.lastSource}`, () => ({ ...blank(), campaign: o.lastCampaign!, source: o.lastSource || "" })));
    }
    const label = (c: string) => CHANNEL_LABELS[c as Channel] || c;
    const sortAgg = (a: Agg, b: Agg) => b.orders - a.orders || b.sessions - a.sessions;
    const sources = {
      channels: Array.from(byChannel.entries()).map(([channel, a]) => ({ channel, label: label(channel), ...a })).sort(sortAgg),
      top: Array.from(bySource.values()).map((a) => ({ ...a, label: label(a.channel) })).sort(sortAgg).slice(0, 20),
      campaigns: Array.from(byCampaign.values()).sort(sortAgg).slice(0, 20),
      totalOrders: orders.length,
      unattributed,
      trackedSessions: landings.length,
    };

    return NextResponse.json({
      sources,
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
      byDomain,
    });
  } catch (e) {
    console.error("[analytics/visits]", e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
