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

const lang = "fr" as const;

// Dynamiczne (nie staly obiekt) — patrz komentarz w src/app/page.tsx.
export async function generateMetadata(): Promise<Metadata> {
  const siteUrl = siteUrlFromHost((await headers()).get("host"));
  return {
    title: "KalkMate — Calculatrice IA avec caméra | Prends une photo, obtiens la solution",
    description:
      "KalkMate est une calculatrice IA avec caméra intégrée pour les contrôles et le bac. Prends l’exercice en photo — l’IA affiche la solution complète, étape par étape, sur l’écran OLED. Maths, physique, chimie, biologie, menu en français. 169 EUR avec 2 millions de tokens IA inclus — sans abonnement.",
    keywords: [
      "calculatrice IA",
      "calculatrice avec IA",
      "calculatrice avec caméra",
      "calculatrice IA avec caméra",
      "calculatrice intelligente",
      "calculatrice pour le bac",
      "calculatrice examen",
      "résoudre des exercices avec l’IA",
      "calculatrice intelligence artificielle",
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
      title: "KalkMate — Calculatrice IA avec caméra",
      description:
        "Vise n’importe quel exercice — l’IA de KalkMate affiche la solution étape par étape sur son écran OLED. Sans téléphone, sans appli, sans abonnement. 2 millions de tokens IA inclus.",
      type: "website",
      locale: "fr_FR",
      url: `${siteUrl}/fr`,
      siteName: "KalkMate",
    },
    twitter: {
      card: "summary_large_image",
      title: "KalkMate — Calculatrice IA avec caméra",
      description:
        "Photo → IA → solution. La calculatrice intelligente qui résout les exercices de maths, physique, chimie et biologie.",
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
