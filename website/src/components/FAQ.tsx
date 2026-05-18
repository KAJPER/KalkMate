"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const faqs = [
  {
    q: "Czy nauczyciel może zauważyć, że to nie zwykły kalkulator?",
    a: "Nie. Obudowa, klawiatura i ekran są identyczne ze standardowymi kalkulatorami graficznymi. Tryb AI uruchamiasz ukrytą kombinacją klawiszy — nie ma żadnych ikon ani wskaźników, które by Cię zdradzały.",
  },
  {
    q: "Jakie przedmioty obsługuje AI?",
    a: "Matematyka (poziom podstawowy i rozszerzony), fizyka, chemia i biologia. Model jest trenowany na arkuszach CKE z lat 2014–2025. Sukcesywnie dodajemy kolejne przedmioty.",
  },
  {
    q: "Czy potrzebuję WiFi?",
    a: "Tryb AI wymaga WiFi (konfigurujesz raz, w panelu użytkownika). Tryb klasycznego kalkulatora działa offline przez cały czas.",
  },
  {
    q: "Jak długo działa na baterii?",
    a: "Około 6 godzin w trybie mieszanym (AI + kalkulator). Sam tryb kalkulatora wytrzymuje znacznie dłużej. Ładowanie USB-C ~ 2 godziny.",
  },
  {
    q: "Czy moje dane są bezpieczne?",
    a: "Zdjęcia i zapytania przesyłamy szyfrowanym HTTPS. Po przetworzeniu nie przechowujemy zdjęć — są usuwane z serwera natychmiast po wysłaniu odpowiedzi.",
  },
  {
    q: "Czy mogę zwrócić produkt?",
    a: "Tak. Masz 14 dni na zwrot bez podania przyczyny, zgodnie z prawem konsumenckim. Zwracamy pełną kwotę po otrzymaniu urządzenia.",
  },
  {
    q: "Kiedy dostanę zamówienie?",
    a: "Wysyłka w ciągu 3–5 dni roboczych. Dostawa Paczkomatem InPost 1–2 dni robocze. Numer przesyłki dostajesz mailem.",
  },
  {
    q: "Jaka jest gwarancja?",
    a: "24 miesiące gwarancji producenta na wszystkie elementy. Naprawiamy lub wymieniamy urządzenie w razie usterki.",
  },
];

function Item({ item, n }: { item: { q: string; a: string }; n: number }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-[rgba(242,237,227,0.10)]">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full py-6 lg:py-7 flex items-start gap-6 text-left group"
      >
        <span className="km-mono-eyebrow text-[#D8FF3D] pt-2 w-12 flex-shrink-0">
          {String(n).padStart(2, "0")}
        </span>
        <span className="flex-1 km-display text-2xl lg:text-[28px] text-[#F2EDE3] leading-tight group-hover:text-[#D8FF3D] transition-colors">
          {item.q}
        </span>
        <span
          className={`flex-shrink-0 w-8 h-8 border border-[rgba(242,237,227,0.20)] flex items-center justify-center km-display text-xl text-[#F2EDE3] transition-transform ${
            open ? "rotate-45 border-[#D8FF3D] text-[#D8FF3D]" : ""
          }`}
        >
          +
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <p className="pb-8 pl-[4.5rem] pr-12 text-[15px] leading-[1.65] text-[#F2EDE3]/70 max-w-3xl">
              {item.a}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function FAQ() {
  return (
    <section id="faq" className="relative py-24 lg:py-36">
      <div className="mx-auto max-w-[1400px] px-5 lg:px-10">
        <div className="grid lg:grid-cols-12 gap-8 items-end mb-12 lg:mb-16">
          <div className="lg:col-span-8">
            <p className="km-mono-eyebrow text-[#D8FF3D]">[ 06 ] · FAQ</p>
            <h2 className="km-display text-[clamp(40px,7vw,108px)] text-[#F2EDE3] mt-4">
              Pytania, <span className="italic">które</span><br />
              każdy ma.
            </h2>
          </div>
          <div className="lg:col-span-4">
            <p className="text-[15px] leading-[1.65] text-[#F2EDE3]/60">
              Nie znalazłeś odpowiedzi? Napisz —
              odpowiadam w ciągu 24h.
            </p>
            <a
              href="mailto:kontakt@kalkmate.pl"
              className="km-mono-eyebrow text-[#D8FF3D] mt-3 inline-flex items-center gap-2"
            >
              kontakt@kalkmate.pl <span>↗</span>
            </a>
          </div>
        </div>

        <div className="border-t border-[rgba(242,237,227,0.10)]">
          {faqs.map((f, i) => (
            <Item key={i} item={f} n={i + 1} />
          ))}
        </div>
      </div>
    </section>
  );
}
