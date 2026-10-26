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

const lang = "sk" as const;

// Dynamiczne (nie staly obiekt) — patrz komentarz w src/app/page.tsx.
export async function generateMetadata(): Promise<Metadata> {
  const siteUrl = siteUrlFromHost((await headers()).get("host"));
  return {
    title: "AI kalkulačka s kamerou na maturitu a písomky | KalkMate",
    description:
      "Odfoť príklad a KalkMate ti ukáže riešenie krok za krokom. Matematika, fyzika, chémia, biológia. 169 EUR vrátane 2 mil. AI tokenov, bez predplatného.",
    keywords: [
      "AI kalkulačka",
      "kalkulačka s kamerou",
      "AI kalkulačka s kamerou",
      "kalkulačka s umelou inteligenciou",
      "kalkulačka na maturitu",
      "príprava na maturitu z matematiky",
      "príklady na písomku z matematiky",
      "riešenie príkladov z fotky",
      "riešenie príkladov krok za krokom",
      "AI riešenie úloh z fyziky a chémie",
      "inteligentná kalkulačka",
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
      images: ogImages,
      title: "AI kalkulačka s kamerou — KalkMate",
      description:
        "Odfoť úlohu z matematiky, fyziky, chémie či biológie — KalkMate ukáže riešenie krok za krokom na OLED displeji. Menu v 11 jazykoch. 169 EUR vrátane 2 mil. AI tokenov, bez predplatného.",
      type: "website",
      locale: "sk_SK",
      alternateLocale: locales.filter((l) => l !== lang).map((l) => ogLocale[l]),
      url: `${siteUrl}/sk`,
      siteName: "KalkMate",
    },
    twitter: {
      images: ogImages,
      card: "summary_large_image",
      title: "AI kalkulačka s kamerou — KalkMate",
      description:
        "Fotka → AI → riešenie krok za krokom. Pomôže s prípravou na písomky aj maturitu. 169 EUR vrátane 2 mil. AI tokenov, bez predplatného.",
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
