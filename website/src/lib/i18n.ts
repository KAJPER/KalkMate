// Centralny moduł i18n dla strony marketingowej KalkMate.
// Routing: "/" = polski (domyślny), pozostałe języki pod prefiksem:
// /en angielski, /de niemiecki, /cs czeski, /sk słowacki, /lt litewski,
// /be białoruski (cyrylica), /es hiszpański, /pt portugalski, /fr francuski,
// /it włoski.
// Komponenty marketingowe przyjmują prop `lang: Locale` i trzymają tłumaczenia
// współlokalizowane (obiekt { pl, en, de, cs, sk, ... }) — dzięki temu wszystkie
// wersje językowe renderują te same komponenty, bez rozjazdu designu.

export const locales = ["pl", "en", "de", "cs", "sk", "lt", "be", "es", "pt", "fr", "it"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "pl";

/** Type guard: czy string to obsługiwany Locale. */
export function isLocale(v: unknown): v is Locale {
  return typeof v === "string" && (locales as readonly string[]).includes(v);
}

export const SITE_URL = "https://kalkmate.pl";
export const EU_SITE_URL = "https://kalkmate.eu";

// kalkmate.eu serwuje TEN SAM kod co kalkmate.pl (wspolny backend/baza/panel
// admina), ale ma byc WLASNYM bytem SEO — canonical/hreflang/JSON-LD musza
// wskazywac na .eu, kiedy strona jest odwiedzana pod .eu, inaczej Google
// nigdy nie zaindeksuje jej niezaleznie (zobaczylby wszedzie canonical na
// kalkmate.pl i pominal .eu jako duplikat). Admin panel, transakcyjne maile
// i wewnetrzne wywolania API (referer do OpenRoutera itp.) CELOWO zostaja
// pod SITE_URL (kalkmate.pl) — to nie sa sygnaly SEO, tylko biznesowa
// logika dzialajaca zawsze na tym samym, glownym adresie.
export function siteUrlFromHost(host: string | null | undefined): string {
  const h = (host || "").toLowerCase().split(":")[0]; // odetnij ewentualny port
  if (h === "kalkmate.eu" || h === "www.kalkmate.eu") return EU_SITE_URL;
  return SITE_URL;
}

/** Ścieżka strony głównej dla danego języka. */
export function localeHome(locale: Locale): string {
  return locale === "pl" ? "/" : `/${locale}`;
}

/**
 * Ścieżka dowolnej podstrony dla danego języka, np. localePath("de", "/pomoc")
 * -> "/de/pomoc". `path` bez językowego prefiksu, zaczyna się od "/".
 */
export function localePath(locale: Locale, path: string): string {
  return locale === "pl" ? path : `/${locale}${path}`;
}

/** Absolutny URL strony głównej dla danego języka. */
export function localeHomeUrl(locale: Locale, siteUrl: string = SITE_URL): string {
  return locale === "pl" ? `${siteUrl}/` : `${siteUrl}/${locale}`;
}

/** Wykrycie języka na podstawie ścieżki (dla globalnego chrome bez propa). */
export function localeFromPathname(pathname: string | null | undefined): Locale {
  if (!pathname) return defaultLocale;
  const seg = pathname.split("/")[1] || "";
  return seg !== "pl" && isLocale(seg) ? seg : defaultLocale;
}

/** locale w formacie Open Graph (np. pl_PL). */
export const ogLocale: Record<Locale, string> = {
  pl: "pl_PL",
  en: "en_US",
  de: "de_DE",
  cs: "cs_CZ",
  sk: "sk_SK",
  lt: "lt_LT",
  be: "be_BY",
  es: "es_ES",
  pt: "pt_PT",
  fr: "fr_FR",
  it: "it_IT",
};

/** Krótka etykieta przełącznika języka. */
export const localeLabel: Record<Locale, string> = {
  pl: "PL",
  en: "EN",
  de: "DE",
  cs: "CS",
  sk: "SK",
  lt: "LT",
  be: "BE",
  es: "ES",
  pt: "PT",
  fr: "FR",
  it: "IT",
};

/** Pełna nazwa języka (we własnym języku). */
export const localeName: Record<Locale, string> = {
  pl: "Polski",
  en: "English",
  de: "Deutsch",
  cs: "Čeština",
  sk: "Slovenčina",
  lt: "Lietuvių",
  be: "Беларуская",
  es: "Español",
  pt: "Português",
  fr: "Français",
  it: "Italiano",
};

/** Mapa alternates dla metadata Next.js (hreflang). */
export function languageAlternates(siteUrl: string = SITE_URL): Record<string, string> {
  const out: Record<string, string> = {};
  for (const l of locales) out[l] = localeHomeUrl(l, siteUrl);
  out["x-default"] = `${siteUrl}/`;
  return out;
}

/**
 * Alternates hreflang dla podstrony obecnej we wszystkich językach,
 * np. languagePathAlternates("/pomoc") -> { pl: ".../pomoc", en: ".../en/pomoc", ... }.
 */
export function languagePathAlternates(path: string, siteUrl: string = SITE_URL): Record<string, string> {
  const out: Record<string, string> = {};
  for (const l of locales) out[l] = `${siteUrl}${localePath(l, path)}`;
  out["x-default"] = `${siteUrl}${path}`;
  return out;
}
