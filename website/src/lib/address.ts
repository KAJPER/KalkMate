// Rozbicie adresu z jednego pola ("ulica + numer") na ulice / numer budynku /
// numer mieszkania — do importu CSV w Furgonetce i do Base Courier, ktore chca
// te dane w osobnych kolumnach. Czysta funkcja (bez zaleznosci), uzywana i w
// panelu (przegladarka), i po stronie serwera.
//
// Dwa style zapisu:
//   - numer NA KONCU (Polska, Niemcy, wiekszosc Europy): "Marszalkowska 1/2", "Musterstrasse 12a"
//   - numer NA POCZATKU (USA, Kanada, UK, Irlandia, Australia, NZ): "217 Manhattan Avenue, unit 5B-3"
// Numer mieszkania z jawnym slowem ("unit", "apt", "suite", "flat", "#") jest
// wydzielany w obu stylach.

const NUMBER_FIRST_COUNTRIES = new Set(["US", "CA", "GB", "IE", "AU", "NZ"]);

export interface SplitAddress {
  street: string;
  building: string;
  apartment: string;
}

const UNIT_AT_END = /[,\s]+(?:unit|apt\.?|apartment|suite|ste\.?|flat|room|rm\.?|#)\s*\.?\s*([A-Za-z0-9][A-Za-z0-9-]*)\s*$/i;

export function splitAddress(full: string | null | undefined, country?: string | null): SplitAddress {
  let s = (full || "").trim().replace(/\s+/g, " ");
  if (!s) return { street: "", building: "", apartment: "" };

  let apartment = "";
  const unit = s.match(UNIT_AT_END);
  if (unit && unit.index !== undefined && unit.index > 0) {
    apartment = unit[1];
    s = s.slice(0, unit.index).replace(/[,\s]+$/, "");
  }

  const c = (country || "").toUpperCase();
  if (NUMBER_FIRST_COUNTRIES.has(c) || c === "OTHER") {
    const first = s.match(/^(\d+[A-Za-z]?(?:-\d+[A-Za-z]?)?)[\s,]+(.+)$/);
    if (first) return { street: first[2].trim(), building: first[1], apartment };
  }

  const last = s.match(/^(.*?)[\s,]+(\d+[A-Za-z]?(?:\/\d+[A-Za-z]?)?)$/);
  if (last && last[1].trim()) return { street: last[1].trim(), building: last[2], apartment };

  return { street: s, building: "", apartment };
}

// === Stan / prowincja (US, CA) ===
// UPS wymaga StateProvinceCode dla USA i Kanady; bez niego odrzuca nadanie
// (blad 120206 "Missing or invalid ship to StateProvinceCode", 2026-09-28).
// Formularz zamowienia ma tylko pole "miasto" — klienci wpisuja tam czesto
// "New York, new york" albo "Austin TX", wiec stan wykrywamy z tego pola.
const US_STATES: Record<string, string> = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA", colorado: "CO", connecticut: "CT",
  delaware: "DE", "district of columbia": "DC", florida: "FL", georgia: "GA", hawaii: "HI", idaho: "ID", illinois: "IL",
  indiana: "IN", iowa: "IA", kansas: "KS", kentucky: "KY", louisiana: "LA", maine: "ME", maryland: "MD",
  massachusetts: "MA", michigan: "MI", minnesota: "MN", mississippi: "MS", missouri: "MO", montana: "MT",
  nebraska: "NE", nevada: "NV", "new hampshire": "NH", "new jersey": "NJ", "new mexico": "NM", "new york": "NY",
  "north carolina": "NC", "north dakota": "ND", ohio: "OH", oklahoma: "OK", oregon: "OR", pennsylvania: "PA",
  "rhode island": "RI", "south carolina": "SC", "south dakota": "SD", tennessee: "TN", texas: "TX", utah: "UT",
  vermont: "VT", virginia: "VA", washington: "WA", "west virginia": "WV", wisconsin: "WI", wyoming: "WY",
};
const CA_PROVINCES: Record<string, string> = {
  alberta: "AB", "british columbia": "BC", manitoba: "MB", "new brunswick": "NB", "newfoundland and labrador": "NL",
  "nova scotia": "NS", ontario: "ON", "prince edward island": "PE", quebec: "QC", saskatchewan: "SK",
  "northwest territories": "NT", nunavut: "NU", yukon: "YT",
};

function stateTable(countryCode: string): Record<string, string> | null {
  // "OTHER" (formularz zakupu: "Other country") traktujemy jak USA — ta sama konwencja co w basecourier.ts.
  const c = (countryCode || "").toUpperCase() === "OTHER" ? "US" : (countryCode || "").toUpperCase();
  return c === "US" ? US_STATES : c === "CA" ? CA_PROVINCES : null;
}

// Kraje, w ktorych UPS wymaga kodu stanu/prowincji.
export function needsStateCode(countryCode: string): boolean {
  return stateTable(countryCode) !== null;
}

export function isValidStateCode(countryCode: string, code: string): boolean {
  const t = stateTable(countryCode);
  return !!t && Object.values(t).includes((code || "").toUpperCase());
}

// "New York, new york" -> { city: "New York", state: "NY" }; "Austin TX" -> { city: "Austin", state: "TX" };
// samo "New York" (miasto = nazwa stanu, brak osobnego stanu) -> state "" (admin dopisuje w panelu).
export function splitCityState(city: string | null | undefined, countryCode: string | null | undefined): { city: string; state: string } {
  const raw = (city || "").trim();
  const table = stateTable(countryCode || "");
  if (!table || !raw) return { city: raw, state: "" };
  const codes = new Set(Object.values(table));
  const trailingCode = raw.match(/^(.*?)[\s,]+([A-Za-z]{2})\.?$/);
  if (trailingCode && trailingCode[1].trim() && codes.has(trailingCode[2].toUpperCase())) {
    return { city: trailingCode[1].trim().replace(/[\s,]+$/, ""), state: trailingCode[2].toUpperCase() };
  }
  const lower = raw.toLowerCase();
  for (const [name, code] of Object.entries(table).sort((a, b) => b[0].length - a[0].length)) {
    if (lower.endsWith(name)) {
      const before = raw.slice(0, raw.length - name.length).replace(/[\s,]+$/, "").trim();
      if (before) return { city: before, state: code };
    }
  }
  return { city: raw, state: "" };
}
