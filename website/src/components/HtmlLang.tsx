"use client";

import { useEffect } from "react";

// Root layout renderuje <html lang="pl">. Na stronach /en i /de ustawiamy
// poprawny atrybut lang po stronie klienta — Google wykonuje JS, a użytkownicy
// czytników ekranu dostają właściwy język.
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
