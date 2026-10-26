import Image from "next/image";
import Reveal from "@/components/Reveal";
import { type Locale } from "@/lib/i18n";

interface Shot {
  src: string;
  label: string;
  caption: string;
  span: string;
}

// Zdjęcia + układ siatki wspólne dla wszystkich języków — kolejne wersje
// językowe podają tylko [label, caption] w tej samej kolejności.
const SHOT_BASE: Pick<Shot, "src" | "span">[] = [
  { src: "/galeria/kalkulator-kalkmate-gotowy-egzemplarz.webp", span: "md:col-span-7 md:row-span-2 aspect-[4/5]" },
  { src: "/galeria/kalkulator-kalkmate-opakowanie-pudelko.webp", span: "md:col-span-5 aspect-[4/3]" },
  { src: "/galeria/kalkulator-kalkmate-ekran-menu-glowne.webp", span: "md:col-span-5 aspect-[4/3]" },
  { src: "/galeria/kalkulator-kalkmate-ekran-rozwiaz-zadanie.webp", span: "md:col-span-6 aspect-[4/3]" },
  { src: "/galeria/kalkulator-kalkmate-etykieta-certyfikaty.webp", span: "md:col-span-6 aspect-[4/3]" },
];

function localizedShots(texts: [label: string, caption: string][]): Shot[] {
  return SHOT_BASE.map((base, i) => ({ ...base, label: texts[i][0], caption: texts[i][1] }));
}

const shots: Record<Locale, Shot[]> = {
  pl: [
    {
      src: "/galeria/kalkulator-kalkmate-gotowy-egzemplarz.webp",
      label: "01 · Gotowy egzemplarz",
      caption: "KalkMate v3 — realne zdjęcie",
      span: "md:col-span-7 md:row-span-2 aspect-[4/5]",
    },
    {
      src: "/galeria/kalkulator-kalkmate-opakowanie-pudelko.webp",
      label: "02 · Opakowanie",
      caption: "Pudełko, w którym przyjedzie",
      span: "md:col-span-5 aspect-[4/3]",
    },
    {
      src: "/galeria/kalkulator-kalkmate-ekran-menu-glowne.webp",
      label: "03 · Ekran OLED",
      caption: "Menu główne na żywo",
      span: "md:col-span-5 aspect-[4/3]",
    },
    {
      src: "/galeria/kalkulator-kalkmate-ekran-rozwiaz-zadanie.webp",
      label: "04 · Rozwiąż zadanie",
      caption: "Zdjęcie kamerą → rozwiązanie",
      span: "md:col-span-6 aspect-[4/3]",
    },
    {
      src: "/galeria/kalkulator-kalkmate-etykieta-certyfikaty.webp",
      label: "05 · Etykieta",
      caption: "CE / RoHS, kod kreskowy",
      span: "md:col-span-6 aspect-[4/3]",
    },
  ],
  en: [
    {
      src: "/galeria/kalkulator-kalkmate-gotowy-egzemplarz.webp",
      label: "01 · Finished unit",
      caption: "KalkMate v3 — real photo",
      span: "md:col-span-7 md:row-span-2 aspect-[4/5]",
    },
    {
      src: "/galeria/kalkulator-kalkmate-opakowanie-pudelko.webp",
      label: "02 · Packaging",
      caption: "The box it ships in",
      span: "md:col-span-5 aspect-[4/3]",
    },
    {
      src: "/galeria/kalkulator-kalkmate-ekran-menu-glowne.webp",
      label: "03 · OLED screen",
      caption: "Main menu, live",
      span: "md:col-span-5 aspect-[4/3]",
    },
    {
      src: "/galeria/kalkulator-kalkmate-ekran-rozwiaz-zadanie.webp",
      label: "04 · Solve problem",
      caption: "Camera photo → solution",
      span: "md:col-span-6 aspect-[4/3]",
    },
    {
      src: "/galeria/kalkulator-kalkmate-etykieta-certyfikaty.webp",
      label: "05 · Label",
      caption: "CE / RoHS, barcode",
      span: "md:col-span-6 aspect-[4/3]",
    },
  ],
  de: [
    {
      src: "/galeria/kalkulator-kalkmate-gotowy-egzemplarz.webp",
      label: "01 · Fertiges Gerät",
      caption: "KalkMate v3 — echtes Foto",
      span: "md:col-span-7 md:row-span-2 aspect-[4/5]",
    },
    {
      src: "/galeria/kalkulator-kalkmate-opakowanie-pudelko.webp",
      label: "02 · Verpackung",
      caption: "So kommt es bei dir an",
      span: "md:col-span-5 aspect-[4/3]",
    },
    {
      src: "/galeria/kalkulator-kalkmate-ekran-menu-glowne.webp",
      label: "03 · OLED-Display",
      caption: "Hauptmenü, live",
      span: "md:col-span-5 aspect-[4/3]",
    },
    {
      src: "/galeria/kalkulator-kalkmate-ekran-rozwiaz-zadanie.webp",
      label: "04 · Aufgabe lösen",
      caption: "Kamerafoto → Lösung",
      span: "md:col-span-6 aspect-[4/3]",
    },
    {
      src: "/galeria/kalkulator-kalkmate-etykieta-certyfikaty.webp",
      label: "05 · Etikett",
      caption: "CE / RoHS, Barcode",
      span: "md:col-span-6 aspect-[4/3]",
    },
  ],
  cs: [
    {
      src: "/galeria/kalkulator-kalkmate-gotowy-egzemplarz.webp",
      label: "01 · Hotový kus",
      caption: "KalkMate v3 — skutečná fotka",
      span: "md:col-span-7 md:row-span-2 aspect-[4/5]",
    },
    {
      src: "/galeria/kalkulator-kalkmate-opakowanie-pudelko.webp",
      label: "02 · Balení",
      caption: "Krabička, ve které k tobě dorazí",
      span: "md:col-span-5 aspect-[4/3]",
    },
    {
      src: "/galeria/kalkulator-kalkmate-ekran-menu-glowne.webp",
      label: "03 · OLED displej",
      caption: "Hlavní menu naživo",
      span: "md:col-span-5 aspect-[4/3]",
    },
    {
      src: "/galeria/kalkulator-kalkmate-ekran-rozwiaz-zadanie.webp",
      label: "04 · Vyřeš úlohu",
      caption: "Fotka kamerou → řešení",
      span: "md:col-span-6 aspect-[4/3]",
    },
    {
      src: "/galeria/kalkulator-kalkmate-etykieta-certyfikaty.webp",
      label: "05 · Štítek",
      caption: "CE / RoHS, čárový kód",
      span: "md:col-span-6 aspect-[4/3]",
    },
  ],
  sk: localizedShots([
    ["01 · Hotový kus", "KalkMate v3 — skutočná fotka"],
    ["02 · Balenie", "Krabička, v ktorej k tebe príde"],
    ["03 · OLED displej", "Hlavné menu naživo"],
    ["04 · Vyrieš úlohu", "Fotka kamerou → riešenie"],
    ["05 · Štítok", "CE / RoHS, čiarový kód"],
  ]),
  lt: localizedShots([
    ["01 · Gatavas egzempliorius", "KalkMate v3 — tikra nuotrauka"],
    ["02 · Pakuotė", "Dėžutė, kurioje jis atkeliaus"],
    ["03 · OLED ekranas", "Pagrindinis meniu gyvai"],
    ["04 · Spręsk užduotį", "Nuotrauka kamera → sprendimas"],
    ["05 · Etiketė", "CE / RoHS, brūkšninis kodas"],
  ]),
  be: localizedShots([
    ["01 · Гатовы асобнік", "KalkMate v3 — сапраўднае фота"],
    ["02 · Упакоўка", "Скрынка, у якой ён да цябе прыедзе"],
    ["03 · OLED-экран", "Галоўнае меню ўжывую"],
    ["04 · Рашы задачу", "Фота камерай → рашэнне"],
    ["05 · Этыкетка", "CE / RoHS, штрых-код"],
  ]),
  es: localizedShots([
    ["01 · Unidad terminada", "KalkMate v3 — foto real"],
    ["02 · Embalaje", "La caja en la que te llega"],
    ["03 · Pantalla OLED", "Menú principal, en directo"],
    ["04 · Resolver problema", "Foto con la cámara → solución"],
    ["05 · Etiqueta", "CE / RoHS, código de barras"],
  ]),
  pt: localizedShots([
    ["01 · Unidade final", "KalkMate v3 — foto real"],
    ["02 · Embalagem", "A caixa em que te chega"],
    ["03 · Ecrã OLED", "Menu principal, ao vivo"],
    ["04 · Resolver exercício", "Foto com a câmara → resolução"],
    ["05 · Etiqueta", "CE / RoHS, código de barras"],
  ]),
  fr: localizedShots([
    ["01 · Exemplaire final", "KalkMate v3 — vraie photo"],
    ["02 · Emballage", "La boîte dans laquelle il arrive"],
    ["03 · Écran OLED", "Menu principal, en direct"],
    ["04 · Résoudre un exercice", "Photo → solution"],
    ["05 · Étiquette", "CE / RoHS, code-barres"],
  ]),
  it: localizedShots([
    ["01 · Esemplare finito", "KalkMate v3 — foto reale"],
    ["02 · Confezione", "La scatola in cui arriva"],
    ["03 · Display OLED", "Menu principale dal vivo"],
    ["04 · Risolvi l’esercizio", "Foto con la fotocamera → soluzione"],
    ["05 · Etichetta", "CE / RoHS, codice a barre"],
  ]),
};

const content: Record<
  Locale,
  {
    eyebrow: string;
    h2: { before: string; italic: string; after: string };
    galleryCount: string;
    meta: string;
  }
> = {
  pl: {
    eyebrow: "[ 05 ] · Archiwum",
    h2: { before: "Z warsztatu, ", italic: "prosto", after: "do Twojej kieszeni." },
    galleryCount: "Galeria · 05 ujęć",
    meta: "2025–2026 · KRK · PL",
  },
  en: {
    eyebrow: "[ 05 ] · Archive",
    h2: { before: "From the workshop, ", italic: "straight", after: "to your pocket." },
    galleryCount: "Gallery · 05 shots",
    meta: "2025–2026 · KRK · PL",
  },
  de: {
    eyebrow: "[ 05 ] · Archiv",
    h2: { before: "Aus der Werkstatt, ", italic: "direkt", after: "in deine Tasche." },
    galleryCount: "Galerie · 05 Aufnahmen",
    meta: "2025–2026 · KRK · PL",
  },
  cs: {
    eyebrow: "[ 05 ] · Archiv",
    h2: { before: "Z dílny ", italic: "rovnou", after: "do tvé kapsy." },
    galleryCount: "Galerie · 05 snímků",
    meta: "2025–2026 · KRK · PL",
  },
  sk: {
    eyebrow: "[ 05 ] · Archív",
    h2: { before: "Z dielne ", italic: "rovno", after: "do tvojho vrecka." },
    galleryCount: "Galéria · 05 záberov",
    meta: "2025–2026 · KRK · PL",
  },
  lt: {
    eyebrow: "[ 05 ] · Archyvas",
    h2: { before: "Iš dirbtuvių ", italic: "tiesiai", after: "į tavo kišenę." },
    galleryCount: "Galerija · 05 kadrai",
    meta: "2025–2026 · KRK · PL",
  },
  be: {
    eyebrow: "[ 05 ] · Архіў",
    h2: { before: "З майстэрні ", italic: "наўпрост", after: "у тваю кішэню." },
    galleryCount: "Галерэя · 05 кадраў",
    meta: "2025–2026 · KRK · PL",
  },
  es: {
    eyebrow: "[ 05 ] · Archivo",
    h2: { before: "Del taller, ", italic: "directo", after: "a tu bolsillo." },
    galleryCount: "Galería · 05 fotos",
    meta: "2025–2026 · KRK · PL",
  },
  pt: {
    eyebrow: "[ 05 ] · Arquivo",
    h2: { before: "Da oficina, ", italic: "direto", after: "para o teu bolso." },
    galleryCount: "Galeria · 05 imagens",
    meta: "2025–2026 · KRK · PL",
  },
  fr: {
    eyebrow: "[ 05 ] · Archives",
    h2: { before: "De l’atelier, ", italic: "directement", after: "dans ta poche." },
    galleryCount: "Galerie · 05 clichés",
    meta: "2025–2026 · KRK · PL",
  },
  it: {
    eyebrow: "[ 05 ] · Archivio",
    h2: { before: "Dal laboratorio, ", italic: "dritto", after: "nella tua tasca." },
    galleryCount: "Galleria · 05 scatti",
    meta: "2025–2026 · KRK · PL",
  },
};

export default function Gallery({ lang = "pl" }: { lang?: Locale }) {
  const t = content[lang];
  const items = shots[lang];
  return (
    <section id="galeria" className="relative py-24 lg:py-36 bg-[#0E0E0E]">
      <div className="mx-auto max-w-[1400px] px-5 lg:px-10">
        <div className="grid lg:grid-cols-12 gap-8 items-end mb-16">
          <div className="lg:col-span-8">
            <p className="km-mono-eyebrow text-[#D8FF3D]">{t.eyebrow}</p>
            <h2 className="km-display text-[clamp(40px,7vw,108px)] text-[#F2EDE3] mt-4">
              {t.h2.before}<span className="italic">{t.h2.italic}</span><br />
              {t.h2.after}
            </h2>
          </div>
          <div className="lg:col-span-4 km-mono-eyebrow text-[#F2EDE3]/55">
            <p>{t.galleryCount}</p>
            <p className="mt-2 text-[#F2EDE3]/55">{t.meta}</p>
          </div>
        </div>

        <div className="grid md:grid-cols-12 grid-cols-1 gap-3 md:gap-4">
          {items.map((s, i) => (
            <Reveal
              as="figure"
              key={s.src}
              y={24}
              amount={0.2}
              duration={0.6}
              delay={i * 0.06}
              className={`relative overflow-hidden border border-[rgba(242,237,227,0.10)] bg-[#1a1a1a] group ${s.span}`}
            >
              <Image
                src={s.src}
                alt={s.caption}
                fill
                sizes="(min-width: 1024px) 50vw, 100vw"
                className="object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0B0B0B]/85 via-transparent to-transparent" />
              <figcaption className="absolute bottom-0 left-0 right-0 p-4 lg:p-5 flex items-end justify-between gap-3">
                <div>
                  <p className="km-mono-eyebrow text-[#D8FF3D]">{s.label}</p>
                  <p className="km-display text-2xl lg:text-3xl text-[#F2EDE3] mt-1">
                    {s.caption}
                  </p>
                </div>
                <span className="km-mono-eyebrow text-[#F2EDE3]/50 hidden md:inline">
                  ↗
                </span>
              </figcaption>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
