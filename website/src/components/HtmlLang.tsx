"use client";

import { useEffect } from "react";

// Root layout renderuje <html lang="pl">. Na stronach pozostałych języków
// (/en, /de, /cs, /sk, /lt, /be, /es, /pt, /fr, /it i ich /pomoc) ustawiamy
// poprawny atrybut lang po stronie klienta — Google wykonuje JS, a użytkownicy
// czytników ekranu dostają właściwy język (ważne też dla doboru fontu/
// dzielenia wyrazów, np. cyrylica na /be).
export default function HtmlLang({ lang }: { lang: string }) {
  useEffect(() => {
    const prev = document.documentElement.lang;
    document.documentElement.lang = lang;
    return () => {
      document.documentElement.lang = prev;
    };
  }, [lang]);
  return null;
}
