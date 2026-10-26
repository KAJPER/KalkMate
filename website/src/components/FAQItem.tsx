"use client";

import { useId, useState } from "react";

// Klientowa czesc FAQ (rozwijanie odpowiedzi). Sama sekcja FAQ (FAQ.tsx) jest
// serwerowa — do przegladarki trafiaja tylko pytania biezacego jezyka (w RSC
// payloadzie), a nie caly slownik src/lib/content/faq.ts dla 11 jezykow.
export default function FAQItem({ item, n }: { item: { q: string; a: string }; n: number }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  return (
    <div className="border-b border-[rgba(242,237,227,0.10)]">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        className="w-full py-6 lg:py-7 flex items-start gap-6 text-left group"
      >
        <span className="km-mono-eyebrow text-[#D8FF3D] pt-2 w-12 flex-shrink-0">
          {String(n).padStart(2, "0")}
        </span>
        <span className="flex-1 km-display text-2xl lg:text-[28px] text-[#F2EDE3] leading-tight group-hover:text-[#D8FF3D] transition-colors">
          {item.q}
        </span>
        <span
          className={`flex-shrink-0 w-8 h-8 border border-[rgba(242,237,227,0.20)] flex items-center justify-center km-display text-xl text-[#F2EDE3] transition-transform ${
            open ? "rotate-45 border-[#D8FF3D] text-[#D8FF3D]" : ""
          }`}
        >
          +
        </span>
      </button>
      {/* CSS (grid-rows 0fr -> 1fr) zamiast framer-motion AnimatePresence —
          odpowiedz jest zawsze w HTML (SEO), a FAQ nie ciagnie framer-motion. */}
      <div
        id={panelId}
        aria-hidden={!open}
        className={`grid transition-[grid-template-rows,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <p className="pb-8 pl-[4.5rem] pr-12 text-[15px] leading-[1.65] text-[#F2EDE3]/70 max-w-3xl">
            {item.a}
          </p>
        </div>
      </div>
    </div>
  );
}
