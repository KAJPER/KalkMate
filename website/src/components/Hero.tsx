"use client";

import { type ReactNode } from "react";
import Image from "next/image";
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
    eyebrow: "Edycja 2026 · Polska",
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
        {" "}jak zwykły kalkulator prosty. Ma jednak coś, czego nie ma żaden inny —
        ukrytą kamerę i model AI trenowany na tysiącach zadań z ostatnich 10 lat.
      </>
    ),
    para2:
      "Nic nie wpisujesz. Nic nie wstukujesz. Kierujesz obiektyw na zadanie — i po 1.2 sekundy widzisz rozwiązanie krok po kroku na ekranie OLED.",
    ctaOrder: "Zamów — 699 zł",
    ctaHow: "Zobacz jak działa",
    specBattery: "Bateria",
    specAnswer: "Odpowiedź",
    specSubjects: "Przedmioty",
    imageAlt: "KalkMate — kalkulator prosty z ukrytą kamerą i AI",
    labelCamera: "Kamera OV2640",
    labelCameraSub: "UKRYTA · 2MP",
    labelOled: "OLED · 256×64",
    ticker: [
      "MATEMATYKA · ROZSZ.",
      "FIZYKA",
      "CHEMIA · 2014–2025",
      "BIOLOGIA",
      "OCR < 1.2s",
      "OLED 256×64",
      "ESP32-S3",
      "MADE IN PL",
    ],
  },
  en: {
    eyebrow: "Edition 2026 · Poland",
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
        {" "}like an ordinary simple calculator. But it hides something no other one has —
        a concealed camera and an AI model trained on thousands of problems
        from the last decade.
      </>
    ),
    para2:
      "You type nothing. You key in nothing. Just point the lens at the problem — and 1.2 seconds later the step-by-step solution appears on the OLED screen.",
    ctaOrder: "Order — 169 EUR",
    ctaHow: "See how it works",
    specBattery: "Battery",
    specAnswer: "Answer",
    specSubjects: "Subjects",
    imageAlt: "KalkMate — a simple calculator with a hidden camera and AI",
    labelCamera: "OV2640 camera",
    labelCameraSub: "HIDDEN · 2MP",
    labelOled: "OLED · 256×64",
    ticker: [
      "MATHEMATICS · ADV.",
      "PHYSICS",
      "CHEMISTRY · 2014–2025",
      "BIOLOGY",
      "OCR < 1.2s",
      "OLED 256×64",
      "ESP32-S3",
      "MADE IN PL",
    ],
  },
  de: {
    eyebrow: "Edition 2026 · Polen",
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
        {" "}wie ein gewöhnlicher einfacher Taschenrechner aus. Doch er hat etwas, das kein anderer besitzt —
        eine versteckte Kamera und ein KI-Modell, trainiert auf Tausenden von Aufgaben
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
    imageAlt: "KalkMate — ein einfacher Taschenrechner mit versteckter Kamera und KI",
    labelCamera: "Kamera OV2640",
    labelCameraSub: "VERSTECKT · 2MP",
    labelOled: "OLED · 256×64",
    ticker: [
      "MATHEMATIK · ERW.",
      "PHYSIK",
      "CHEMIE · 2014–2025",
      "BIOLOGIE",
      "OCR < 1.2s",
      "OLED 256×64",
      "ESP32-S3",
      "MADE IN PL",
    ],
  },
  cs: {
    eyebrow: "Edice 2026 · Polsko",
    section: "[ 01 ] · Kalkulačka. S mozkem.",
    h1: (
      <>
        Vyfoť<br />
        úlohu. <span className="italic text-[#D8FF3D]">Získej</span><br />
        <span className="italic">odpověď.</span>
      </>
    ),
    para1: (
      <>
        KalkMate vypadá <em className="font-serif not-italic text-[#F2EDE3]">přesně</em>
        {" "}jako obyčejná jednoduchá kalkulačka. Skrývá ale něco, co žádná jiná nemá —
        skrytou kameru a AI model natrénovaný na tisících úloh
        z posledních 10 let.
      </>
    ),
    para2:
      "Nic nepíšeš. Nic neťukáš. Stačí namířit objektiv na úlohu — a za 1,2 sekundy uvidíš na OLED displeji řešení krok za krokem.",
    ctaOrder: "Objednat — 169 EUR",
    ctaHow: "Jak to funguje",
    specBattery: "Baterie",
    specAnswer: "Odpověď",
    specSubjects: "Předměty",
    imageAlt: "KalkMate — jednoduchá kalkulačka se skrytou kamerou a AI",
    labelCamera: "Kamera OV2640",
    labelCameraSub: "SKRYTÁ · 2MP",
    labelOled: "OLED · 256×64",
    ticker: [
      "MATEMATIKA",
      "FYZIKA",
      "CHEMIE · 2014–2025",
      "BIOLOGIE",
      "OCR < 1.2s",
      "OLED 256×64",
      "ESP32-S3",
      "MADE IN PL",
    ],
  },
  sk: {
    eyebrow: "Edícia 2026 · Poľsko",
    section: "[ 01 ] · Kalkulačka. S mozgom.",
    h1: (
      <>
        Odfoť<br />
        úlohu. <span className="italic text-[#D8FF3D]">Získaj</span><br />
        <span className="italic">odpoveď.</span>
      </>
    ),
    para1: (
      <>
        KalkMate vyzerá <em className="font-serif not-italic text-[#F2EDE3]">presne</em>
        {" "}ako obyčajná jednoduchá kalkulačka. Skrýva však niečo, čo žiadna iná nemá —
        skrytú kameru a AI model natrénovaný na tisíckach úloh
        z posledných 10 rokov.
      </>
    ),
    para2:
      "Nič nepíšeš. Nič neťukáš. Stačí namieriť objektív na úlohu — a o 1,2 sekundy uvidíš na OLED displeji riešenie krok za krokom.",
    ctaOrder: "Objednať — 169 EUR",
    ctaHow: "Ako to funguje",
    specBattery: "Batéria",
    specAnswer: "Odpoveď",
    specSubjects: "Predmety",
    imageAlt: "KalkMate — jednoduchá kalkulačka so skrytou kamerou a AI",
    labelCamera: "Kamera OV2640",
    labelCameraSub: "SKRYTÁ · 2MP",
    labelOled: "OLED · 256×64",
    ticker: [
      "MATEMATIKA",
      "FYZIKA",
      "CHÉMIA · 2014–2025",
      "BIOLÓGIA",
      "OCR < 1.2s",
      "OLED 256×64",
      "ESP32-S3",
      "MADE IN PL",
    ],
  },
  lt: {
    eyebrow: "2026 m. leidimas · Lenkija",
    section: "[ 01 ] · Skaičiuotuvas. Su smegenimis.",
    h1: (
      <>
        Fotografuok<br />
        užduotį. <span className="italic text-[#D8FF3D]">Gauk</span><br />
        <span className="italic">atsakymą.</span>
      </>
    ),
    para1: (
      <>
        KalkMate atrodo <em className="font-serif not-italic text-[#F2EDE3]">lygiai</em>
        {" "}kaip paprastas skaičiuotuvas. Tačiau jame slypi tai, ko neturi joks kitas —
        paslėpta kamera ir DI modelis, apmokytas tūkstančiais užduočių
        iš pastarųjų 10 metų.
      </>
    ),
    para2:
      "Nieko nerašai. Nieko nevedi. Tiesiog nukreipi objektyvą į užduotį — ir po 1,2 sekundės OLED ekrane matai sprendimą žingsnis po žingsnio.",
    ctaOrder: "Užsakyti — 169 EUR",
    ctaHow: "Kaip tai veikia",
    specBattery: "Baterija",
    specAnswer: "Atsakymas",
    specSubjects: "Dalykai",
    imageAlt: "KalkMate — paprastas skaičiuotuvas su paslėpta kamera ir DI",
    labelCamera: "Kamera OV2640",
    labelCameraSub: "PASLĖPTA · 2MP",
    labelOled: "OLED · 256×64",
    ticker: [
      "MATEMATIKA",
      "FIZIKA",
      "CHEMIJA · 2014–2025",
      "BIOLOGIJA",
      "OCR < 1.2s",
      "OLED 256×64",
      "ESP32-S3",
      "MADE IN PL",
    ],
  },
  be: {
    eyebrow: "Выданне 2026 · Польшча",
    section: "[ 01 ] · Калькулятар. З розумам.",
    h1: (
      <>
        Зрабі<br />
        фота. <span className="italic text-[#D8FF3D]">Атрымай</span><br />
        <span className="italic">адказ.</span>
      </>
    ),
    para1: (
      <>
        KalkMate выглядае <em className="font-serif not-italic text-[#F2EDE3]">дакладна</em>
        {" "}як звычайны просты калькулятар. Але ў ім ёсць тое, чаго няма ні ў воднага іншага —
        схаваная камера і мадэль ШІ, навучаная на тысячах задач
        за апошнія 10 гадоў.
      </>
    ),
    para2:
      "Нічога не ўпісваеш. Нічога не набіраеш. Наводзіш аб’ектыў на задачу — і праз 1,2 секунды бачыш на OLED-экране рашэнне крок за крокам.",
    ctaOrder: "Замовіць — 699 zł",
    ctaHow: "Як гэта працуе",
    specBattery: "Батарэя",
    specAnswer: "Адказ",
    specSubjects: "Прадметы",
    imageAlt: "KalkMate — просты калькулятар са схаванай камерай і ШІ",
    labelCamera: "Камера OV2640",
    labelCameraSub: "СХАВАНАЯ · 2MP",
    labelOled: "OLED · 256×64",
    ticker: [
      "МАТЭМАТЫКА",
      "ФІЗІКА",
      "ХІМІЯ · 2014–2025",
      "БІЯЛОГІЯ",
      "OCR < 1.2s",
      "OLED 256×64",
      "ESP32-S3",
      "MADE IN PL",
    ],
  },
  es: {
    eyebrow: "Edición 2026 · Polonia",
    section: "[ 01 ] · Una calculadora. Con cerebro.",
    h1: (
      <>
        Haz<br />
        la foto. <span className="italic text-[#D8FF3D]">Obtén</span><br />
        <span className="italic">la respuesta.</span>
      </>
    ),
    para1: (
      <>
        KalkMate parece <em className="font-serif not-italic text-[#F2EDE3]">exactamente</em>
        {" "}una calculadora básica normal. Pero esconde algo que ninguna otra tiene:
        una cámara oculta y un modelo de IA entrenado con miles de problemas
        de los últimos 10 años.
      </>
    ),
    para2:
      "No escribes nada. No tecleas nada. Apuntas el objetivo al problema y, en 1,2 segundos, ves la solución paso a paso en la pantalla OLED.",
    ctaOrder: "Comprar — 169 EUR",
    ctaHow: "Ver cómo funciona",
    specBattery: "Batería",
    specAnswer: "Respuesta",
    specSubjects: "Asignaturas",
    imageAlt: "KalkMate — una calculadora básica con cámara oculta e IA",
    labelCamera: "Cámara OV2640",
    labelCameraSub: "OCULTA · 2MP",
    labelOled: "OLED · 256×64",
    ticker: [
      "MATEMÁTICAS",
      "FÍSICA",
      "QUÍMICA · 2014–2025",
      "BIOLOGÍA",
      "OCR < 1.2s",
      "OLED 256×64",
      "ESP32-S3",
      "MADE IN PL",
    ],
  },
  pt: {
    eyebrow: "Edição 2026 · Polónia",
    section: "[ 01 ] · Uma calculadora. Com cérebro.",
    h1: (
      <>
        Tira<br />
        a foto. <span className="italic text-[#D8FF3D]">Recebe</span><br />
        <span className="italic">a resposta.</span>
      </>
    ),
    para1: (
      <>
        O KalkMate parece <em className="font-serif not-italic text-[#F2EDE3]">exatamente</em>
        {" "}uma calculadora simples comum. Mas esconde algo que nenhuma outra tem —
        uma câmara oculta e um modelo de IA treinado com milhares de exercícios
        dos últimos 10 anos.
      </>
    ),
    para2:
      "Não escreves nada. Não carregas em nada. Apontas a objetiva ao exercício — e, 1,2 segundos depois, vês a resolução passo a passo no ecrã OLED.",
    ctaOrder: "Encomendar — 169 EUR",
    ctaHow: "Ver como funciona",
    specBattery: "Bateria",
    specAnswer: "Resposta",
    specSubjects: "Disciplinas",
    imageAlt: "KalkMate — uma calculadora simples com câmara oculta e IA",
    labelCamera: "Câmara OV2640",
    labelCameraSub: "OCULTA · 2MP",
    labelOled: "OLED · 256×64",
    ticker: [
      "MATEMÁTICA",
      "FÍSICA",
      "QUÍMICA · 2014–2025",
      "BIOLOGIA",
      "OCR < 1.2s",
      "OLED 256×64",
      "ESP32-S3",
      "MADE IN PL",
    ],
  },
  fr: {
    eyebrow: "Édition 2026 · Pologne",
    section: "[ 01 ] · Une calculatrice. Avec un cerveau.",
    h1: (
      <>
        Prends<br />
        la photo. <span className="italic text-[#D8FF3D]">Obtiens</span><br />
        <span className="italic">la réponse.</span>
      </>
    ),
    para1: (
      <>
        KalkMate ressemble <em className="font-serif not-italic text-[#F2EDE3]">exactement</em>
        {" "}à une calculatrice basique ordinaire. Mais elle cache ce qu’aucune autre ne possède —
        une caméra dissimulée et un modèle d’IA entraîné sur des milliers d’exercices
        des 10 dernières années.
      </>
    ),
    para2:
      "Tu ne tapes rien. Tu ne saisis rien. Tu vises l’exercice avec l’objectif — et 1,2 seconde plus tard, la solution détaillée étape par étape s’affiche sur l’écran OLED.",
    ctaOrder: "Commander — 169 EUR",
    ctaHow: "Voir comment ça marche",
    specBattery: "Batterie",
    specAnswer: "Réponse",
    specSubjects: "Matières",
    imageAlt: "KalkMate — une calculatrice basique avec caméra cachée et IA",
    labelCamera: "Caméra OV2640",
    labelCameraSub: "CACHÉE · 2MP",
    labelOled: "OLED · 256×64",
    ticker: [
      "MATHÉMATIQUES",
      "PHYSIQUE",
      "CHIMIE · 2014–2025",
      "BIOLOGIE",
      "OCR < 1.2s",
      "OLED 256×64",
      "ESP32-S3",
      "MADE IN PL",
    ],
  },
  it: {
    eyebrow: "Edizione 2026 · Polonia",
    section: "[ 01 ] · Una calcolatrice. Con un cervello.",
    h1: (
      <>
        Scatta<br />
        la foto. <span className="italic text-[#D8FF3D]">Ottieni</span><br />
        <span className="italic">la risposta.</span>
      </>
    ),
    para1: (
      <>
        KalkMate sembra <em className="font-serif not-italic text-[#F2EDE3]">esattamente</em>
        {" "}una normale calcolatrice semplice. Ma nasconde qualcosa che nessun’altra ha —
        una fotocamera nascosta e un modello di IA addestrato su migliaia di esercizi
        degli ultimi 10 anni.
      </>
    ),
    para2:
      "Non scrivi nulla. Non digiti nulla. Punti l’obiettivo sull’esercizio — e dopo 1,2 secondi vedi la soluzione passo dopo passo sul display OLED.",
    ctaOrder: "Ordina — 169 EUR",
    ctaHow: "Scopri come funziona",
    specBattery: "Batteria",
    specAnswer: "Risposta",
    specSubjects: "Materie",
    imageAlt: "KalkMate — una calcolatrice semplice con fotocamera nascosta e IA",
    labelCamera: "Fotocamera OV2640",
    labelCameraSub: "NASCOSTA · 2MP",
    labelOled: "OLED · 256×64",
    ticker: [
      "MATEMATICA",
      "FISICA",
      "CHIMICA · 2014–2025",
      "BIOLOGIA",
      "OCR < 1.2s",
      "OLED 256×64",
      "ESP32-S3",
      "MADE IN PL",
    ],
  },
};

export default function Hero({ lang = "pl" }: { lang?: Locale }) {
  const t = content[lang];

  return (
    <section id="top" className="relative pt-28 lg:pt-32 pb-16 lg:pb-24 overflow-hidden">
      {/* Backdrop atmosphere — hidden on mobile (expensive GPU blur) */}
      <div className="hidden lg:block pointer-events-none absolute inset-0 -z-10">
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
        <div className="lg:col-span-7 relative">
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
        <div className="hidden lg:block lg:col-span-5 relative">
          <div className="relative aspect-[4/5] w-full max-w-[460px] mx-auto">
            {/* Frame ticks */}
            <div className="absolute -top-2 -left-2 w-5 h-5 border-l border-t border-[#D8FF3D]" />
            <div className="absolute -top-2 -right-2 w-5 h-5 border-r border-t border-[#D8FF3D]" />
            <div className="absolute -bottom-2 -left-2 w-5 h-5 border-l border-b border-[#D8FF3D]" />
            <div className="absolute -bottom-2 -right-2 w-5 h-5 border-r border-b border-[#D8FF3D]" />

            <div className="absolute inset-0 overflow-hidden bg-[#0B0B0B]">
              <Image
                src="/galeria/kalkulator-kalkmate-gotowy-egzemplarz.webp"
                alt={t.imageAlt}
                fill
                priority
                sizes="(min-width: 1024px) 460px, 0px"
                className="object-cover"
                style={{ objectPosition: "center 82%" }}
              />
              <div className="hidden lg:block absolute inset-0 bg-gradient-to-b from-[#0B0B0B] via-transparent to-transparent" />
              <div className="hidden lg:block absolute inset-0 bg-gradient-to-t from-[#0B0B0B] via-transparent to-transparent" />
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
              <p className="km-mono-eyebrow">KM v3.0</p>
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
