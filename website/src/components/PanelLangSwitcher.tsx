"use client";

import { locales, localeLabel, localeName, type Locale } from "@/lib/i18n";

// Przełącznik języka panelu — steruje stanem z usePanelLang (localStorage),
// bez nawigacji. Przy 11 językach rząd przycisków nie mieści się na telefonie,
// więc to natywny <select>: na mobile otwiera systemową listę (duże, czytelne
// pozycje z pełną nazwą języka), a zamknięty zajmuje tyle co etykieta "PL ▾".
export default function PanelLangSwitcher({
  lang,
  setLang,
  compact = false,
}: {
  lang: Locale;
  setLang: (l: Locale) => void;
  compact?: boolean;
}) {
  return (
    <label
      className={`relative inline-flex items-center border border-[rgba(242,237,227,0.18)] hover:border-[#D8FF3D] focus-within:border-[#D8FF3D] transition-colors ${
        compact ? "" : "min-w-[9.5rem]"
      }`}
      title={localeName[lang]}
    >
      <span className="sr-only">Język / Language</span>
      {/* Widoczna etykieta: kod + (poza trybem compact) pełna nazwa języka. */}
      <span
        aria-hidden="true"
        className="km-mono-eyebrow pointer-events-none flex items-center gap-2 px-2.5 py-1.5 text-[#F2EDE3]"
        lang={lang}
      >
        <span className="bg-[#D8FF3D] text-[#0B0B0B] px-1.5">{localeLabel[lang]}</span>
        {!compact && <span className="text-[#F2EDE3]/70 normal-case">{localeName[lang]}</span>}
        <span className="text-[#F2EDE3]/55">▾</span>
      </span>
      <select
        value={lang}
        onChange={(e) => setLang(e.target.value as Locale)}
        aria-label="Język / Language"
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer text-base"
      >
        {locales.map((l) => (
          <option key={l} value={l} lang={l} className="bg-[#0B0B0B] text-[#F2EDE3]">
            {localeName[l]} ({localeLabel[l]})
          </option>
        ))}
      </select>
    </label>
  );
}
