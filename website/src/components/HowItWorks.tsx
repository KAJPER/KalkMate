"use client";

import { motion } from "framer-motion";

const steps = [
  {
    title: "Zrób zdjęcie lub wpisz pytanie",
    description: "Naciśnij przycisk kamery lub wpisz treść zadania na klawiaturze",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="2" width="16" height="20" rx="2" />
        <circle cx="12" cy="8" r="2" />
        <rect x="7" y="13" width="10" height="6" rx="1" />
      </svg>
    ),
  },
  {
    title: "Urządzenie łączy się z WiFi",
    description: "KalkMate automatycznie łączy się z zapamiętaną siecią WiFi",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 12.55a11 11 0 0114.08 0" />
        <path d="M1.42 9a16 16 0 0121.16 0" />
        <path d="M8.53 16.11a6 6 0 016.95 0" />
        <circle cx="12" cy="20" r="1" />
      </svg>
    ),
  },
  {
    title: "Dane trafiają na nasz serwer",
    description: "Zdjęcie lub tekst jest szyfrowane i wysyłane na serwer KalkMate przez HTTPS",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="6" rx="1" />
        <rect x="2" y="15" width="20" height="6" rx="1" />
        <path d="M6 6h.01M6 18h.01M12 9v6" />
      </svg>
    ),
  },
  {
    title: "AI analizuje zadanie",
    description:
      "Nasz model AI wytrenowany pod matematykę (podstawa + rozszerzenie), biologię, chemię i fizykę rozwiązuje zadanie krok po kroku",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2a8 8 0 018 8c0 3-1.5 5.5-4 7v3H8v-3c-2.5-1.5-4-4-4-7a8 8 0 018-8z" />
        <path d="M10 22h4" />
      </svg>
    ),
  },
  {
    title: "Odpowiedź na ekranie",
    description:
      "Rozwiązanie pojawia się na wyświetlaczu. Przewijaj przyciskami 8/2 (góra/dół) i 4/6 (lewo/prawo)",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M7 9h10M7 13h6" />
      </svg>
    ),
  },
];

const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.15,
    },
  },
};

const stepVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: "easeOut" as const },
  },
};

export default function HowItWorks() {
  return (
    <section id="jak-dziala" className="py-24 bg-white dark:bg-[#2B2D31]">
      <div className="max-w-7xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="text-center"
        >
          <h2 className="text-3xl lg:text-4xl font-bold text-[#1a1a1a] dark:text-[#E0E0E0]">
            Od zdjęcia do odpowiedzi w 3 sekundy
          </h2>
          <p className="mt-4 text-[#1a1a1a]/60 dark:text-[#E0E0E0]/60 max-w-2xl mx-auto">
            Cały proces dzieje się automatycznie. Ty robisz zdjęcie, resztą zajmuje się
            KalkMate.
          </p>
        </motion.div>

        {/* Desktop: horizontal flow */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          className="mt-16 hidden lg:grid grid-cols-5 gap-4 relative"
        >
          {/* Connecting line */}
          <div className="absolute top-12 left-[10%] right-[10%] h-[2px] bg-gray-200 dark:bg-[#3F4147]" />
          <motion.div
            initial={{ scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 1.2, ease: "easeOut", delay: 0.3 }}
            className="absolute top-12 left-[10%] right-[10%] h-[2px] bg-[#2563EB] dark:bg-[#3B82F6] origin-left"
          />

          {steps.map((step, i) => (
            <motion.div key={i} variants={stepVariants} className="relative text-center">
              <div className="mx-auto w-24 h-24 rounded-full bg-[#F5F5F5] dark:bg-[#313338] border-2 border-gray-200 dark:border-[#3F4147] flex items-center justify-center text-[#2563EB] dark:text-[#3B82F6] relative z-10">
                {step.icon}
              </div>
              <h3 className="mt-4 text-sm font-bold text-[#1a1a1a] dark:text-[#E0E0E0]">
                {step.title}
              </h3>
              <p className="mt-2 text-xs text-[#1a1a1a]/50 dark:text-[#E0E0E0]/50 leading-relaxed">
                {step.description}
              </p>
            </motion.div>
          ))}
        </motion.div>

        {/* Mobile: vertical flow */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.1 }}
          className="mt-16 lg:hidden flex flex-col gap-8 relative"
        >
          {/* Vertical line */}
          <div className="absolute left-6 top-0 bottom-0 w-[2px] bg-gray-200 dark:bg-[#3F4147]" />

          {steps.map((step, i) => (
            <motion.div key={i} variants={stepVariants} className="relative flex gap-6 items-start">
              <div className="w-12 h-12 rounded-full bg-[#F5F5F5] dark:bg-[#313338] border-2 border-gray-200 dark:border-[#3F4147] flex items-center justify-center text-[#2563EB] dark:text-[#3B82F6] shrink-0 relative z-10">
                {step.icon}
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#1a1a1a] dark:text-[#E0E0E0]">
                  {step.title}
                </h3>
                <p className="mt-1 text-xs text-[#1a1a1a]/50 dark:text-[#E0E0E0]/50 leading-relaxed">
                  {step.description}
                </p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
