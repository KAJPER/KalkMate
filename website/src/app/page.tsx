import dynamic from "next/dynamic";
import { headers } from "next/headers";
import Navigation from "@/components/Navigation";
import Hero from "@/components/Hero";
import Footer from "@/components/Footer";
import VisitTracker from "@/components/VisitTracker";
import { homeJsonLd } from "@/lib/seo";
import type { Metadata } from "next";
import { languageAlternates, siteUrlFromHost } from "@/lib/i18n";
import { ClientBuyNow, ClientVideoScroll } from "@/components/ClientShell";

const HowItWorks   = dynamic(() => import("@/components/HowItWorks"));
const ExamBenefits = dynamic(() => import("@/components/ExamBenefits"));
const Specs        = dynamic(() => import("@/components/Specs"));
const Gallery      = dynamic(() => import("@/components/Gallery"));
const Reviews      = dynamic(() => import("@/components/Reviews"));
const FAQ          = dynamic(() => import("@/components/FAQ"));

const lang = "pl" as const;

// Canonical + hreflang dla polskiej strony głównej (przeniesione z root layout,
// żeby nie wyciekały na podstrony). Dynamiczne (nie staly obiekt) — kalkmate.eu
// serwuje ten sam kod, ale ma miec WLASNY canonical (siteUrlFromHost), inaczej
// Google widzialby na .eu wszedzie canonical do kalkmate.pl i nigdy by go nie
// zaindeksowal osobno. To celowo jedyne strony w tej witrynie, ktore przez to
// tracaj prerenderowanie statyczne — pozostale (panel, koszyk, auth...) nie sa
// tu ruszane.
export async function generateMetadata(): Promise<Metadata> {
  const siteUrl = siteUrlFromHost((await headers()).get("host"));
  return {
    alternates: {
      canonical: `${siteUrl}/`,
      languages: languageAlternates(siteUrl),
    },
  };
}

export default async function Home() {
  const siteUrl = siteUrlFromHost((await headers()).get("host"));
  return (
    <>
      {homeJsonLd(lang, siteUrl).map((json, i) => (
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
