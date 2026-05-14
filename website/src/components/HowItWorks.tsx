"use client";

import { motion } from "framer-motion";

const steps = [
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
    desc: "Model wytrenowany na arkuszach CKE z lat 2014–2025 czyta zadanie, klasyfikuje przedmiot i typ, dobiera metodę rozwiązania.",
    tag: "OCR + LLM",
  },
  {
    n: "03",
    title: "Odpowiedź",
    head: "Rozwiązanie na OLED.",
    desc: "Kompletne rozwiązanie krok po kroku z wzorami w formacie LaTeX. Wynik w mniej niż 1.2 sekundy.",
    tag: "256×64 OLED",
  },
];

export default function HowItWorks() {
  return (
    <section id="jak-dziala" className="relative py-24 lg:py-36">
      <div className="mx-auto max-w-[1400px] px-5 lg:px-10">
        <div className="grid lg:grid-cols-12 gap-8 items-end mb-16">
          <div className="lg:col-span-7">
            <p className="km-mono-eyebrow text-[#D8FF3D]">[ 02 ] · Workflow</p>
            <h2 className="km-display text-[clamp(40px,7vw,108px)] text-[#F2EDE3] mt-4">
              Trzy ruchy. <span className="italic">Zero</span><br />
              wpisywania.
            </h2>
          </div>
          <div className="lg:col-span-4 lg:col-start-9">
            <p className="text-[15px] leading-[1.65] text-[#F2EDE3]/65">
              Cała interakcja zamyka się w jednym geście. Nie tłumaczysz zadania,
              nie literujesz wzoru, nie szukasz przycisku.
            </p>
            <div className="km-mono-eyebrow text-[#F2EDE3]/40 mt-4">
              [ Avg. czas użycia: 5.4 sek ]
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-px bg-[rgba(242,237,227,0.10)] border border-[rgba(242,237,227,0.10)]">
          {steps.map((s, i) => (
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
                STEP / {s.title.toUpperCase()}
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
          <p className="text-[#F2EDE3]/45">[ok] model: ckematura-r1</p>
          <p>
            <span className="text-[#D8FF3D]">→</span> ∫₀¹ (3x² + 2x) dx ={" "}
            <span className="text-[#D8FF3D]">2</span>
          </p>
        </div>
      </div>
    </section>
  );
}
