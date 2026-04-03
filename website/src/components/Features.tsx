"use client";

import { motion } from "framer-motion";

const features = [
  {
    title: "Zrób zdjęcie. Dostań odpowiedź.",
    description:
      "Nie wpisujesz niczego ręcznie. Ukryta kamera fotografuje zadanie z kartki lub tablicy. AI rozpoznaje treść i zwraca rozwiązanie krok po kroku.",
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="6" width="20" height="14" rx="2" />
        <circle cx="12" cy="13" r="4" />
        <path d="M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2" />
      </svg>
    ),
  },
  {
    title: "Wpisz zadanie ręcznie",
    description:
      "25 klawiszy membranowych. Wpisz pytanie z chemii, biologii lub matematyki. Nawiguj wyniki: 8 góra, 2 dół, 4 lewo, 6 prawo.",
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="4" width="20" height="16" rx="2" />
        <path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M6 12h.01M10 12h.01M14 12h.01M18 12h.01M8 16h8" />
      </svg>
    ),
  },
  {
    title: "Wyraźny ekran 256x64",
    description:
      "Monochromatyczny wyświetlacz OLED z wysokim kontrastem. Czytelny w każdych warunkach oświetlenia. Przewijanie odpowiedzi przyciskami.",
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M7 9h10M7 13h6" />
      </svg>
    ),
  },
  {
    title: "Zwykły kalkulator gdy potrzebujesz",
    description:
      "Gdy nie korzystasz z AI, KalkMate działa jak normalny kalkulator prosty. Nikt nie widzi różnicy.",
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="2" width="16" height="20" rx="2" />
        <rect x="8" y="6" width="8" height="4" rx="1" />
        <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01" />
      </svg>
    ),
  },
  {
    title: "Cały dzień bez ładowania",
    description:
      "Bateria LiPo 2000mAh z ładowaniem USB-C. Inteligentne zarządzanie energią: ekran i kamera wyłączają się automatycznie.",
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="6" y="7" width="12" height="10" rx="1" />
        <path d="M22 11v2M7 10v4M10 10v4M13 10v4" />
      </svg>
    ),
  },
  {
    title: "Zaprojektowane i wyprodukowane w Polsce",
    description:
      "Każda płytka PCB projektowana w Polsce. Nie masowa chińska produkcja, a ręczna kontrola jakości każdego egzemplarza.",
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s-8-4.5-8-11.8A8 8 0 0112 2a8 8 0 018 8.2c0 7.3-8 11.8-8 11.8z" />
        <circle cx="12" cy="10" r="3" />
      </svg>
    ),
  },
];

const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: "easeOut" as const },
  },
};

export default function Features() {
  return (
    <section id="funkcje" className="py-24 bg-[#F5F5F5] dark:bg-[#313338]">
      <div className="max-w-7xl mx-auto px-6">
        <motion.h2
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="text-3xl lg:text-4xl font-bold text-center text-[#1a1a1a] dark:text-[#E0E0E0]"
        >
          Wszystko czego potrzebujesz.<br />Nic, czego nie powinno być.
        </motion.h2>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          className="mt-16 grid md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {features.map((feature, i) => (
            <motion.div
              key={i}
              variants={itemVariants}
              className="bg-white dark:bg-[#2B2D31] rounded-xl p-8 border border-gray-100 dark:border-[#3F4147]"
            >
              <div className="text-[#2563EB] dark:text-[#3B82F6]">
                {feature.icon}
              </div>
              <h3 className="mt-4 text-lg font-bold text-[#1a1a1a] dark:text-[#E0E0E0]">
                {feature.title}
              </h3>
              <p className="mt-2 text-sm text-[#1a1a1a]/60 dark:text-[#E0E0E0]/60 leading-relaxed">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
