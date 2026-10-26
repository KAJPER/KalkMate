import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { headers } from "next/headers";
import Navigation from "@/components/Navigation";
import Hero from "@/components/Hero";
import Footer from "@/components/Footer";
import HtmlLang from "@/components/HtmlLang";
import { homeJsonLd } from "@/lib/seo";
import { languageAlternates, locales, ogLocale, siteUrlFromHost } from "@/lib/i18n";
import { ClientBuyNow, ClientVideoScroll } from "@/components/ClientShell";

const HowItWorks   = dynamic(() => import("@/components/HowItWorks"));
const ExamBenefits = dynamic(() => import("@/components/ExamBenefits"));
const Specs        = dynamic(() => import("@/components/Specs"));
const Gallery      = dynamic(() => import("@/components/Gallery"));
const Reviews      = dynamic(() => import("@/components/Reviews"));
const FAQ          = dynamic(() => import("@/components/FAQ"));

const lang = "fr" as const;

// Dynamiczne (nie staly obiekt) — patrz komentarz w src/app/page.tsx.
export async function generateMetadata(): Promise<Metadata> {
  const siteUrl = siteUrlFromHost((await headers()).get("host"));
  return {
    title: "Calculatrice IA avec caméra qui résout tes exos | KalkMate",
    description:
      "Prends ton exercice en photo : KalkMate affiche la solution étape par étape. Maths, physique-chimie, SVT. 169 EUR avec 2 millions de tokens IA, sans abonnement.",
    keywords: [
      "calculatrice IA",
      "calculatrice avec IA",
      "calculatrice avec caméra",
      "calculatrice IA avec caméra",
      "calculatrice qui résout les exercices",
      "résoudre un exercice de maths avec une photo",
      "résoudre des exercices avec l’IA",
      "exercices corrigés étape par étape",
      "réviser le bac de maths",
      "réviser le brevet",
      "préparer un contrôle de maths",
      "aide aux devoirs maths",
      "calculatrice intelligente",
      "KalkMate",
    ],
    authors: [{ name: "KalkMate" }],
    creator: "KalkMate",
    publisher: "KalkMate",
    formatDetection: { email: false, address: false, telephone: false },
    metadataBase: new URL(siteUrl),
    alternates: {
      canonical: `${siteUrl}/fr`,
      languages: languageAlternates(siteUrl),
    },
    openGraph: {
      title: "Calculatrice IA avec caméra — KalkMate",
      description:
        "Prends en photo un exercice de maths, physique-chimie ou SVT : KalkMate affiche la solution étape par étape sur son écran OLED. Menu en 11 langues. 169 EUR avec 2 millions de tokens IA, sans abonnement.",
      type: "website",
      locale: "fr_FR",
      alternateLocale: locales.filter((l) => l !== lang).map((l) => ogLocale[l]),
      url: `${siteUrl}/fr`,
      siteName: "KalkMate",
    },
    twitter: {
      card: "summary_large_image",
      title: "Calculatrice IA avec caméra — KalkMate",
      description:
        "Photo → IA → solution étape par étape. Pour réviser contrôles, brevet et bac. 169 EUR avec 2 millions de tokens IA, sans abonnement.",
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

export default async function FrenchPage() {
  const siteUrl = siteUrlFromHost((await headers()).get("host"));
  return (
    <>
      <HtmlLang lang="fr" />
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
        <ClientBuyNow lang={lang} defaultCountry="FR" />
      </main>
      <Footer lang={lang} />
    </>
  );
}
