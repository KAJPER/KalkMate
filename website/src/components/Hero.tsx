"use client";

import { motion } from "framer-motion";
import Image from "next/image";

export default function Hero() {
  return (
    <section className="min-h-screen flex items-center pt-32 bg-white dark:bg-[#2B2D31]">
      <div className="max-w-7xl mx-auto px-6 py-20 grid lg:grid-cols-2 gap-12 items-center">
        {/* Text */}
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          <h1 className="text-5xl lg:text-6xl font-bold text-[#1a1a1a] dark:text-[#E0E0E0] leading-tight">
            Zrób zdjęcie zadania.<br />Odpowiedź na ekranie.
          </h1>
          <p className="mt-6 text-lg text-[#1a1a1a]/70 dark:text-[#E0E0E0]/70 max-w-lg">
            KalkMate wygląda jak zwykły kalkulator, ale ma ukrytą kamerę i AI.
            Nie wpisujesz niczego ręcznie. Jedno kliknięcie i masz rozwiązanie.
          </p>
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-[#1a1a1a]/50 dark:text-[#E0E0E0]/50">
            <span>Ukryta kamera</span>
            <span>6h na baterii</span>
            <span>Wygląda jak zwykły kalkulator</span>
            <span>Produkowany w Polsce</span>
          </div>
          <div className="mt-8 flex flex-wrap gap-4">
            <a
              href="#kup-teraz"
              className="inline-flex items-center px-8 py-3 bg-[#2563EB] dark:bg-[#3B82F6] text-white font-medium rounded-full hover:bg-[#1d4ed8] dark:hover:bg-[#2563EB] transition-colors"
            >
              Zamów teraz
            </a>
            <a
              href="#jak-dziala"
              className="inline-flex items-center px-8 py-3 border border-[#1a1a1a]/20 dark:border-[#E0E0E0]/20 text-[#1a1a1a] dark:text-[#E0E0E0] font-medium rounded-full hover:border-[#1a1a1a]/40 dark:hover:border-[#E0E0E0]/40 transition-colors"
            >
              Jak to działa
            </a>
          </div>
        </motion.div>

        {/* Device placeholder */}
        <motion.div
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease: "easeOut", delay: 0.2 }}
          className="flex justify-center"
        >
          <div className="relative w-full max-w-[520px] aspect-[16/9] rounded-2xl overflow-hidden shadow-2xl shadow-black/20 dark:shadow-black/50">
            <Image
              src="/KalkMate3.png"
              alt="KalkMate - kalkulator graficzny z ukrytą kamerą i AI"
              fill
              className="object-cover"
              priority
              quality={90}
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 520px"
            />
          </div>
        </motion.div>
      </div>
    </section>
  );
}
