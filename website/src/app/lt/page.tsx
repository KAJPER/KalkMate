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

const lang = "lt" as const;

// Dynamiczne (nie staly obiekt) — patrz komentarz w src/app/page.tsx.
export async function generateMetadata(): Promise<Metadata> {
  const siteUrl = siteUrlFromHost((await headers()).get("host"));
  return {
    title: "KalkMate — DI skaičiuotuvas su kamera | Nufotografuok užduotį, gauk sprendimą",
    description:
      "KalkMate — skaičiuotuvas su kamera ir dirbtiniu intelektu kontroliniams ir brandos egzaminams. Nufotografuok užduotį — DI parodys visą sprendimą žingsnis po žingsnio OLED ekrane. Matematika, fizika, chemija, biologija, meniu lietuvių kalba. 169 EUR su 2 mln. DI žetonų — be prenumeratos.",
    keywords: [
      "DI skaičiuotuvas",
      "AI skaičiuotuvas",
      "skaičiuotuvas su kamera",
      "skaičiuotuvas su dirbtiniu intelektu",
      "išmanusis skaičiuotuvas",
      "skaičiuotuvas egzaminui",
      "skaičiuotuvas brandos egzaminui",
      "uždavinių sprendimas su DI",
      "KalkMate",
    ],
    authors: [{ name: "KalkMate" }],
    creator: "KalkMate",
    publisher: "KalkMate",
    formatDetection: { email: false, address: false, telephone: false },
    metadataBase: new URL(siteUrl),
    alternates: {
      canonical: `${siteUrl}/lt`,
      languages: languageAlternates(siteUrl),
    },
    openGraph: {
      title: "KalkMate — DI skaičiuotuvas su kamera",
      description:
        "Nufotografuok užduotį — KalkMate ją išspręs su DI tiesiai OLED ekrane. Matematika, fizika, chemija, biologija. 169 EUR su 2 mln. DI žetonų — be prenumeratos.",
      type: "website",
      locale: "lt_LT",
      url: `${siteUrl}/lt`,
      siteName: "KalkMate",
    },
    twitter: {
      card: "summary_large_image",
      title: "KalkMate — DI skaičiuotuvas su kamera",
      description:
        "Nuotrauka → DI → sprendimas. Išmanusis skaičiuotuvas, sprendžiantis matematikos, fizikos, chemijos ir biologijos užduotis.",
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

export default async function LithuanianPage() {
  const siteUrl = siteUrlFromHost((await headers()).get("host"));
  return (
    <>
      <HtmlLang lang="lt" />
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
        <ClientBuyNow lang={lang} defaultCountry="LT" />
      </main>
      <Footer lang={lang} />
    </>
  );
}
