import type { Metadata } from "next";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "KI-Taschenrechner für Abitur & Prüfungen | KalkMate",
  description:
    "KalkMate — der intelligente AI-Taschenrechner für Prüfungen. Macht ein Foto der Aufgabe, KI analysiert sie und zeigt die Lösung auf einem OLED-Display. Mathe, Physik, Chemie, Biologie. 169 EUR.",
  keywords: [
    "KI Taschenrechner",
    "AI Taschenrechner",
    "KI Rechner Prüfung",
    "intelligenter Taschenrechner Abitur",
    "calculator ai",
    "AI Rechner Schule",
    "KI Mathe Abitur",
    "Taschenrechner mit KI",
    "AI Prüfungsrechner",
  ],
  alternates: {
    canonical: "https://kalkmate.pl/de",
    languages: {
      "de": "https://kalkmate.pl/de",
      "pl": "https://kalkmate.pl/",
      "en": "https://kalkmate.pl/en",
    },
  },
  openGraph: {
    title: "KI-Taschenrechner für Abitur & Prüfungen | KalkMate",
    description:
      "Fotografiere deine Aufgabe — KalkMate löst sie mit KI direkt auf dem OLED-Display. Mathe, Physik, Chemie, Biologie. Jetzt für 169 EUR bestellen.",
    url: "https://kalkmate.pl/de",
    siteName: "KalkMate",
    locale: "de_DE",
    type: "website",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Product",
  name: "KalkMate — KI-Taschenrechner",
  description:
    "KalkMate ist ein intelligenter AI-Taschenrechner für Schüler. Das Gerät fotografiert die Prüfungsaufgabe, sendet sie zur KI-Analyse und zeigt die vollständige Lösung auf einem 256×64 OLED-Display an. Unterstützt Mathematik, Physik, Chemie und Biologie.",
  sku: "KM-V1-EU",
  brand: {
    "@type": "Brand",
    name: "KalkMate",
  },
  offers: {
    "@type": "Offer",
    priceCurrency: "EUR",
    price: "169.00",
    priceValidUntil: "2027-12-31",
    availability: "https://schema.org/InStock",
    url: "https://kalkmate.pl/#kup-teraz",
    shippingDetails: {
      "@type": "OfferShippingDetails",
      shippingRate: {
        "@type": "MonetaryAmount",
        value: "20.00",
        currency: "EUR",
      },
      shippingDestination: {
        "@type": "DefinedRegion",
        addressCountry: "DE",
      },
    },
  },
};

const steps = [
  {
    n: "01",
    title: "Foto machen",
    desc: "Richte die OV2640-Kamera auf deine Prüfungsaufgabe und drücke die Auslösetaste. Das Gerät macht in Sekundenbruchteilen eine scharfe Aufnahme.",
  },
  {
    n: "02",
    title: "KI analysiert",
    desc: "Das Bild wird verschlüsselt an unsere KI-Server übertragen. Das Sprachmodell erkennt Gleichungen, Diagramme und Texte und berechnet die vollständige Lösung.",
  },
  {
    n: "03",
    title: "Lösung auf dem OLED-Display",
    desc: "Schritt-für-Schritt-Lösung erscheint auf dem 256×64 OLED-Display. Kein Smartphone, keine Cloud-App — alles direkt auf dem Gerät.",
  },
];

const specs = [
  { label: "Display", value: "SSD1322 OLED 256×64 px" },
  { label: "Kamera", value: "OV2640 2MP" },
  { label: "Prozessor", value: "ESP32-WROVER-E (240 MHz)" },
  { label: "Konnektivität", value: "WLAN 802.11 b/g/n" },
  { label: "Speicher", value: "8 MB PSRAM + 4 MB Flash" },
  { label: "Tastatur", value: "25-Tasten-Matrix (membran)" },
  { label: "Akku", value: "LiPo 3,7 V mit USB-C Ladung" },
  { label: "Fächer", value: "Mathematik · Physik · Chemie · Biologie" },
];

export default function GermanPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* hreflang alternate links */}
      <link rel="alternate" hrefLang="de" href="https://kalkmate.pl/de" />
      <link rel="alternate" hrefLang="pl" href="https://kalkmate.pl/" />
      <link rel="alternate" hrefLang="en" href="https://kalkmate.pl/en" />
      <link rel="alternate" hrefLang="x-default" href="https://kalkmate.pl/" />

      <Navigation />

      <main
        className="relative overflow-x-clip bg-[#0B0B0B] text-[#F2EDE3]"
        style={{ minHeight: "100vh" }}
      >
        {/* ── HERO ─────────────────────────────────────────────── */}
        <section
          id="hero"
          className="relative pt-32 pb-24 px-5 lg:px-10"
          style={{
            background:
              "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(216,255,61,0.12) 0%, transparent 70%)",
          }}
        >
          <div className="mx-auto max-w-[1400px]">
            {/* eyebrow */}
            <p className="font-mono text-[11px] tracking-[0.20em] uppercase text-[#D8FF3D] mb-6">
              KI-Taschenrechner · Abitur 2026
            </p>

            <h1 className="font-bold text-[clamp(38px,7vw,96px)] leading-[0.93] tracking-tight max-w-5xl mb-8">
              Der{" "}
              <span className="text-[#D8FF3D] italic">intelligente</span>{" "}
              KI-Taschenrechner
              <br />
              für Prüfungen & Abitur
            </h1>

            <p className="text-[clamp(16px,1.8vw,22px)] text-[#F2EDE3]/70 max-w-2xl leading-relaxed mb-10">
              KalkMate fotografiert deine Prüfungsaufgabe, analysiert sie mit
              modernster KI und zeigt dir die vollständige, schrittweise Lösung
              auf einem integrierten OLED-Display — ohne Smartphone, ohne App,
              ohne Abo.
            </p>

            <div className="flex flex-wrap gap-4 items-center">
              <a
                href="/#kup-teraz"
                className="inline-flex items-center gap-2 px-8 py-4 bg-[#D8FF3D] text-[#0B0B0B] font-bold font-mono text-[13px] tracking-widest uppercase hover:bg-[#F2EDE3] transition-colors"
              >
                Jetzt bestellen — 169 EUR
                <span aria-hidden>→</span>
              </a>
              <p className="font-mono text-[11px] text-[#F2EDE3]/40 uppercase tracking-widest">
                EU-Versand · 20 EUR · InPost kostenlos (PL)
              </p>
            </div>

            {/* stat row */}
            <div className="mt-16 grid grid-cols-2 sm:grid-cols-4 gap-px border border-[rgba(242,237,227,0.08)]">
              {[
                { n: "256×64", sub: "OLED-Display" },
                { n: "2 MP", sub: "OV2640 Kamera" },
                { n: "4 Fächer", sub: "Mathe·Phys·Chem·Bio" },
                { n: "169 EUR", sub: "Einmalpreis, kein Abo" },
              ].map((s) => (
                <div
                  key={s.n}
                  className="bg-[rgba(242,237,227,0.03)] px-6 py-5 hover:bg-[rgba(242,237,227,0.06)] transition-colors"
                >
                  <p className="font-bold text-[24px] text-[#D8FF3D] leading-none">
                    {s.n}
                  </p>
                  <p className="font-mono text-[10px] tracking-wider text-[#F2EDE3]/45 uppercase mt-1">
                    {s.sub}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── WIE ES FUNKTIONIERT ──────────────────────────────── */}
        <section
          id="wie-es-funktioniert"
          className="py-24 px-5 lg:px-10 border-t border-[rgba(242,237,227,0.08)]"
        >
          <div className="mx-auto max-w-[1400px]">
            <p className="font-mono text-[11px] tracking-[0.20em] uppercase text-[#D8FF3D] mb-4">
              Wie es funktioniert
            </p>
            <h2 className="font-bold text-[clamp(28px,4vw,56px)] mb-16 max-w-xl leading-tight">
              Drei Schritte zur Lösung
            </h2>

            <div className="grid md:grid-cols-3 gap-px bg-[rgba(242,237,227,0.08)]">
              {steps.map((step) => (
                <div
                  key={step.n}
                  className="bg-[#0B0B0B] p-8 lg:p-10 hover:bg-[rgba(242,237,227,0.03)] transition-colors group"
                >
                  <span className="font-mono text-[11px] tracking-[0.18em] text-[#D8FF3D] uppercase">
                    {step.n}
                  </span>
                  <h3 className="font-bold text-[22px] mt-4 mb-4 group-hover:text-[#D8FF3D] transition-colors">
                    {step.title}
                  </h3>
                  <p className="text-[15px] text-[#F2EDE3]/60 leading-relaxed">
                    {step.desc}
                  </p>
                </div>
              ))}
            </div>

            {/* visual connector hint */}
            <div className="hidden md:flex items-center justify-center gap-3 mt-8">
              {steps.map((s, i) => (
                <div key={s.n} className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-[#D8FF3D]" />
                  {i < steps.length - 1 && (
                    <div className="w-24 h-px bg-[rgba(216,255,61,0.25)]" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── TECHNISCHE DATEN ─────────────────────────────────── */}
        <section
          id="technische-daten"
          className="py-24 px-5 lg:px-10 border-t border-[rgba(242,237,227,0.08)]"
        >
          <div className="mx-auto max-w-[1400px]">
            <div className="grid lg:grid-cols-12 gap-12 lg:gap-20">
              <div className="lg:col-span-4">
                <p className="font-mono text-[11px] tracking-[0.20em] uppercase text-[#D8FF3D] mb-4">
                  Technische Daten
                </p>
                <h2 className="font-bold text-[clamp(26px,3.5vw,48px)] leading-tight mb-6">
                  Echte Hardware.
                  <br />
                  Echter KI-Rechner.
                </h2>
                <p className="text-[15px] text-[#F2EDE3]/60 leading-relaxed">
                  Kein Softwaretrick — KalkMate ist ein eigenständiges
                  Gerät mit dedizierter Kamera, OLED-Display und WLAN-Chip.
                  Komplett in Polen entwickelt und gefertigt.
                </p>
              </div>

              <div className="lg:col-span-8">
                <dl className="grid sm:grid-cols-2 gap-px bg-[rgba(242,237,227,0.08)]">
                  {specs.map((spec) => (
                    <div
                      key={spec.label}
                      className="bg-[#0B0B0B] px-6 py-5 flex flex-col gap-1 hover:bg-[rgba(242,237,227,0.03)] transition-colors"
                    >
                      <dt className="font-mono text-[10px] tracking-[0.16em] uppercase text-[#F2EDE3]/40">
                        {spec.label}
                      </dt>
                      <dd className="font-bold text-[16px] text-[#F2EDE3]">
                        {spec.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
          </div>
        </section>

        {/* ── PREIS ────────────────────────────────────────────── */}
        <section
          id="preis"
          className="py-24 px-5 lg:px-10 border-t border-[rgba(242,237,227,0.08)]"
          style={{
            background:
              "radial-gradient(ellipse 60% 60% at 50% 100%, rgba(216,255,61,0.07) 0%, transparent 70%)",
          }}
        >
          <div className="mx-auto max-w-[1400px]">
            <div className="max-w-2xl mx-auto text-center">
              <p className="font-mono text-[11px] tracking-[0.20em] uppercase text-[#D8FF3D] mb-4">
                Preiskarte
              </p>
              <h2 className="font-bold text-[clamp(28px,4vw,56px)] mb-6 leading-tight">
                Einmalpreis.
                <br />
                Kein Abo. Kein Abo-Zwang.
              </h2>

              <div className="border border-[rgba(242,237,227,0.12)] bg-[rgba(242,237,227,0.03)] p-10 mt-8 mb-8">
                <p className="font-mono text-[11px] tracking-widest uppercase text-[#F2EDE3]/40 mb-2">
                  KalkMate v1
                </p>
                <p className="font-bold text-[72px] leading-none text-[#D8FF3D]">
                  169
                  <span className="text-[32px] ml-1">EUR</span>
                </p>
                <p className="font-mono text-[11px] text-[#F2EDE3]/40 mt-3 uppercase tracking-wider">
                  inkl. MwSt. · Einmalzahlung
                </p>

                <div className="mt-8 border-t border-[rgba(242,237,227,0.08)] pt-6 grid sm:grid-cols-2 gap-3 text-left">
                  {[
                    "256×64 OLED-Display (SSD1322)",
                    "OV2640 2-Megapixel-Kamera",
                    "ESP32-WROVER-E WLAN-Modul",
                    "25-Tasten-Membrantastatur",
                    "LiPo-Akku mit USB-C Laden",
                    "Mathe · Physik · Chemie · Biologie",
                    "KI-Updates inklusive",
                    "In Polen entwickelt & gefertigt",
                  ].map((item) => (
                    <div key={item} className="flex items-start gap-2">
                      <span className="text-[#D8FF3D] font-bold mt-0.5 flex-shrink-0">
                        ✓
                      </span>
                      <span className="text-[14px] text-[#F2EDE3]/70">
                        {item}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
                <a
                  href="/#kup-teraz"
                  className="inline-flex items-center justify-center gap-2 px-10 py-4 bg-[#D8FF3D] text-[#0B0B0B] font-bold font-mono text-[13px] tracking-widest uppercase hover:bg-[#F2EDE3] transition-colors w-full sm:w-auto"
                >
                  Jetzt bestellen
                  <span aria-hidden>→</span>
                </a>
              </div>

              <div className="mt-6 grid sm:grid-cols-2 gap-2 text-center">
                <p className="font-mono text-[11px] text-[#F2EDE3]/40 uppercase tracking-wider">
                  EU-Versand: 20 EUR (DHL/UPS)
                </p>
                <p className="font-mono text-[11px] text-[#F2EDE3]/40 uppercase tracking-wider">
                  Polen InPost: kostenlos
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── FOOTER CTA STRIP ─────────────────────────────────── */}
        <section
          id="cta"
          className="py-16 px-5 lg:px-10 border-t border-[rgba(242,237,227,0.08)]"
        >
          <div className="mx-auto max-w-[1400px] flex flex-col md:flex-row items-center justify-between gap-8">
            <div>
              <p className="font-mono text-[11px] tracking-[0.20em] uppercase text-[#D8FF3D] mb-2">
                AI Taschenrechner für Abitur
              </p>
              <p className="font-bold text-[clamp(22px,3vw,40px)] leading-tight">
                Bereit, deine Prüfungen zu meistern?
              </p>
            </div>
            <a
              href="/#kup-teraz"
              className="flex-shrink-0 inline-flex items-center gap-2 px-8 py-4 bg-[#D8FF3D] text-[#0B0B0B] font-bold font-mono text-[13px] tracking-widest uppercase hover:bg-[#F2EDE3] transition-colors"
            >
              KalkMate kaufen — 169 EUR
              <span aria-hidden>→</span>
            </a>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
