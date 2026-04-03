"use client";

import { motion } from "framer-motion";

const comparison = [
  {
    feature: "Wygląd",
    kalkmate: "Profesjonalna obudowa Esperanza - wygląda jak zwykły kalkulator",
    tiktok: "Dziwna obudowa, widać z daleka że to nie zwykły kalkulator",
    tikTokIcon: "❌",
    kalkmateIcon: "✓",
  },
  {
    feature: "Kamera",
    kalkmate: "Wbudowana kamera 2MP - jedno zdjęcie i masz odpowiedź",
    tiktok: "Brak kamery - musisz wszystko wpisywać ręcznie",
    tikTokIcon: "❌",
    kalkmateIcon: "✓",
  },
  {
    feature: "Jakość wykonania",
    kalkmate: "Polska produkcja, kontrola jakości, gwarancja",
    tiktok: "Chińska podróbka, brak wsparcia, psuje się po tygodniu",
    tikTokIcon: "❌",
    kalkmateIcon: "✓",
  },
  {
    feature: "Dyskrecja",
    kalkmate: "Nikt nie zauważy - wygląda i działa jak zwykły kalkulator",
    tiktok: "Rzuca się w oczy, nauczyciel od razu zorientuje się",
    tikTokIcon: "❌",
    kalkmateIcon: "✓",
  },
  {
    feature: "Polskie zadania",
    kalkmate: "AI trenowane na polskiej maturze i podręcznikach",
    tiktok: "Nie rozpoznaje polskich zadań, błędy w tłumaczeniu",
    tikTokIcon: "❌",
    kalkmateIcon: "✓",
  },
  {
    feature: "Aktualizacje",
    kalkmate: "Regularne aktualizacje AI, nowe funkcje co miesiąc",
    tiktok: "Brak aktualizacji, co kupiłeś to masz",
    tikTokIcon: "❌",
    kalkmateIcon: "✓",
  },
];

const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.08 },
  },
};

const rowVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.4, ease: "easeOut" as const },
  },
};

export default function PriceComparison() {
  return (
    <section className="py-24 bg-white dark:bg-[#2B2D31]">
      <div className="max-w-5xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="text-center"
        >
          <h2 className="text-3xl lg:text-4xl font-bold text-[#1a1a1a] dark:text-[#E0E0E0]">
            Dlaczego 499 zł to świetna cena?
          </h2>
          <p className="mt-4 text-[#1a1a1a]/60 dark:text-[#E0E0E0]/60 max-w-2xl mx-auto">
            Kalkulatory z TikToka kosztują 700-2000 zł, ale mają fatalne opinie.
            Zobacz sam, dlaczego KalkMate za 499 zł to lepsza inwestycja.
          </p>
        </motion.div>

        {/* Price badges */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.5, ease: "easeOut", delay: 0.1 }}
          className="mt-8 flex flex-wrap gap-4 justify-center"
        >
          <div className="px-6 py-3 bg-red-50 dark:bg-red-500/10 rounded-xl border border-red-100 dark:border-red-500/20">
            <p className="text-xs text-red-600/60 dark:text-red-400/60 font-medium uppercase tracking-wide">
              Kalkulatory z TikToka
            </p>
            <p className="mt-1 text-2xl font-bold text-red-600 dark:text-red-400">
              700-2000 zł
            </p>
            <p className="text-xs text-red-600/60 dark:text-red-400/60">
              + mnóstwo problemów
            </p>
          </div>

          <div className="px-6 py-3 bg-green-50 dark:bg-green-500/10 rounded-xl border-2 border-green-500 dark:border-green-400">
            <p className="text-xs text-green-600/60 dark:text-green-400/60 font-medium uppercase tracking-wide">
              KalkMate
            </p>
            <p className="mt-1 text-2xl font-bold text-green-600 dark:text-green-400">
              499 zł
            </p>
            <p className="text-xs text-green-600 dark:text-green-400 font-medium">
              ✓ Pełen profesjonalizm
            </p>
          </div>
        </motion.div>

        {/* Comparison table */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.1 }}
          className="mt-12 bg-[#F5F5F5] dark:bg-[#313338] rounded-xl border border-gray-100 dark:border-[#3F4147] overflow-hidden"
        >
          {/* Header */}
          <div className="grid grid-cols-3 gap-4 p-4 bg-white dark:bg-[#2B2D31] border-b border-gray-100 dark:border-[#3F4147]">
            <div className="text-sm font-bold text-[#1a1a1a]/50 dark:text-[#E0E0E0]/50">
              Porównanie
            </div>
            <div className="text-sm font-bold text-center text-red-600 dark:text-red-400">
              Kalkulatory z TikToka
            </div>
            <div className="text-sm font-bold text-center text-[#2563EB] dark:text-[#3B82F6]">
              KalkMate
            </div>
          </div>

          {/* Rows */}
          {comparison.map((item, i) => (
            <motion.div
              key={i}
              variants={rowVariants}
              className={`grid grid-cols-3 gap-4 p-4 ${
                i !== comparison.length - 1
                  ? "border-b border-gray-200 dark:border-[#3F4147]"
                  : ""
              }`}
            >
              <div className="flex items-center">
                <span className="text-sm font-semibold text-[#1a1a1a] dark:text-[#E0E0E0]">
                  {item.feature}
                </span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-lg shrink-0 mt-0.5">❌</span>
                <span className="text-xs text-[#1a1a1a]/60 dark:text-[#E0E0E0]/60 leading-relaxed">
                  {item.tiktok}
                </span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-lg shrink-0 mt-0.5 text-green-600 dark:text-green-400">✓</span>
                <span className="text-xs text-[#1a1a1a] dark:text-[#E0E0E0] leading-relaxed font-medium">
                  {item.kalkmate}
                </span>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Bottom CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.5, ease: "easeOut", delay: 0.3 }}
          className="mt-12 text-center"
        >
          <div className="inline-block bg-gradient-to-r from-[#2563EB]/10 to-green-500/10 dark:from-[#3B82F6]/10 dark:to-green-400/10 rounded-2xl px-8 py-6 border border-[#2563EB]/20 dark:border-[#3B82F6]/20">
            <p className="text-lg font-bold text-[#1a1a1a] dark:text-[#E0E0E0]">
              Oszczędzasz <span className="text-[#2563EB] dark:text-[#3B82F6]">201-1501 zł</span> i dostajesz lepszy produkt
            </p>
            <p className="mt-2 text-sm text-[#1a1a1a]/60 dark:text-[#E0E0E0]/60">
              Nie przepłacaj za chińskie podróbki. KalkMate to polska jakość w uczciwej cenie.
            </p>
            <div className="mt-4 flex flex-wrap gap-3 justify-center text-xs text-[#1a1a1a]/50 dark:text-[#E0E0E0]/50">
              <span className="flex items-center gap-1.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                14 dni na zwrot
              </span>
              <span className="flex items-center gap-1.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Polska gwarancja
              </span>
              <span className="flex items-center gap-1.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Darmowa wysyłka
              </span>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
