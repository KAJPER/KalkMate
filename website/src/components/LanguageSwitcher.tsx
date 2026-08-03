"use client";

import { locales, localeLabel, localeHome, localePath, type Locale } from "@/lib/i18n";

// Przełącznik języka. Domyślnie linkuje do strony głównej PL/EN/DE; przekaż
// `path` (np. "/pomoc") żeby linkował do odpowiednika tej samej podstrony.
// `compact` — wariant do menu mobilnego (większe elementy).
export default function LanguageSwitcher({
  current,
  compact = false,
  path,
}: {
  current: Locale;
  compact?: boolean;
  path?: string;
}) {
  return (
    <div
      className={`inline-flex items-center ${compact ? "gap-1" : "gap-0"} border border-[rgba(242,237,227,0.18)]`}
      role="group"
      aria-label="Język / Language / Sprache"
    >
      {locales.map((l) => {
        const active = l === current;
        return (
          <a
            key={l}
            href={path ? localePath(l, path) : localeHome(l)}
            hrefLang={l}
            aria-current={active ? "true" : undefined}
            className={`km-mono-eyebrow px-2.5 py-1.5 transition-colors ${
              active
                ? "bg-[#D8FF3D] text-[#0B0B0B]"
                : "text-[#F2EDE3]/55 hover:text-[#F2EDE3]"
            }`}
          >
            {localeLabel[l]}
          </a>
        );
      })}
    </div>
  );
}
