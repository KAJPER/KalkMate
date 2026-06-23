"use client";

import { useEffect, useState } from "react";
import { type Locale, locales, defaultLocale } from "@/lib/i18n";

const KEY = "kalkmate-panel-lang";

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
        const nav = (navigator.language || "").slice(0, 2).toLowerCase();
        if (nav === "de") setLangState("de");
        else if (nav === "en") setLangState("en");
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
