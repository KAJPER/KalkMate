"use client";

import Image from "next/image";
import { motion } from "framer-motion";

const shots = [
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
];

export default function Gallery() {
  return (
    <section id="galeria" className="relative py-24 lg:py-36 bg-[#0E0E0E]">
      <div className="mx-auto max-w-[1400px] px-5 lg:px-10">
        <div className="grid lg:grid-cols-12 gap-8 items-end mb-16">
          <div className="lg:col-span-8">
            <p className="km-mono-eyebrow text-[#D8FF3D]">[ 05 ] · Archiwum</p>
            <h2 className="km-display text-[clamp(40px,7vw,108px)] text-[#F2EDE3] mt-4">
              Z warsztatu, <span className="italic">prosto</span><br />
              do Twojej kieszeni.
            </h2>
          </div>
          <div className="lg:col-span-4 km-mono-eyebrow text-[#F2EDE3]/45">
            <p>Galeria · 05 ujęć</p>
            <p className="mt-2 text-[#F2EDE3]/30">2025–2026 · KRK · PL</p>
          </div>
        </div>

        <div className="grid md:grid-cols-12 grid-cols-1 gap-3 md:gap-4">
          {shots.map((s, i) => (
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
