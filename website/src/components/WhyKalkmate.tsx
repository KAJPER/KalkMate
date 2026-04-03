"use client";

import { motion } from "framer-motion";

const phoneCons = [
  "Nauczyciel widzi telefon = zabierany",
  "Odblokuj, otwórz apkę, zrób zdjęcie... za dużo kroków",
  "Telefony często zakazane na egzaminach",
  "Ekran telefonu rzuca się w oczy",
];

const aliCons = [
  "Plastikowa zabawka, która się psuje po tygodniu",
  "Brak aktualizacji, brak wsparcia",
  "Nie rozpoznaje polskich zadań",
  "Widać z daleka, że to nie kalkulator",
];

const tiktokCons = [
  "Brak kamery, musisz wpisywać ręcznie",
  "Nie wygląda jak kalkulator, od razu widać",
  "Dziwna obudowa, rzuca się w oczy",
  "Brak polskiego wsparcia i aktualizacji",
];

const kalkmateProps = [
  "Wygląda jak zwykły kalkulator, nikt nie zwraca uwagi",
  "Jeden przycisk = zdjęcie → odpowiedź",
  "Kalkulatory dozwolone na większości egzaminów",
  "Dyskretny ekran OLED, widoczny tylko dla Ciebie",
  "6h pracy na baterii, ładowanie USB-C",
  "Polska produkcja, regularne aktualizacje AI",
];

export default function WhyKalkmate() {
  return (
    <section className="py-24 bg-[#F5F5F5] dark:bg-[#313338]">
      <div className="max-w-7xl mx-auto px-6">
        <motion.h2
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="text-3xl lg:text-4xl font-bold text-center text-[#1a1a1a] dark:text-[#E0E0E0]"
        >
          Dlaczego KalkMate?
        </motion.h2>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.5, ease: "easeOut", delay: 0.1 }}
          className="mt-12 grid md:grid-cols-2 lg:grid-cols-4 gap-6"
        >
          {/* Phone */}
          <div className="bg-white dark:bg-[#2B2D31] rounded-xl p-8 border border-gray-100 dark:border-[#3F4147] opacity-60">
            <h3 className="text-lg font-bold text-[#1a1a1a] dark:text-[#E0E0E0] mb-6">
              Telefon z apką
            </h3>
            <ul className="space-y-4">
              {phoneCons.map((item, i) => (
                <li key={i} className="flex items-start gap-3">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-400 shrink-0 mt-0.5">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                  <span className="text-sm text-[#1a1a1a]/60 dark:text-[#E0E0E0]/60">
                    {item}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* AliExpress */}
          <div className="bg-white dark:bg-[#2B2D31] rounded-xl p-8 border border-gray-100 dark:border-[#3F4147] opacity-60">
            <h3 className="text-lg font-bold text-[#1a1a1a] dark:text-[#E0E0E0] mb-6">
              Kalkulator z AliExpress
            </h3>
            <ul className="space-y-4">
              {aliCons.map((item, i) => (
                <li key={i} className="flex items-start gap-3">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-400 shrink-0 mt-0.5">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                  <span className="text-sm text-[#1a1a1a]/60 dark:text-[#E0E0E0]/60">
                    {item}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* TikTok AI */}
          <div className="bg-white dark:bg-[#2B2D31] rounded-xl p-8 border border-gray-100 dark:border-[#3F4147] opacity-60">
            <h3 className="text-lg font-bold text-[#1a1a1a] dark:text-[#E0E0E0] mb-6">
              &quot;Kalkulator AI&quot; z TikToka
            </h3>
            <ul className="space-y-4">
              {tiktokCons.map((item, i) => (
                <li key={i} className="flex items-start gap-3">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-400 shrink-0 mt-0.5">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                  <span className="text-sm text-[#1a1a1a]/60 dark:text-[#E0E0E0]/60">
                    {item}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* KalkMate */}
          <div className="bg-white dark:bg-[#2B2D31] rounded-xl p-8 border-2 border-[#2563EB] dark:border-[#3B82F6]">
            <h3 className="text-lg font-bold text-[#2563EB] dark:text-[#3B82F6] mb-6">
              KalkMate
            </h3>
            <ul className="space-y-4">
              {kalkmateProps.map((item, i) => (
                <li key={i} className="flex items-start gap-3">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#2563EB] dark:text-[#3B82F6] shrink-0 mt-0.5">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span className="text-sm text-[#1a1a1a] dark:text-[#E0E0E0]">
                    {item}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
