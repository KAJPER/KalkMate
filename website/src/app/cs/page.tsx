import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { headers } from "next/headers";
import Navigation from "@/components/Navigation";
import Hero from "@/components/Hero";
import Footer from "@/components/Footer";
import HtmlLang from "@/components/HtmlLang";
import { homeJsonLd, ogImages } from "@/lib/seo";
import { getVerifiedAggregateRating } from "@/lib/reviews";
import { languageAlternates, locales, ogLocale, siteUrlFromHost } from "@/lib/i18n";
import { ClientBuyNow, ClientStickyBuyBar, ClientVideoScroll } from "@/components/ClientShell";

const HowItWorks   = dynamic(() => import("@/components/HowItWorks"));
const ExamBenefits = dynamic(() => import("@/components/ExamBenefits"));
const Specs        = dynamic(() => import("@/components/Specs"));
const Gallery      = dynamic(() => import("@/components/Gallery"));
const Reviews      = dynamic(() => import("@/components/Reviews"));
const FAQ          = dynamic(() => import("@/components/FAQ"));

const lang = "cs" as const;

// Dynamiczne (nie staly obiekt) — patrz komentarz w src/app/page.tsx.
export async function generateMetadata(): Promise<Metadata> {
  const siteUrl = siteUrlFromHost((await headers()).get("host"));
  return {
    title: "KalkMate — AI kalkulačka s kamerou | Vyfoť úlohu, získej řešení",
    description:
      "KalkMate je AI kalkulačka s kamerou na zkoušky a maturitu. Vyfoť úlohu — AI ukáže kompletní řešení krok za krokem na OLED displeji. Matematika, fyzika, chemie, biologie. 169 EUR včetně 2 mil. AI tokenů — bez předplatného.",
    keywords: [
      "AI kalkulačka",
      "ai kalkulačka",
      "kalkulačka s AI",
      "kalkulačka s kamerou",
      "AI kalkulačka s kamerou",
      "chytrá kalkulačka",
      "kalkulačka na maturitu",
      "kalkulačka na zkoušky",
      "AI řešení příkladů",
      "kalkulačka umělá inteligence",
      "foto kalkulačka",
      "KalkMate",
    ],
    authors: [{ name: "KalkMate" }],
    creator: "KalkMate",
    publisher: "KalkMate",
    formatDetection: { email: false, address: false, telephone: false },
    metadataBase: new URL(siteUrl),
    alternates: {
      canonical: `${siteUrl}/cs`,
      languages: languageAlternates(siteUrl),
    },
    openGraph: {
      images: ogImages,
      title: "KalkMate — AI kalkulačka s kamerou",
      description:
        "Vyfoť úlohu — KalkMate ji vyřeší pomocí AI přímo na OLED displeji. Matematika, fyzika, chemie, biologie. 169 EUR včetně 2 mil. AI tokenů — bez předplatného.",
      type: "website",
      locale: "cs_CZ",
      alternateLocale: locales.filter((l) => l !== lang).map((l) => ogLocale[l]),
      url: `${siteUrl}/cs`,
      siteName: "KalkMate",
    },
    twitter: {
      images: ogImages,
      card: "summary_large_image",
      title: "KalkMate — AI kalkulačka s kamerou",
      description:
        "Foto → AI → řešení. Chytrá kalkulačka, která vyřeší úlohy z matematiky, fyziky, chemie a biologie.",
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

export default async function CzechPage() {
  const siteUrl = siteUrlFromHost((await headers()).get("host"));
  return (
    <>
      <HtmlLang lang="cs" />
      {homeJsonLd(lang, siteUrl, await getVerifiedAggregateRating().catch(() => null)).map((json, i) => (
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
        <ClientBuyNow lang={lang} defaultCountry="CZ" />
        <ClientStickyBuyBar lang={lang} />
      </main>
      <Footer lang={lang} />
    </>
  );
}
