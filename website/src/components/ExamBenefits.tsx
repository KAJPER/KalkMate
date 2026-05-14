"use client";

import { motion } from "framer-motion";

const subjects = [
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
];

export default function ExamBenefits() {
  return (
    <section id="przedmioty" className="relative py-24 lg:py-36 bg-[#0E0E0E]">
      <div className="mx-auto max-w-[1400px] px-5 lg:px-10">
        <div className="grid lg:grid-cols-12 gap-8 items-end mb-16">
          <div className="lg:col-span-8">
            <p className="km-mono-eyebrow text-[#D8FF3D]">[ 03 ] · Pokrycie przedmiotów</p>
            <h2 className="km-display text-[clamp(40px,7vw,108px)] text-[#F2EDE3] mt-4">
              Cztery <span className="italic">maturalne</span><br />
              kierunki.
            </h2>
          </div>
          <div className="lg:col-span-4">
            <p className="text-[15px] leading-[1.65] text-[#F2EDE3]/65">
              Trenowany na arkuszach CKE z lat 2014–2025. Rozpoznaje typ zadania,
              stosuje metodę z klucza odpowiedzi, pokazuje pełne rozumowanie.
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-px bg-[rgba(242,237,227,0.10)] border border-[rgba(242,237,227,0.10)]">
          {subjects.map((s, i) => (
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
                <p className="km-mono-eyebrow text-[#F2EDE3]/40">Przykład</p>
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
          <div className="border-t border-[rgba(242,237,227,0.18)] pt-5">
            <p className="km-display text-5xl text-[#F2EDE3]">
              <span className="text-[#D8FF3D]">10</span> lat
            </p>
            <p className="km-mono-eyebrow text-[#F2EDE3]/45 mt-2">Arkuszy CKE w treningu</p>
          </div>
          <div className="border-t border-[rgba(242,237,227,0.18)] pt-5">
            <p className="km-display text-5xl text-[#F2EDE3]">
              <span className="text-[#D8FF3D]">94</span>%
            </p>
            <p className="km-mono-eyebrow text-[#F2EDE3]/45 mt-2">Trafność na zadaniach maturalnych</p>
          </div>
          <div className="border-t border-[rgba(242,237,227,0.18)] pt-5">
            <p className="km-display text-5xl text-[#F2EDE3]">
              <span className="text-[#D8FF3D]">1.2</span>s
            </p>
            <p className="km-mono-eyebrow text-[#F2EDE3]/45 mt-2">Średni czas odpowiedzi</p>
          </div>
        </div>
      </div>
    </section>
  );
}
