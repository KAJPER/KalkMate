import type { Metadata } from "next";
import Navigation from "@/components/Navigation";
import Hero from "@/components/Hero";
import HowItWorks from "@/components/HowItWorks";
import Specs from "@/components/Specs";
import ExamBenefits from "@/components/ExamBenefits";
import Gallery from "@/components/Gallery";
import FAQ from "@/components/FAQ";
import BuyNow from "@/components/BuyNow";
import Footer from "@/components/Footer";
import HtmlLang from "@/components/HtmlLang";
import { homeJsonLd } from "@/lib/seo";
import { SITE_URL, languageAlternates } from "@/lib/i18n";

const lang = "de" as const;

export const metadata: Metadata = {
  title: "KalkMate — KI-Taschenrechner für Abitur & Prüfungen",
  description:
    "KalkMate ist der intelligente KI-Taschenrechner für Prüfungen. Fotografiere die Aufgabe — die KI analysiert sie und zeigt die vollständige Lösung Schritt für Schritt auf dem OLED-Display. Mathe, Physik, Chemie, Biologie. 169 EUR, kein Abo.",
  keywords: [
    "KI Taschenrechner",
    "AI Taschenrechner",
    "KI Rechner Prüfung",
    "intelligenter Taschenrechner Abitur",
    "AI Rechner Schule",
    "KI Mathe Abitur",
    "Taschenrechner mit KI",
    "AI Prüfungsrechner",
    "KalkMate",
  ],
  authors: [{ name: "KalkMate" }],
  creator: "KalkMate",
  publisher: "KalkMate",
  formatDetection: { email: false, address: false, telephone: false },
  metadataBase: new URL(SITE_URL),
  alternates: {
    canonical: `${SITE_URL}/de`,
    languages: languageAlternates(),
  },
  openGraph: {
    title: "KalkMate — KI-Taschenrechner für Abitur & Prüfungen",
    description:
      "Fotografiere deine Aufgabe — KalkMate löst sie mit KI direkt auf dem OLED-Display. Mathe, Physik, Chemie, Biologie. Jetzt für 169 EUR, kein Abo.",
    type: "website",
    locale: "de_DE",
    url: `${SITE_URL}/de`,
    siteName: "KalkMate",
    images: [
      { url: "/KalkMate.png", width: 1200, height: 630, alt: "KalkMate — KI-Taschenrechner" },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "KalkMate — KI-Taschenrechner für Abitur & Prüfungen",
    description:
      "Foto → KI → Lösung. Der intelligente Taschenrechner, der Mathe-, Physik-, Chemie- und Biologie-Aufgaben löst.",
    images: ["/KalkMate.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function GermanPage() {
  return (
    <>
      <HtmlLang lang="de" />
      {homeJsonLd(lang).map((json, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: json }}
        />
      ))}
      <Navigation lang={lang} />
      <main className="relative overflow-x-clip">
        <Hero lang={lang} />
        <HowItWorks lang={lang} />
        <ExamBenefits lang={lang} />
        <Specs lang={lang} />
        <Gallery lang={lang} />
        <FAQ lang={lang} />
        <BuyNow lang={lang} defaultCountry="DE" />
      </main>
      <Footer lang={lang} />
    </>
  );
}
