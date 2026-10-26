"use client";

import { useEffect, useState } from "react";
import { type Locale, locales, defaultLocale } from "@/lib/i18n";

const KEY = "kalkmate-panel-lang";

// Tylko pewne mapowania: tag przeglądarki → obsługiwany język po samym
// podstawowym podtagu (pt-BR → pt, es-MX → es, fr-CA → fr, de-AT → de,
// en-US → en). Słowacki ma teraz własne tłumaczenie (wcześniej sk → cs).
// Języków "pokrewnych" (ca/gl → es, ru/uk → be itp.) celowo NIE zgadujemy —
// wtedy szukamy dalej w navigator.languages, a w ostateczności zostaje "pl".
function detectBrowserLocale(): Locale | null {
  const prefs =
    typeof navigator === "undefined"
      ? []
      : navigator.languages && navigator.languages.length > 0
        ? navigator.languages
        : [navigator.language || ""];
  for (const tag of prefs) {
    const primary = (tag || "").toLowerCase().split(/[-_]/)[0];
    if ((locales as readonly string[]).includes(primary)) return primary as Locale;
  }
  return null;
}

// Język panelu (zalogowany dashboard). Panel ma jedną ścieżkę /panel bez routingu
// językowego, więc wybór języka trzymamy w localStorage. Pierwszy render (SSR i
// pierwsza hydracja) używa domyślnego "pl", a useEffect podmienia na zapamiętany
// wybór / język przeglądarki — krótki flash jest akceptowalny w panelu aplikacji.
export function usePanelLang(): {
  lang: Locale;
  setLang: (l: Locale) => void;
  ready: boolean;
} {
  const [lang, setLangState] = useState<Locale>(defaultLocale);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved && (locales as readonly string[]).includes(saved)) {
        setLangState(saved as Locale);
      } else {
        const detected = detectBrowserLocale();
        if (detected) setLangState(detected);
      }
    } catch {
      /* localStorage niedostępny — zostaje domyślny */
    }
    setReady(true);
  }, []);

  const setLang = (l: Locale) => {
    setLangState(l);
    try {
      localStorage.setItem(KEY, l);
    } catch {
      /* ignore */
    }
  };

  return { lang, setLang, ready };
}
