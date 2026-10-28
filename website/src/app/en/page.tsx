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

const lang = "en" as const;

// Dynamiczne (nie staly obiekt) — patrz komentarz w src/app/page.tsx.
export async function generateMetadata(): Promise<Metadata> {
  const siteUrl = siteUrlFromHost((await headers()).get("host"));
  return {
    // GSC 2026-10: "calculator with camera" 1.5k wyswietlen, poz. 4.9, CTR 8% —
    // fraza na poczatku tytulu, marka na koncu.
    title: "AI Calculator with Camera — Step-by-Step Solutions | KalkMate",
    description:
      "Calculator with camera and AI built in: snap any math, physics, chemistry or biology problem and get the full step-by-step solution on its OLED screen. 169 EUR with 2M AI tokens included — no subscription.",
    keywords: [
      "AI calculator",
      "AI calculator with camera",
      "calculator with camera",
      "photo calculator AI",
      "calculator with AI",
      "AI math solver",
      "camera calculator",
      "calculator that solves problems",
      "KalkMate",
    ],
    authors: [{ name: "KalkMate" }],
    creator: "KalkMate",
    publisher: "KalkMate",
    formatDetection: { email: false, address: false, telephone: false },
    metadataBase: new URL(siteUrl),
    alternates: {
      canonical: `${siteUrl}/en`,
      languages: languageAlternates(siteUrl),
    },
    openGraph: {
      images: ogImages,
      title: "KalkMate — AI Calculator with Camera",
      description:
        "Point the camera at any problem. KalkMate's built-in AI delivers a step-by-step solution on its OLED screen — no phone, no app, no subscription. 2M AI tokens included.",
      type: "website",
      locale: "en_US",
      alternateLocale: locales.filter((l) => l !== lang).map((l) => ogLocale[l]),
      url: `${siteUrl}/en`,
      siteName: "KalkMate",
    },
    twitter: {
      images: ogImages,
      card: "summary_large_image",
      title: "KalkMate — AI Calculator with Camera",
      description:
        "Photo → AI → Solution. The AI calculator with camera that solves math, physics, chemistry and biology problems.",
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

export default async function EnglishPage() {
  const siteUrl = siteUrlFromHost((await headers()).get("host"));
  return (
    <>
      <HtmlLang lang="en" />
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
        <ClientBuyNow lang={lang} />
      </main>
      <Footer lang={lang} />
    </>
  );
}
