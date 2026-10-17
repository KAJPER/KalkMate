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

// === Bledy typowane ===
// Przy NADANIU (createOrderV2 — realne pieniadze) kluczowe jest, czy zlecenie
// moglo powstac:
//   BcRejectedError  — PEWNE: zlecenie na pewno NIE powstalo. API odpowiedzialo
//                      i odrzucilo zadanie (success:false / HTTP 4xx, np. blad
//                      walidacji, brak srodkow, zly kod Paczkomatu) albo zadanie
//                      nadania w ogole nie zostalo wyslane (brak konfiguracji,
//                      blad pobrania profilu nadawcy). Mozna bezpiecznie ponowic.
//   BcUncertainError — NIEPEWNE: blad sieci, timeout, HTTP 5xx, nieczytelna
//                      odpowiedz — zadanie moglo dojsc i paczka mogla zostac
//                      utworzona i oplacona. NIE ponawiac bez sprawdzenia panelu.
export class BcError extends Error {
  readonly endpoint: string;
  readonly httpStatus: number | null;
  constructor(message: string, endpoint: string, httpStatus: number | null, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "BcError";
    this.endpoint = endpoint;
    this.httpStatus = httpStatus;
  }
}

export class BcRejectedError extends BcError {
  readonly certain = true as const;
  constructor(message: string, endpoint: string, httpStatus: number | null, options?: { cause?: unknown }) {
    super(message, endpoint, httpStatus, options);
    this.name = "BcRejectedError";
  }
}

export class BcUncertainError extends BcError {
  readonly certain = false as const;
  constructor(message: string, endpoint: string, httpStatus: number | null, options?: { cause?: unknown }) {
    super(message, endpoint, httpStatus, options);
    this.name = "BcUncertainError";
  }
}

export function isBcRejected(e: unknown): e is BcRejectedError {
  return e instanceof BcRejectedError;
}

// Stan "nadanie w toku / niepewne" (Order.furgonetkaStatus) i znacznik w
// adminNotes — wspolne dla basecourier/route.ts (nadanie) i basecourier/link
// (powiazanie zlecenia czysci znacznik).
export const BC_PENDING_STATUS = "basecourier_pending";
export const BC_UNCERTAIN_NOTE = "[NIEPEWNE NADANIE — sprawdz w panelu Base Courier i uzyj 'Powiaz zlecenie']";
export const BC_UNCERTAIN_RESOLVED_NOTE = "[niepewne nadanie — rozwiazane]";

// Id zlecenia Base Courier jest liczba — "abc" dawal NaN, ktory JSON zamienia na null.
function bcNumericId(id: string, endpoint: string): number {
  const s = String(id ?? "").trim();
  if (!/^\d{1,15}$/.test(s)) throw new BcRejectedError(`Niepoprawne ID zlecenia Base Courier: "${s.slice(0, 40)}"`, endpoint, null);
  return Number(s);
}

function creds(endpoint: string) {
  const login = process.env.BASECOURIER_LOGIN || "";
  const api_key = process.env.BASECOURIER_API_KEY || "";
  if (!login || !api_key) {
    // Nic nie zostalo wyslane — pewne.
    throw new BcRejectedError("Brak BASECOURIER_LOGIN / BASECOURIER_API_KEY w konfiguracji serwera", endpoint, null);
  }
  return { login, api_key };
}

// Zwraca koperte API dla odpowiedzi HTTP < 500 (takze success:false — wywolujacy
// decyduje, co z tym zrobic). Rzuca:
//   BcUncertainError — blad sieci / timeout / HTTP 5xx / nieczytelna odpowiedz 2xx-3xx,
//   BcRejectedError  — brak konfiguracji / nieczytelna odpowiedz HTTP 4xx (np. strona
//                      bledu proxy — zadanie odrzucone, zanim cokolwiek przetworzono).
export async function bcCall<T = unknown>(
  endpoint: string,
  body: Record<string, unknown> = {},
  timeoutMs = 25000
): Promise<BaseCourierEnvelope<T>> {
  const payload = JSON.stringify({ auth: creds(endpoint), ...body });
  let res: Response;
  let text: string;
  try {
    res = await fetch(`${API_BASE}/${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: payload,
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
    text = await res.text();
  } catch (e) {
    const name = (e as { name?: string } | null)?.name;
    const what = name === "TimeoutError" || name === "AbortError" ? `timeout po ${Math.round(timeoutMs / 1000)} s` : `blad sieci: ${(e as Error)?.message ?? String(e)}`;
    throw new BcUncertainError(`Base Courier (${endpoint}): ${what}`, endpoint, null, { cause: e });
  }
  if (res.status >= 500) {
    throw new BcUncertainError(`Base Courier (${endpoint}): HTTP ${res.status}: ${text.slice(0, 200)}`, endpoint, res.status);
  }
  let json: BaseCourierEnvelope<T>;
  try {
    json = JSON.parse(text);
  } catch {
    const msg = `Base Courier (${endpoint}): niepoprawna odpowiedz HTTP ${res.status}: ${text.slice(0, 200)}`;
    if (res.status >= 400) throw new BcRejectedError(msg, endpoint, res.status);
    throw new BcUncertainError(msg, endpoint, res.status);
  }
  if (!json || typeof json !== "object") {
    throw new BcUncertainError(`Base Courier (${endpoint}): pusta odpowiedz HTTP ${res.status}`, endpoint, res.status);
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
    // validationErrors to zagniezdzone {Cart:[{Order:{"Etykieta pola":["komunikat"]}}]}
    // — splaszczamy do czytelnego "Etykieta pola: komunikat; ...".
    const parts: string[] = [];
    const walk = (node: unknown, label = "") => {
      if (Array.isArray(node)) {
        if (node.every((x) => typeof x === "string")) parts.push(label ? `${label}: ${node.join(", ")}` : node.join(", "));
        else node.forEach((x) => walk(x, label));
      } else if (node && typeof node === "object") {
        for (const [k, v] of Object.entries(node)) walk(v, k);
      } else if (typeof node === "string") {
        parts.push(label ? `${label}: ${node}` : node);
      }
    };
    walk(errs);
    if (parts.length) return parts.join("; ").slice(0, 500);
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
  if (!env.success || !env.data?.Broker) throw new BcRejectedError(bcErrorMessage(env), "getProfile.json", null);
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

// Zamowienie kilku sztuk = JEDNA paczka (wysylka stala na zamowienie, patrz
// checkoutPricing.shippingCentsForCountry). Waga = waga 1 sztuki x ilosc.
// Wymiary: domyslnie pudelka 18x12x4 ulozone jedno na drugim (side_z x ilosc) —
// to dolne oszacowanie, NIE zmierzony karton zbiorczy.
// TODO(wlasciciel): jesli kilka sztuk pakujesz do innego kartonu, wpisz jego
// wymiary (cm) tutaj — wtedy beda uzyte dla kazdego zamowienia > 1 szt.
export const KALKMATE_MULTI_PARCEL_SIDES: { side_x: number; side_y: number; side_z: number } | null = null;

export function normalizeParcelQuantity(quantity: unknown): number {
  const q = Math.floor(Number(quantity));
  return Number.isFinite(q) && q >= 1 ? Math.min(q, 50) : 1;
}

export function kalkmateParcel(quantity: unknown = 1): { weight: number; side_x: number; side_y: number; side_z: number; content: string } {
  const q = normalizeParcelQuantity(quantity);
  if (q === 1) return { ...KALKMATE_PARCEL };
  const sides = KALKMATE_MULTI_PARCEL_SIDES ?? {
    side_x: KALKMATE_PARCEL.side_x,
    side_y: KALKMATE_PARCEL.side_y,
    side_z: KALKMATE_PARCEL.side_z * q,
  };
  // "x" zamiast "×": package_content trafia na etykiete kuriera (UPS = ASCII).
  return { weight: KALKMATE_PARCEL.weight * q, ...sides, content: `${KALKMATE_PARCEL.content} x${q}` };
}

export interface BcReceiver {
  name: string;
  email: string;
  phone: string;
  lockerCode: string; // np. WAW88H
  street?: string;
  houseNo?: string;
  postal?: string;
  city?: string;
  state?: string; // kod stanu/prowincji (US, CA) — np. "NY"
  country?: string; // kod kraju odbiorcy (zagranica) — decyduje o sposobie rozbicia adresu
}

// Stan / prowincja (US, CA) — logika w address.ts (czysta, uzywana tez w panelu).
// UPS wymaga StateProvinceCode dla USA i Kanady (blad 120206), a formularz zamowienia
// ma tylko pole "miasto" — stan wykrywamy z niego (splitCityState).
export { needsStateCode, isValidStateCode, splitCityState } from "./address";
import { splitAddress } from "./address";
import { isEuCountry } from "./countries";

// Rozbija "ul. Zastawie I 37" -> { street:"ul. Zastawie I", house_no:"37" };
// gdy brak numeru, zwraca house_no "1" (API wymaga niepustego numeru).
export function splitStreet(full: string | null | undefined): { street: string; house_no: string } {
  const s = (full || "").trim();
  const m = s.match(/^(.*?)[\s,]+(\d+[A-Za-z]?(?:\/\d+[A-Za-z]?)?)\s*$/);
  if (m) return { street: m[1].trim(), house_no: m[2] };
  return { street: s || "-", house_no: "1" };
}

// === Podjazd kuriera ("zamawianie podjazdu") ===
// Adres nadawcy w zleceniu = adres, z ktorego kurier odbierze paczke. Bez
// podjazdu idzie adres z profilu konta Base Courier (Zastawie I 37,
// Choroszcz) — jest tez jednym z dwoch adresow do wyboru w panelu.
export const PICKUP_ADDRESSES = {
  choroszcz: {
    label: "ul. Zastawie I 37, 16-070 Choroszcz",
    street: "ul. Zastawie I",
    house_no: "37",
    locum_no: "",
    postal: "16-070",
    city: "Choroszcz",
  },
  bialystok: {
    label: "ul. Piaskowa 19A, 15-561 Białystok",
    street: "ul. Piaskowa",
    house_no: "19A",
    locum_no: "",
    postal: "15-561",
    city: "Białystok",
  },
} as const;
export type PickupAddressKey = keyof typeof PICKUP_ADDRESSES;

export interface BcPickup {
  addressKey: PickupAddressKey;
  date: string; // YYYY-MM-DD
  from: string; // HH:MM
  to: string;   // HH:MM
}

export interface BcShipOptions {
  pickup?: BcPickup | null;
  // Dokumenty celne w wersji papierowej (przesylki poza UE) — patrz courierSearch().
  customsPaper?: boolean;
  // Liczba sztuk w zamowieniu (Order.quantity) — waga/wymiary/opis paczki.
  quantity?: number;
}

// Dzisiejsza data (YYYY-MM-DD) w strefie Europe/Warsaw — serwer chodzi w UTC,
// wiec toISOString() miedzy 00:00 a 01:00/02:00 czasu PL dawal wczorajsza date.
export function warsawToday(): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Warsaw" }).format(new Date());
}

// Najblizszy dzien roboczy po dzisiejszym (Pn-Pt) — domyslna data podjazdu.
function nextWorkingDay(): string {
  const d = new Date(`${warsawToday()}T12:00:00Z`);
  do {
    d.setUTCDate(d.getUTCDate() + 1);
  } while (d.getUTCDay() === 0 || d.getUTCDay() === 6);
  return d.toISOString().slice(0, 10);
}

export function pickupOptions() {
  return {
    addresses: (Object.keys(PICKUP_ADDRESSES) as PickupAddressKey[]).map((key) => ({
      key,
      label: PICKUP_ADDRESSES[key].label,
    })),
    minDate: warsawToday(),
    defaultDate: nextWorkingDay(),
  };
}

// Walidacja tego, co przyszlo z przegladarki. Reguly podjazdu potwierdzone
// odpowiedziami samego API (2026-09-25): data wymagana, godziny "od"/"do"
// wymagane, okno co najmniej 2 godziny.
export function parsePickup(raw: unknown): { ok: true; pickup: BcPickup } | { ok: false; error: string } {
  const p = (raw ?? {}) as Record<string, unknown>;
  const addressKey = String(p.addressKey ?? "");
  if (!(addressKey in PICKUP_ADDRESSES)) return { ok: false, error: "Wybierz adres, z którego kurier ma odebrać paczkę." };

  const date = String(p.date ?? "");
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(`${date}T12:00:00Z`) : null;
  if (!parsed || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    return { ok: false, error: "Podaj poprawny dzień odbioru przesyłki." };
  }
  if (date < warsawToday()) return { ok: false, error: "Dzień odbioru nie może być w przeszłości." };

  const timeRe = /^([01]\d|2[0-3]):([0-5]\d)$/;
  const from = String(p.from ?? "");
  const to = String(p.to ?? "");
  if (!timeRe.test(from) || !timeRe.test(to)) return { ok: false, error: "Podaj godziny podjazdu (od – do)." };
  const mins = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  if (mins(to) - mins(from) < 120) return { ok: false, error: "Okno podjazdu musi trwać co najmniej 2 godziny." };

  return { ok: true, pickup: { addressKey: addressKey as PickupAddressKey, date, from, to } };
}

// Przesylki poza UE wymagaja dokumentow celnych (faktura handlowa). API
// Base Courier odrzuca nadanie bez nich: "Dla tej przesylki wymagane jest
// dodanie elektronicznych dokumentow celnych lub zaznaczenie opcji wersji
// papierowej." Wersje papierowa wlacza CourierSearch.paper_customs_docs=true
// (pole ustalone empirycznie 2026-09-25 — nie ma go w wtyczce WooCommerce ani
// w publicznej dokumentacji; boolean true/1 przechodzi, false/0 nie). Papier =
// wydrukowac fakture w 3 egzemplarzach i dolaczyc do paczki.
// Zbior UE: wspolny z countries.ts (ten sam co EU_COUNTRIES + PL w checkoutPricing.ts).
// Terytoria z osobnym kodem ISO poza obszarem celno-VAT UE (AX, GF, GP, MQ, RE,
// YT, MF...) NIE sa w zbiorze — tak jak w cenniku (wysylka 3500) — wiec dla nich
// tez idzie wersja papierowa dokumentow celnych.
export function needsCustomsDocs(countryCode: string): boolean {
  return !isEuCountry(normalizeCountryForShipping(countryCode));
}

function courierSearch(courierCode = "paczkomaty", countryCode = "PL", opts: BcShipOptions = {}) {
  const parcel = kalkmateParcel(opts.quantity);
  return {
    courier_code: courierCode,
    type: "package",
    origin: "api",
    country_code: countryCode,
    weight: parcel.weight,
    side_x: parcel.side_x,
    side_y: parcel.side_y,
    side_z: parcel.side_z,
    // "Nie zamawiaj podjazdu" (nazwa z oficjalnej wtyczki WooCommerce):
    // domyslnie wlasciciel sam wrzuca paczke do Paczkomatu/punktu. Przy
    // no_pickup=false API wymaga daty i godzin (Order.pickup_date + godziny).
    no_pickup: !opts.pickup,
    ...(opts.customsPaper ? { paper_customs_docs: true } : {}),
  };
}

export interface BcValuation {
  courierSearchId: string | null;
  price: { value: string; netto: string; vat: string } | null;
  raw: unknown;
}

export async function bcValuation(quantity = 1): Promise<BcValuation> {
  const env = await bcCall<{
    CourierSearch?: { id?: string };
    results?: { Courier?: { courier_code?: string }; Price?: { value: string; netto: string; vat: string } }[];
  }>("getValuation.json", { CourierSearch: courierSearch("paczkomaty", "PL", { quantity }) });
  if (!env.success) throw new BcRejectedError(bcErrorMessage(env), "getValuation.json", null);
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

export async function bcValuationInternational(countryCode: string, quantity = 1): Promise<BcIntlQuote[]> {
  const country = normalizeCountryForShipping(countryCode);
  const results = await Promise.allSettled(
    INTL_COURIER_CANDIDATES.map(async (c) => {
      const env = await bcCall<{
        results?: { Courier?: { courier_code?: string }; Price?: { value: string; netto: string; vat: string } }[];
      }>("getValuation.json", { CourierSearch: courierSearch(c.code, country, { quantity }) });
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
// UWAGA: wtyczka WooCommerce NIE ma pol celnych, ale API dla przesylek poza UE
// (np. USA) i tak wymaga dokumentow celnych — patrz needsCustomsDocs() /
// courierSearch() (CourierSearch.paper_customs_docs). Podjazd kuriera: pola
// Order.pickup_date + pickup_ready_time(_minute) + pickup_close_time(_minute)
// (nazwy z CreateOrderRestApiService.php wtyczki, potwierdzone walidacja API).
function buildOrderPayload(
  receiver: BcReceiver,
  sender: BcProfile,
  orderRef: string,
  opts: BcShipOptions = {}
): Record<string, unknown> {
  // Zagranica: "217 Manhattan Avenue, unit 5B-3" -> ulica / numer 217 / mieszkanie 5B-3 (USA pisze numer przed ulica).
  // Kraj: "Marszalkowska 1/2" -> numer "1/2" (jak dawniej); "Marszalkowska 1 m. 2"
  // -> numer 1, mieszkanie 2 (dawniej numer "2", a "1 m." w nazwie ulicy).
  const foreign = receiver.country && receiver.country.toUpperCase() !== "PL" ? splitAddress(receiver.street, receiver.country) : null;
  const domestic = foreign ? null : splitAddress(receiver.street, "PL");
  const recvAddr = foreign
    ? { street: foreign.street || "-", house_no: foreign.building || "1", locum_no: foreign.apartment }
    : domestic && domestic.building
      ? { street: domestic.street || "-", house_no: domestic.building, locum_no: domestic.apartment }
      : { ...splitStreet(receiver.street), locum_no: "" };
  // Przy podjezdzie adres nadawcy = wybrany adres odbioru paczki.
  const from = opts.pickup ? PICKUP_ADDRESSES[opts.pickup.addressKey] : null;
  const [readyH, readyM] = (opts.pickup?.from ?? "").split(":");
  const [closeH, closeM] = (opts.pickup?.to ?? "").split(":");
  return {
    // nadawca
    name: sender.name,
    vat_company: sender.vat_company ?? "",
    email: sender.email,
    phone: sender.phone,
    street: from ? from.street : sender.street,
    house_no: from ? from.house_no : sender.house_no,
    locum_no: from ? from.locum_no : sender.locum_no ?? "",
    postal: from ? from.postal : sender.postal,
    city: from ? from.city : sender.city,
    // podjazd kuriera
    ...(opts.pickup
      ? {
          pickup_date: opts.pickup.date,
          pickup_ready_time: readyH,
          pickup_ready_time_minute: readyM,
          pickup_close_time: closeH,
          pickup_close_time_minute: closeM,
        }
      : {}),
    // odbiorca
    taker_name: receiver.name,
    taker_email: receiver.email,
    taker_phone: receiver.phone.replace(/\s+/g, ""),
    ...(receiver.lockerCode ? { taker_point: receiver.lockerCode } : {}),
    taker_street: receiver.street ? recvAddr.street : "",
    taker_house_no: receiver.street ? recvAddr.house_no : "",
    taker_locum_no: receiver.street ? recvAddr.locum_no : "",
    taker_postal: receiver.postal ?? "",
    taker_city: receiver.city ?? "",
    // Stan (US/CA): UWAGA — model zlecenia Base Courier (getOrderDetails, 2026-09-28) nie ma
    // zadnej kolumny na stan/prowincje (tylko taker_city/taker_postal/...), a UPS mimo to
    // wymaga StateProvinceCode (blad 120206). Wysylanie taker_state / dopisanie stanu do
    // miasta ("New York, NY") NIE pomoglo. Zostawiamy taker_state jako tani strzal, ale
    // pewna droga dla USA to nadanie recznie w panelu Base Courier i powiazanie zlecenia
    // (POST .../basecourier/link).
    ...(receiver.state ? { taker_state: receiver.state } : {}),
    // paczka — package_content jest JEDYNYM polem, ktore faktycznie trafia na
    // etykiete: dla UPS pokazuje sie jako "Reference No.1" / "DESC:" (zweryfikowane
    // 2026-10-16 na realnej etykiecie zamowienia #23780392 — "reference"/"description"
    // ponizej NIE wystepuja nigdzie w getOrderDetails.json ani na etykiecie, mimo
    // wczesniejszego zalozenia ze sa "widoczne w panelu" — zostawione na wszelki
    // wypadek, gdyby jednak cos z nich czytalo, ale package_content to realne zrodlo).
    package_content: `${kalkmateParcel(opts.quantity).content} ${orderRef}`,
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

// Profil nadawcy przed nadaniem: blad tutaj = createOrderV2 NIE zostal wyslany,
// wiec niezaleznie od przyczyny (takze timeout) to blad PEWNY.
async function senderForCreate(): Promise<BcProfile> {
  try {
    return await bcGetProfile();
  } catch (e) {
    if (e instanceof BcRejectedError) throw e;
    throw new BcRejectedError(
      `Nie udalo sie pobrac profilu nadawcy (nadanie NIE zostalo wyslane): ${(e as Error)?.message ?? String(e)}`,
      "getProfile.json",
      e instanceof BcError ? e.httpStatus : null,
      { cause: e }
    );
  }
}

// Wspolne wywolanie createOrderV2 z klasyfikacja bledu (patrz BcRejectedError /
// BcUncertainError). success:false z HTTP < 500 = API odrzucilo zadanie — chyba
// ze w odpowiedzi mimo to jest id zlecenia / numer listu (wtedy NIEPEWNE).
async function createOrder(payload: Record<string, unknown>): Promise<BcCreatedShipment> {
  const endpoint = "createOrderV2.json";
  const env = await bcCall<Record<string, unknown>>(endpoint, payload, 40000);
  if (!env.success) {
    const msg = bcErrorMessage(env);
    const partial = env.data && typeof env.data === "object" ? parseCreatedShipment(env.data) : null;
    if (partial && (partial.orderId || partial.trackingNumber)) {
      throw new BcUncertainError(
        `Base Courier zwrocil blad, ale odpowiedz zawiera zlecenie (ID ${partial.orderId ?? "?"}, list ${partial.trackingNumber ?? "?"}): ${msg}`,
        endpoint,
        null
      );
    }
    throw new BcRejectedError(msg, endpoint, null);
  }
  return parseCreatedShipment(env.data ?? {});
}

export async function bcCreateLockerShipment(
  receiver: BcReceiver,
  orderRef: string,
  opts: BcShipOptions = {}
): Promise<BcCreatedShipment> {
  const sender = await senderForCreate();
  const order = buildOrderPayload(receiver, sender, orderRef, opts);

  return createOrder({
    CartOrder: { payment: paymentMethod() },
    CourierSearch: courierSearch("paczkomaty", "PL", opts),
    Cart: [{ Order: order }],
  });
}

// Nadanie zagraniczne (DE, US, ...) — drzwi-drzwi, wybranym kurierem z listy
// zwroconej przez bcValuationInternational(). Bez taker_point (nie ma
// Paczkomatow poza PL); adres odbiorcy musi byc kompletny (street/postal/city).
export async function bcCreateInternationalShipment(
  receiver: BcReceiver,
  orderRef: string,
  courierCode: string,
  countryCode: string,
  opts: BcShipOptions = {}
): Promise<BcCreatedShipment> {
  if (!INTL_COURIER_CANDIDATES.some((c) => c.code === courierCode)) {
    throw new BcRejectedError(`Nieznany kurier: ${courierCode}`, "createOrderV2.json", null);
  }
  const sender = await senderForCreate();
  const order = buildOrderPayload({ ...receiver, country: normalizeCountryForShipping(countryCode) }, sender, orderRef, opts);

  return createOrder({
    CartOrder: { payment: paymentMethod() },
    CourierSearch: courierSearch(courierCode, normalizeCountryForShipping(countryCode), opts),
    Cart: [{ Order: order }],
  });
}

// Etykieta PDF. Kontrakt zweryfikowany na produkcji (2026-09-18, printer_type
// przewalidowany 2026-09-30):
//   POST getWaybill.json  { Order: { id: <int>, printer_type: "LBL" } }
//   -> { success: true, data: { "0": { type:"label", filename:"LBL_<tracking>.pdf",
//                                       mime:"application/pdf", file:<base64> }, labels: [...] } }
// "LBL" to nieudokumentowana, ale dzialajaca wartosc printer_type — zwraca gotowa,
// pojedyncza etykiete ok. A6 (105x148mm, pasuje na VEVOR 100x150mm), BEZ potrzeby
// przycinania. Wczesniej uzywalismy "A4" + reczne przyciecie do gornego-lewego rogu
// strony (patrz historia tego pliku) — dzialalo to przypadkiem dla domyslnych
// przesylek InPost, ale dla UPS/international etykieta w wersji A4 jest OBROCONA
// o 90° i umieszczona w LEWYM-DOLNYM rogu (czasem tez poprzedzona strona z "Your
// closest UPS Access Points"), wiec przyciecie top-left lapalo pusta/zla tresc —
// admin drukowal nieprawidlowy plik. "A6" (bez "L") dla obu typow przesylek zwraca
// blad "Wystapil blad podczas pobierania dokumentow" — nie mylic z "LBL".
// Id to Order[0].id z odpowiedzi createOrderV2 (NIE CartOrder.id_prefix) — patrz bcFindOrder().
export async function bcGetWaybillPdf(blpaczkaOrderId: string): Promise<{ pdf: Buffer | null; link: string | null; raw: unknown }> {
  const printerType = process.env.BASECOURIER_PRINTER || "LBL";
  const env = await bcCall<unknown>("getWaybill.json", {
    Order: { id: bcNumericId(blpaczkaOrderId, "getWaybill.json"), printer_type: printerType },
  });
  if (!env.success) throw new BcRejectedError(bcErrorMessage(env), "getWaybill.json", null);
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

// Sledzenie — dziala dla KAZDEGO kuriera obslugiwanego przez Base Courier
// (DPD, GLS, UPS...), nie tylko InPost. Kontrakt zweryfikowany na zywo
// (2026-09-21) dla przesylki DPD Export Standard:
//   POST getOrderDetails.json  { Order: { id: <int> } }
//   -> { success: true, data: { Order: {...}, Tracking: [
//        { TrackingStatus: { status, status_desc, delivered, event_time,
//                             bl_status_mapped, received_by, terminal, error_desc } },
//        ...
//      ] } }
// "bl_status_mapped" to znormalizowany status Base Courier (np. "STATUS_CREATE"
// dla swiezo utworzonej etykiety, przed odbiorem/nadaniem) — wspolny dla
// wszystkich kurierow, w przeciwienstwie do surowych kodow (status/status_desc),
// ktore sa specyficzne dla danego przewoznika.
export interface BcTrackingEvent {
  status: string;
  statusDesc: string | null;
  blStatusMapped: string | null;
  delivered: boolean;
  eventTime: string | null;
}

export interface BcOrderDetails {
  courierName: string | null;
  noPickup: boolean | null;
  events: BcTrackingEvent[];
  raw: unknown;
}

export async function bcGetOrderDetails(blpaczkaOrderId: string): Promise<BcOrderDetails> {
  const env = await bcCall<{ Order?: Record<string, unknown>; Tracking?: Array<{ TrackingStatus?: Record<string, unknown> }> }>(
    "getOrderDetails.json",
    { Order: { id: bcNumericId(blpaczkaOrderId, "getOrderDetails.json") } }
  );
  if (!env.success) throw new BcRejectedError(bcErrorMessage(env), "getOrderDetails.json", null);
  const d = env.data ?? {};
  const events: BcTrackingEvent[] = (d.Tracking ?? [])
    .map((t) => t.TrackingStatus)
    .filter((s): s is Record<string, unknown> => !!s)
    .map((s) => ({
      status: typeof s.status === "string" ? s.status : "",
      statusDesc: typeof s.status_desc === "string" ? s.status_desc : null,
      blStatusMapped: typeof s.bl_status_mapped === "string" ? s.bl_status_mapped : null,
      delivered: s.delivered === true,
      eventTime: typeof s.event_time === "string" ? s.event_time : null,
    }));
  return {
    courierName: typeof d.Order?.courier_name === "string" ? d.Order.courier_name : null,
    noPickup: typeof d.Order?.no_pickup === "boolean" ? d.Order.no_pickup : null,
    events,
    raw: d,
  };
}

// Panel Base Courier pokazuje odbiorcy/nadawcy "Numer zamowienia" (CartOrder.id_prefix,
// np. 23729913) — TO NIE JEST to samo co "Order.id" (np. 23780392), ktorego wymaga
// getOrderDetails.json/getWaybill.json. Admin naturalnie kopiuje ten pierwszy (jest
// najbardziej widoczny w ich UI), wiec "Powiaz zlecenie" szuka po OBU: sprawdza liste
// getOrders.json (do 5 stron, max 500 zlecen — konto ma ich dzis kilkanascie) i dopasowuje
// po id_prefix ALBO po Order.id. Przy okazji: getOrders.json (w przeciwienstwie do
// getOrderDetails.json, ktore dla tego zlecenia zwrocilo waybill_no=null mimo ze etykieta
// juz istnieje) ma numer listu przewozowego w tym samym wpisie — jesli sie znajdzie,
// nie trzeba go juz wpisywac recznie.
export interface BcOrderLookup {
  orderId: string;
  waybillNo: string | null;
  takerName: string | null;
}

type BcOrderRow = { Order?: Record<string, unknown>; CartOrder?: Record<string, unknown> };

export async function bcFindOrder(idOrPrefix: string): Promise<BcOrderLookup | null> {
  const needle = idOrPrefix.trim();
  for (let page = 1; page <= 5; page++) {
    const env = await bcCall<BcOrderRow[]>("getOrders.json", { Pagination: { page } });
    if (!env.success) throw new BcRejectedError(bcErrorMessage(env), "getOrders.json", null);
    const rows = env.data ?? [];
    for (const row of rows) {
      const orderId = row.Order?.id;
      const idPrefix = row.CartOrder?.id_prefix;
      if (String(orderId ?? "") === needle || String(idPrefix ?? "") === needle) {
        return {
          orderId: String(orderId),
          waybillNo: typeof row.Order?.waybill_no === "string" && row.Order.waybill_no.trim() ? row.Order.waybill_no.trim() : null,
          takerName: typeof row.Order?.taker_name === "string" ? row.Order.taker_name : null,
        };
      }
    }
    // "pagination" jest polem odpowiedzi obok "data" — nie ma go w BaseCourierEnvelope<T>, doczytujemy osobno.
    const pagination = (env as unknown as { pagination?: { next?: boolean } }).pagination;
    if (!pagination?.next) break;
  }
  return null;
}
