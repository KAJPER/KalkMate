import Image from "next/image";
import { type ReactNode } from "react";
import { type Locale } from "@/lib/i18n";

type HeroContent = {
  eyebrow: string;
  section: string;
  h1: ReactNode;
  para1: ReactNode;
  para2: string;
  ctaOrder: string;
  ctaHow: string;
  specBattery: string;
  specAnswer: string;
  specSubjects: string;
  imageAlt: string;
  labelCamera: string;
  labelCameraSub: string;
  labelOled: string;
  ticker: string[];
};

const content: Record<Locale, HeroContent> = {
  pl: {
    eyebrow: "Edycja przedmaturalna · Polska, 2026",
    section: "[ 01 ] · Kalkulator. Z mózgiem.",
    h1: (
      <>
        Zrób<br />
        zdjęcie. <span className="italic text-[#D8FF3D]">Dostań</span><br />
        <span className="italic">odpowiedź.</span>
      </>
    ),
    para1: (
      <>
        KalkMate wygląda <em className="font-serif not-italic text-[#F2EDE3]">dokładnie</em>
        {" "}jak zwykły kalkulator graficzny. Ma jednak coś, czego nie ma żaden inny —
        ukrytą kamerę i model AI trenowany na arkuszach CKE z ostatnich 10 lat.
      </>
    ),
    para2:
      "Nic nie wpisujesz. Nic nie wstukujesz. Kierujesz obiektyw na zadanie — i po 1.2 sekundy widzisz rozwiązanie krok po kroku na ekranie OLED.",
    ctaOrder: "Zamów — 699 zł",
    ctaHow: "Zobacz jak działa",
    specBattery: "Bateria",
    specAnswer: "Odpowiedź",
    specSubjects: "Przedmioty",
    imageAlt: "KalkMate — kalkulator graficzny z ukrytą kamerą i AI",
    labelCamera: "Kamera OV2640",
    labelCameraSub: "UKRYTA · 2MP",
    labelOled: "OLED · 256×64",
    ticker: [
      "MATEMATYKA · ROZSZ.",
      "FIZYKA · CKE",
      "CHEMIA · ARKUSZE 2014–2025",
      "BIOLOGIA",
      "OCR < 1.2s",
      "OLED 256×64",
      "ESP32-WROVER",
      "MADE IN PL",
    ],
  },
  en: {
    eyebrow: "Pre-matura edition · Poland, 2026",
    section: "[ 01 ] · A calculator. With a brain.",
    h1: (
      <>
        Snap<br />
        the photo. <span className="italic text-[#D8FF3D]">Get</span><br />
        <span className="italic">the answer.</span>
      </>
    ),
    para1: (
      <>
        KalkMate looks <em className="font-serif not-italic text-[#F2EDE3]">exactly</em>
        {" "}like an ordinary graphing calculator. But it hides something no other one has —
        a concealed camera and an AI model trained on Polish national matura exam papers (CKE)
        from the last 10 years.
      </>
    ),
    para2:
      "You type nothing. You key in nothing. Just point the lens at the problem — and 1.2 seconds later the step-by-step solution appears on the OLED screen.",
    ctaOrder: "Order — 169 EUR",
    ctaHow: "See how it works",
    specBattery: "Battery",
    specAnswer: "Answer",
    specSubjects: "Subjects",
    imageAlt: "KalkMate — a graphing calculator with a hidden camera and AI",
    labelCamera: "OV2640 camera",
    labelCameraSub: "HIDDEN · 2MP",
    labelOled: "OLED · 256×64",
    ticker: [
      "MATHEMATICS · ADV.",
      "PHYSICS · CKE",
      "CHEMISTRY · PAPERS 2014–2025",
      "BIOLOGY",
      "OCR < 1.2s",
      "OLED 256×64",
      "ESP32-WROVER",
      "MADE IN PL",
    ],
  },
  de: {
    eyebrow: "Vor-Abitur-Edition · Polen, 2026",
    section: "[ 01 ] · Ein Taschenrechner. Mit Verstand.",
    h1: (
      <>
        Foto<br />
        machen. <span className="italic text-[#D8FF3D]">Antwort</span><br />
        <span className="italic">erhalten.</span>
      </>
    ),
    para1: (
      <>
        KalkMate sieht <em className="font-serif not-italic text-[#F2EDE3]">exakt</em>
        {" "}wie ein gewöhnlicher Grafikrechner aus. Doch er hat etwas, das kein anderer besitzt —
        eine versteckte Kamera und ein KI-Modell, trainiert auf polnischen Abiturprüfungen (CKE)
        der letzten 10 Jahre.
      </>
    ),
    para2:
      "Du tippst nichts. Du gibst nichts ein. Richte einfach das Objektiv auf die Aufgabe — und nach 1,2 Sekunden erscheint die Schritt-für-Schritt-Lösung auf dem OLED-Display.",
    ctaOrder: "Bestellen — 169 EUR",
    ctaHow: "So funktioniert's",
    specBattery: "Akku",
    specAnswer: "Antwort",
    specSubjects: "Fächer",
    imageAlt: "KalkMate — ein Grafikrechner mit versteckter Kamera und KI",
    labelCamera: "Kamera OV2640",
    labelCameraSub: "VERSTECKT · 2MP",
    labelOled: "OLED · 256×64",
    ticker: [
      "MATHEMATIK · ERW.",
      "PHYSIK · CKE",
      "CHEMIE · PRÜFUNGEN 2014–2025",
      "BIOLOGIE",
      "OCR < 1.2s",
      "OLED 256×64",
      "ESP32-WROVER",
      "MADE IN PL",
    ],
  },
};

export default function Hero({ lang = "pl" }: { lang?: Locale }) {
  const t = content[lang];

  return (
    <section id="top" className="relative pt-28 lg:pt-32 pb-16 lg:pb-24 overflow-hidden">
      {/* Backdrop atmosphere */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-40 right-[-10%] w-[680px] h-[680px] rounded-full bg-[#D8FF3D] opacity-[0.06] blur-[140px]" />
        <div className="absolute top-[40%] left-[-10%] w-[480px] h-[480px] rounded-full bg-[#FF4D2E] opacity-[0.05] blur-[140px]" />
      </div>

      {/* Top eyebrow row */}
      <div className="mx-auto max-w-[1400px] px-5 lg:px-10">
        <div className="flex items-center justify-between gap-6 border-b border-[rgba(242,237,227,0.10)] pb-5">
          <span className="km-mono-eyebrow text-[#F2EDE3]/55 flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-[#D8FF3D] rounded-full km-blink" />
            {t.eyebrow}
          </span>
          <span className="km-mono-eyebrow text-[#F2EDE3]/40 hidden md:inline">
            S/N · KM–0001 ▸ KM–0500
          </span>
        </div>
      </div>

      {/* Headline + device */}
      <div className="mx-auto max-w-[1400px] px-5 lg:px-10 mt-10 lg:mt-16 grid lg:grid-cols-12 gap-10 items-start">
        {/* Left: Headline */}
        <div className="lg:col-span-7 relative km-fade-up">
          <p className="km-mono-eyebrow text-[#D8FF3D]">
            {t.section}
          </p>

          <h1 className="km-display text-[clamp(56px,9.4vw,148px)] text-[#F2EDE3] mt-6">
            {t.h1}
          </h1>

          <div className="mt-8 grid sm:grid-cols-2 gap-6 max-w-2xl">
            <p className="text-[15px] leading-[1.65] text-[#F2EDE3]/75">
              {t.para1}
            </p>
            <p className="text-[15px] leading-[1.65] text-[#F2EDE3]/55">
              {t.para2}
            </p>
          </div>

          <div className="mt-10 flex flex-wrap items-center gap-3">
            <a
              href="#kup-teraz"
              className="group inline-flex items-center gap-3 bg-[#D8FF3D] text-[#0B0B0B] px-6 py-3.5 km-mono-eyebrow hover:bg-[#F2EDE3] transition-colors"
            >
              {t.ctaOrder}
              <span className="text-base">→</span>
            </a>
            <a
              href="#jak-dziala"
              className="inline-flex items-center gap-2 px-5 py-3.5 km-mono-eyebrow text-[#F2EDE3]/80 border border-[rgba(242,237,227,0.18)] hover:border-[#D8FF3D] hover:text-[#F2EDE3] transition-colors"
            >
              {t.ctaHow}
            </a>
          </div>

          {/* Footnote / spec */}
          <div className="mt-12 grid grid-cols-3 gap-6 max-w-xl border-t border-[rgba(242,237,227,0.10)] pt-6">
            <div>
              <p className="km-mono-eyebrow text-[#F2EDE3]/40">{t.specBattery}</p>
              <p className="km-display text-3xl text-[#F2EDE3] mt-1">~6<span className="text-[#F2EDE3]/40 text-xl">h</span></p>
            </div>
            <div>
              <p className="km-mono-eyebrow text-[#F2EDE3]/40">{t.specAnswer}</p>
              <p className="km-display text-3xl text-[#F2EDE3] mt-1">1.2<span className="text-[#F2EDE3]/40 text-xl">s</span></p>
            </div>
            <div>
              <p className="km-mono-eyebrow text-[#F2EDE3]/40">{t.specSubjects}</p>
              <p className="km-display text-3xl text-[#F2EDE3] mt-1">04</p>
            </div>
          </div>
        </div>

        {/* Right: Device + floating data */}
        <div className="lg:col-span-5 relative km-fade-up-delayed">
          <div className="relative aspect-[4/5] w-full max-w-[460px] mx-auto">
            {/* Frame ticks */}
            <div className="absolute -top-2 -left-2 w-5 h-5 border-l border-t border-[#D8FF3D]" />
            <div className="absolute -top-2 -right-2 w-5 h-5 border-r border-t border-[#D8FF3D]" />
            <div className="absolute -bottom-2 -left-2 w-5 h-5 border-l border-b border-[#D8FF3D]" />
            <div className="absolute -bottom-2 -right-2 w-5 h-5 border-r border-b border-[#D8FF3D]" />

            <div className="absolute inset-0 overflow-hidden">
              <Image
                src="/KalkMate3.png"
                alt={t.imageAlt}
                fill
                priority
                quality={80}
                sizes="(max-width: 640px) 460px, (max-width: 1024px) 50vw, 460px"
                className="object-cover grayscale-[10%] contrast-[1.05]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0B0B0B] via-transparent to-transparent" />
            </div>

            {/* Floating labels */}
            <div className="absolute top-6 -left-3 lg:-left-12 bg-[#0B0B0B] border border-[rgba(242,237,227,0.18)] px-3 py-2 max-w-[180px]">
              <p className="km-mono-eyebrow text-[#D8FF3D] flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-[#D8FF3D] rounded-full km-blink" />
                {t.labelCamera}
              </p>
              <p className="km-mono-eyebrow text-[#F2EDE3]/50 mt-1">{t.labelCameraSub}</p>
            </div>

            <div className="absolute bottom-12 -right-3 lg:-right-10 bg-[#0B0B0B] border border-[rgba(242,237,227,0.18)] px-3 py-2 max-w-[200px]">
              <p className="km-mono-eyebrow text-[#F2EDE3]/50">{t.labelOled}</p>
              <p className="km-led text-sm mt-1">∫ x² dx = x³/3 + C</p>
            </div>

            <div className="absolute -bottom-4 left-4 bg-[#D8FF3D] text-[#0B0B0B] px-2.5 py-1">
              <p className="km-mono-eyebrow">KM v1.0</p>
            </div>
          </div>
        </div>
      </div>

      {/* Marquee ticker */}
      <div className="mt-16 lg:mt-24 border-y border-[rgba(242,237,227,0.10)] py-4 overflow-hidden">
        <div className="km-marquee flex gap-12 whitespace-nowrap">
          {[...t.ticker, ...t.ticker, ...t.ticker].map((tok, i) => (
            <span
              key={i}
              className="km-mono-eyebrow text-[#F2EDE3]/55 inline-flex items-center gap-12"
            >
              {tok}
              <span className="text-[#D8FF3D]">✦</span>
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
