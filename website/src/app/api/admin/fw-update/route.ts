import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import {
  fwAdminOverview,
  startFwCampaign,
  stopFwCampaign,
  runFwUpdateNotices,
  isValidTargetVersion,
  FW_DEFAULT_TARGET,
  FW_DEFAULT_DURATION_DAYS,
  FW_DEFAULT_INTERVAL_DAYS,
} from "@/lib/fwUpdateNotice";

const DAY_MS = 24 * 60 * 60_000;
const MAX_DEADLINE_DAYS = 90;

// GET /api/admin/fw-update — flota wg wersji, nieaktualne urzadzenia, kampania
export async function GET(req: NextRequest) {
  const authErr = await requireAdminAuth(req); if (authErr) return authErr;
  try {
    return NextResponse.json({ ok: true, ...(await fwAdminOverview()) });
  } catch (e) {
    console.error("[admin/fw-update GET]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// deadline: ms (liczba) albo ISO string. null = niepoprawny.
function parseDeadline(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? Math.round(v) : null;
  if (typeof v === "string" && v.trim()) {
    const s = v.trim();
    const t = /^\d+$/.test(s) ? Number(s) : new Date(s).getTime();
    return Number.isFinite(t) ? Math.round(t) : null;
  }
  return null;
}

// POST /api/admin/fw-update
// Body: { action: "start" | "stop" | "send", targetVersion?, deadline?, intervalDays? }
//   start — nowa kampania (poprzednia aktywna sie konczy); TYLKO stad
//   stop  — konczy aktywna kampanie
//   send  — przebieg wysylki teraz (interwal i tak pilnowany w lib)
export async function POST(req: NextRequest) {
  const authErr = await requireAdminAuth(req); if (authErr) return authErr;
  try {
    const body = await req.json().catch(() => ({}));
    const action = body?.action;

    if (action === "start") {
      const targetVersion = body?.targetVersion == null || body.targetVersion === ""
        ? FW_DEFAULT_TARGET
        : String(body.targetVersion).trim();
      if (!isValidTargetVersion(targetVersion)) {
        return NextResponse.json({ ok: false, error: "Wersja docelowa w formacie X.Y.Z (np. 2.1.0)." }, { status: 400 });
      }

      const now = Date.now();
      let deadline: number;
      if (body?.deadline == null || body.deadline === "") {
        deadline = now + FW_DEFAULT_DURATION_DAYS * DAY_MS;
      } else {
        const d = parseDeadline(body.deadline);
        if (d == null) {
          return NextResponse.json({ ok: false, error: "Niepoprawny termin." }, { status: 400 });
        }
        deadline = d;
      }
      if (deadline <= now) {
        return NextResponse.json({ ok: false, error: "Termin musi być w przyszłości." }, { status: 400 });
      }
      if (deadline > now + MAX_DEADLINE_DAYS * DAY_MS) {
        return NextResponse.json({ ok: false, error: `Termin maks. ${MAX_DEADLINE_DAYS} dni od dziś.` }, { status: 400 });
      }

      let intervalDays = FW_DEFAULT_INTERVAL_DAYS;
      if (body?.intervalDays != null && body.intervalDays !== "") {
        const n = Number(body.intervalDays);
        if (!Number.isInteger(n) || n < 1 || n > 14) {
          return NextResponse.json({ ok: false, error: "Interwał: liczba całkowita 1..14 dni." }, { status: 400 });
        }
        intervalDays = n;
      }

      const campaign = await startFwCampaign({ targetVersion, deadline, intervalDays });
      console.log(`[admin/fw-update] campaign start ${campaign.id} target=${targetVersion} deadline=${new Date(deadline).toISOString()} interval=${intervalDays}d outdatedDevices=${campaign.outdatedDevices}`);
      return NextResponse.json({ ok: true, campaign, overview: await fwAdminOverview() });
    }

    if (action === "stop") {
      const stopped = await stopFwCampaign();
      console.log(`[admin/fw-update] campaign stop (${stopped})`);
      return NextResponse.json({ ok: true, stopped, overview: await fwAdminOverview() });
    }

    if (action === "send") {
      const result = await runFwUpdateNotices();
      console.log(`[admin/fw-update] manual send: sent=${result.sent.length} failed=${result.failed.length} due=${result.due} eligible=${result.eligible}`);
      return NextResponse.json({ ok: true, result, overview: await fwAdminOverview() });
    }

    return NextResponse.json({ ok: false, error: "Nieznana akcja (start | stop | send)." }, { status: 400 });
  } catch (e) {
    console.error("[admin/fw-update POST]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
