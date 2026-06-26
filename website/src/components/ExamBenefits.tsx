"use client";

import { motion } from "framer-motion";
import { type Locale } from "@/lib/i18n";
import type { ReactNode } from "react";

type Subject = {
  code: string;
  name: string;
  sub: string;
  formula: string;
  bullets: string[];
  accent?: boolean;
};

type Stat = {
  value: ReactNode;
  label: string;
};

type Content = {
  eyebrow: string;
  heading: ReactNode;
  side: string;
  exampleLabel: string;
  subjects: Subject[];
  stats: Stat[];
};

const content: Record<Locale, Content> = {
  pl: {
    eyebrow: "[ 03 ] · Pokrycie przedmiotów",
    heading: (
      <>
        Cztery <span className="italic">kierunki</span><br />
        naukowe.
      </>
    ),
    side:
      "Trenowany na tysiącach zadań z ostatnich 10 lat. Rozpoznaje typ zadania, dobiera metodę rozwiązania, pokazuje pełne rozumowanie.",
    exampleLabel: "Przykład",
    subjects: [
      {
        code: "MAT",
        name: "Matematyka",
        sub: "podstawa · rozszerzenie",
        formula: "f(x) = ax² + bx + c",
        bullets: ["Funkcje, granice, pochodne", "Geometria analityczna", "Ciągi, prawd., kombinatoryka"],
        accent: true,
      },
      {
        code: "FIZ",
        name: "Fizyka",
        sub: "rozszerzenie",
        formula: "E = ½mv² + mgh",
        bullets: ["Mechanika, termodynamika", "Elektromagnetyzm", "Optyka, fizyka jądrowa"],
      },
      {
        code: "CHE",
        name: "Chemia",
        sub: "rozszerzenie",
        formula: "2H₂ + O₂ → 2H₂O",
        bullets: ["Stechiometria, równowagi", "Chemia organiczna", "Roztwory, elektrochemia"],
      },
      {
        code: "BIO",
        name: "Biologia",
        sub: "rozszerzenie",
        formula: "ATP ⇌ ADP + Pᵢ",
        bullets: ["Genetyka, biochemia", "Fizjologia, ekologia", "Ewolucja, biotechnologia"],
      },
    ],
    stats: [
      {
        value: (
          <>
            <span className="text-[#D8FF3D]">10</span> lat
          </>
        ),
        label: "lat danych treningowych",
      },
      {
        value: (
          <>
            <span className="text-[#D8FF3D]">94</span>%
          </>
        ),
        label: "Trafność rozwiązywania zadań",
      },
      {
        value: (
          <>
            <span className="text-[#D8FF3D]">1.2</span>s
          </>
        ),
        label: "Średni czas odpowiedzi",
      },
    ],
  },
  en: {
    eyebrow: "[ 03 ] · Subject coverage",
    heading: (
      <>
        Four <span className="italic">science</span><br />
        subjects.
      </>
    ),
    side:
      "Trained on thousands of problems from the last 10 years. It recognises the task type, picks the right method and shows the full reasoning.",
    exampleLabel: "Example",
    subjects: [
      {
        code: "MAT",
        name: "Mathematics",
        sub: "basic · extended",
        formula: "f(x) = ax² + bx + c",
        bullets: ["Functions, limits, derivatives", "Analytic geometry", "Sequences, probability, combinatorics"],
        accent: true,
      },
      {
        code: "FIZ",
        name: "Physics",
        sub: "extended",
        formula: "E = ½mv² + mgh",
        bullets: ["Mechanics, thermodynamics", "Electromagnetism", "Optics, nuclear physics"],
      },
      {
        code: "CHE",
        name: "Chemistry",
        sub: "extended",
        formula: "2H₂ + O₂ → 2H₂O",
        bullets: ["Stoichiometry, equilibria", "Organic chemistry", "Solutions, electrochemistry"],
      },
      {
        code: "BIO",
        name: "Biology",
        sub: "extended",
        formula: "ATP ⇌ ADP + Pᵢ",
        bullets: ["Genetics, biochemistry", "Physiology, ecology", "Evolution, biotechnology"],
      },
    ],
    stats: [
      {
        value: (
          <>
            <span className="text-[#D8FF3D]">10</span> years
          </>
        ),
        label: "years of training data",
      },
      {
        value: (
          <>
            <span className="text-[#D8FF3D]">94</span>%
          </>
        ),
        label: "Accuracy on exam problems",
      },
      {
        value: (
          <>
            <span className="text-[#D8FF3D]">1.2</span>s
          </>
        ),
        label: "Average response time",
      },
    ],
  },
  de: {
    eyebrow: "[ 03 ] · Fächerabdeckung",
    heading: (
      <>
        Vier <span className="italic">natur</span>-<br />
        wissenschaftliche Fächer.
      </>
    ),
    side:
      "Trainiert auf Tausenden von Aufgaben der letzten 10 Jahre. Er erkennt den Aufgabentyp, wählt die passende Methode und zeigt den vollständigen Lösungsweg.",
    exampleLabel: "Beispiel",
    subjects: [
      {
        code: "MAT",
        name: "Mathematik",
        sub: "Grund · Leistung",
        formula: "f(x) = ax² + bx + c",
        bullets: ["Funktionen, Grenzwerte, Ableitungen", "Analytische Geometrie", "Folgen, Wahrsch., Kombinatorik"],
        accent: true,
      },
      {
        code: "FIZ",
        name: "Physik",
        sub: "Leistung",
        formula: "E = ½mv² + mgh",
        bullets: ["Mechanik, Thermodynamik", "Elektromagnetismus", "Optik, Kernphysik"],
      },
      {
        code: "CHE",
        name: "Chemie",
        sub: "Leistung",
        formula: "2H₂ + O₂ → 2H₂O",
        bullets: ["Stöchiometrie, Gleichgewichte", "Organische Chemie", "Lösungen, Elektrochemie"],
      },
      {
        code: "BIO",
        name: "Biologie",
        sub: "Leistung",
        formula: "ATP ⇌ ADP + Pᵢ",
        bullets: ["Genetik, Biochemie", "Physiologie, Ökologie", "Evolution, Biotechnologie"],
      },
    ],
    stats: [
      {
        value: (
          <>
            <span className="text-[#D8FF3D]">10</span> Jahre
          </>
        ),
        label: "Jahre Trainingsdaten",
      },
      {
        value: (
          <>
            <span className="text-[#D8FF3D]">94</span>%
          </>
        ),
        label: "Trefferquote bei Aufgaben",
      },
      {
        value: (
          <>
            <span className="text-[#D8FF3D]">1.2</span>s
          </>
        ),
        label: "Durchschnittliche Antwortzeit",
      },
    ],
  },
};

export default function ExamBenefits({ lang = "pl" }: { lang?: Locale }) {
  const t = content[lang];
  return (
    <section id="przedmioty" className="relative py-24 lg:py-36 bg-[#0E0E0E]">
      <div className="mx-auto max-w-[1400px] px-5 lg:px-10">
        <div className="grid lg:grid-cols-12 gap-8 items-end mb-16">
          <div className="lg:col-span-8">
            <p className="km-mono-eyebrow text-[#D8FF3D]">{t.eyebrow}</p>
            <h2 className="km-display text-[clamp(40px,7vw,108px)] text-[#F2EDE3] mt-4">
              {t.heading}
            </h2>
          </div>
          <div className="lg:col-span-4">
            <p className="text-[15px] leading-[1.65] text-[#F2EDE3]/65">
              {t.side}
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-px bg-[rgba(242,237,227,0.10)] border border-[rgba(242,237,227,0.10)]">
          {t.subjects.map((s, i) => (
            <motion.div
              key={s.code}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.55, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
              className={`relative p-8 lg:p-10 bg-[#0E0E0E] hover:bg-[#0B0B0B] transition-colors group ${
                s.accent ? "lg:row-span-1" : ""
              }`}
            >
              <div className="flex items-start justify-between gap-6">
                <div>
                  <p className="km-mono-eyebrow text-[#D8FF3D]">{s.code} · {s.sub}</p>
                  <h3 className="km-display text-[clamp(40px,5vw,72px)] text-[#F2EDE3] mt-3 leading-none">
                    {s.name}
                  </h3>
                </div>
                <span className="km-mono-eyebrow text-[#F2EDE3]/40 border border-[rgba(242,237,227,0.18)] px-2 py-1 whitespace-nowrap">
                  0{i + 1}/04
                </span>
              </div>

              <div className="mt-8 border-l-2 border-[#D8FF3D]/60 pl-4">
                <p className="km-mono-eyebrow text-[#F2EDE3]/40">{t.exampleLabel}</p>
                <p className="km-led text-lg mt-1">{s.formula}</p>
              </div>

              <ul className="mt-8 space-y-2">
                {s.bullets.map((b, j) => (
                  <li key={j} className="flex items-baseline gap-3 text-[14.5px] text-[#F2EDE3]/75">
                    <span className="km-mono-eyebrow text-[#F2EDE3]/30">→</span>
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>

        <div className="mt-12 grid md:grid-cols-3 gap-6 text-center md:text-left">
          {t.stats.map((stat, i) => (
            <div key={i} className="border-t border-[rgba(242,237,227,0.18)] pt-5">
              <p className="km-display text-5xl text-[#F2EDE3]">
                {stat.value}
              </p>
              <p className="km-mono-eyebrow text-[#F2EDE3]/45 mt-2">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
