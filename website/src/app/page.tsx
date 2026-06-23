import Navigation from "@/components/Navigation";
import Hero from "@/components/Hero";
import HowItWorks from "@/components/HowItWorks";
import Specs from "@/components/Specs";
import ExamBenefits from "@/components/ExamBenefits";
import Gallery from "@/components/Gallery";
import FAQ from "@/components/FAQ";
import BuyNow from "@/components/BuyNow";
import Footer from "@/components/Footer";
import VisitTracker from "@/components/VisitTracker";
import { homeJsonLd } from "@/lib/seo";
import type { Metadata } from "next";
import { SITE_URL, languageAlternates } from "@/lib/i18n";

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
