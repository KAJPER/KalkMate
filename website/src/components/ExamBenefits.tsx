"use client";

import { motion } from "framer-motion";

const benefits = [
  {
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
    title: "Legalny na egzaminach",
    description: "Kalkulatory są dozwolone na maturze, kartkówkach i większości sprawdzianów. KalkMate wygląda jak zwykły kalkulator – nikt nie będzie miał podejrzeń.",
  },
  {
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
    title: "Oszczędność czasu",
    description: "Jedno zdjęcie = natychmiastowa odpowiedź. Nie tracisz czasu na długie obliczenia. Więcej czasu na inne zadania = lepsza ocena.",
  },
  {
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    ),
    title: "100% dyskretne",
    description: "Ekran OLED widoczny tylko dla Ciebie. Brak podświetlenia, brak dźwięków. Nauczyciel patrzy – widzi tylko kalkulator.",
  },
  {
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    ),
    title: "Sprawdzone rozwiązania",
    description: "AI zna polską podstawę i rozszerzenie z matematyki, biologii, chemii i fizyki. Rozpoznaje wzory, wzory reakcji chemicznych, diagramy i schematy fizyczne.",
  },
  {
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    ),
    title: "Zwraca się po 2-3 egzaminach",
    description: "Jedna poprawiona ocena z matury = wyższa pozycja na liście rankingowej = lepszy kierunek. Raz kupujesz, korzystasz przez całą szkołę.",
  },
  {
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
        <polyline points="7.5 4.21 12 6.81 16.5 4.21" />
        <polyline points="7.5 19.79 7.5 14.6 3 12" />
        <polyline points="21 12 16.5 14.6 16.5 19.79" />
        <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
        <line x1="12" y1="22.08" x2="12" y2="12" />
      </svg>
    ),
    title: "Polska produkcja = bezpieczeństwo",
    description: "Twoje dane nie trafiają do Chin. Szyfrowane połączenie, polskie serwery, zgodność z RODO. Żadnych backdoorów ani szpiegowania.",
  },
];

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
    transition: { duration: 0.5, ease: "easeOut" as const },
  },
};

export default function ExamBenefits() {
  return (
    <section className="py-24 bg-white dark:bg-[#2B2D31]">
      <div className="max-w-7xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="text-center"
        >
          <h2 className="text-3xl lg:text-4xl font-bold text-[#1a1a1a] dark:text-[#E0E0E0]">
            Dlaczego KalkMate na egzaminie?
          </h2>
          <p className="mt-4 text-[#1a1a1a]/60 dark:text-[#E0E0E0]/60 max-w-2xl mx-auto">
            Każdy punkt się liczy. KalkMate daje Ci przewagę bez ryzyka.
          </p>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.1 }}
          className="mt-16 grid md:grid-cols-2 lg:grid-cols-3 gap-8"
        >
          {benefits.map((benefit, i) => (
            <motion.div
              key={i}
              variants={itemVariants}
              className="bg-[#F5F5F5] dark:bg-[#313338] rounded-xl p-8 border border-gray-100 dark:border-[#3F4147]"
            >
              <div className="text-[#2563EB] dark:text-[#3B82F6] mb-4">
                {benefit.icon}
              </div>
              <h3 className="text-lg font-bold text-[#1a1a1a] dark:text-[#E0E0E0] mb-3">
                {benefit.title}
              </h3>
              <p className="text-sm text-[#1a1a1a]/60 dark:text-[#E0E0E0]/60 leading-relaxed">
                {benefit.description}
              </p>
            </motion.div>
          ))}
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.5, ease: "easeOut", delay: 0.3 }}
          className="mt-16 text-center"
        >
          <div className="inline-block bg-[#2563EB]/10 dark:bg-[#3B82F6]/10 rounded-xl px-8 py-6 border border-[#2563EB]/20 dark:border-[#3B82F6]/20">
            <p className="text-lg font-semibold text-[#1a1a1a] dark:text-[#E0E0E0] mb-2">
              Już <span className="text-[#2563EB] dark:text-[#3B82F6]">ponad 150 uczniów</span> używa KalkMate
            </p>
            <p className="text-sm text-[#1a1a1a]/60 dark:text-[#E0E0E0]/60">
              Dołącz do nich i przestań się stresować egzaminami
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
