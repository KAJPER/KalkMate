import dynamic from "next/dynamic";
import Navigation from "@/components/Navigation";
import Hero from "@/components/Hero";
import Footer from "@/components/Footer";
import { homeJsonLd } from "@/lib/seo";
import type { Metadata } from "next";
import { SITE_URL, languageAlternates } from "@/lib/i18n";

const VisitTracker  = dynamic(() => import("@/components/VisitTracker"),  { ssr: false });
const HowItWorks   = dynamic(() => import("@/components/HowItWorks"));
const ExamBenefits = dynamic(() => import("@/components/ExamBenefits"));
const Specs        = dynamic(() => import("@/components/Specs"));
const Gallery      = dynamic(() => import("@/components/Gallery"));
const FAQ          = dynamic(() => import("@/components/FAQ"));
const BuyNow       = dynamic(() => import("@/components/BuyNow"));

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
        <HowItWorks lang={lang} />
        <ExamBenefits lang={lang} />
        <Specs lang={lang} />
        <Gallery lang={lang} />
        <FAQ lang={lang} />
        <BuyNow lang={lang} />
      </main>
      <Footer lang={lang} />
    </>
  );
}
