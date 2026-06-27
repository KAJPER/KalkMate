import type { Metadata } from "next";
import dynamic from "next/dynamic";
import Navigation from "@/components/Navigation";
import Hero from "@/components/Hero";
import Footer from "@/components/Footer";

const VideoScroll  = dynamic(() => import("@/components/VideoScroll"), { ssr: false });
const HowItWorks   = dynamic(() => import("@/components/HowItWorks"));
const ExamBenefits = dynamic(() => import("@/components/ExamBenefits"));
const Specs        = dynamic(() => import("@/components/Specs"));
const Gallery      = dynamic(() => import("@/components/Gallery"));
const Reviews      = dynamic(() => import("@/components/Reviews"));
const FAQ          = dynamic(() => import("@/components/FAQ"));
const BuyNow       = dynamic(() => import("@/components/BuyNow"));
import HtmlLang from "@/components/HtmlLang";
import { homeJsonLd } from "@/lib/seo";
import { SITE_URL, languageAlternates } from "@/lib/i18n";

const lang = "en" as const;

export const metadata: Metadata = {
  title: "KalkMate — AI Calculator | Smart Photo Calculator",
  description:
    "KalkMate is the AI calculator that solves math, physics, chemistry and biology problems. Point the built-in camera at a problem — get the full step-by-step solution on its OLED screen. 169 EUR, then from 4 EUR/month.",
  keywords: [
    "AI calculator",
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
  metadataBase: new URL(SITE_URL),
  alternates: {
    canonical: `${SITE_URL}/en`,
    languages: languageAlternates(),
  },
  openGraph: {
    title: "KalkMate — AI Calculator",
    description:
      "Point the camera at any problem. KalkMate's built-in AI delivers a step-by-step solution on its OLED screen — no phone, no app, subscription from 4 EUR/month.",
    type: "website",
    locale: "en_US",
    url: `${SITE_URL}/en`,
    siteName: "KalkMate",
    images: [
      { url: "/KalkMate.png", width: 1200, height: 630, alt: "KalkMate — AI Calculator" },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "KalkMate — AI Calculator",
    description:
      "Photo → AI → Solution. The smart calculator that solves math, physics, chemistry and biology problems.",
    images: ["/KalkMate.png"],
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

export default function EnglishPage() {
  return (
    <>
      <HtmlLang lang="en" />
      {homeJsonLd(lang).map((json, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: json }}
        />
      ))}
      <Navigation lang={lang} />
      <main className="relative overflow-x-clip">
        <Hero lang={lang} />
        <VideoScroll lang={lang} />
        <HowItWorks lang={lang} />
        <ExamBenefits lang={lang} />
        <Specs lang={lang} />
        <Gallery lang={lang} />
        <Reviews lang={lang} />
        <FAQ lang={lang} />
        <BuyNow lang={lang} />
      </main>
      <Footer lang={lang} />
    </>
  );
}
