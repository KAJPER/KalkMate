"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { PRICING_PLANS } from "@/lib/pricing";

const features = [
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2v20M2 12h20" />
      </svg>
    ),
    title: "Wytrenowany na maturach",
    description: "Model uczony na zadaniach maturalnych z ostatnich 10 lat. Rozpoznaje wszystkie typy zadań z matematyki, fizyki i chemii na poziomie podstawowym i rozszerzonym.",
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
        <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
        <line x1="12" y1="22.08" x2="12" y2="12" />
      </svg>
    ),
    title: "Adaptacyjny algorytm",
    description: "AI nieustannie się uczy. Każdy nowy egzamin, każda zmiana w formule matury - model automatycznie dostosowuje się do aktualnych standardów i wymagań CKE.",
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
    title: "Dokładność 98.7%",
    description: "Testowany na tysiącach zadań maturalnych. Model osiąga skuteczność rozwiązywania na poziomie 98.7% - wyżej niż przeciętny maturzysta z oceną bardzo dobrą.",
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
      </svg>
    ),
    title: "Błyskawiczna reakcja",
    description: "Rozwiązanie zadania w mniej niż 3 sekundy. Nie musisz czekać - robisz zdjęcie i natychmiast masz odpowiedź na ekranie kalkulatora. Żadnych opóźnień, żadnego ładowania.",
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
    title: "Aktualizacje co miesiąc",
    description: "Model jest regularnie aktualizowany o nowe wzorce zadań, ulepszenia algorytmów i rozpoznawanie nowych typów notacji matematycznej. Zawsze masz najnowszą wersję.",
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    title: "Rozpoznaje każde pismo",
    description: "Czy piszesz drukowanymi literami, czy masz najgorsze pismo świata - model rozpozna treść zadania. Testowany na setkach różnych stylów pisma ręcznego.",
  },
];

// Używamy wspólnej konfiguracji cennika z @/lib/pricing
const pricingPlans = PRICING_PLANS;

const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: "easeOut" as const },
  },
};

export default function AIModel() {
  const [selectedPlan, setSelectedPlan] = useState(1);

  return (
    <section id="ai-model" className="py-24 bg-gradient-to-b from-[#F5F5F5] to-white dark:from-[#313338] dark:to-[#2B2D31]">
      <div className="max-w-7xl mx-auto px-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="text-center mb-16"
        >
          <div className="inline-block mb-4 px-4 py-2 bg-[#2563EB]/10 dark:bg-[#3B82F6]/10 rounded-full">
            <span className="text-sm font-bold text-[#2563EB] dark:text-[#3B82F6]">
              🤖 Powered by Advanced AI
            </span>
          </div>
          <h2 className="text-4xl lg:text-5xl font-bold text-[#1a1a1a] dark:text-[#E0E0E0]">
            Najlepszy model AI dla maturzystów
          </h2>
          <p className="mt-6 text-lg text-[#1a1a1a]/60 dark:text-[#E0E0E0]/60 max-w-3xl mx-auto">
            Nasz autorski model AI został wytrenowany specjalnie z myślą o polskich egzaminach.
            To nie jest ChatGPT ani żaden gotowy model - to system uczony na <strong>tysiącach zadań
            maturalnych z ostatnich 10 lat</strong>, zoptymalizowany pod kątem maksymalnej skuteczności
            podczas egzaminów.
          </p>
        </motion.div>

        {/* Features Grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.1 }}
          className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-20"
        >
          {features.map((feature, index) => (
            <motion.div
              key={index}
              variants={itemVariants}
              className="bg-white dark:bg-[#2B2D31] p-6 rounded-2xl border border-gray-100 dark:border-[#3F4147] hover:shadow-lg transition-shadow duration-300"
            >
              <div className="w-12 h-12 bg-[#2563EB]/10 dark:bg-[#3B82F6]/10 rounded-xl flex items-center justify-center mb-4 text-[#2563EB] dark:text-[#3B82F6]">
                {feature.icon}
              </div>
              <h3 className="text-lg font-bold text-[#1a1a1a] dark:text-[#E0E0E0] mb-2">
                {feature.title}
              </h3>
              <p className="text-sm text-[#1a1a1a]/60 dark:text-[#E0E0E0]/60 leading-relaxed">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-20"
        >
          <div className="text-center p-6 bg-white dark:bg-[#2B2D31] rounded-xl border border-gray-100 dark:border-[#3F4147]">
            <div className="text-3xl lg:text-4xl font-bold text-[#2563EB] dark:text-[#3B82F6] mb-2">
              98.7%
            </div>
            <div className="text-sm text-[#1a1a1a]/60 dark:text-[#E0E0E0]/60">
              Dokładność rozwiązań
            </div>
          </div>
          <div className="text-center p-6 bg-white dark:bg-[#2B2D31] rounded-xl border border-gray-100 dark:border-[#3F4147]">
            <div className="text-3xl lg:text-4xl font-bold text-[#2563EB] dark:text-[#3B82F6] mb-2">
              10 lat
            </div>
            <div className="text-sm text-[#1a1a1a]/60 dark:text-[#E0E0E0]/60">
              Danych treningowych
            </div>
          </div>
          <div className="text-center p-6 bg-white dark:bg-[#2B2D31] rounded-xl border border-gray-100 dark:border-[#3F4147]">
            <div className="text-3xl lg:text-4xl font-bold text-[#2563EB] dark:text-[#3B82F6] mb-2">
              &lt;3s
            </div>
            <div className="text-sm text-[#1a1a1a]/60 dark:text-[#E0E0E0]/60">
              Czas odpowiedzi
            </div>
          </div>
          <div className="text-center p-6 bg-white dark:bg-[#2B2D31] rounded-xl border border-gray-100 dark:border-[#3F4147]">
            <div className="text-3xl lg:text-4xl font-bold text-[#2563EB] dark:text-[#3B82F6] mb-2">
              100%
            </div>
            <div className="text-sm text-[#1a1a1a]/60 dark:text-[#E0E0E0]/60">
              Dostępność online
            </div>
          </div>
        </motion.div>

        {/* Pricing Section */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.5 }}
          className="bg-gradient-to-br from-[#2563EB]/5 to-[#3B82F6]/5 dark:from-[#2563EB]/10 dark:to-[#3B82F6]/10 rounded-3xl p-8 lg:p-12"
        >
          <div className="text-center mb-12">
            <h3 className="text-3xl lg:text-4xl font-bold text-[#1a1a1a] dark:text-[#E0E0E0] mb-4">
              AI Chat - Cennik subskrypcji
            </h3>
            <p className="text-lg text-[#1a1a1a]/60 dark:text-[#E0E0E0]/60 max-w-2xl mx-auto">
              Zacznij z darmowym dostępem, a następnie płać symboliczne ceny zamiast standardowych 44,99 zł/miesiąc.
              <strong className="text-[#2563EB] dark:text-[#3B82F6]"> Oszczędzasz nawet 67% co miesiąc!</strong>
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {pricingPlans.map((plan, index) => (
              <motion.div
                key={index}
                variants={itemVariants}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                className={`relative bg-white dark:bg-[#2B2D31] rounded-2xl p-6 border-2 transition-all duration-300 ${
                  selectedPlan === index
                    ? "border-[#2563EB] dark:border-[#3B82F6] shadow-xl scale-105"
                    : "border-gray-200 dark:border-[#3F4147] hover:border-[#2563EB]/50 dark:hover:border-[#3B82F6]/50"
                }`}
                onClick={() => setSelectedPlan(index)}
              >
                {/* Badge */}
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-[#2563EB] to-[#3B82F6] text-white text-xs font-bold rounded-full whitespace-nowrap">
                  {plan.badge}
                </div>

                <div className="text-center mt-4">
                  <div className="text-sm font-medium text-[#1a1a1a]/60 dark:text-[#E0E0E0]/60 mb-2">
                    {plan.period}
                  </div>
                  <div className="mb-2">
                    <span className="text-4xl font-bold text-[#1a1a1a] dark:text-[#E0E0E0]">
                      {plan.price}
                    </span>
                    {plan.originalPrice && (
                      <div className="text-sm text-[#1a1a1a]/40 dark:text-[#E0E0E0]/40 line-through mt-1">
                        {plan.originalPrice}
                      </div>
                    )}
                  </div>
                  <div className="text-xs font-bold text-[#2563EB] dark:text-[#3B82F6] mb-6">
                    {plan.highlight}
                  </div>

                  <div className="space-y-3 mb-6">
                    {plan.features.map((feature, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm text-[#1a1a1a]/70 dark:text-[#E0E0E0]/70">
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="text-[#2563EB] dark:text-[#3B82F6] shrink-0 mt-0.5"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        {feature}
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="mt-12 text-center">
            <p className="text-sm text-[#1a1a1a]/60 dark:text-[#E0E0E0]/60 mb-6">
              ⚡ Możesz anulować subskrypcję w każdej chwili bez dodatkowych opłat.<br />
              💳 Pierwszy miesiąc GRATIS przy zakupie kalkulatora. Nie potrzebujesz karty kredytowej.
            </p>
            <a
              href="#kup-teraz"
              className="inline-flex items-center px-8 py-4 bg-[#2563EB] dark:bg-[#3B82F6] text-white font-bold rounded-full hover:bg-[#1d4ed8] dark:hover:bg-[#2563EB] transition-colors text-lg shadow-lg"
            >
              Kup KalkMate i zacznij za darmo
            </a>
          </div>
        </motion.div>

        {/* Normal Pricing Comparison */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.5 }}
          className="mt-20 bg-white dark:bg-[#2B2D31] rounded-3xl p-8 lg:p-12 border border-gray-100 dark:border-[#3F4147]"
        >
          <h3 className="text-2xl lg:text-3xl font-bold text-[#1a1a1a] dark:text-[#E0E0E0] mb-4 text-center">
            Porównanie cennika AI Chat
          </h3>
          <p className="text-center text-[#1a1a1a]/60 dark:text-[#E0E0E0]/60 mb-8 max-w-2xl mx-auto">
            Zobacz różnicę między normalnym cennikiem a tym, co płacisz z KalkMate
          </p>

          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {/* Normal Pricing */}
            <div className="bg-[#F5F5F5] dark:bg-[#313338] rounded-2xl p-6 border-2 border-gray-200 dark:border-[#3F4147]">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-lg font-bold text-[#1a1a1a] dark:text-[#E0E0E0]">
                  Normalny Cennik
                </h4>
                <span className="px-3 py-1 bg-red-100 dark:bg-red-500/10 text-red-600 dark:text-red-400 text-xs font-bold rounded-full">
                  Bez KalkMate
                </span>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between py-3 border-b border-gray-300 dark:border-[#3F4147]">
                  <div>
                    <div className="font-medium text-[#1a1a1a] dark:text-[#E0E0E0]">Tydzień</div>
                    <div className="text-xs text-[#1a1a1a]/50 dark:text-[#E0E0E0]/50">Bez rabatu</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold text-[#1a1a1a] dark:text-[#E0E0E0]">11,25 zł</div>
                    <div className="text-xs text-[#1a1a1a]/40 dark:text-[#E0E0E0]/40">~¼ miesiąca</div>
                  </div>
                </div>

                <div className="flex items-center justify-between py-3 border-b border-gray-300 dark:border-[#3F4147]">
                  <div>
                    <div className="font-medium text-[#1a1a1a] dark:text-[#E0E0E0]">Miesiąc</div>
                    <div className="text-xs text-[#1a1a1a]/50 dark:text-[#E0E0E0]/50">30 dni</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold text-[#1a1a1a] dark:text-[#E0E0E0]">44,99 zł</div>
                    <div className="text-xs text-[#1a1a1a]/40 dark:text-[#E0E0E0]/40">pełna cena</div>
                  </div>
                </div>

                <div className="flex items-center justify-between py-3">
                  <div>
                    <div className="font-medium text-[#1a1a1a] dark:text-[#E0E0E0]">3 miesiące</div>
                    <div className="text-xs text-[#1a1a1a]/50 dark:text-[#E0E0E0]/50">90 dni</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold text-[#1a1a1a] dark:text-[#E0E0E0]">134,97 zł</div>
                    <div className="text-xs text-[#1a1a1a]/40 dark:text-[#E0E0E0]/40">3 × 44,99 zł</div>
                  </div>
                </div>

                <div className="pt-4 border-t-2 border-gray-300 dark:border-[#3F4147]">
                  <div className="text-center text-2xl font-bold text-red-600 dark:text-red-400">
                    134,97 zł
                  </div>
                  <div className="text-center text-xs text-[#1a1a1a]/50 dark:text-[#E0E0E0]/50 mt-1">
                    Razem za 3 miesiące
                  </div>
                </div>
              </div>
            </div>

            {/* KalkMate Pricing */}
            <div className="bg-gradient-to-br from-[#2563EB]/5 to-[#3B82F6]/5 dark:from-[#2563EB]/10 dark:to-[#3B82F6]/10 rounded-2xl p-6 border-2 border-[#2563EB] dark:border-[#3B82F6] relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#2563EB]/10 dark:bg-[#3B82F6]/10 rounded-full blur-3xl -mr-16 -mt-16" />

              <div className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-lg font-bold text-[#1a1a1a] dark:text-[#E0E0E0]">
                    Z KalkMate
                  </h4>
                  <span className="px-3 py-1 bg-gradient-to-r from-[#2563EB] to-[#3B82F6] text-white text-xs font-bold rounded-full">
                    🔥 Mega Oszczędności
                  </span>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between py-3 border-b border-[#2563EB]/20 dark:border-[#3B82F6]/20">
                    <div>
                      <div className="font-medium text-[#1a1a1a] dark:text-[#E0E0E0]">1. tydzień</div>
                      <div className="text-xs text-[#2563EB] dark:text-[#3B82F6] font-medium">Pierwszy miesiąc</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-bold text-green-600 dark:text-green-400">GRATIS</div>
                      <div className="text-xs text-[#1a1a1a]/40 dark:text-[#E0E0E0]/40 line-through">44,99 zł</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between py-3 border-b border-[#2563EB]/20 dark:border-[#3B82F6]/20">
                    <div>
                      <div className="font-medium text-[#1a1a1a] dark:text-[#E0E0E0]">Miesiąc (4-5 tyg)</div>
                      <div className="text-xs text-[#2563EB] dark:text-[#3B82F6] font-medium">Drugi miesiąc</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-bold text-[#2563EB] dark:text-[#3B82F6]">1 zł</div>
                      <div className="text-xs text-green-600 dark:text-green-400">-98% taniej!</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between py-3">
                    <div>
                      <div className="font-medium text-[#1a1a1a] dark:text-[#E0E0E0]">2 miesiące dalej</div>
                      <div className="text-xs text-[#2563EB] dark:text-[#3B82F6] font-medium">Kolejne miesiące</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-bold text-[#2563EB] dark:text-[#3B82F6]">30 zł</div>
                      <div className="text-xs text-green-600 dark:text-green-400">2 × 15 zł/mies</div>
                    </div>
                  </div>

                  <div className="pt-4 border-t-2 border-[#2563EB] dark:border-[#3B82F6]">
                    <div className="text-center text-2xl font-bold text-[#2563EB] dark:text-[#3B82F6]">
                      31 zł
                    </div>
                    <div className="text-center text-xs text-[#1a1a1a]/50 dark:text-[#E0E0E0]/50 mt-1">
                      Razem za 3 miesiące
                    </div>
                  </div>
                </div>

                <div className="mt-6 p-4 bg-green-50 dark:bg-green-500/10 rounded-xl border border-green-200 dark:border-green-500/20">
                  <div className="flex items-center justify-center gap-2">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-600 dark:text-green-400">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <div className="text-center">
                      <div className="text-xl font-bold text-green-600 dark:text-green-400">
                        Oszczędzasz 103,97 zł!
                      </div>
                      <div className="text-xs text-green-600/70 dark:text-green-400/70">
                        To 77% taniej niż normalny cennik
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 text-center">
            <p className="text-sm text-[#1a1a1a]/60 dark:text-[#E0E0E0]/60 mb-4">
              💡 <strong>Uwaga:</strong> Normalny cennik AI Chat to 44,99 zł miesięcznie.<br />
              Z KalkMate płacisz tylko 15 zł miesięcznie po promocji - <strong>77% taniej!</strong>
            </p>
            <a
              href="#kup-teraz"
              className="inline-flex items-center px-8 py-4 bg-[#2563EB] dark:bg-[#3B82F6] text-white font-bold rounded-full hover:bg-[#1d4ed8] dark:hover:bg-[#2563EB] transition-colors text-lg shadow-lg"
            >
              Zacznij oszczędzać z KalkMate
            </a>
          </div>
        </motion.div>

        {/* Why Our Model */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.5 }}
          className="mt-20 bg-white dark:bg-[#2B2D31] rounded-3xl p-8 lg:p-12 border border-gray-100 dark:border-[#3F4147]"
        >
          <h3 className="text-2xl lg:text-3xl font-bold text-[#1a1a1a] dark:text-[#E0E0E0] mb-6 text-center">
            Dlaczego nasz model jest lepszy niż ChatGPT?
          </h3>
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <div className="flex items-start gap-3 mb-4">
                <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0 mt-1">
                  <span className="text-red-600 dark:text-red-400 font-bold">✕</span>
                </div>
                <div>
                  <h4 className="font-bold text-[#1a1a1a] dark:text-[#E0E0E0] mb-1">ChatGPT / Gemini</h4>
                  <ul className="text-sm text-[#1a1a1a]/60 dark:text-[#E0E0E0]/60 space-y-1">
                    <li>• Ogólny model, nie zna specyfiki polskiej matury</li>
                    <li>• Często błędne odpowiedzi przy trudnych zadaniach</li>
                    <li>• Wolniejszy, wymaga komputera/telefonu</li>
                    <li>• Drogi abonament (20-25 USD/miesiąc)</li>
                  </ul>
                </div>
              </div>
            </div>
            <div>
              <div className="flex items-start gap-3 mb-4">
                <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center shrink-0 mt-1">
                  <span className="text-green-600 dark:text-green-400 font-bold">✓</span>
                </div>
                <div>
                  <h4 className="font-bold text-[#1a1a1a] dark:text-[#E0E0E0] mb-1">KalkMate AI</h4>
                  <ul className="text-sm text-[#1a1a1a]/60 dark:text-[#E0E0E0]/60 space-y-1">
                    <li>• Trenowany na polskich maturach (10 lat danych)</li>
                    <li>• 98.7% dokładności - najlepszy wynik na rynku</li>
                    <li>• Natychmiastowa odpowiedź (&lt;3s), bez telefonu</li>
                    <li>• Tylko 15 zł/miesiąc po promocji</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
