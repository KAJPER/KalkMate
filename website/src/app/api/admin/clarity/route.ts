import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { fetchAndStoreClaritySnapshot, getClarityTrends, CLARITY_CALLS_PER_SNAPSHOT } from "@/lib/clarity";

// GET  /api/admin/clarity?days=30 — dzienne snapshoty Clarity (ogolne + per urzadzenie)
//      + top URL-e z ostatniego snapshotu + stan limitu zapytan
// POST /api/admin/clarity[?force=1] — pobierz snapshot teraz (bez force pomija,
//      gdy snapshot na dzis juz jest). Kazde pobranie = 3 z 10 zapytan/dobe Clarity.
export async function GET(request: NextRequest) {
  const authErr = await requireAdminAuth(request); if (authErr) return authErr;
  const raw = parseInt(request.nextUrl.searchParams.get("days") || "30", 10);
  const days = Math.min(365, Math.max(1, Number.isFinite(raw) ? raw : 30));
  try {
    const trends = await getClarityTrends(days);
    return NextResponse.json({ ok: true, ...trends });
  } catch (e) {
    console.error("[api/admin/clarity] GET", e);
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const authErr = await requireAdminAuth(request); if (authErr) return authErr;
  const rl = rateLimit(`clarity:${clientIp(request)}`, 5, 60 * 60_000);
  if (!rl.ok) return NextResponse.json({ ok: false, error: "Za dużo prób w krótkim czasie." }, { status: 429 });

  const force = request.nextUrl.searchParams.get("force") === "1";
  try {
    const result = await fetchAndStoreClaritySnapshot({ force, trigger: "manual" });
    const q = result.quota;
    const quotaWarning =
      `Limit Clarity: 10 zapytań/dobę na projekt, jedno pobranie = ${CLARITY_CALLS_PER_SNAPSHOT}. ` +
      `Zużyte w ostatnich 24h (wg naszego licznika): ${q.callsLast24h}/${q.hardCap}.`;
    let message: string;
    switch (result.skipped) {
      case "exists":
        message = `Snapshot za ${result.day} już jest — nie pobieram (force=1 pobierze ponownie i zużyje ${CLARITY_CALLS_PER_SNAPSHOT} zapytania).`;
        break;
      case "not_configured":
        message = "Brak CLARITY_API_TOKEN na serwerze.";
        break;
      case "quota":
        message = "Wyczerpany budżet zapytań do Clarity na ostatnie 24h — spróbuj później.";
        break;
      case "running":
        message = "Pobieranie już trwa — odśwież za chwilę.";
        break;
      default:
        message = result.ok
          ? `Zapisano snapshot za ${result.day}${result.errors.length ? " (częściowo — patrz errors)" : ""}.`
          : `Nie udało się pobrać danych z Clarity: ${result.errors.join(" | ") || "nieznany błąd"}`;
    }
    const status = result.skipped === "quota" ? 429 : result.skipped === "not_configured" ? 503 : result.ok || result.skipped ? 200 : 502;
    return NextResponse.json({ ...result, message, quotaWarning }, { status });
  } catch (e) {
    console.error("[api/admin/clarity] POST", e);
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
