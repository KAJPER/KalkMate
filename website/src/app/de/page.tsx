import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { headers } from "next/headers";
import Navigation from "@/components/Navigation";
import Hero from "@/components/Hero";
import Footer from "@/components/Footer";
import HtmlLang from "@/components/HtmlLang";
import { homeJsonLd } from "@/lib/seo";
import { languageAlternates, siteUrlFromHost } from "@/lib/i18n";
import { ClientBuyNow, ClientVideoScroll } from "@/components/ClientShell";

const HowItWorks   = dynamic(() => import("@/components/HowItWorks"));
const ExamBenefits = dynamic(() => import("@/components/ExamBenefits"));
const Specs        = dynamic(() => import("@/components/Specs"));
const Gallery      = dynamic(() => import("@/components/Gallery"));
const Reviews      = dynamic(() => import("@/components/Reviews"));
const FAQ          = dynamic(() => import("@/components/FAQ"));

const lang = "de" as const;

// Dynamiczne (nie staly obiekt) — patrz komentarz w src/app/page.tsx.
export async function generateMetadata(): Promise<Metadata> {
  const siteUrl = siteUrlFromHost((await headers()).get("host"));
  return {
    title: "KalkMate — KI-Taschenrechner | Foto-Rechner mit KI",
    description:
      "KalkMate ist der KI Taschenrechner mit Kamera für Prüfungen. Fotografiere die Aufgabe — die KI zeigt die vollständige Lösung Schritt für Schritt auf dem OLED-Display. Mathe, Physik, Chemie, Biologie. 169 EUR, danach ab 4 EUR/Monat.",
    keywords: [
      "KI Taschenrechner",
      "ki taschenrechner",
      "ki taschenrechner mit kamera",
      "AI Taschenrechner",
      "KI Taschenrechner mit Kamera",
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
    metadataBase: new URL(siteUrl),
    alternates: {
      canonical: `${siteUrl}/de`,
      languages: languageAlternates(siteUrl),
    },
    openGraph: {
      title: "KalkMate — KI-Taschenrechner",
      description:
        "KI Taschenrechner mit Kamera: Fotografiere deine Aufgabe — KalkMate löst sie mit KI direkt auf dem OLED-Display. Mathe, Physik, Chemie, Biologie. 169 EUR, danach ab 4 EUR/Monat.",
      type: "website",
      locale: "de_DE",
      url: `${siteUrl}/de`,
      siteName: "KalkMate",
    },
    twitter: {
      card: "summary_large_image",
      title: "KalkMate — KI-Taschenrechner",
      description:
        "Foto → KI → Lösung. Der intelligente Taschenrechner, der Mathe-, Physik-, Chemie- und Biologie-Aufgaben löst.",
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
}

export default async function GermanPage() {
  const siteUrl = siteUrlFromHost((await headers()).get("host"));
  return (
    <>
      <HtmlLang lang="de" />
      {homeJsonLd(lang, siteUrl).map((json, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: json }}
        />
      ))}
      <Navigation lang={lang} />
      <main className="relative overflow-x-clip">
        <Hero lang={lang} />
        <ClientVideoScroll lang={lang} />
        <HowItWorks lang={lang} />
        <ExamBenefits lang={lang} />
        <Specs lang={lang} />
        <Gallery lang={lang} />
        <Reviews lang={lang} />
        <FAQ lang={lang} />
        <ClientBuyNow lang={lang} defaultCountry="DE" />
      </main>
      <Footer lang={lang} />
    </>
  );
}
