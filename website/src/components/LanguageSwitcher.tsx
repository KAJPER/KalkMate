"use client";

import { useEffect, useId, useRef, useState } from "react";
import { locales, localeLabel, localeName, localeHome, localePath, type Locale } from "@/lib/i18n";

// Przełącznik języka — rozwijana lista (przy 11 językach rząd przycisków
// rozsadzał nagłówek i był nieczytelny na telefonie). Domyślnie linkuje do
// strony głównej danego języka; przekaż `path` (np. "/pomoc") żeby linkował
// do odpowiednika tej samej podstrony.
// `compact` — wariant do menu mobilnego: przycisk na pełną szerokość, lista
// rozwija się w treści menu (siatka 2 kolumn, duże pola dotyku).
// Linki są zawsze w DOM (lista tylko ukrywana klasą) — crawlery widzą
// wszystkie wersje językowe z hrefLang.
export default function LanguageSwitcher({
  current,
  compact = false,
  path,
}: {
  current: Locale;
  compact?: boolean;
  path?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const listClass = compact
    ? `${open ? "grid" : "hidden"} mt-2 grid-cols-2 gap-px bg-[rgba(242,237,227,0.10)] border border-[rgba(242,237,227,0.10)]`
    : `${open ? "block" : "hidden"} absolute right-0 top-full mt-2 z-50 w-56 max-h-[70vh] overflow-y-auto bg-[#0B0B0B] border border-[rgba(242,237,227,0.18)] shadow-2xl py-1`;

  return (
    <div ref={rootRef} className={compact ? "relative w-full" : "relative"}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={listId}
        aria-label={`Język / Language · ${localeName[current]}`}
        className={`inline-flex items-center gap-2 km-mono-eyebrow border transition-colors ${
          open
            ? "border-[#D8FF3D] text-[#F2EDE3]"
            : "border-[rgba(242,237,227,0.18)] text-[#F2EDE3]/75 hover:border-[#D8FF3D] hover:text-[#F2EDE3]"
        } ${compact ? "w-full justify-between px-4 py-3" : "px-3 py-1.5"}`}
      >
        <span className="inline-flex items-center gap-2">
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="2" y1="12" x2="22" y2="12" />
            <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
          </svg>
          {compact ? (
            <span lang={current}>
              {localeName[current]} <span className="text-[#F2EDE3]/45">· {localeLabel[current]}</span>
            </span>
          ) : (
            <span>{localeLabel[current]}</span>
          )}
        </span>
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          aria-hidden="true"
          className={`transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path d="M1.5 3.5L5 7l3.5-3.5" />
        </svg>
      </button>

      <ul id={listId} className={listClass}>
        {locales.map((l) => {
          const active = l === current;
          return (
            <li key={l} className={compact ? "bg-[#0B0B0B]" : undefined}>
              <a
                href={path ? localePath(l, path) : localeHome(l)}
                hrefLang={l}
                lang={l}
                aria-current={active ? "page" : undefined}
                onClick={() => setOpen(false)}
                className={`flex items-center justify-between gap-3 transition-colors ${
                  compact ? "px-4 py-3 min-h-[48px] text-[15px]" : "px-4 py-2.5 text-[14px]"
                } ${
                  active
                    ? "text-[#D8FF3D]"
                    : "text-[#F2EDE3]/80 hover:text-[#F2EDE3] hover:bg-[#151515]"
                }`}
              >
                <span>{localeName[l]}</span>
                <span className={`km-mono-eyebrow ${active ? "text-[#D8FF3D]" : "text-[#F2EDE3]/35"}`}>
                  {localeLabel[l]}
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
