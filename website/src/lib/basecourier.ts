// Base Courier (basecourier.com, dawniej BLPaczka) — nadawanie przesylek
// InPost Paczkomat z panelu admina.
//
// API (zweryfikowane sonda na produkcji, 2026-09-17):
//   POST https://api.blpaczka.com/api/<endpoint>   Content-Type: application/json
//   body zawsze zawiera  "auth": { "login": <email konta>, "api_key": <klucz> }
//   getProfile.json        -> dane nadawcy z konta
//   couriers               -> lista kodow kurierow ("paczkomaty" = InPost Paczkomat)
//   getValuation.json      -> wycena; wymaga CourierSearch.{courier_code,type:"package",
//                             origin:"api",country_code,weight,side_x,side_y,side_z}
//   createOrderV2.json     -> nadanie; wymaga Cart:[{Order:{...}}] + taker_point (kod
//                             Paczkomatu) + skonfigurowanej w panelu Base Courier formy
//                             platnosci za nadanie (Skarbonka/Paynow) — API NIE
//                             przyjmuje jej w zadaniu.
//   getWaybill.json        -> etykieta PDF
//   getWaybillTracking.json-> sledzenie po numerze
// Sandbox (sandbox.blpaczka.com) odpowiada 301 — nie uzywamy.
//
// Konfiguracja: BASECOURIER_LOGIN + BASECOURIER_API_KEY w .env na serwerze
// (NIGDY w repo — jest publiczne).

const API_BASE = "https://api.blpaczka.com/api";

export interface BaseCourierEnvelope<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
}

function creds() {
  const login = process.env.BASECOURIER_LOGIN || "";
  const api_key = process.env.BASECOURIER_API_KEY || "";
  if (!login || !api_key) {
    throw new Error("Brak BASECOURIER_LOGIN / BASECOURIER_API_KEY w konfiguracji serwera");
  }
  return { login, api_key };
}

export async function bcCall<T = unknown>(
  endpoint: string,
  body: Record<string, unknown> = {},
  timeoutMs = 25000
): Promise<BaseCourierEnvelope<T>> {
  const res = await fetch(`${API_BASE}/${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ auth: creds(), ...body }),
    signal: AbortSignal.timeout(timeoutMs),
    cache: "no-store",
  });
  const text = await res.text();
  let json: BaseCourierEnvelope<T>;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Base Courier: niepoprawna odpowiedz HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  return json;
}

// Wyciaga czytelny komunikat bledu z roznych ksztaltow odpowiedzi API
// ({message}, {data:{message}}, {data:{errors:{...}}}, {data:{validationErrors}}).
export function bcErrorMessage(env: BaseCourierEnvelope<unknown>): string {
  const d = (env.data ?? {}) as Record<string, unknown>;
  if (typeof env.message === "string" && env.message.trim()) return env.message;
  if (typeof d.message === "string" && d.message.trim()) return d.message;
  const errs = d.errors ?? d.validationErrors;
  if (errs) {
    try {
      return JSON.stringify(errs).slice(0, 500);
    } catch {
      /* noop */
    }
  }
  return "Nieznany blad Base Courier";
}

// === Nadawca (z profilu konta Base Courier, cache w procesie) ===
export interface BcProfile {
  name: string;
  vat_company: string | null;
  email: string;
  street: string;
  house_no: string;
  locum_no: string | null;
  postal: string;
  city: string;
  phone: string;
}

let _profileCache: { at: number; profile: BcProfile } | null = null;

export async function bcGetProfile(): Promise<BcProfile> {
  if (_profileCache && Date.now() - _profileCache.at < 60 * 60 * 1000) return _profileCache.profile;
  const env = await bcCall<{ Broker: Record<string, string | null> }>("getProfile.json");
  if (!env.success || !env.data?.Broker) throw new Error(bcErrorMessage(env));
  const b = env.data.Broker;
  const profile: BcProfile = {
    name: b.name || `${b.person_name ?? ""} ${b.person_surname ?? ""}`.trim(),
    vat_company: b.vat_company ?? null,
    email: b.email || "",
    street: b.street || "",
    house_no: b.house_no || "",
    locum_no: b.locum_no && b.locum_no !== "-" ? b.locum_no : null,
    postal: b.postal || "",
    city: b.city || "",
    phone: b.phone || "",
  };
  _profileCache = { at: Date.now(), profile };
  return profile;
}

// === Paczka KalkMate: pudelko 18x12x4 cm, ~1 kg (te same wartosci co CSV) ===
export const KALKMATE_PARCEL = {
  weight: 1,
  side_x: 18,
  side_y: 12,
  side_z: 4,
  content: "Kalkulator elektroniczny",
} as const;

export interface BcReceiver {
  name: string;
  email: string;
  phone: string;
  lockerCode: string; // np. WAW88H
  street?: string;
  houseNo?: string;
  postal?: string;
  city?: string;
}

// Rozbija "ul. Zastawie I 37" -> { street:"ul. Zastawie I", house_no:"37" };
// gdy brak numeru, zwraca house_no "1" (API wymaga niepustego numeru).
export function splitStreet(full: string | null | undefined): { street: string; house_no: string } {
  const s = (full || "").trim();
  const m = s.match(/^(.*?)[\s,]+(\d+[A-Za-z]?(?:\/\d+[A-Za-z]?)?)\s*$/);
  if (m) return { street: m[1].trim(), house_no: m[2] };
  return { street: s || "-", house_no: "1" };
}

function courierSearch(courierCode = "paczkomaty", countryCode = "PL") {
  return {
    courier_code: courierCode,
    type: "package",
    origin: "api",
    country_code: countryCode,
    weight: KALKMATE_PARCEL.weight,
    side_x: KALKMATE_PARCEL.side_x,
    side_y: KALKMATE_PARCEL.side_y,
    side_z: KALKMATE_PARCEL.side_z,
    // "Nie zamawiaj podjazdu" (nazwa z oficjalnej wtyczki WooCommerce):
    // wlasciciel sam wrzuca paczke do Paczkomatu — bez tego API wymaga
    // daty i godzin przyjazdu kuriera ("Dzien odbioru paczki przez kuriera").
    no_pickup: true,
  };
}

export interface BcValuation {
  courierSearchId: string | null;
  price: { value: string; netto: string; vat: string } | null;
  raw: unknown;
}

export async function bcValuation(): Promise<BcValuation> {
  const env = await bcCall<{
    CourierSearch?: { id?: string };
    results?: { Courier?: { courier_code?: string }; Price?: { value: string; netto: string; vat: string } }[];
  }>("getValuation.json", { CourierSearch: courierSearch() });
  if (!env.success) throw new Error(bcErrorMessage(env));
  const r = (env.data?.results ?? []).find((x) => x.Courier?.courier_code === "paczkomaty") ?? env.data?.results?.[0];
  return {
    courierSearchId: env.data?.CourierSearch?.id ?? null,
    price: r?.Price ?? null,
    raw: env.data,
  };
}

// === Wycena zagraniczna (DE, US, ...) ===
// InPost Paczkomat dziala tylko w Polsce, wiec zamowienia zagraniczne
// (customerCountry != "PL") potrzebuja innych kurierow. Base Courier nie ma
// jednego uniwersalnego kodu "kurier miedzynarodowy" — dostepnosc i cena
// zaleza od kraju i wagi, wiec probujemy kilku sensownych kandydatow na raz
// i pokazujemy wszystkie, ktore faktycznie zwrocily cene (reszta zwraca
// "Brak wynikow..." dla naszej paczki 1kg/18x12x4 — to normalne, nie blad).
//
// Zweryfikowane na zywo dla paczki KalkMate (2026-09-20):
//   DE: dpd 19.99 zl, euro_hermes 21.49 zl, spring 24.16 zl,
//       ups_rest_standard 30.99 zl, gls 33.99 zl, ups_rest_saver 110 zl (express)
//   US: tylko ups_rest_saver 115 zl i ups_rest_expedited 133 zl (express) —
//       zwykle DPD/GLS/FedEx/DHL nie maja oferty na tak mala/lekka paczke do USA.
export const INTL_COURIER_CANDIDATES: { code: string; name: string }[] = [
  { code: "dpd", name: "DPD" },
  { code: "euro_hermes", name: "Eurohermes" },
  { code: "spring", name: "Spring" },
  { code: "ups_rest_standard", name: "UPS Standard" },
  { code: "gls", name: "GLS" },
  { code: "ups_rest_saver", name: "UPS Saver (express)" },
  { code: "ups_rest_expedited", name: "UPS Expedited (express)" },
];

export interface BcIntlQuote {
  courierCode: string;
  courierName: string;
  price: { value: string; netto: string; vat: string };
}

// "OTHER" (formularz zakupu ma opcje "Other country") nie jest kodem ISO —
// Base Courier potrzebuje realnego kraju do wyceny, wiec traktujemy go jak US
// (ta sama konwencja co przy rejestracji GTIN w BuyNow.tsx).
export function normalizeCountryForShipping(countryCode: string): string {
  const c = (countryCode || "").toUpperCase();
  return c === "OTHER" || !c ? "US" : c;
}

export async function bcValuationInternational(countryCode: string): Promise<BcIntlQuote[]> {
  const country = normalizeCountryForShipping(countryCode);
  const results = await Promise.allSettled(
    INTL_COURIER_CANDIDATES.map(async (c) => {
      const env = await bcCall<{
        results?: { Courier?: { courier_code?: string }; Price?: { value: string; netto: string; vat: string } }[];
      }>("getValuation.json", { CourierSearch: courierSearch(c.code, country) });
      if (!env.success) return null;
      const r = env.data?.results?.[0];
      if (!r?.Price) return null;
      return { courierCode: c.code, courierName: c.name, price: r.Price } satisfies BcIntlQuote;
    })
  );
  const quotes: BcIntlQuote[] = [];
  for (const r of results) {
    if (r.status === "fulfilled" && r.value) quotes.push(r.value);
  }
  quotes.sort((a, b) => parseFloat(a.price.value) - parseFloat(b.price.value));
  return quotes;
}

export interface BcCreatedShipment {
  orderId: string | null;       // blpaczka_order_id
  trackingNumber: string | null;
  waybillLink: string | null;
  raw: unknown;
}

// Szuka numeru listu przewozowego w odpowiedzi — API nie ma udokumentowanego
// pola, wiec sprawdzamy najbardziej prawdopodobne klucze (rekurencyjnie).
function findTracking(obj: unknown, depth = 0): string | null {
  if (!obj || typeof obj !== "object" || depth > 6) return null;
  const rec = obj as Record<string, unknown>;
  for (const key of ["waybill_no", "waybill_number", "waybill", "tracking_number", "tracking_no", "package_no", "package_number", "inpost_number"]) {
    const v = rec[key];
    if (typeof v === "string" && /^[A-Za-z0-9]{8,40}$/.test(v)) return v;
  }
  for (const v of Object.values(rec)) {
    const found = findTracking(v, depth + 1);
    if (found) return found;
  }
  return null;
}

// Pola formularza nadania zweryfikowane w zrodle oficjalnej wtyczki WooCommerce
// (wordpress.org/plugins/blpaczka, pobrana i przejrzana 2026-09-20):
// resources/views/backend/order/_partials/shipment-meta-box/shipment-form.blade.php.
// Ten SAM formularz (bez rozgalezien) obsluguje i Paczkomat, i kurierow
// zagranicznych (DPD/GLS/Eurohermes/UPS...) — jedyna roznica to:
//   - "Cart.0.Order.taker_point" jest OPCJONALNE (uzywane tylko dla Paczkomatu/
//     punktow odbioru), adres (taker_street/house_no/postal/city) jest ZAWSZE
//     wymagany i zawsze wysylany.
//   - Kraj odbiorcy idzie do "CourierSearch.country_code" (NIE Order.taker_country
//     — takiego pola w ogole nie ma).
// W calym formularzu NIE MA zadnego pola celnego/deklaracji wartosci dla
// eksportu (np. do USA) — Base Courier/kurier generuje dokumenty celne sam na
// podstawie package_content, tak jak dla Polski. Stad wysylka do USA dziala
// przez ten sam createOrderV2.json bez dodatkowych danych.
function buildOrderPayload(receiver: BcReceiver, sender: BcProfile, orderRef: string): Record<string, unknown> {
  const recvAddr = splitStreet(receiver.street);
  return {
    // nadawca
    name: sender.name,
    vat_company: sender.vat_company ?? "",
    email: sender.email,
    phone: sender.phone,
    street: sender.street,
    house_no: sender.house_no,
    locum_no: sender.locum_no ?? "",
    postal: sender.postal,
    city: sender.city,
    // odbiorca
    taker_name: receiver.name,
    taker_email: receiver.email,
    taker_phone: receiver.phone.replace(/\s+/g, ""),
    ...(receiver.lockerCode ? { taker_point: receiver.lockerCode } : {}),
    taker_street: receiver.street ? recvAddr.street : "",
    taker_house_no: receiver.street ? recvAddr.house_no : "",
    taker_postal: receiver.postal ?? "",
    taker_city: receiver.city ?? "",
    // paczka
    package_content: KALKMATE_PARCEL.content,
    // referencja do naszego zamowienia (widoczna w panelu Base Courier)
    reference: orderRef,
    description: orderRef,
  };
}

function parseCreatedShipment(d: Record<string, unknown>): BcCreatedShipment {
  // Ksztalt odpowiedzi (zweryfikowany na pierwszym realnym nadaniu 2026-09-18):
  //   { CartOrder: { id_prefix, price, price_netto },
  //     Order: [ { id: "23584605", waybill_no: "6209...", name, type, price } ],
  //     waybill_link: "https://api.blpaczka.com/courier/orders/downloadWaybillAction/..." }
  const firstOrder = Array.isArray(d.Order) ? (d.Order[0] as Record<string, unknown> | undefined) : undefined;
  const rawId = firstOrder?.id;
  const orderId =
    typeof rawId === "string" || typeof rawId === "number" ? String(rawId) : null;
  const waybill = firstOrder?.waybill_no;
  const trackingNumber =
    typeof waybill === "string" && waybill.trim() ? waybill.trim() : findTracking(d);
  return {
    orderId,
    trackingNumber,
    waybillLink: typeof d.waybill_link === "string" ? d.waybill_link : null,
    raw: d,
  };
}

// Forma platnosci za nadanie: "bank" = Skarbonka (przedplata na koncie Base
// Courier), "pay_later" = faktura z odroczona platnoscia. Nazwa pola z
// oficjalnej wtyczki WooCommerce (CartOrder.payment) — w panelu Base Courier
// NIE MA tego ustawienia dla API, bez tego pola API odrzuca nadanie
// ("Nie wybrano formy platnosci za nadanie...").
function paymentMethod(): string {
  return process.env.BASECOURIER_PAYMENT || "bank";
}

export async function bcCreateLockerShipment(receiver: BcReceiver, orderRef: string): Promise<BcCreatedShipment> {
  const sender = await bcGetProfile();
  const order = buildOrderPayload(receiver, sender, orderRef);

  const env = await bcCall<Record<string, unknown>>("createOrderV2.json", {
    CartOrder: { payment: paymentMethod() },
    CourierSearch: courierSearch(),
    Cart: [{ Order: order }],
  }, 40000);

  if (!env.success) throw new Error(bcErrorMessage(env));
  return parseCreatedShipment(env.data ?? {});
}

// Nadanie zagraniczne (DE, US, ...) — drzwi-drzwi, wybranym kurierem z listy
// zwroconej przez bcValuationInternational(). Bez taker_point (nie ma
// Paczkomatow poza PL); adres odbiorcy musi byc kompletny (street/postal/city).
export async function bcCreateInternationalShipment(
  receiver: BcReceiver,
  orderRef: string,
  courierCode: string,
  countryCode: string
): Promise<BcCreatedShipment> {
  if (!INTL_COURIER_CANDIDATES.some((c) => c.code === courierCode)) {
    throw new Error(`Nieznany kurier: ${courierCode}`);
  }
  const sender = await bcGetProfile();
  const order = buildOrderPayload(receiver, sender, orderRef);

  const env = await bcCall<Record<string, unknown>>("createOrderV2.json", {
    CartOrder: { payment: paymentMethod() },
    CourierSearch: courierSearch(courierCode, normalizeCountryForShipping(countryCode)),
    Cart: [{ Order: order }],
  }, 40000);

  if (!env.success) throw new Error(bcErrorMessage(env));
  return parseCreatedShipment(env.data ?? {});
}

// Etykieta PDF. Kontrakt zweryfikowany na produkcji (2026-09-18):
//   POST getWaybill.json  { Order: { id: <int>, printer_type: "A4" } }
//   -> { success: true, data: { "0": { type:"label", filename, mime:"application/pdf", file:<base64> },
//                               labels: [ { name:"ZPL_...", extension:"zpl", file }, { ... "epl" } ] } }
// UWAGA: printer_type "A6" dla InPost Paczkomat zwraca "Wystapil blad podczas
// pobierania dokumentow" — dziala tylko A4 (etykieta i tak jest 100x150 na
// stronie A4). Id to Order[0].id z odpowiedzi createOrderV2 (NIE CartOrder.id_prefix).
export async function bcGetWaybillPdf(blpaczkaOrderId: string): Promise<{ pdf: Buffer | null; link: string | null; raw: unknown }> {
  const printerType = process.env.BASECOURIER_PRINTER || "A4";
  const env = await bcCall<unknown>("getWaybill.json", {
    Order: { id: Number(blpaczkaOrderId), printer_type: printerType },
  });
  if (!env.success) throw new Error(bcErrorMessage(env));
  const d = env.data as Record<string, unknown> | unknown[] | undefined;

  // data["0"] (obiekt z kluczem "0") albo data[0] (tablica) — obslugujemy oba.
  let first: Record<string, unknown> | undefined;
  if (Array.isArray(d)) first = d[0] as Record<string, unknown> | undefined;
  else if (d && typeof d === "object") first = (d["0"] ?? d[0 as unknown as string]) as Record<string, unknown> | undefined;

  const b64 = first?.file ?? first?.content;
  if (typeof b64 === "string" && b64.length > 100) {
    try {
      const buf = Buffer.from(b64, "base64");
      if (buf.subarray(0, 4).toString() === "%PDF") {
        return { pdf: buf, link: null, raw: { filename: first?.filename, mime: first?.mime } };
      }
    } catch {
      /* nie base64 */
    }
  }
  return { pdf: null, link: null, raw: d };
}
