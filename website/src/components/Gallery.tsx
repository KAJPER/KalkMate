"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { type Locale } from "@/lib/i18n";

interface Shot {
  src: string;
  label: string;
  caption: string;
  span: string;
}

const shots: Record<Locale, Shot[]> = {
  pl: [
    {
      src: "/galeria/kalkulator-kalkmate-gotowy-egzemplarz.webp",
      label: "01 · Gotowy egzemplarz",
      caption: "KalkMate v3 — realne zdjęcie",
      span: "md:col-span-7 md:row-span-2 aspect-[4/5]",
    },
    {
      src: "/galeria/kalkulator-kalkmate-opakowanie-pudelko.webp",
      label: "02 · Opakowanie",
      caption: "Pudełko, w którym przyjedzie",
      span: "md:col-span-5 aspect-[4/3]",
    },
    {
      src: "/galeria/kalkulator-kalkmate-ekran-menu-glowne.webp",
      label: "03 · Ekran OLED",
      caption: "Menu główne na żywo",
      span: "md:col-span-5 aspect-[4/3]",
    },
    {
      src: "/galeria/kalkulator-kalkmate-ekran-rozwiaz-zadanie.webp",
      label: "04 · Rozwiąż zadanie",
      caption: "Zdjęcie kamerą → rozwiązanie",
      span: "md:col-span-6 aspect-[4/3]",
    },
    {
      src: "/galeria/kalkulator-kalkmate-etykieta-certyfikaty.webp",
      label: "05 · Etykieta",
      caption: "CE / RoHS, kod kreskowy",
      span: "md:col-span-6 aspect-[4/3]",
    },
  ],
  en: [
    {
      src: "/galeria/kalkulator-kalkmate-gotowy-egzemplarz.webp",
      label: "01 · Finished unit",
      caption: "KalkMate v3 — real photo",
      span: "md:col-span-7 md:row-span-2 aspect-[4/5]",
    },
    {
      src: "/galeria/kalkulator-kalkmate-opakowanie-pudelko.webp",
      label: "02 · Packaging",
      caption: "The box it ships in",
      span: "md:col-span-5 aspect-[4/3]",
    },
    {
      src: "/galeria/kalkulator-kalkmate-ekran-menu-glowne.webp",
      label: "03 · OLED screen",
      caption: "Main menu, live",
      span: "md:col-span-5 aspect-[4/3]",
    },
    {
      src: "/galeria/kalkulator-kalkmate-ekran-rozwiaz-zadanie.webp",
      label: "04 · Solve problem",
      caption: "Camera photo → solution",
      span: "md:col-span-6 aspect-[4/3]",
    },
    {
      src: "/galeria/kalkulator-kalkmate-etykieta-certyfikaty.webp",
      label: "05 · Label",
      caption: "CE / RoHS, barcode",
      span: "md:col-span-6 aspect-[4/3]",
    },
  ],
  de: [
    {
      src: "/galeria/kalkulator-kalkmate-gotowy-egzemplarz.webp",
      label: "01 · Fertiges Gerät",
      caption: "KalkMate v3 — echtes Foto",
      span: "md:col-span-7 md:row-span-2 aspect-[4/5]",
    },
    {
      src: "/galeria/kalkulator-kalkmate-opakowanie-pudelko.webp",
      label: "02 · Verpackung",
      caption: "So kommt es bei dir an",
      span: "md:col-span-5 aspect-[4/3]",
    },
    {
      src: "/galeria/kalkulator-kalkmate-ekran-menu-glowne.webp",
      label: "03 · OLED-Display",
      caption: "Hauptmenü, live",
      span: "md:col-span-5 aspect-[4/3]",
    },
    {
      src: "/galeria/kalkulator-kalkmate-ekran-rozwiaz-zadanie.webp",
      label: "04 · Aufgabe lösen",
      caption: "Kamerafoto → Lösung",
      span: "md:col-span-6 aspect-[4/3]",
    },
    {
      src: "/galeria/kalkulator-kalkmate-etykieta-certyfikaty.webp",
      label: "05 · Etikett",
      caption: "CE / RoHS, Barcode",
      span: "md:col-span-6 aspect-[4/3]",
    },
  ],
};

const content: Record<
  Locale,
  {
    eyebrow: string;
    h2: { before: string; italic: string; after: string };
    galleryCount: string;
    meta: string;
  }
> = {
  pl: {
    eyebrow: "[ 05 ] · Archiwum",
    h2: { before: "Z warsztatu, ", italic: "prosto", after: "do Twojej kieszeni." },
    galleryCount: "Galeria · 05 ujęć",
    meta: "2025–2026 · KRK · PL",
  },
  en: {
    eyebrow: "[ 05 ] · Archive",
    h2: { before: "From the workshop, ", italic: "straight", after: "to your pocket." },
    galleryCount: "Gallery · 05 shots",
    meta: "2025–2026 · KRK · PL",
  },
  de: {
    eyebrow: "[ 05 ] · Archiv",
    h2: { before: "Aus der Werkstatt, ", italic: "direkt", after: "in deine Tasche." },
    galleryCount: "Galerie · 05 Aufnahmen",
    meta: "2025–2026 · KRK · PL",
  },
};

export default function Gallery({ lang = "pl" }: { lang?: Locale }) {
  const t = content[lang];
  const items = shots[lang];
  return (
    <section id="galeria" className="relative py-24 lg:py-36 bg-[#0E0E0E]">
      <div className="mx-auto max-w-[1400px] px-5 lg:px-10">
        <div className="grid lg:grid-cols-12 gap-8 items-end mb-16">
          <div className="lg:col-span-8">
            <p className="km-mono-eyebrow text-[#D8FF3D]">{t.eyebrow}</p>
            <h2 className="km-display text-[clamp(40px,7vw,108px)] text-[#F2EDE3] mt-4">
              {t.h2.before}<span className="italic">{t.h2.italic}</span><br />
              {t.h2.after}
            </h2>
          </div>
          <div className="lg:col-span-4 km-mono-eyebrow text-[#F2EDE3]/45">
            <p>{t.galleryCount}</p>
            <p className="mt-2 text-[#F2EDE3]/30">{t.meta}</p>
          </div>
        </div>

        <div className="grid md:grid-cols-12 grid-cols-1 gap-3 md:gap-4">
          {items.map((s, i) => (
            <motion.figure
              key={s.src}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.6, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] }}
              className={`relative overflow-hidden border border-[rgba(242,237,227,0.10)] bg-[#1a1a1a] group ${s.span}`}
            >
              <Image
                src={s.src}
                alt={s.caption}
                fill
                sizes="(min-width: 1024px) 50vw, 100vw"
                className="object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0B0B0B]/85 via-transparent to-transparent" />
              <figcaption className="absolute bottom-0 left-0 right-0 p-4 lg:p-5 flex items-end justify-between gap-3">
                <div>
                  <p className="km-mono-eyebrow text-[#D8FF3D]">{s.label}</p>
                  <p className="km-display text-2xl lg:text-3xl text-[#F2EDE3] mt-1">
                    {s.caption}
                  </p>
                </div>
                <span className="km-mono-eyebrow text-[#F2EDE3]/50 hidden md:inline">
                  ↗
                </span>
              </figcaption>
            </motion.figure>
          ))}
        </div>
      </div>
    </section>
  );
}
