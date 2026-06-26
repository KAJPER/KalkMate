"use client";

import { motion } from "framer-motion";
import { type ReactNode } from "react";
import { type Locale } from "@/lib/i18n";

type Step = {
  n: string;
  title: string;
  head: string;
  desc: string;
  tag: string;
};

type HowItWorksContent = {
  eyebrow: string;
  h2: ReactNode;
  side: string;
  avg: string;
  stepLabel: string;
  steps: Step[];
};

const content: Record<Locale, HowItWorksContent> = {
  pl: {
    eyebrow: "[ 02 ] · Workflow",
    h2: (
      <>
        Trzy ruchy. <span className="italic">Zero</span><br />
        wpisywania.
      </>
    ),
    side:
      "Cała interakcja zamyka się w jednym geście. Nie tłumaczysz zadania, nie literujesz wzoru, nie szukasz przycisku.",
    avg: "[ Avg. czas użycia: 5.4 sek ]",
    stepLabel: "STEP",
    steps: [
      {
        n: "01",
        title: "Wyceluj",
        head: "Kierujesz kamerę.",
        desc: "Ukryta kamera 2MP ostrzy automatycznie. Wszystko od jednego polecenia: zadanie z arkusza, zeszytu, ekranu — wystarczy że widać tekst.",
        tag: "OV2640 · AF",
      },
      {
        n: "02",
        title: "Analiza",
        head: "AI rozpoznaje treść.",
        desc: "Model AI czyta zadanie, klasyfikuje przedmiot i typ, dobiera metodę rozwiązania.",
        tag: "OCR + LLM",
      },
      {
        n: "03",
        title: "Odpowiedź",
        head: "Rozwiązanie na OLED.",
        desc: "Kompletne rozwiązanie krok po kroku z wzorami w formacie LaTeX. Wynik w mniej niż 1.2 sekundy.",
        tag: "256×64 OLED",
      },
    ],
  },
  en: {
    eyebrow: "[ 02 ] · Workflow",
    h2: (
      <>
        Three moves. <span className="italic">Zero</span><br />
        typing.
      </>
    ),
    side:
      "The whole interaction fits into a single gesture. No spelling out the problem, no keying in the formula, no hunting for a button.",
    avg: "[ Avg. time in use: 5.4 sec ]",
    stepLabel: "STEP",
    steps: [
      {
        n: "01",
        title: "Aim",
        head: "Point the camera.",
        desc: "The hidden 2MP camera focuses automatically. One command handles it all: a problem from an exam paper, a notebook or a screen — as long as the text is visible.",
        tag: "OV2640 · AF",
      },
      {
        n: "02",
        title: "Analysis",
        head: "AI reads it.",
        desc: "The AI model reads the problem, classifies the subject and type, and picks the right solving method.",
        tag: "OCR + LLM",
      },
      {
        n: "03",
        title: "Answer",
        head: "Solution on OLED.",
        desc: "A complete step-by-step solution with formulas in LaTeX format. The result in under 1.2 seconds.",
        tag: "256×64 OLED",
      },
    ],
  },
  de: {
    eyebrow: "[ 02 ] · Workflow",
    h2: (
      <>
        Drei Gesten. <span className="italic">Null</span><br />
        Tippen.
      </>
    ),
    side:
      "Die gesamte Interaktion passt in eine einzige Geste. Kein Abtippen der Aufgabe, kein Buchstabieren der Formel, kein Suchen nach einer Taste.",
    avg: "[ Durchschn. Nutzungsdauer: 5,4 Sek ]",
    stepLabel: "STEP",
    steps: [
      {
        n: "01",
        title: "Zielen",
        head: "Kamera draufhalten.",
        desc: "Die versteckte 2-MP-Kamera fokussiert automatisch. Ein Befehl genügt: eine Aufgabe aus dem Prüfungsbogen, dem Heft oder vom Bildschirm — Hauptsache, der Text ist sichtbar.",
        tag: "OV2640 · AF",
      },
      {
        n: "02",
        title: "Analyse",
        head: "KI erkennt alles.",
        desc: "Das KI-Modell liest die Aufgabe, klassifiziert Fach und Typ und wählt die passende Lösungsmethode.",
        tag: "OCR + LLM",
      },
      {
        n: "03",
        title: "Antwort",
        head: "Lösung auf OLED.",
        desc: "Eine vollständige Schritt-für-Schritt-Lösung mit Formeln im LaTeX-Format. Das Ergebnis in unter 1,2 Sekunden.",
        tag: "256×64 OLED",
      },
    ],
  },
};

export default function HowItWorks({ lang = "pl" }: { lang?: Locale }) {
  const t = content[lang];

  return (
    <section id="jak-dziala" className="relative py-24 lg:py-36">
      <div className="mx-auto max-w-[1400px] px-5 lg:px-10">
        <div className="grid lg:grid-cols-12 gap-8 items-end mb-16">
          <div className="lg:col-span-7">
            <p className="km-mono-eyebrow text-[#D8FF3D]">{t.eyebrow}</p>
            <h2 className="km-display text-[clamp(40px,7vw,108px)] text-[#F2EDE3] mt-4">
              {t.h2}
            </h2>
          </div>
          <div className="lg:col-span-4 lg:col-start-9">
            <p className="text-[15px] leading-[1.65] text-[#F2EDE3]/65">
              {t.side}
            </p>
            <div className="km-mono-eyebrow text-[#F2EDE3]/40 mt-4">
              {t.avg}
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-px bg-[rgba(242,237,227,0.10)] border border-[rgba(242,237,227,0.10)]">
          {t.steps.map((s, i) => (
            <motion.div
              key={s.n}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 0.6, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] }}
              className="bg-[#0B0B0B] p-8 lg:p-10 group relative hover:bg-[#111] transition-colors"
            >
              <div className="flex items-start justify-between">
                <span className="km-display text-7xl text-[#F2EDE3]/20 group-hover:text-[#D8FF3D] transition-colors">
                  {s.n}
                </span>
                <span className="km-mono-eyebrow text-[#F2EDE3]/40 border border-[rgba(242,237,227,0.18)] px-2 py-1">
                  {s.tag}
                </span>
              </div>

              <h3 className="km-display text-4xl mt-12 text-[#F2EDE3]">
                {s.head.split(" ").map((w, idx) => (
                  <span key={idx} className={idx === 1 ? "italic text-[#D8FF3D]" : ""}>
                    {w}{" "}
                  </span>
                ))}
              </h3>

              <p className="text-[14.5px] leading-[1.65] text-[#F2EDE3]/65 mt-4">
                {s.desc}
              </p>

              <p className="km-mono-eyebrow text-[#F2EDE3]/35 mt-10">
                {t.stepLabel} / {s.title.toUpperCase()}
              </p>
            </motion.div>
          ))}
        </div>

        <div className="mt-10 border border-[rgba(242,237,227,0.10)] bg-[#0E0E0E] p-5 lg:p-6 font-mono text-[12.5px] leading-[1.7] text-[#F2EDE3]/65 overflow-x-auto km-no-scrollbar">
          <p>
            <span className="text-[#F2EDE3]/35">$</span>{" "}
            <span className="text-[#D8FF3D]">kalkmate</span> --capture --solve
          </p>
          <p className="text-[#F2EDE3]/45">[ok] zdjęcie · 1632×1232 · 218 KB</p>
          <p className="text-[#F2EDE3]/45">[ok] klasyfikator: matematyka / całki / oznaczone</p>
          <p className="text-[#F2EDE3]/45">[ok] model: kalkmate-r1</p>
          <p>
            <span className="text-[#D8FF3D]">→</span> ∫₀¹ (3x² + 2x) dx ={" "}
            <span className="text-[#D8FF3D]">2</span>
          </p>
        </div>
      </div>
    </section>
  );
}
