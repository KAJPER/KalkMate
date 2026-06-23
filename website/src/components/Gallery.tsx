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
      src: "/galeria/kalkulator-kalkmate-prototyp-widok-ogolny.png",
      label: "01 · Prototyp v1",
      caption: "Pierwsza zlutowana płytka — bring-up",
      span: "md:col-span-7 md:row-span-2 aspect-[4/5]",
    },
    {
      src: "/galeria/kalkulator-graficzny-ai-ekran-lcd.png",
      label: "02 · Display",
      caption: "OLED SSD1322 256×64",
      span: "md:col-span-5 aspect-[4/3]",
    },
    {
      src: "/galeria/kalkulator-naukowy-kalkmate-ukryta-kamera.jpg",
      label: "03 · Kamera",
      caption: "OV2640 w obudowie",
      span: "md:col-span-5 aspect-[4/3]",
    },
    {
      src: "/galeria/kalkulator-kalkmate-platforma-pcb-elektronika.png",
      label: "04 · PCB",
      caption: "Wytrasowane w Polsce",
      span: "md:col-span-6 aspect-[4/3]",
    },
    {
      src: "/galeria/inteligentny-kalkulator-rozwiazywanie-zadan.jpg",
      label: "05 · Test",
      caption: "Rozwiązywanie matury 2024",
      span: "md:col-span-6 aspect-[4/3]",
    },
  ],
  en: [
    {
      src: "/galeria/kalkulator-kalkmate-prototyp-widok-ogolny.png",
      label: "01 · Prototype v1",
      caption: "First soldered board — bring-up",
      span: "md:col-span-7 md:row-span-2 aspect-[4/5]",
    },
    {
      src: "/galeria/kalkulator-graficzny-ai-ekran-lcd.png",
      label: "02 · Display",
      caption: "OLED SSD1322 256×64",
      span: "md:col-span-5 aspect-[4/3]",
    },
    {
      src: "/galeria/kalkulator-naukowy-kalkmate-ukryta-kamera.jpg",
      label: "03 · Camera",
      caption: "OV2640 inside the casing",
      span: "md:col-span-5 aspect-[4/3]",
    },
    {
      src: "/galeria/kalkulator-kalkmate-platforma-pcb-elektronika.png",
      label: "04 · PCB",
      caption: "Routed in Poland",
      span: "md:col-span-6 aspect-[4/3]",
    },
    {
      src: "/galeria/inteligentny-kalkulator-rozwiazywanie-zadan.jpg",
      label: "05 · Test",
      caption: "Solving the 2024 matura exam",
      span: "md:col-span-6 aspect-[4/3]",
    },
  ],
  de: [
    {
      src: "/galeria/kalkulator-kalkmate-prototyp-widok-ogolny.png",
      label: "01 · Prototyp v1",
      caption: "Erste gelötete Platine — Bring-up",
      span: "md:col-span-7 md:row-span-2 aspect-[4/5]",
    },
    {
      src: "/galeria/kalkulator-graficzny-ai-ekran-lcd.png",
      label: "02 · Display",
      caption: "OLED SSD1322 256×64",
      span: "md:col-span-5 aspect-[4/3]",
    },
    {
      src: "/galeria/kalkulator-naukowy-kalkmate-ukryta-kamera.jpg",
      label: "03 · Kamera",
      caption: "OV2640 im Gehäuse",
      span: "md:col-span-5 aspect-[4/3]",
    },
    {
      src: "/galeria/kalkulator-kalkmate-platforma-pcb-elektronika.png",
      label: "04 · PCB",
      caption: "In Polen geroutet",
      span: "md:col-span-6 aspect-[4/3]",
    },
    {
      src: "/galeria/inteligentny-kalkulator-rozwiazywanie-zadan.jpg",
      label: "05 · Test",
      caption: "Lösung der Abiturprüfung 2024",
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
              className={`relative overflow-hidden border border-[rgba(242,237,227,0.10)] group ${s.span}`}
            >
              <Image
                src={s.src}
                alt={s.caption}
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-cover transition-transform duration-700 group-hover:scale-[1.04]"
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
