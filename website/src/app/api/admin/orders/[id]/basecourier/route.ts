import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";
import {
  bcCreateLockerShipment,
  bcCreateInternationalShipment,
  bcValuation,
  bcValuationInternational,
  INTL_COURIER_CANDIDATES,
  kalkmateParcel,
  needsCustomsDocs,
  needsStateCode,
  isValidStateCode,
  parsePickup,
  pickupOptions,
  isBcRejected,
  BC_PENDING_STATUS,
  BC_UNCERTAIN_NOTE,
  type BcShipOptions,
  type BcCreatedShipment,
} from "@/lib/basecourier";
import { syncOrderTracking, appendOrderNoteOnce } from "@/lib/inpostTracking";
import { ensureLabelEmail } from "@/lib/orderFulfillment";
import { receiverFromOrder, applyReceiverEdits, orderPatchFromReceiver, savedForClient } from "@/lib/basecourierReceiver";
import { customsGoodsValue } from "@/lib/customsInvoice";
import { readOrderUnits } from "@/lib/orderPersonalization";

// Liczba sztuk zamowienia (jedna paczka) — blad odczytu = 1 (stare zamowienia).
async function orderQuantity(orderId: string): Promise<number> {
  const u = await readOrderUnits(orderId).catch(() => null);
  const q = Math.floor(Number(u?.quantity));
  return Number.isFinite(q) && q >= 1 ? q : 1;
}

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
//
// furgonetkaStatus = "basecourier_pending" — nadanie w toku albo NIEPEWNE
// (blad/timeout po wyslaniu zlecenia: paczka mogla zostac utworzona i
// oplacona). Ustawiane atomowo PRZED wywolaniem API kuriera, wiec dwa
// klikniecia / dwie karty nie nadadza dwoch paczek. Ponowne nadanie z tego
// stanu tylko z { confirmUncertainRetry: true } (admin sprawdzil panel Base
// Courier); jesli zlecenie tam jest — "Powiaz zlecenie" (link/route.ts).
//
// Wynik nadania (lib/basecourier.ts):
//   BcRejectedError  — API PEWNIE odrzucilo zadanie (walidacja itp.) albo
//                      zadanie nie zostalo wyslane: zwalniamy stan pending
//                      (przywracamy poprzedni), 422 — admin poprawia dane i ponawia.
//   kazdy inny blad  — NIEPEWNE: pending zostaje, notatka, 502.

const PENDING = BC_PENDING_STATUS;
const NO_SHIP_FULFILLMENT = ["cancelled", "shipped", "fulfilled"];
const UNCERTAIN_NOTE = BC_UNCERTAIN_NOTE;

type OrderRow = NonNullable<Awaited<ReturnType<typeof prisma.order.findUnique>>>;

// Straznik serwera: anulowane (zwrot), juz wyslane, z numerem/ID przesylki
// albo z niepewnym nadaniem — bez wolania platnego API.
function shipmentGuard(order: OrderRow, confirmUncertainRetry: boolean): NextResponse | null {
  const fs = order.fulfillmentStatus || "unfulfilled";
  if (fs === "cancelled") {
    return NextResponse.json({ ok: false, error: "Zamowienie anulowane (pieniadze zwrocone) — nie nadajemy przesylki." }, { status: 409 });
  }
  if (fs === "shipped" || fs === "fulfilled") {
    return NextResponse.json({ ok: false, error: "Zamowienie jest juz wyslane/zrealizowane — nie nadajemy drugiej przesylki." }, { status: 409 });
  }
  if (order.furgonetkaStatus === "basecourier") {
    return NextResponse.json(
      { ok: false, error: `Przesylka Base Courier juz istnieje dla tego zamowienia${order.furgonetkaPackageId ? ` (ID ${order.furgonetkaPackageId})` : ""}` },
      { status: 409 }
    );
  }
  if (order.furgonetkaStatus === PENDING && !confirmUncertainRetry) {
    return NextResponse.json(
      {
        ok: false,
        uncertain: true,
        error:
          "Poprzednie nadanie jest w toku albo zakonczylo sie NIEPEWNIE — paczka mogla zostac utworzona i oplacona. " +
          "Sprawdz panel Base Courier: jesli zlecenie istnieje, uzyj 'Powiaz zlecenie'; jesli na pewno go nie ma, ponow nadanie z potwierdzeniem.",
        adminNotes: order.adminNotes || "",
      },
      { status: 409 }
    );
  }
  if ((order.trackingNumber || "").trim()) {
    return NextResponse.json(
      { ok: false, error: `Zamowienie ma juz numer przesylki (${order.trackingNumber}) — jesli to pomylka, najpierw go wyczysc.` },
      { status: 409 }
    );
  }
  if (order.furgonetkaPackageId) {
    return NextResponse.json({ ok: false, error: `Zamowienie ma juz zapisane ID przesylki (${order.furgonetkaPackageId}).` }, { status: 409 });
  }
  return null;
}

// Nadania w toku w TYM procesie. Zajecie w bazie (claimShipment) nie chroni
// przed dwoma rownoczesnymi "ponow z potwierdzeniem" (oba widza pending i oba
// je "zajmuja") — ten zamek tak (serwer to jeden proces pm2).
const inFlight = new Set<string>();

// Atomowe zajecie zamowienia przed wywolaniem API kuriera.
async function claimShipment(id: string, confirmUncertainRetry: boolean): Promise<boolean> {
  const r = await prisma.order.updateMany({
    where: {
      id,
      fulfillmentStatus: { notIn: NO_SHIP_FULFILLMENT },
      AND: [
        { OR: [{ trackingNumber: null }, { trackingNumber: "" }] },
        { OR: [{ furgonetkaPackageId: null }, { furgonetkaPackageId: "" }] },
        { OR: [{ furgonetkaStatus: null }, { furgonetkaStatus: { notIn: confirmUncertainRetry ? ["basecourier"] : ["basecourier", PENDING] } }] },
      ],
    },
    data: { furgonetkaStatus: PENDING },
  });
  return r.count === 1;
}

// Blad/timeout po zajeciu: NIE zwalniamy stanu pending — paczka mogla powstac.
// Notatka dopisywana atomowo w SQL (dawniej read-modify-write gubil notatke
// admina zapisana w tym samym czasie).
async function markUncertain(id: string, e: unknown): Promise<string> {
  const msg = e instanceof Error ? e.message : String(e);
  const line = `${UNCERTAIN_NOTE} ${new Date().toISOString()}: ${msg}`.slice(0, 1000);
  try {
    await prisma.order.update({ where: { id }, data: { furgonetkaStatus: PENDING } });
    await appendOrderNoteOnce(id, line);
    const cur = await prisma.order.findUnique({ where: { id }, select: { adminNotes: true } });
    return cur?.adminNotes || line;
  } catch (dbErr) {
    console.error("[basecourier] nie udalo sie zapisac notatki o niepewnym nadaniu", id, dbErr);
    return line;
  }
}

// Pewne odrzucenie przez API: zlecenie NIE powstalo — oddajemy zamowienie do
// ponownego nadania, przywracajac stan sprzed zajecia (null albo — przy
// swiadomym ponowieniu — poprzedni "basecourier_pending" z niepewnej proby,
// ktorej wynik nadal jest nieznany). Warunkowo: tylko jesli nadal jest nasz pending.
async function releaseClaim(id: string, previousStatus: string | null): Promise<void> {
  try {
    await prisma.order.updateMany({
      where: { id, furgonetkaStatus: PENDING },
      data: { furgonetkaStatus: previousStatus },
    });
  } catch (dbErr) {
    console.error("[basecourier] nie udalo sie zwolnic stanu pending", id, dbErr);
  }
}

// Wspolna obsluga nadania (krajowe i zagraniczne) po udanym zajeciu.
async function runCreate(
  id: string,
  previousStatus: string | null,
  orderPatch: Record<string, unknown>,
  create: () => Promise<BcCreatedShipment>,
  logTag: string
): Promise<{ ok: true; created: BcCreatedShipment; emailSent: boolean } | { ok: false; response: NextResponse }> {
  let created: BcCreatedShipment;
  try {
    created = await create();
  } catch (e) {
    if (isBcRejected(e)) {
      console.warn(`[basecourier] ${logTag} rejected`, id, e.message);
      await releaseClaim(id, previousStatus);
      return {
        ok: false,
        response: NextResponse.json(
          { ok: false, rejected: true, uncertain: false, error: `Base Courier odrzucil nadanie (nic nie utworzono): ${e.message}` },
          { status: 422 }
        ),
      };
    }
    console.error(`[basecourier] ${logTag} failed (uncertain)`, id, e);
    const adminNotes = await markUncertain(id, e);
    return { ok: false, response: NextResponse.json({ ok: false, uncertain: true, error: (e as Error).message, adminNotes }, { status: 502 }) };
  }
  console.log(`[basecourier] created ${logTag}`, id, JSON.stringify(created.raw).slice(0, 2000));

  // Paczka JEST utworzona i oplacona — blad zapisu w bazie nie moze tego zgubic.
  try {
    await prisma.order.update({
      where: { id },
      data: {
        furgonetkaPackageId: created.orderId ?? undefined,
        furgonetkaStatus: "basecourier",
        ...(created.trackingNumber ? { trackingNumber: created.trackingNumber } : {}),
        ...orderPatch,
      },
    });
  } catch (dbErr) {
    console.error(`[basecourier] ${logTag} created but DB save failed`, id, dbErr);
    const adminNotes = await markUncertain(
      id,
      new Error(`paczka UTWORZONA (ID ${created.orderId ?? "?"}, list ${created.trackingNumber ?? "?"}), ale zapis w bazie sie nie udal — uzyj 'Powiaz zlecenie'`)
    );
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, uncertain: true, error: `Paczka utworzona (ID ${created.orderId ?? "?"}), ale nie zapisano jej w zamowieniu — uzyj 'Powiaz zlecenie'.`, adminNotes },
        { status: 502 }
      ),
    };
  }
  // Mail do klienta "Pakujemy i wysylamy" z numerem — blad maila nie psuje nadania.
  let emailSent = false;
  try { emailSent = await ensureLabelEmail(id); } catch (e) { console.error(`[basecourier] ${logTag} label email failed`, id, e); }
  return { ok: true, created, emailSent };
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
  const quantity = await orderQuantity(order.id);
  const parcel = kalkmateParcel(quantity);

  // Zamowienia zagraniczne (np. DE, US) nie jada InPost Paczkomatem — tylko
  // szacujemy koszt kilkoma kurierami Base Courier, bez mozliwosci nadania
  // z tego panelu (patrz POST nizej — zostaje ograniczone do PL). Admin i tak
  // widzi orientacyjna cene zeby wiedziec ile doliczyc / czy sie oplaca.
  if (!isDomestic) {
    try {
      const quotes = await bcValuationInternational(country, quantity);
      return NextResponse.json({
        ok: true,
        international: true,
        country,
        quantity,
        parcel,
        receiver: receiverFromOrder(order),
        quotes,
        needsState: needsStateCode(country),
        pickup: pickupOptions(),
        // Poza UE: nadanie wymaga dokumentow celnych — wysylamy opcje "wersja
        // papierowa", a panel daje fakture do wydruku (customs-invoice/route.ts).
        needsCustomsDocs: needsCustomsDocs(country),
        customsDefaults: {
          // Wartosc TOWARU (bez oplaty za wysylke) — Karta odprawy UPS deklaruje
          // "koszt transportu NIE wliczony w cene towaru".
          value: customsGoodsValue(order),
          quantity,
          currency: (order.currency || "eur").toUpperCase(),
          hsCode: "8470.10",
          origin: "PL",
        },
        alreadyCreated: order.furgonetkaStatus === "basecourier" ? order.furgonetkaPackageId : null,
        pending: order.furgonetkaStatus === PENDING,
        trackingNumber: order.trackingNumber,
      });
    } catch (e) {
      return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 502 });
    }
  }

  try {
    const valuation = await bcValuation(quantity);
    return NextResponse.json({
      ok: true,
      international: false,
      quantity,
      parcel,
      receiver: receiverFromOrder(order),
      valuation: { price: valuation.price, courierSearchId: valuation.courierSearchId },
      pickup: pickupOptions(),
      alreadyCreated: order.furgonetkaStatus === "basecourier" ? order.furgonetkaPackageId : null,
      pending: order.furgonetkaStatus === PENDING,
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
  if (inFlight.has(id)) {
    return NextResponse.json(
      { ok: false, uncertain: true, error: "Nadanie tego zamówienia jest właśnie w toku (inna karta / podwójne kliknięcie) — poczekaj na wynik i odśwież stronę." },
      { status: 409 }
    );
  }
  inFlight.add(id);
  try {
    return await createShipment(request, id);
  } finally {
    inFlight.delete(id);
  }
}

async function createShipment(request: NextRequest, id: string): Promise<NextResponse> {
  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) return NextResponse.json({ ok: false, error: "Order not found" }, { status: 404 });

  // Body jest opcjonalny (krajowe nadanie dawniej go nie wysylalo):
  // { courierCode?, pickup?, receiver?, saveToOrder?, confirmUncertainRetry? }.
  // pickup = zamowienie podjazdu kuriera; bez niego admin sam nadaje paczke.
  // receiver = poprawki danych odbiorcy; saveToOrder = zapisz je tez w zamowieniu
  // (dopiero po udanym nadaniu).
  const body = await request.json().catch(() => ({} as Record<string, unknown>));
  const confirmUncertainRetry = body?.confirmUncertainRetry === true;

  const guard = shipmentGuard(order, confirmUncertainRetry);
  if (guard) return guard;

  const country = (order.customerCountry || "PL").toUpperCase();
  const isDomestic = country === "PL" || country === "";

  const edited = applyReceiverEdits(receiverFromOrder(order), body?.receiver, !isDomestic, country);
  if (!edited.ok) return NextResponse.json({ ok: false, error: edited.error }, { status: 400 });
  const receiver = edited.receiver;
  const savedPatch = body?.saveToOrder === true ? edited.patch : {};
  const orderPatch = orderPatchFromReceiver(savedPatch, receiver);
  const shipOpts: BcShipOptions = { quantity: await orderQuantity(order.id) };
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
    if (needsStateCode(country) && !isValidStateCode(country, receiver.state || "")) {
      return NextResponse.json(
        { ok: false, error: "Podaj kod stanu odbiorcy (np. NY, CA, TX) — UPS wymaga go dla USA i Kanady." },
        { status: 400 }
      );
    }
    if (!receiver.street || !receiver.postal || !receiver.city) {
      return NextResponse.json(
        { ok: false, error: "Brak pelnego adresu odbiorcy (ulica/kod pocztowy/miasto) w zamowieniu — nie da sie nadac." },
        { status: 400 }
      );
    }

    if (!(await claimShipment(id, confirmUncertainRetry))) {
      return NextResponse.json({ ok: false, error: "Stan zamowienia zmienil sie w miedzyczasie (rownolegle nadanie?) — odswiez strone." }, { status: 409 });
    }
    const r = await runCreate(
      id,
      order.furgonetkaStatus,
      orderPatch,
      () => bcCreateInternationalShipment(receiver, `KalkMate ${order.orderNumber}`, courierCode, country, shipOpts),
      `(intl ${courierCode} ${country})`
    );
    if (!r.ok) return r.response;
    const created = r.created;

    let trackingSync = null;
    if (created.trackingNumber) {
      try { trackingSync = await syncOrderTracking(id); } catch { /* kurier zagraniczny moze nie byc sledzony przez InPost */ }
    }

    return NextResponse.json({
      ok: true,
      basecourierOrderId: created.orderId,
      trackingNumber: created.trackingNumber,
      waybillLink: created.waybillLink,
      emailSent: r.emailSent,
      trackingSync,
      saved: savedForClient(savedPatch, receiver),
      raw: created.raw,
    });
  }

  if (!/^[A-Z]{3}\d{2,3}[A-Z0-9]*$/.test(receiver.lockerCode)) {
    return NextResponse.json({ ok: false, error: `Brak poprawnego kodu Paczkomatu w zamowieniu (pickupPoint="${order.pickupPoint}")` }, { status: 400 });
  }

  if (!(await claimShipment(id, confirmUncertainRetry))) {
    return NextResponse.json({ ok: false, error: "Stan zamowienia zmienil sie w miedzyczasie (rownolegle nadanie?) — odswiez strone." }, { status: 409 });
  }
  const r = await runCreate(
    id,
    order.furgonetkaStatus,
    orderPatch,
    () => bcCreateLockerShipment(receiver, `KalkMate ${order.orderNumber}`, shipOpts),
    "(paczkomat)"
  );
  if (!r.ok) return r.response;
  const created = r.created;

  let trackingSync = null;
  if (created.trackingNumber) {
    try { trackingSync = await syncOrderTracking(id); } catch { /* InPost moze jeszcze nie znac numeru */ }
  }

  return NextResponse.json({
    ok: true,
    basecourierOrderId: created.orderId,
    trackingNumber: created.trackingNumber,
    waybillLink: created.waybillLink,
    emailSent: r.emailSent,
    saved: savedForClient(savedPatch, receiver),
    trackingSync,
    raw: created.raw,
  });
}
