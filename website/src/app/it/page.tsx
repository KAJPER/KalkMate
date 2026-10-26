import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { headers } from "next/headers";
import Navigation from "@/components/Navigation";
import Hero from "@/components/Hero";
import Footer from "@/components/Footer";
import HtmlLang from "@/components/HtmlLang";
import { homeJsonLd, ogImages } from "@/lib/seo";
import { languageAlternates, locales, ogLocale, siteUrlFromHost } from "@/lib/i18n";
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
    title: "Calcolatrice IA con fotocamera per la scuola | KalkMate",
    description:
      "Fotografa l’esercizio e KalkMate ti mostra la soluzione passo passo. Matematica, fisica, chimica, biologia. 169 EUR con 2 milioni di token IA, senza abbonamento.",
    keywords: [
      "calcolatrice IA",
      "calcolatrice con IA",
      "calcolatrice con fotocamera",
      "calcolatrice che risolve esercizi",
      "risolvere esercizi con una foto",
      "risolvere esercizi di matematica con IA",
      "esercizi svolti passo passo",
      "preparazione maturità matematica",
      "seconda prova maturità",
      "verifica di matematica",
      "compito in classe di matematica",
      "calcolatrice intelligente",
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
      images: ogImages,
      title: "Calcolatrice IA con fotocamera — KalkMate",
      description:
        "Fotografa un esercizio di matematica, fisica, chimica o biologia: KalkMate mostra la soluzione passo passo sul display OLED. Menu in 11 lingue. 169 EUR con 2 milioni di token IA, senza abbonamento.",
      type: "website",
      locale: "it_IT",
      alternateLocale: locales.filter((l) => l !== lang).map((l) => ogLocale[l]),
      url: `${siteUrl}/it`,
      siteName: "KalkMate",
    },
    twitter: {
      images: ogImages,
      card: "summary_large_image",
      title: "Calcolatrice IA con fotocamera — KalkMate",
      description:
        "Foto → IA → soluzione passo passo. Ti aiuta a prepararti a verifiche, compiti in classe e maturità. 169 EUR con 2 milioni di token IA, senza abbonamento.",
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
