import dynamic from "next/dynamic";
import Navigation from "@/components/Navigation";
import Hero from "@/components/Hero";
import Footer from "@/components/Footer";
import VisitTracker from "@/components/VisitTracker";
import { homeJsonLd } from "@/lib/seo";
import type { Metadata } from "next";
import { SITE_URL, languageAlternates } from "@/lib/i18n";
import { ClientBuyNow, ClientVideoScroll } from "@/components/ClientShell";

const HowItWorks   = dynamic(() => import("@/components/HowItWorks"));
const ExamBenefits = dynamic(() => import("@/components/ExamBenefits"));
const Specs        = dynamic(() => import("@/components/Specs"));
const Gallery      = dynamic(() => import("@/components/Gallery"));
const Reviews      = dynamic(() => import("@/components/Reviews"));
const FAQ          = dynamic(() => import("@/components/FAQ"));

const lang = "pl" as const;

// Canonical + hreflang dla polskiej strony głównej (przeniesione z root layout,
// żeby nie wyciekały na podstrony).
export const metadata: Metadata = {
  alternates: {
    canonical: `${SITE_URL}/`,
    languages: languageAlternates(),
  },
};

export default function Home() {
  return (
    <>
      {homeJsonLd(lang).map((json, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: json }}
        />
      ))}
      <VisitTracker />
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
