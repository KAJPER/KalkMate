"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { type Locale } from "@/lib/i18n";
import { faqs } from "@/lib/content/faq";

const content: Record<
  Locale,
  {
    eyebrow: string;
    h2: { before: string; italic: string; after: string };
    sideParagraph: string;
  }
> = {
  pl: {
    eyebrow: "[ 06 ] · FAQ",
    h2: { before: "Pytania, ", italic: "które", after: "każdy ma." },
    sideParagraph: "Nie znalazłeś odpowiedzi? Napisz — odpowiadam w ciągu 24h.",
  },
  en: {
    eyebrow: "[ 06 ] · FAQ",
    h2: { before: "Questions ", italic: "everyone", after: "has." },
    sideParagraph: "Didn't find your answer? Drop me a line — I reply within 24h.",
  },
  de: {
    eyebrow: "[ 06 ] · FAQ",
    h2: { before: "Fragen, ", italic: "die", after: "jeder hat." },
    sideParagraph: "Keine Antwort gefunden? Schreib mir — ich antworte innerhalb von 24h.",
  },
};

function Item({ item, n }: { item: { q: string; a: string }; n: number }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-[rgba(242,237,227,0.10)]">
      <button
        onClick={() => setOpen((v) => !v)}
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
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <p className="pb-8 pl-[4.5rem] pr-12 text-[15px] leading-[1.65] text-[#F2EDE3]/70 max-w-3xl">
              {item.a}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function FAQ({ lang = "pl" }: { lang?: Locale }) {
  const t = content[lang];
  const items = faqs[lang];
  return (
    <section id="faq" className="relative py-24 lg:py-36">
      <div className="mx-auto max-w-[1400px] px-5 lg:px-10">
        <div className="grid lg:grid-cols-12 gap-8 items-end mb-12 lg:mb-16">
          <div className="lg:col-span-8">
            <p className="km-mono-eyebrow text-[#D8FF3D]">{t.eyebrow}</p>
            <h2 className="km-display text-[clamp(40px,7vw,108px)] text-[#F2EDE3] mt-4">
              {t.h2.before}<span className="italic">{t.h2.italic}</span><br />
              {t.h2.after}
            </h2>
          </div>
          <div className="lg:col-span-4">
            <p className="text-[15px] leading-[1.65] text-[#F2EDE3]/60">
              {t.sideParagraph}
            </p>
            <a
              href="mailto:kontakt@kalkmate.pl"
              className="km-mono-eyebrow text-[#D8FF3D] mt-3 inline-flex items-center gap-2"
            >
              kontakt@kalkmate.pl <span>↗</span>
            </a>
          </div>
        </div>

        <div className="border-t border-[rgba(242,237,227,0.10)]">
          {items.map((f, i) => (
            <Item key={i} item={f} n={i + 1} />
          ))}
        </div>
      </div>
    </section>
  );
}
