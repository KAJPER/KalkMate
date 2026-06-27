import type { Metadata } from "next";
import dynamic from "next/dynamic";
import Navigation from "@/components/Navigation";
import Hero from "@/components/Hero";
import Footer from "@/components/Footer";

const VideoScroll  = dynamic(() => import("@/components/VideoScroll"));
const HowItWorks   = dynamic(() => import("@/components/HowItWorks"));
const ExamBenefits = dynamic(() => import("@/components/ExamBenefits"));
const Specs        = dynamic(() => import("@/components/Specs"));
const Gallery      = dynamic(() => import("@/components/Gallery"));
const Reviews      = dynamic(() => import("@/components/Reviews"));
const FAQ          = dynamic(() => import("@/components/FAQ"));
const BuyNow       = dynamic(() => import("@/components/BuyNow"));
import HtmlLang from "@/components/HtmlLang";
import { homeJsonLd } from "@/lib/seo";
import { SITE_URL, languageAlternates } from "@/lib/i18n";

const lang = "de" as const;

export const metadata: Metadata = {
  title: "KalkMate — KI-Taschenrechner | Foto-Rechner mit KI",
  description:
    "KalkMate ist der intelligente KI-Taschenrechner für Prüfungen. Fotografiere die Aufgabe — die KI analysiert sie und zeigt die vollständige Lösung Schritt für Schritt auf dem OLED-Display. Mathe, Physik, Chemie, Biologie. 169 EUR, kein Abo.",
  keywords: [
    "KI Taschenrechner",
    "AI Taschenrechner",
    "KI Rechner Prüfung",
    "intelligenter Taschenrechner",
    "AI Rechner Schule",
    "KI Mathe Aufgaben",
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
    title: "KalkMate — KI-Taschenrechner",
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
    title: "KalkMate — KI-Taschenrechner",
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
        <VideoScroll lang={lang} />
        <HowItWorks lang={lang} />
        <ExamBenefits lang={lang} />
        <Specs lang={lang} />
        <Gallery lang={lang} />
        <Reviews lang={lang} />
        <FAQ lang={lang} />
        <BuyNow lang={lang} defaultCountry="DE" />
      </main>
      <Footer lang={lang} />
    </>
  );
}
