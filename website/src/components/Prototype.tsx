"use client";

import { motion } from "framer-motion";
import Image from "next/image";

const timeline = [
  { date: "Grudzień 2025", label: "Projekt PCB ukończony", done: true },
  { date: "Styczeń 2026", label: "Pierwszy prototyp zbudowany", done: true },
  { date: "Luty 2026", label: "Urządzenie docelowe w produkcji", done: true },
  { date: "Koniec lutego 2026", label: "Start sprzedaży", done: true },
];

const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.15 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, x: -30 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.5, ease: "easeOut" as const },
  },
};

export default function Prototype() {
  return (
    <section id="prototyp" className="py-24 bg-white dark:bg-[#2B2D31]">
      <div className="max-w-7xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="text-center"
        >
          <h2 className="text-3xl lg:text-4xl font-bold text-[#1a1a1a] dark:text-[#E0E0E0]">
            Prawdziwy produkt. Nie tylko render.
          </h2>
          <p className="mt-4 text-[#1a1a1a]/60 dark:text-[#E0E0E0]/60 max-w-2xl mx-auto">
            KalkMate przeszedł fazę prototypu. Urządzenie docelowe jest aktualnie w produkcji.
          </p>
        </motion.div>

        {/* Photo placeholders */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.5, ease: "easeOut", delay: 0.1 }}
          className="mt-12 grid md:grid-cols-3 gap-6"
        >
          {["Prototyp v1.0", "Płytka PCB", "Urządzenie docelowe"].map((label, n) => (
            <div
              key={n}
              className="relative aspect-[4/3] rounded-xl border-2 border-dashed border-gray-300 dark:border-[#3F4147] bg-[#F5F5F5] dark:bg-[#313338] flex flex-col items-center justify-center overflow-hidden"
            >
              {n === 0 ? (
                <>
                  <Image
                    src="/KalkMate4.png"
                    alt="Prototyp v1.0 - pierwszy działający prototyp kalkulatora KalkMate"
                    fill
                    className="object-cover"
                    quality={85}
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    loading="lazy"
                  />
                  <span className="absolute bottom-2 left-0 right-0 text-center text-xs text-white drop-shadow-md">
                    {label}
                  </span>
                </>
              ) : n === 2 ? (
                <>
                  <Image
                    src="/KalkMate2.png"
                    alt="Urządzenie docelowe - finalna wersja kalkulatora KalkMate"
                    fill
                    className="object-cover object-[center_70%]"
                    quality={85}
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    loading="lazy"
                  />
                  <span className="absolute bottom-2 left-0 right-0 text-center text-xs text-white drop-shadow-md">
                    {label}
                  </span>
                </>
              ) : (
                <>
                  <Image
                    src="/KalkMate5.png"
                    alt="Płytka PCB - elektronika kalkulatora KalkMate"
                    fill
                    className="object-cover"
                    quality={85}
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    loading="lazy"
                  />
                  <span className="absolute bottom-2 left-0 right-0 text-center text-xs text-white drop-shadow-md">
                    {label}
                  </span>
                </>
              )}
            </div>
          ))}
        </motion.div>

        {/* Timeline */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          className="mt-16 max-w-2xl mx-auto"
        >
          {timeline.map((item, i) => (
            <motion.div
              key={i}
              variants={itemVariants}
              className="flex items-center gap-4 py-3"
            >
              <div
                className={`w-3 h-3 rounded-full shrink-0 ${
                  item.done
                    ? "bg-[#2563EB] dark:bg-[#3B82F6]"
                    : "bg-gray-300 dark:bg-[#3F4147]"
                }`}
              />
              <span className="text-sm font-mono text-[#1a1a1a]/50 dark:text-[#E0E0E0]/50 w-36 shrink-0">
                {item.date}
              </span>
              <span className={`text-sm font-medium ${
                item.done
                  ? "text-[#1a1a1a] dark:text-[#E0E0E0]"
                  : "text-[#1a1a1a]/40 dark:text-[#E0E0E0]/40"
              }`}>
                {item.label}
              </span>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
