import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";
import { CHANNEL_LABELS, type Channel, paidOrdersWithAttribution } from "@/lib/attribution";
import { cachedStats, lastWarsawDays, warsawDayStartMs, warsawOffsetMs } from "../../_lib/stats";

// Agregacja w SQL (GROUP BY) zamiast findMany calej tabeli Visit do pamieci —
// przy 365 dniach to byly setki tysiecy wierszy na kazde odswiezenie panelu.
// Dni i godziny w strefie Europe/Warsaw (Visit.createdAt = INTEGER ms UTC,
// patrz lib/attribution.ts recordVisit). Wynik w cache 60 s per ?days.

const MAX_DAYS = 365;

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

const n = (v: number | bigint | null | undefined) => Number(v ?? 0);

// Przesuniecie czasu warszawskiego (ms) jako wyrazenie SQL na "createdAt":
// odcinki miedzy zmianami czasu w badanym okresie (zmiany sa na pelnych
// godzinach, wiec szukamy ich z dokladnoscia do godziny).
function warsawOffsetSql(fromMs: number, toMs: number): string {
  const offsetAt = (ms: number) => Math.round(warsawOffsetMs(ms) / 3_600_000) * 3_600_000;
  const HOUR = 3_600_000;
  const segments: { until: number; offset: number }[] = [];
  let cur = offsetAt(fromMs);
  for (let t = fromMs; t < toMs; t += 24 * HOUR) {
    const next = Math.min(t + 24 * HOUR, toMs);
    const o = offsetAt(next);
    if (o !== cur) {
      // binarnie po godzinach w obrebie tej doby
      let lo = Math.floor(t / HOUR), hi = Math.ceil(next / HOUR);
      while (hi - lo > 1) {
        const mid = Math.floor((lo + hi) / 2);
        if (offsetAt(mid * HOUR) === cur) lo = mid; else hi = mid;
      }
      segments.push({ until: hi * HOUR, offset: cur });
      cur = o;
    }
  }
  if (!segments.length) return String(cur);
  const whens = segments.map((s) => `WHEN "createdAt" < ${Math.trunc(s.until)} THEN ${Math.trunc(s.offset)}`).join(" ");
  return `(CASE ${whens} ELSE ${Math.trunc(cur)} END)`;
}

async function visitHasColumn(name: string): Promise<boolean> {
  const cols = await prisma.$queryRawUnsafe<{ name: string }[]>(`PRAGMA table_info("Visit")`);
  return cols.some((c) => c.name === name);
}

async function computeVisits(days: number) {
  const now = Date.now();
  const dayKeys = lastWarsawDays(days, now);
  const sinceMs = warsawDayStartMs(dayKeys[0]);
  const todayKey = dayKeys[dayKeys.length - 1];
  const yesterdayKey = lastWarsawDays(2, now)[0];

  const off = warsawOffsetSql(sinceMs, now + 3_600_000);
  const localSec = `(("createdAt" + ${off}) / 1000)`;
  const hasLanding = await visitHasColumn("landing");
  const hasChannel = hasLanding && (await visitHasColumn("channel"));

  const [overviewRows, dailyRows, hourRows, pageRows, refRows, deviceRows, domainRows, channelRows] = await Promise.all([
    prisma.$queryRawUnsafe<{ views: bigint; uniq: bigint }[]>(
      `SELECT COUNT(*) AS views, COUNT(DISTINCT "ipHash") AS uniq FROM "Visit" WHERE "createdAt" >= ?`, sinceMs),
    prisma.$queryRawUnsafe<{ day: string; views: bigint; uniq: bigint }[]>(
      `SELECT strftime('%Y-%m-%d', ${localSec}, 'unixepoch') AS day, COUNT(*) AS views, COUNT(DISTINCT "ipHash") AS uniq
       FROM "Visit" WHERE "createdAt" >= ? GROUP BY day`, sinceMs),
    prisma.$queryRawUnsafe<{ h: bigint | number; cnt: bigint }[]>(
      `SELECT CAST(strftime('%H', ${localSec}, 'unixepoch') AS INTEGER) AS h, COUNT(*) AS cnt
       FROM "Visit" WHERE "createdAt" >= ? GROUP BY h`, sinceMs),
    prisma.$queryRawUnsafe<{ page: string; views: bigint }[]>(
      `SELECT "page" AS page, COUNT(*) AS views FROM "Visit" WHERE "createdAt" >= ?
       GROUP BY "page" ORDER BY views DESC LIMIT 15`, sinceMs),
    // Tylko wejscia na strone — przejscia wewnatrz (landing = 0) niosly ten sam
    // document.referrer i zawyzaly zrodla. Stare wpisy (bez kolumny / NULL) liczone jak dawniej.
    prisma.$queryRawUnsafe<{ referer: string | null; cnt: bigint }[]>(
      `SELECT "referer" AS referer, COUNT(*) AS cnt FROM "Visit" WHERE "createdAt" >= ?
       ${hasLanding ? `AND COALESCE("landing", 1) <> 0` : ""} GROUP BY "referer"`, sinceMs),
    prisma.$queryRawUnsafe<{ mobile: bigint | null; total: bigint }[]>(
      `SELECT SUM(CASE WHEN "userAgent" LIKE '%Mobi%' OR "userAgent" LIKE '%Android%' OR "userAgent" LIKE '%iPhone%'
                     OR "userAgent" LIKE '%iPad%' OR "userAgent" LIKE '%iPod%' OR "userAgent" LIKE '%BlackBerry%'
                     OR "userAgent" LIKE '%Opera Mini%' THEN 1 ELSE 0 END) AS mobile,
              COUNT(*) AS total
       FROM "Visit" WHERE "createdAt" >= ?`, sinceMs),
    // Podzial na domeny (kalkmate.pl vs kalkmate.eu). Host NULL (stare wpisy) = kalkmate.pl.
    prisma.$queryRawUnsafe<{ domain: string; views: bigint; uniq: bigint }[]>(
      `SELECT CASE WHEN lower(COALESCE("host", '')) IN ('kalkmate.eu', 'www.kalkmate.eu') THEN 'kalkmate.eu' ELSE 'kalkmate.pl' END AS domain,
              COUNT(*) AS views, COUNT(DISTINCT "ipHash") AS uniq
       FROM "Visit" WHERE "createdAt" >= ? GROUP BY domain ORDER BY views DESC`, sinceMs),
    hasChannel
      ? prisma.$queryRawUnsafe<{ channel: string; source: string | null; campaign: string | null; sessions: bigint }[]>(
          `SELECT "channel" AS channel, "source" AS source, "campaign" AS campaign, COUNT(*) AS sessions
           FROM "Visit" WHERE "landing" = 1 AND "channel" IS NOT NULL AND "createdAt" >= ?
           GROUP BY "channel", "source", "campaign"`, sinceMs)
      : Promise.resolve([] as { channel: string; source: string | null; campaign: string | null; sessions: bigint }[]),
  ]);

  // Metryki ogolne
  const totalViews = n(overviewRows[0]?.views);
  const uniqueVisitors = n(overviewRows[0]?.uniq);

  // Wykres dzienny (brakujace dni = 0)
  const dailyMap = new Map(dailyRows.map((r) => [r.day, { views: n(r.views), unique: n(r.uniq) }]));
  const daily = dayKeys.map((date) => ({ date, views: dailyMap.get(date)?.views ?? 0, unique: dailyMap.get(date)?.unique ?? 0 }));
  const todayViews = dailyMap.get(todayKey)?.views ?? 0;
  const todayUnique = dailyMap.get(todayKey)?.unique ?? 0;
  const yesterdayViews = days >= 2 ? (dailyMap.get(yesterdayKey)?.views ?? 0) : 0;

  // Top strony
  const topPages = pageRows.map((r) => ({ page: r.page, views: n(r.views) }));

  // Zrodla ruchu (grupowanie po ladnej nazwie w JS — po GROUP BY referer)
  const refMap = new Map<string, number>();
  for (const r of refRows) {
    const src = cleanReferer(r.referer);
    refMap.set(src, (refMap.get(src) ?? 0) + n(r.cnt));
  }
  const referrers = Array.from(refMap.entries())
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Urzadzenia
  const mobile = n(deviceRows[0]?.mobile);
  const desktop = n(deviceRows[0]?.total) - mobile;

  // Lejek konwersji (kluczowe strony)
  const funnelPages = ["/", "/koszyk", "/auth/signin", "/panel"];
  const funnel = await Promise.all(
    funnelPages.map(async (page) => {
      const prefix = `${page}?`;
      const rows = await prisma.$queryRawUnsafe<{ views: bigint; uniq: bigint }[]>(
        `SELECT COUNT(*) AS views, COUNT(DISTINCT "ipHash") AS uniq FROM "Visit"
         WHERE "createdAt" >= ? AND ("page" = ? OR substr("page", 1, ?) = ?)`,
        sinceMs, page, prefix.length, prefix);
      return { page, views: n(rows[0]?.views), unique: n(rows[0]?.uniq) };
    })
  );

  // Godziny aktywnosci (0-23, czas warszawski)
  const hourMap = new Array(24).fill(0);
  for (const r of hourRows) {
    const h = Number(r.h);
    if (h >= 0 && h < 24) hourMap[h] += n(r.cnt);
  }
  const hourly = hourMap.map((count, hour) => ({ hour, count }));

  const byDomain = domainRows.map((r) => ({ domain: r.domain, views: n(r.views), unique: n(r.uniq) }));

  // ----------------------------------------------------------------
  // Zrodla i sprzedaz (lib/attribution.ts): wejscia vs oplacone zamowienia
  // przypisane do OSTATNIEGO zrodla przed zakupem (last non-direct).
  // ----------------------------------------------------------------
  const orders = await paidOrdersWithAttribution(sinceMs);
  type Agg = { sessions: number; orders: number; pln: number; eur: number };
  const blank = (): Agg => ({ sessions: 0, orders: 0, pln: 0, eur: 0 });
  const byChannel = new Map<string, Agg>();
  const bySource = new Map<string, Agg & { channel: string; source: string }>();
  const byCampaign = new Map<string, Agg & { campaign: string; source: string }>();
  const bump = <T extends Agg>(m: Map<string, T>, key: string, init: () => T) => {
    if (!m.has(key)) m.set(key, init());
    return m.get(key)!;
  };
  let trackedSessions = 0;
  for (const v of channelRows) {
    const ch = v.channel || "direct";
    const cnt = n(v.sessions);
    trackedSessions += cnt;
    bump(byChannel, ch, blank).sessions += cnt;
    bump(bySource, `${ch}|${v.source}`, () => ({ ...blank(), channel: ch, source: v.source || "" })).sessions += cnt;
    if (v.campaign) bump(byCampaign, `${v.campaign}|${v.source}`, () => ({ ...blank(), campaign: v.campaign!, source: v.source || "" })).sessions += cnt;
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
    trackedSessions,
  };

  return {
    sources,
    period: { days, since: new Date(sinceMs).toISOString(), timezone: "Europe/Warsaw" },
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
  };
}

export async function GET(request: NextRequest) {
  const authErr = await requireAdminAuth(request);
  if (authErr) return authErr;

  try {
    const url = new URL(request.url);
    // NaN / <1 -> 30, max 365
    const parsed = parseInt(url.searchParams.get("days") || "30", 10);
    const days = Number.isFinite(parsed) && parsed >= 1 ? Math.min(parsed, MAX_DAYS) : 30;
    return NextResponse.json(await cachedStats(`visits:${days}`, () => computeVisits(days)));
  } catch (e) {
    console.error("[analytics/visits]", e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
