import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";
import {
  bcCreateLockerShipment,
  bcCreateInternationalShipment,
  bcValuation,
  bcValuationInternational,
  INTL_COURIER_CANDIDATES,
  needsCustomsDocs,
  parsePickup,
  pickupOptions,
  type BcShipOptions,
} from "@/lib/basecourier";
import { syncOrderTracking } from "@/lib/inpostTracking";

// GET  /api/admin/orders/[id]/basecourier  — wycena + podglad danych, ktore
//                                            poleca do Base Courier (bez nadania)
// POST /api/admin/orders/[id]/basecourier  — NADANIE przesylki InPost Paczkomat
//                                            (kosztuje realne pieniadze na koncie
//                                            Base Courier). Zapisuje numer
//                                            sledzenia w zamowieniu i od razu
//                                            odpytuje InPost.
//
// Identyfikator zlecenia Base Courier trzymamy w istniejacych kolumnach
// furgonetka* (furgonetkaPackageId = blpaczka_order_id, furgonetkaStatus =
// "basecourier"), zeby nie dokladac kolejnych kolumn poza schema Prisma.

function receiverFromOrder(o: {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  pickupPoint: string;
  customerAddressStreet: string | null;
  customerAddressPostcode: string | null;
  customerAddressCity: string | null;
  customerCountry: string | null;
}) {
  return {
    name: o.customerName,
    email: o.customerEmail,
    phone: o.customerPhone,
    lockerCode: (o.pickupPoint || "").trim().toUpperCase(),
    street: o.customerAddressStreet || undefined,
    postal: o.customerAddressPostcode || undefined,
    city: o.customerAddressCity || undefined,
  };
}

type ReceiverBase = ReturnType<typeof receiverFromOrder>;
type EditableKey = "name" | "email" | "phone" | "street" | "postal" | "city";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Regula API Base Courier (odpowiedz walidacji 2026-09-25): "min. 9 cyfr,
// opcjonalny + na poczatku". Klient potrafi wpisac ucięty numer albo "+" w
// zlym miejscu — admin poprawia dane w panelu przed nadaniem.
const PHONE_RE = /^\+?\d{9,15}$/;

// Poprawki danych odbiorcy z panelu. patch = tylko pola, ktore faktycznie sie
// zmienily wzgledem zamowienia (uzywane do opcjonalnego zapisu w zamowieniu).
function applyReceiverEdits(
  base: ReceiverBase,
  raw: unknown,
  international: boolean
): { ok: true; receiver: ReceiverBase; patch: Partial<Record<EditableKey, string>> } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") return { ok: true, receiver: base, patch: {} };
  const r = raw as Record<string, unknown>;
  const next: ReceiverBase = { ...base };
  const patch: Partial<Record<EditableKey, string>> = {};
  const errors: string[] = [];

  const take = (key: EditableKey, label: string, max: number, validate?: (s: string) => string | null) => {
    const v = r[key];
    if (typeof v !== "string") return;
    let s = v.trim().replace(/\s+/g, " ");
    if (key === "phone") s = s.replace(/[\s\-().]/g, "");
    if (!s) return void errors.push(`${label}: pole nie może być puste.`);
    if (s.length > max) return void errors.push(`${label}: za długie.`);
    const problem = validate?.(s);
    if (problem) return void errors.push(`${label}: ${problem}`);
    if (s !== (base[key] ?? "")) {
      next[key] = s;
      patch[key] = s;
    }
  };

  take("name", "Imię i nazwisko", 100);
  take("email", "E-mail", 120, (s) => (EMAIL_RE.test(s) ? null : "nieprawidłowy adres."));
  take("phone", "Telefon", 20, (s) => (PHONE_RE.test(s) ? null : "min. 9 cyfr, opcjonalny + na początku, bez innych znaków."));
  if (international) {
    take("street", "Ulica", 150);
    take("postal", "Kod pocztowy", 20);
    take("city", "Miasto", 80);
  }
  if (errors.length) return { ok: false, error: errors.join(" ") };
  return { ok: true, receiver: next, patch };
}

function orderPatchFromReceiver(patch: Partial<Record<EditableKey, string>>) {
  return {
    ...(patch.name !== undefined ? { customerName: patch.name } : {}),
    ...(patch.email !== undefined ? { customerEmail: patch.email } : {}),
    ...(patch.phone !== undefined ? { customerPhone: patch.phone } : {}),
    ...(patch.street !== undefined ? { customerAddressStreet: patch.street } : {}),
    ...(patch.postal !== undefined ? { customerAddressPostcode: patch.postal } : {}),
    ...(patch.city !== undefined ? { customerAddressCity: patch.city } : {}),
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authErr = await requireAdminAuth(request); if (authErr) return authErr;
  const { id } = await params;
  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) return NextResponse.json({ ok: false, error: "Order not found" }, { status: 404 });

  const country = (order.customerCountry || "PL").toUpperCase();
  const isDomestic = country === "PL" || country === "";

  // Zamowienia zagraniczne (np. DE, US) nie jada InPost Paczkomatem — tylko
  // szacujemy koszt kilkoma kurierami Base Courier, bez mozliwosci nadania
  // z tego panelu (patrz POST nizej — zostaje ograniczone do PL). Admin i tak
  // widzi orientacyjna cene zeby wiedziec ile doliczyc / czy sie oplaca.
  if (!isDomestic) {
    try {
      const quotes = await bcValuationInternational(country);
      return NextResponse.json({
        ok: true,
        international: true,
        country,
        receiver: receiverFromOrder(order),
        quotes,
        pickup: pickupOptions(),
        // Poza UE: nadanie wymaga dokumentow celnych — wysylamy opcje "wersja
        // papierowa", a panel daje fakture do wydruku (customs-invoice/route.ts).
        needsCustomsDocs: needsCustomsDocs(country),
        customsDefaults: {
          value: order.amount / 100,
          currency: (order.currency || "eur").toUpperCase(),
          hsCode: "8470.10",
          origin: "PL",
        },
        alreadyCreated: order.furgonetkaStatus === "basecourier" ? order.furgonetkaPackageId : null,
        trackingNumber: order.trackingNumber,
      });
    } catch (e) {
      return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 502 });
    }
  }

  try {
    const valuation = await bcValuation();
    return NextResponse.json({
      ok: true,
      international: false,
      receiver: receiverFromOrder(order),
      valuation: { price: valuation.price, courierSearchId: valuation.courierSearchId },
      pickup: pickupOptions(),
      alreadyCreated: order.furgonetkaStatus === "basecourier" ? order.furgonetkaPackageId : null,
      trackingNumber: order.trackingNumber,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 502 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authErr = await requireAdminAuth(request); if (authErr) return authErr;
  const { id } = await params;
  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) return NextResponse.json({ ok: false, error: "Order not found" }, { status: 404 });

  if (order.furgonetkaStatus === "basecourier" && order.furgonetkaPackageId) {
    return NextResponse.json(
      { ok: false, error: `Przesylka Base Courier juz istnieje dla tego zamowienia (ID ${order.furgonetkaPackageId})` },
      { status: 409 }
    );
  }

  const country = (order.customerCountry || "PL").toUpperCase();
  const isDomestic = country === "PL" || country === "";

  // Body jest opcjonalny (krajowe nadanie dawniej go nie wysylalo):
  // { courierCode?, pickup?, receiver?, saveToOrder? }.
  // pickup = zamowienie podjazdu kuriera; bez niego admin sam nadaje paczke.
  // receiver = poprawki danych odbiorcy; saveToOrder = zapisz je tez w zamowieniu
  // (dopiero po udanym nadaniu).
  const body = await request.json().catch(() => ({} as Record<string, unknown>));
  const edited = applyReceiverEdits(receiverFromOrder(order), body?.receiver, !isDomestic);
  if (!edited.ok) return NextResponse.json({ ok: false, error: edited.error }, { status: 400 });
  const receiver = edited.receiver;
  const savedPatch = body?.saveToOrder === true ? edited.patch : {};
  const orderPatch = orderPatchFromReceiver(savedPatch);
  const shipOpts: BcShipOptions = {};
  if (body?.pickup) {
    const pk = parsePickup(body.pickup);
    if (!pk.ok) return NextResponse.json({ ok: false, error: pk.error }, { status: 400 });
    shipOpts.pickup = pk.pickup;
  }

  if (!isDomestic) {
    // Nadanie zagraniczne — admin wybiera kuriera z listy wycen zwroconej
    // przez GET (bcValuationInternational). Bez Paczkomatow, wiec wymagany
    // jest pelny adres drzwi-drzwi (mamy go z formularza zamowienia).
    // Poza UE zawsze wersja papierowa dokumentow celnych (inaczej API odrzuca).
    shipOpts.customsPaper = needsCustomsDocs(country);
    const courierCode = typeof body?.courierCode === "string" ? body.courierCode : "";
    if (!INTL_COURIER_CANDIDATES.some((c) => c.code === courierCode)) {
      return NextResponse.json(
        { ok: false, error: "Wybierz kuriera z listy wycen (courierCode) — nieznany lub brakujący kod." },
        { status: 400 }
      );
    }
    if (!receiver.street || !receiver.postal || !receiver.city) {
      return NextResponse.json(
        { ok: false, error: "Brak pelnego adresu odbiorcy (ulica/kod pocztowy/miasto) w zamowieniu — nie da sie nadac." },
        { status: 400 }
      );
    }

    try {
      const created = await bcCreateInternationalShipment(receiver, `KalkMate ${order.orderNumber}`, courierCode, country, shipOpts);
      console.log("[basecourier] created (intl)", id, courierCode, country, JSON.stringify(created.raw).slice(0, 2000));

      await prisma.order.update({
        where: { id },
        data: {
          furgonetkaPackageId: created.orderId ?? undefined,
          furgonetkaStatus: "basecourier",
          ...(created.trackingNumber ? { trackingNumber: created.trackingNumber } : {}),
          ...orderPatch,
        },
      });

      let trackingSync = null;
      if (created.trackingNumber) {
        try { trackingSync = await syncOrderTracking(id); } catch { /* kurier zagraniczny moze nie byc sledzony przez InPost */ }
      }

      return NextResponse.json({
        ok: true,
        basecourierOrderId: created.orderId,
        trackingNumber: created.trackingNumber,
        waybillLink: created.waybillLink,
        trackingSync,
        saved: savedPatch,
        raw: created.raw,
      });
    } catch (e) {
      console.error("[basecourier] create failed (intl)", id, e);
      return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 502 });
    }
  }

  if (!/^[A-Z]{3}\d{2,3}[A-Z0-9]*$/.test(receiver.lockerCode)) {
    return NextResponse.json({ ok: false, error: `Brak poprawnego kodu Paczkomatu w zamowieniu (pickupPoint="${order.pickupPoint}")` }, { status: 400 });
  }

  try {
    const created = await bcCreateLockerShipment(receiver, `KalkMate ${order.orderNumber}`, shipOpts);
    console.log("[basecourier] created", id, JSON.stringify(created.raw).slice(0, 2000));

    await prisma.order.update({
      where: { id },
      data: {
        furgonetkaPackageId: created.orderId ?? undefined,
        furgonetkaStatus: "basecourier",
        ...(created.trackingNumber ? { trackingNumber: created.trackingNumber } : {}),
        ...orderPatch,
      },
    });

    let trackingSync = null;
    if (created.trackingNumber) {
      try { trackingSync = await syncOrderTracking(id); } catch { /* InPost moze jeszcze nie znac numeru */ }
    }

    return NextResponse.json({
      ok: true,
      basecourierOrderId: created.orderId,
      trackingNumber: created.trackingNumber,
      waybillLink: created.waybillLink,
      saved: savedPatch,
      trackingSync,
      raw: created.raw,
    });
  } catch (e) {
    console.error("[basecourier] create failed", id, e);
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 502 });
  }
}
