import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { randomBytes } from "crypto";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import {
  checkDeviceApiKey,
  normalizeDeviceId,
  loadDeviceAuthRow,
  hasStoredToken,
  matchDeviceToken,
  hashDeviceToken,
  isDeviceAuthStrict,
} from "@/lib/device-auth";
import { storeDeviceLogs } from "@/lib/deviceLog";

// POST /api/device/register
// Headers: x-api-key, x-device-token (wymagany gdy device ma token w DB),
//          x-factory-reset: 1 (opcjonalny, fw po resecie fabrycznym — K5)
// Body: { deviceId: string (12 hex), unlockCode: string, firmwareVersion?: string }
//
// Zabezpieczenia:
//  - Jeśli device ma token w DB i przysłał zły/brak x-device-token → 401
//  - Jeśli device jest sparowany (ma userId) → unlockCode NIE jest nadpisywany
//    (zapobiega przejęciu konta przez zmianę kodu odblokowującego)
//  - Nowy token (64 hex) dostaje tylko: nowy rekord albo NIESPAROWANY rekord
//    bez tokenu. Sparowany rekord bez tokenu (stary firmware) dostaje token
//    tylko w trybie przejsciowym (DEVICE_AUTH_STRICT !== "1") — z ostrzezeniem
//    w logu, bo wspolny x-api-key jest publiczny i to jest TOFU.
//  - x-factory-reset: 1 z WAZNYM tokenem → odpiecie od konta (userId=NULL),
//    licencja urzadzenia zostaje, unlockCode z zadania (jak niesparowane).
//  - rate limit per IP i per deviceId; lastIp z clientIp() (nie XFF[0]).
//  - lastSeen zapisywany przez Prisme (DateTime = INTEGER ms, jak reszta bazy;
//    wczesniej CURRENT_TIMESTAMP dawal TEXT).

const MAX_BODY_BYTES = 8192; // + pole "logs" (src/event_log.h, max ~3KB surowe + JSON-escape)
const FW_VERSION_RE = /^[0-9A-Za-z.+_-]{1,32}$/;

export async function POST(request: NextRequest) {
  try {
    if (!checkDeviceApiKey(request)) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const ip = clientIp(request);
    const rlIp = rateLimit(`devreg:ip:${ip}`, 60, 10 * 60_000);
    if (!rlIp.ok) {
      return NextResponse.json({ ok: false, error: "Too many requests" }, { status: 429 });
    }

    const len = Number(request.headers.get("content-length") || 0);
    if (len > MAX_BODY_BYTES) {
      return NextResponse.json({ ok: false, error: "Body too large" }, { status: 413 });
    }

    const body = await request.json().catch(() => null);
    const deviceId = normalizeDeviceId(body?.deviceId);
    const unlockCode = String(body?.unlockCode || "").trim();
    const fwRaw = body?.firmwareVersion ? String(body.firmwareVersion).trim() : "";

    if (!deviceId) {
      return NextResponse.json({ ok: false, error: "Bad deviceId" }, { status: 400 });
    }
    if (!unlockCode || unlockCode.length < 1 || unlockCode.length > 16) {
      return NextResponse.json({ ok: false, error: "Bad unlockCode" }, { status: 400 });
    }
    if (fwRaw && !FW_VERSION_RE.test(fwRaw)) {
      return NextResponse.json({ ok: false, error: "Bad firmwareVersion" }, { status: 400 });
    }
    const firmwareVersion = fwRaw || null;

    // Logi zdarzen z event_log.h — niekrytyczne, nie blokuja rejestracji
    // przy bledzie zapisu (urzadzenie i tak czysci swoj bufor dopiero po 200).
    if (typeof body?.logs === "string" && body.logs) {
      storeDeviceLogs(deviceId, body.logs).catch((e) => console.error("[device/register] storeDeviceLogs fail:", e));
    }

    const rlDev = rateLimit(`devreg:dev:${deviceId}`, 10, 10 * 60_000);
    if (!rlDev.ok) {
      return NextResponse.json({ ok: false, error: "Too many requests" }, { status: 429 });
    }

    const incomingToken = request.headers.get("x-device-token")?.trim() || null;
    const factoryReset = request.headers.get("x-factory-reset") === "1";

    const row = await loadDeviceAuthRow(deviceId);

    if (row) {
      const tokenStored = hasStoredToken(row);

      // Urządzenie ma token w DB — weryfikacja obowiązkowa
      if (tokenStored && !(await matchDeviceToken(deviceId, incomingToken, row))) {
        return NextResponse.json(
          { ok: false, error: "Invalid device token" },
          { status: 401 }
        );
      }

      let assignedToken: string;
      if (tokenStored) {
        // Token zweryfikowany wyzej — przyslany == zapisany.
        assignedToken = incomingToken as string;
      } else if (row.userId) {
        if (isDeviceAuthStrict()) {
          console.warn(`[device/register] odmowa: sparowane urzadzenie ${deviceId} bez tokenu (strict)`);
          return NextResponse.json(
            { ok: false, error: "Device token required" },
            { status: 403 }
          );
        }
        console.warn(
          `[device/register] TRYB PRZEJSCIOWY: nadaje token sparowanemu urzadzeniu ${deviceId} bez tokenu (ip=${ip})`
        );
        assignedToken = randomBytes(32).toString("hex");
      } else {
        assignedToken = randomBytes(32).toString("hex");
      }

      // K5: reset fabryczny tylko z WAZNYM tokenem (inaczej kazdy z publicznym
      // api key moglby odpinac cudze urzadzenia).
      const doFactoryReset = factoryReset && tokenStored;
      if (factoryReset && !tokenStored) {
        console.warn(`[device/register] x-factory-reset bez tokenu w DB — ignoruje (${deviceId})`);
      }

      const data: {
        lastSeen: Date;
        firmwareVersion?: string;
        lastIp: string;
        deviceToken: string;
        unlockCode?: string;
        userId?: null;
      } = {
        lastSeen: new Date(),
        firmwareVersion: firmwareVersion ?? undefined,
        lastIp: ip,
        deviceToken: assignedToken,
      };
      if (doFactoryReset) {
        data.userId = null;
        data.unlockCode = unlockCode;
        console.log(`[device/register] factory reset: odpinam ${deviceId} od konta ${row.userId ?? "-"}`);
      } else if (!row.userId) {
        // Niesparowane: może aktualizować swój kod odblokowujący
        data.unlockCode = unlockCode;
      }
      // Sparowane urządzenie: nie nadpisuj unlockCode (H2)

      await prisma.device.update({ where: { deviceId }, data });
      await prisma.$executeRaw`
        UPDATE "Device" SET "deviceTokenHash" = ${hashDeviceToken(assignedToken)} WHERE "deviceId" = ${deviceId}
      `;

      // factoryReset: czy odpiecie zostalo wykonane (firmware moze na tej
      // podstawie skasowac flage "reset do potwierdzenia" — tylko gdy true).
      return NextResponse.json(
        factoryReset
          ? { ok: true, deviceToken: assignedToken, factoryReset: doFactoryReset }
          : { ok: true, deviceToken: assignedToken }
      );
    }

    // Nowe urządzenie
    const deviceToken = randomBytes(32).toString("hex");
    try {
      await prisma.device.create({
        data: {
          deviceId,
          unlockCode,
          firmwareVersion,
          lastIp: ip,
          deviceToken,
        },
      });
    } catch (e) {
      if ((e as { code?: string })?.code === "P2002") {
        // Wyscig: rekord powstal rownolegle — urzadzenie sprobuje ponownie.
        return NextResponse.json({ ok: false, error: "Retry" }, { status: 409 });
      }
      throw e;
    }
    await prisma.$executeRaw`
      UPDATE "Device" SET "deviceTokenHash" = ${hashDeviceToken(deviceToken)} WHERE "deviceId" = ${deviceId}
    `;

    return NextResponse.json(
      factoryReset ? { ok: true, deviceToken, factoryReset: true } : { ok: true, deviceToken }
    );
  } catch (e) {
    console.error("[device/register]", e);
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}
