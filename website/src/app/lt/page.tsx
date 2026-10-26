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

const lang = "lt" as const;

// Dynamiczne (nie staly obiekt) — patrz komentarz w src/app/page.tsx.
export async function generateMetadata(): Promise<Metadata> {
  const siteUrl = siteUrlFromHost((await headers()).get("host"));
  return {
    title: "DI skaičiuotuvas su kamera ruošiantis VBE | KalkMate",
    description:
      "Nufotografuok uždavinį – KalkMate parodys sprendimą žingsnis po žingsnio. Matematika, fizika, chemija, biologija. 169 EUR su 2 mln. DI žetonų, be prenumeratos.",
    keywords: [
      "DI skaičiuotuvas",
      "AI skaičiuotuvas",
      "skaičiuotuvas su kamera",
      "skaičiuotuvas su dirbtiniu intelektu",
      "uždavinių sprendimas iš nuotraukos",
      "matematikos uždavinių sprendimas",
      "uždaviniai su sprendimais",
      "pasiruošimas VBE",
      "matematikos brandos egzaminas",
      "kontrolinis darbas matematika",
      "išmanusis skaičiuotuvas",
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
      title: "DI skaičiuotuvas su kamera — KalkMate",
      description:
        "Nufotografuok matematikos, fizikos, chemijos ar biologijos uždavinį – KalkMate parodys sprendimą žingsnis po žingsnio OLED ekrane. Meniu 11 kalbų. 169 EUR su 2 mln. DI žetonų, be prenumeratos.",
      type: "website",
      locale: "lt_LT",
      alternateLocale: locales.filter((l) => l !== lang).map((l) => ogLocale[l]),
      url: `${siteUrl}/lt`,
      siteName: "KalkMate",
    },
    twitter: {
      card: "summary_large_image",
      title: "DI skaičiuotuvas su kamera — KalkMate",
      description:
        "Nuotrauka → DI → sprendimas žingsnis po žingsnio. Padeda ruoštis kontroliniams ir brandos egzaminams. 169 EUR su 2 mln. DI žetonų, be prenumeratos.",
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
