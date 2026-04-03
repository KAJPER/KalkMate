"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const faqs = [
  {
    q: "Czy nauczyciel może zauważyć że to nie zwykły kalkulator?",
    a: "KalkMate wygląda identycznie jak zwykły kalkulator graficzny. Obudowa, klawiatura i ekran nie różnią się od standardowych kalkulatorów. Tryb AI włącza się specjalną kombinacją klawiszy, której nikt nie zauważy.",
    category: "Bezpieczeństwo",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
  },
  {
    q: "Jakie przedmioty obsługuje AI?",
    a: "Matematyka (poziom podstawowy i rozszerzony), fizyka, chemia i biologia. Model jest specjalnie trenowany na polskich maturach z ostatnich 10 lat. Pracujemy nad dodaniem kolejnych przedmiotów.",
    category: "Funkcje",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2v20M2 12h20" />
      </svg>
    ),
  },
  {
    q: "Czy potrzebuję WiFi żeby korzystać?",
    a: "Tak, do trybu AI potrzebujesz połączenia WiFi, które konfigurujesz w panelu użytkownika. Tryb zwykłego kalkulatora działa offline bez WiFi przez cały czas.",
    category: "Techniczne",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 12.55a11 11 0 0 1 14.08 0" />
        <path d="M1.42 9a16 16 0 0 1 21.16 0" />
        <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
        <circle cx="12" cy="20" r="1" />
      </svg>
    ),
  },
  {
    q: "Jak długo działa na baterii?",
    a: "Około 6 godzin w trybie mieszanym (AI + kalkulator). Sam tryb kalkulatora wytrzymuje znacznie dłużej. Ładowanie przez USB-C trwa około 2 godzin.",
    category: "Techniczne",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="6" width="18" height="12" rx="2" ry="2" />
        <line x1="23" y1="13" x2="23" y2="11" />
      </svg>
    ),
  },
  {
    q: "Czy dane są bezpieczne?",
    a: "Zdjęcia i zapytania są przesyłane szyfrowanym połączeniem HTTPS. Nie przechowujemy zdjęć po przetworzeniu. Wszystkie dane są usuwane z serwera natychmiast po wysłaniu odpowiedzi.",
    category: "Bezpieczeństwo",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    ),
  },
  {
    q: "Czy mogę zwrócić produkt?",
    a: "Tak, masz 14 dni na zwrot bez podania przyczyny, zgodnie z prawem konsumenckim. Zwracamy pełną kwotę po otrzymaniu urządzenia w oryginalnym stanie.",
    category: "Zamówienie",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="1 4 1 10 7 10" />
        <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
      </svg>
    ),
  },
  {
    q: "Kiedy dostanę zamówienie?",
    a: "Wysyłka w ciągu 3-5 dni roboczych. Dostawa przez Paczkomat InPost zajmuje 1-2 dni robocze. Otrzymasz numer przesyłki na email.",
    category: "Zamówienie",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="3" width="15" height="13" />
        <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
        <circle cx="5.5" cy="18.5" r="2.5" />
        <circle cx="18.5" cy="18.5" r="2.5" />
      </svg>
    ),
  },
  {
    q: "Jaka jest gwarancja?",
    a: "24 miesiące gwarancji producenta na wszystkie elementy urządzenia. W przypadku usterki naprawiamy lub wymieniamy produkt na nowy.",
    category: "Zamówienie",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    ),
  },
];

function FAQItem({ item, index }: { item: typeof faqs[0]; index: number }) {
  const [open, setOpen] = useState(false);

  const categoryColors: Record<string, string> = {
    "Bezpieczeństwo": "bg-green-100 dark:bg-green-500/10 text-green-700 dark:text-green-400",
    "Funkcje": "bg-blue-100 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400",
    "Techniczne": "bg-purple-100 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400",
    "Zamówienie": "bg-orange-100 dark:bg-orange-500/10 text-orange-700 dark:text-orange-400",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay: index * 0.05, ease: "easeOut" as const }}
      className="bg-white dark:bg-[#2B2D31] rounded-xl border border-gray-100 dark:border-[#3F4147] overflow-hidden hover:shadow-lg transition-shadow duration-300"
    >
      <button
        onClick={() => setOpen(!open)}
        className="w-full p-6 flex items-start gap-4 text-left hover:bg-[#F5F5F5] dark:hover:bg-[#313338] transition-colors"
      >
        <div className="shrink-0 w-10 h-10 rounded-lg bg-[#2563EB]/10 dark:bg-[#3B82F6]/10 flex items-center justify-center text-[#2563EB] dark:text-[#3B82F6]">
          {item.icon}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${categoryColors[item.category]}`}>
              {item.category}
            </span>
          </div>
          <h3 className="text-base font-bold text-[#1a1a1a] dark:text-[#E0E0E0]">
            {item.q}
          </h3>
        </div>

        <motion.div
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.3, ease: "easeOut" as const }}
          className="shrink-0"
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-[#1a1a1a]/40 dark:text-[#E0E0E0]/40"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </motion.div>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" as const }}
            className="overflow-hidden"
          >
            <div className="px-6 pb-6 pt-0 pl-[4.5rem]">
              <p className="text-sm text-[#1a1a1a]/70 dark:text-[#E0E0E0]/70 leading-relaxed">
                {item.a}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function FAQ() {
  return (
    <section id="faq" className="py-24 bg-[#F5F5F5] dark:bg-[#313338] relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-[#2563EB]/5 dark:bg-[#3B82F6]/5 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-[#3B82F6]/5 dark:bg-[#2563EB]/5 rounded-full blur-3xl" />

      <div className="max-w-4xl mx-auto px-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.5, ease: "easeOut" as const }}
          className="text-center mb-12"
        >
          <div className="inline-block mb-4 px-4 py-2 bg-[#2563EB]/10 dark:bg-[#3B82F6]/10 rounded-full">
            <span className="text-sm font-bold text-[#2563EB] dark:text-[#3B82F6]">
              ❓ Najczęściej zadawane pytania
            </span>
          </div>
          <h2 className="text-3xl lg:text-4xl font-bold text-[#1a1a1a] dark:text-[#E0E0E0]">
            Masz pytania? Mamy odpowiedzi
          </h2>
          <p className="mt-4 text-lg text-[#1a1a1a]/60 dark:text-[#E0E0E0]/60 max-w-2xl mx-auto">
            Wszystko co musisz wiedzieć o KalkMate - od zamówienia po użytkowanie
          </p>
        </motion.div>

        <div className="space-y-4">
          {faqs.map((faq, i) => (
            <FAQItem key={i} item={faq} index={i} />
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3, ease: "easeOut" as const }}
          className="mt-12 text-center bg-white dark:bg-[#2B2D31] rounded-2xl p-8 border border-gray-100 dark:border-[#3F4147]"
        >
          <h3 className="text-xl font-bold text-[#1a1a1a] dark:text-[#E0E0E0] mb-2">
            Nie znalazłeś odpowiedzi?
          </h3>
          <p className="text-sm text-[#1a1a1a]/60 dark:text-[#E0E0E0]/60 mb-4">
            Napisz do nas na <a href="mailto:kacper@kajpa.pl" className="text-[#2563EB] dark:text-[#3B82F6] hover:underline font-medium">kacper@kajpa.pl</a>
            {" "}- odpowiadamy w ciągu 24h!
          </p>
          <a
            href="mailto:kacper@kajpa.pl"
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#2563EB] dark:bg-[#3B82F6] text-white font-medium rounded-full hover:bg-[#1d4ed8] dark:hover:bg-[#2563EB] transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
              <polyline points="22,6 12,13 2,6" />
            </svg>
            Napisz do nas
          </a>
        </motion.div>
      </div>
    </section>
  );
}
