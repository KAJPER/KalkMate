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

const lang = "sk" as const;

// Dynamiczne (nie staly obiekt) — patrz komentarz w src/app/page.tsx.
export async function generateMetadata(): Promise<Metadata> {
  const siteUrl = siteUrlFromHost((await headers()).get("host"));
  return {
    title: "KalkMate — AI kalkulačka s kamerou | Odfoť úlohu, získaj riešenie",
    description:
      "KalkMate je AI kalkulačka s kamerou na skúšky a maturitu. Odfoť úlohu — AI ukáže kompletné riešenie krok za krokom na OLED displeji. Matematika, fyzika, chémia, biológia, menu v slovenčine. 169 EUR vrátane 2 mil. AI tokenov — bez predplatného.",
    keywords: [
      "AI kalkulačka",
      "ai kalkulačka",
      "kalkulačka s AI",
      "kalkulačka s kamerou",
      "AI kalkulačka s kamerou",
      "inteligentná kalkulačka",
      "kalkulačka na maturitu",
      "kalkulačka na skúšky",
      "AI riešenie príkladov",
      "kalkulačka umelá inteligencia",
      "KalkMate",
    ],
    authors: [{ name: "KalkMate" }],
    creator: "KalkMate",
    publisher: "KalkMate",
    formatDetection: { email: false, address: false, telephone: false },
    metadataBase: new URL(siteUrl),
    alternates: {
      canonical: `${siteUrl}/sk`,
      languages: languageAlternates(siteUrl),
    },
    openGraph: {
      title: "KalkMate — AI kalkulačka s kamerou",
      description:
        "Odfoť úlohu — KalkMate ju vyrieši pomocou AI priamo na OLED displeji. Matematika, fyzika, chémia, biológia. 169 EUR vrátane 2 mil. AI tokenov — bez predplatného.",
      type: "website",
      locale: "sk_SK",
      url: `${siteUrl}/sk`,
      siteName: "KalkMate",
    },
    twitter: {
      card: "summary_large_image",
      title: "KalkMate — AI kalkulačka s kamerou",
      description:
        "Fotka → AI → riešenie. Inteligentná kalkulačka, ktorá vyrieši úlohy z matematiky, fyziky, chémie a biológie.",
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

export default async function SlovakPage() {
  const siteUrl = siteUrlFromHost((await headers()).get("host"));
  return (
    <>
      <HtmlLang lang="sk" />
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
        <ClientBuyNow lang={lang} defaultCountry="SK" />
      </main>
      <Footer lang={lang} />
    </>
  );
}
