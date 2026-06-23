"use client";

import { locales, localeLabel, type Locale } from "@/lib/i18n";

// Przełącznik języka panelu — steruje stanem z usePanelLang (localStorage),
// bez nawigacji. Wygląd spójny z LanguageSwitcher na landingu.
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
    <div
      className={`inline-flex items-center ${compact ? "gap-1" : "gap-0"} border border-[rgba(242,237,227,0.18)]`}
      role="group"
      aria-label="Język / Language / Sprache"
    >
      {locales.map((l) => {
        const active = l === lang;
        return (
          <button
            key={l}
            type="button"
            onClick={() => setLang(l)}
            aria-current={active ? "true" : undefined}
            className={`km-mono-eyebrow px-2.5 py-1.5 transition-colors ${
              active
                ? "bg-[#D8FF3D] text-[#0B0B0B]"
                : "text-[#F2EDE3]/55 hover:text-[#F2EDE3]"
            }`}
          >
            {localeLabel[l]}
          </button>
        );
      })}
    </div>
  );
}
