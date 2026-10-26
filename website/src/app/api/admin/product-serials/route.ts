import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";
import {
  assignOrderSerials,
  getCounterState,
  getSerialsForOrders,
  parseSerial,
  setCounter,
  setUnitSerial,
  SERIAL_MAX,
} from "@/lib/productSerial";

// Numery seryjne etykiet produktowych — patrz lib/productSerial.ts.
//
// GET ?orderId=X        -> { last, maxAssigned, serials: [{ unitIndex, serial }] }
// GET ?orderIds=a,b,... -> { serials: { [orderId]: [{ unitIndex, serial }] } }  (lista zamowien)
// POST { action: "assign", orderId }                   -> przydziel brakujace SN (idempotentne)
// POST { action: "set", orderId, unitIndex, serial }   -> reczne nadpisanie SN sztuki (409 = duplikat)
// POST { action: "setCounter", last }                  -> zmiana "ostatni wydany SN"

const MAX_IDS = 200;

export async function GET(request: NextRequest) {
  const authErr = await requireAdminAuth(request); if (authErr) return authErr;
  const sp = request.nextUrl.searchParams;

  const idsParam = sp.get("orderIds");
  if (idsParam !== null) {
    const ids = [...new Set(idsParam.split(",").map((s) => s.trim()).filter(Boolean))].slice(0, MAX_IDS);
    return NextResponse.json({ serials: await getSerialsForOrders(ids) });
  }

  const orderId = sp.get("orderId")?.trim() || "";
  const state = await getCounterState();
  if (!orderId) return NextResponse.json({ ...state, serials: [] });
  const serials = (await getSerialsForOrders([orderId]))[orderId] || [];
  return NextResponse.json({ ...state, serials });
}

export async function POST(request: NextRequest) {
  const authErr = await requireAdminAuth(request); if (authErr) return authErr;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Nieprawidłowe dane" }, { status: 400 });
  }
  const action = body.action;

  if (action === "setCounter") {
    const raw = typeof body.last === "number" ? String(body.last) : typeof body.last === "string" ? body.last.trim() : "";
    if (!/^\d{1,6}$/.test(raw) || parseInt(raw, 10) > SERIAL_MAX) {
      return NextResponse.json({ error: "Ostatni numer seryjny musi być liczbą 0–999999." }, { status: 400 });
    }
    await setCounter(parseInt(raw, 10));
    return NextResponse.json(await getCounterState());
  }

  const orderId = typeof body.orderId === "string" ? body.orderId.trim() : "";
  if (!orderId) return NextResponse.json({ error: "Brak orderId" }, { status: 400 });
  const order = await prisma.order.findUnique({ where: { id: orderId }, select: { id: true } });
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  if (action === "assign") {
    try {
      const serials = await assignOrderSerials(orderId);
      return NextResponse.json({ ...(await getCounterState()), serials });
    } catch (e) {
      console.error("[admin/product-serials] assign failed:", e);
      return NextResponse.json({ error: "Nie udało się przydzielić numerów seryjnych — spróbuj ponownie." }, { status: 500 });
    }
  }

  if (action === "set") {
    const unitIndex = typeof body.unitIndex === "number" ? body.unitIndex : NaN;
    const serial = parseSerial(body.serial);
    if (serial === null) {
      return NextResponse.json({ error: "Numer seryjny musi być liczbą 1–999999 (np. 43 lub 06)." }, { status: 400 });
    }
    const r = await setUnitSerial(orderId, unitIndex, serial);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    return NextResponse.json({ ...(await getCounterState()), serials: r.serials });
  }

  return NextResponse.json({ error: "Nieznana akcja" }, { status: 400 });
}
