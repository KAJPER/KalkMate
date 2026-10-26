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

const lang = "it" as const;

// Dynamiczne (nie staly obiekt) — patrz komentarz w src/app/page.tsx.
export async function generateMetadata(): Promise<Metadata> {
  const siteUrl = siteUrlFromHost((await headers()).get("host"));
  return {
    title: "KalkMate — Calcolatrice con IA e fotocamera | Scatta una foto, ottieni la soluzione",
    description:
      "KalkMate è una calcolatrice con IA e fotocamera integrata per verifiche e maturità. Scatta una foto all’esercizio e vedrai la soluzione completa passo dopo passo sul display OLED. Matematica, fisica, chimica e biologia, con menu in italiano. 169 EUR con 2 milioni di token IA inclusi — senza abbonamento.",
    keywords: [
      "calcolatrice IA",
      "calcolatrice con IA",
      "calcolatrice con fotocamera",
      "calcolatrice IA con fotocamera",
      "calcolatrice intelligente",
      "calcolatrice per la maturità",
      "calcolatrice per esami",
      "risolvere esercizi con IA",
      "calcolatrice intelligenza artificiale",
      "KalkMate",
    ],
    authors: [{ name: "KalkMate" }],
    creator: "KalkMate",
    publisher: "KalkMate",
    formatDetection: { email: false, address: false, telephone: false },
    metadataBase: new URL(siteUrl),
    alternates: {
      canonical: `${siteUrl}/it`,
      languages: languageAlternates(siteUrl),
    },
    openGraph: {
      title: "KalkMate — Calcolatrice con IA e fotocamera",
      description:
        "Inquadra qualsiasi esercizio — l’IA di KalkMate mostra la soluzione passo dopo passo sul display OLED. Niente telefono, niente app, nessun abbonamento. 2 milioni di token IA inclusi.",
      type: "website",
      locale: "it_IT",
      url: `${siteUrl}/it`,
      siteName: "KalkMate",
    },
    twitter: {
      card: "summary_large_image",
      title: "KalkMate — Calcolatrice con IA e fotocamera",
      description:
        "Foto → IA → soluzione. La calcolatrice intelligente che risolve esercizi di matematica, fisica, chimica e biologia.",
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

export default async function ItalianPage() {
  const siteUrl = siteUrlFromHost((await headers()).get("host"));
  return (
    <>
      <HtmlLang lang="it" />
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
        <ClientBuyNow lang={lang} defaultCountry="IT" />
      </main>
      <Footer lang={lang} />
    </>
  );
}
