// Centralny moduł i18n dla strony marketingowej KalkMate.
// Routing: "/" = polski (domyślny), "/en" = angielski, "/de" = niemiecki.
// Komponenty marketingowe przyjmują prop `lang: Locale` i trzymają tłumaczenia
// współlokalizowane (obiekt { pl, en, de }) — dzięki temu /, /en i /de renderują
// te same komponenty, bez rozjazdu designu między językami.

export const locales = ["pl", "en", "de"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "pl";

export const SITE_URL = "https://kalkmate.pl";

/** Ścieżka strony głównej dla danego języka. */
export function localeHome(locale: Locale): string {
  return locale === "pl" ? "/" : `/${locale}`;
}

/** Absolutny URL strony głównej dla danego języka. */
export function localeHomeUrl(locale: Locale): string {
  return locale === "pl" ? `${SITE_URL}/` : `${SITE_URL}/${locale}`;
}

/** Wykrycie języka na podstawie ścieżki (dla globalnego chrome bez propa). */
export function localeFromPathname(pathname: string | null | undefined): Locale {
  if (!pathname) return defaultLocale;
  if (pathname === "/en" || pathname.startsWith("/en/")) return "en";
  if (pathname === "/de" || pathname.startsWith("/de/")) return "de";
  return defaultLocale;
}

/** locale w formacie Open Graph (np. pl_PL). */
export const ogLocale: Record<Locale, string> = {
  pl: "pl_PL",
  en: "en_US",
  de: "de_DE",
};

/** Krótka etykieta przełącznika języka. */
export const localeLabel: Record<Locale, string> = {
  pl: "PL",
  en: "EN",
  de: "DE",
};

/** Pełna nazwa języka (we własnym języku). */
export const localeName: Record<Locale, string> = {
  pl: "Polski",
  en: "English",
  de: "Deutsch",
};

/** Mapa alternates dla metadata Next.js (hreflang). */
export function languageAlternates(): Record<string, string> {
  return {
    pl: `${SITE_URL}/`,
    en: `${SITE_URL}/en`,
    de: `${SITE_URL}/de`,
    "x-default": `${SITE_URL}/`,
  };
}
