// Kraje dostawy dla formularza zamowienia (BuyNow): pelna lista ISO 3166-1,
// nazwy w jezyku strony (Intl.DisplayNames — bez wielkich tablic tlumaczen),
// prefiksy telefoniczne i stany/prowincje tam, gdzie kurier ich wymaga.
//
// Stan NIE ma osobnej kolumny w Order — idzie do miasta jako "Austin, TX",
// ta sama konwencja co cityWithState() w panelu i splitCityState() w
// lib/address.ts (UPS wymaga StateProvinceCode dla US/CA).

// Bez krajow objetych embargiem/sankcjami na elektronike (KP, IR, SY, CU, RU, BY)
// i terytoriow bez normalnej dostawy kurierskiej (AQ, BV, HM, UM, TF, IO).
export const ALL_COUNTRY_CODES = [
  "AD","AE","AF","AG","AI","AL","AM","AO","AR","AS","AT","AU","AW","AX","AZ",
  "BA","BB","BD","BE","BF","BG","BH","BI","BJ","BL","BM","BN","BO","BQ","BR","BS","BT","BW","BZ",
  "CA","CC","CD","CF","CG","CH","CI","CK","CL","CM","CN","CO","CR","CV","CW","CX","CY","CZ",
  "DE","DJ","DK","DM","DO","DZ",
  "EC","EE","EG","EH","ER","ES","ET",
  "FI","FJ","FK","FM","FO","FR",
  "GA","GB","GD","GE","GF","GG","GH","GI","GL","GM","GN","GP","GQ","GR","GS","GT","GU","GW","GY",
  "HK","HN","HR","HT","HU",
  "ID","IE","IL","IM","IN","IQ","IS","IT",
  "JE","JM","JO","JP",
  "KE","KG","KH","KI","KM","KN","KR","KW","KY","KZ",
  "LA","LB","LC","LI","LK","LR","LS","LT","LU","LV","LY",
  "MA","MC","MD","ME","MF","MG","MH","MK","ML","MM","MN","MO","MP","MQ","MR","MS","MT","MU","MV","MW","MX","MY","MZ",
  "NA","NC","NE","NF","NG","NI","NL","NO","NP","NR","NU","NZ",
  "OM",
  "PA","PE","PF","PG","PH","PK","PL","PM","PN","PR","PS","PT","PW","PY",
  "QA",
  "RE","RO","RS","RW",
  "SA","SB","SC","SD","SE","SG","SH","SI","SJ","SK","SL","SM","SN","SO","SR","SS","ST","SV","SX","SZ",
  "TC","TD","TG","TH","TJ","TK","TL","TM","TN","TO","TR","TT","TV","TW","TZ",
  "UA","UG","US","UY","UZ",
  "VA","VC","VE","VG","VI","VN","VU",
  "WF","WS",
  "XK",
  "YE","YT",
  "ZA","ZM","ZW",
] as const;

// Numer kierunkowy (bez "+"). Kraje NANP (Karaiby itp.) maja "1".
const DIAL_CODES: Record<string, string> = {
  AD: "376", AE: "971", AF: "93", AG: "1", AI: "1", AL: "355", AM: "374", AO: "244", AR: "54", AS: "1",
  AT: "43", AU: "61", AW: "297", AX: "358", AZ: "994", BA: "387", BB: "1", BD: "880", BE: "32", BF: "226",
  BG: "359", BH: "973", BI: "257", BJ: "229", BL: "590", BM: "1", BN: "673", BO: "591", BQ: "599", BR: "55",
  BS: "1", BT: "975", BW: "267", BZ: "501", CA: "1", CC: "61", CD: "243", CF: "236", CG: "242", CH: "41",
  CI: "225", CK: "682", CL: "56", CM: "237", CN: "86", CO: "57", CR: "506", CV: "238", CW: "599", CX: "61",
  CY: "357", CZ: "420", DE: "49", DJ: "253", DK: "45", DM: "1", DO: "1", DZ: "213", EC: "593", EE: "372",
  EG: "20", EH: "212", ER: "291", ES: "34", ET: "251", FI: "358", FJ: "679", FK: "500", FM: "691", FO: "298",
  FR: "33", GA: "241", GB: "44", GD: "1", GE: "995", GF: "594", GG: "44", GH: "233", GI: "350", GL: "299",
  GM: "220", GN: "224", GP: "590", GQ: "240", GR: "30", GS: "500", GT: "502", GU: "1", GW: "245", GY: "592",
  HK: "852", HN: "504", HR: "385", HT: "509", HU: "36", ID: "62", IE: "353", IL: "972", IM: "44", IN: "91",
  IQ: "964", IS: "354", IT: "39", JE: "44", JM: "1", JO: "962", JP: "81", KE: "254", KG: "996", KH: "855",
  KI: "686", KM: "269", KN: "1", KR: "82", KW: "965", KY: "1", KZ: "7", LA: "856", LB: "961", LC: "1",
  LI: "423", LK: "94", LR: "231", LS: "266", LT: "370", LU: "352", LV: "371", LY: "218", MA: "212", MC: "377",
  MD: "373", ME: "382", MF: "590", MG: "261", MH: "692", MK: "389", ML: "223", MM: "95", MN: "976", MO: "853",
  MP: "1", MQ: "596", MR: "222", MS: "1", MT: "356", MU: "230", MV: "960", MW: "265", MX: "52", MY: "60",
  MZ: "258", NA: "264", NC: "687", NE: "227", NF: "672", NG: "234", NI: "505", NL: "31", NO: "47", NP: "977",
  NR: "674", NU: "683", NZ: "64", OM: "968", PA: "507", PE: "51", PF: "689", PG: "675", PH: "63", PK: "92",
  PL: "48", PM: "508", PN: "64", PR: "1", PS: "970", PT: "351", PW: "680", PY: "595", QA: "974", RE: "262",
  RO: "40", RS: "381", RW: "250", SA: "966", SB: "677", SC: "248", SD: "249", SE: "46", SG: "65", SH: "290",
  SI: "386", SJ: "47", SK: "421", SL: "232", SM: "378", SN: "221", SO: "252", SR: "597", SS: "211", ST: "239",
  SV: "503", SX: "1", SZ: "268", TC: "1", TD: "235", TG: "228", TH: "66", TJ: "992", TK: "690", TL: "670",
  TM: "993", TN: "216", TO: "676", TR: "90", TT: "1", TV: "688", TW: "886", TZ: "255", UA: "380", UG: "256",
  US: "1", UY: "598", UZ: "998", VA: "39", VC: "1", VE: "58", VG: "1", VI: "1", VN: "84", VU: "678",
  WF: "681", WS: "685", XK: "383", YE: "967", YT: "262", ZA: "27", ZM: "260", ZW: "263",
};

export function dialCode(country: string): string {
  const d = DIAL_CODES[(country || "").toUpperCase()];
  return d ? `+${d}` : "";
}

export function flagEmoji(code: string): string {
  if (!/^[A-Z]{2}$/.test(code)) return "🌍";
  return String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

// Intl.DisplayNames jest w kazdej obslugiwanej przegladarce (browserslist:
// ostatnie 2 wersje); fallback na sam kod, gdyby jednak go nie bylo.
const displayNames = new Map<string, Intl.DisplayNames | null>();

export function countryName(code: string, lang: string): string {
  if (!displayNames.has(lang)) {
    try {
      displayNames.set(lang, new Intl.DisplayNames([lang], { type: "region" }));
    } catch {
      displayNames.set(lang, null);
    }
  }
  return displayNames.get(lang)?.of(code) || code;
}

// === Stany / prowincje ===
// Lista rozwijana tylko tam, gdzie adres bez stanu jest niekompletny
// (US/CA — UPS odrzuca nadanie, AU — poczta/kurierzy wymagaja stanu).
// Dla reszty swiata jest opcjonalne pole tekstowe "region" (np. Meksyk,
// Brazylia, Indie, Japonia — prefektura).
export interface Region { code: string; name: string }

const US_STATES: Region[] = [
  ["AL","Alabama"],["AK","Alaska"],["AZ","Arizona"],["AR","Arkansas"],["CA","California"],["CO","Colorado"],
  ["CT","Connecticut"],["DE","Delaware"],["DC","District of Columbia"],["FL","Florida"],["GA","Georgia"],
  ["HI","Hawaii"],["ID","Idaho"],["IL","Illinois"],["IN","Indiana"],["IA","Iowa"],["KS","Kansas"],
  ["KY","Kentucky"],["LA","Louisiana"],["ME","Maine"],["MD","Maryland"],["MA","Massachusetts"],["MI","Michigan"],
  ["MN","Minnesota"],["MS","Mississippi"],["MO","Missouri"],["MT","Montana"],["NE","Nebraska"],["NV","Nevada"],
  ["NH","New Hampshire"],["NJ","New Jersey"],["NM","New Mexico"],["NY","New York"],["NC","North Carolina"],
  ["ND","North Dakota"],["OH","Ohio"],["OK","Oklahoma"],["OR","Oregon"],["PA","Pennsylvania"],
  ["RI","Rhode Island"],["SC","South Carolina"],["SD","South Dakota"],["TN","Tennessee"],["TX","Texas"],
  ["UT","Utah"],["VT","Vermont"],["VA","Virginia"],["WA","Washington"],["WV","West Virginia"],
  ["WI","Wisconsin"],["WY","Wyoming"],
].map(([code, name]) => ({ code, name }));

const CA_PROVINCES: Region[] = [
  ["AB","Alberta"],["BC","British Columbia"],["MB","Manitoba"],["NB","New Brunswick"],
  ["NL","Newfoundland and Labrador"],["NS","Nova Scotia"],["NT","Northwest Territories"],["NU","Nunavut"],
  ["ON","Ontario"],["PE","Prince Edward Island"],["QC","Québec"],["SK","Saskatchewan"],["YT","Yukon"],
].map(([code, name]) => ({ code, name }));

const AU_STATES: Region[] = [
  ["ACT","Australian Capital Territory"],["NSW","New South Wales"],["NT","Northern Territory"],
  ["QLD","Queensland"],["SA","South Australia"],["TAS","Tasmania"],["VIC","Victoria"],["WA","Western Australia"],
].map(([code, name]) => ({ code, name }));

const REGIONS: Record<string, Region[]> = { US: US_STATES, CA: CA_PROVINCES, AU: AU_STATES };

export function regionsFor(country: string): Region[] | null {
  return REGIONS[(country || "").toUpperCase()] || null;
}

// Europa (EU + EFTA + UK + Balkany) — adres bez regionu jest kompletny,
// wiec nie pokazujemy nawet opcjonalnego pola.
const NO_REGION_FIELD = new Set([
  "PL","AT","BE","BG","HR","CY","CZ","DK","EE","FI","FR","DE","GR","HU","IE","IT","LV","LT","LU","MT","NL",
  "PT","RO","SK","SI","ES","SE","GB","CH","NO","IS","LI","AD","MC","SM","VA","AL","BA","ME","MK","RS","XK",
  "MD","UA","GI","IM","JE","GG","FO","AX","SG","HK","MO","IL",
]);

export function showsOptionalRegion(country: string): boolean {
  const c = (country || "").toUpperCase();
  return !REGIONS[c] && !NO_REGION_FIELD.has(c);
}

// "Austin" + "TX" -> "Austin, TX" (format, ktory rozumie splitCityState()).
export function cityWithRegion(city: string, region: string): string {
  const c = city.trim();
  const r = region.trim();
  return r ? `${c}, ${r}` : c;
}

// Kod pocztowy: etykieta/placeholder zalezny od kraju (tylko wskazowka, bez walidacji).
export function postcodeHint(country: string): string | null {
  switch ((country || "").toUpperCase()) {
    case "US": return "10001";
    case "CA": return "K1A 0B1";
    case "GB": return "SW1A 1AA";
    case "AU": return "2000";
    case "IL": return "6100000";
    case "PL": return "00-001";
    default: return null;
  }
}
