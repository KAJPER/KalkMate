import dynamic from "next/dynamic";
import { headers } from "next/headers";
import Navigation from "@/components/Navigation";
import Hero from "@/components/Hero";
import Footer from "@/components/Footer";
import { homeJsonLd, ogImages } from "@/lib/seo";
import type { Metadata } from "next";
import { languageAlternates, locales, ogLocale, siteUrlFromHost } from "@/lib/i18n";
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
    // openGraph w Next.js NIE jest mergowany z layoutem (podany tu obiekt zastepuje
    // caly openGraph z src/app/layout.tsx), wiec powtarzamy tresc z layoutu + url
    // per-host i alternateLocale. Obrazek OG idzie z pliku opengraph-image (nie ustawiac images).
    openGraph: {
      images: ogImages,
      title: "KalkMate — Kalkulator AI",
      description:
        "Kalkulator z wbudowaną sztuczną inteligencją. Zrób zdjęcie zadania — AI rozwiąże je za Ciebie.",
      type: "website",
      locale: "pl_PL",
      alternateLocale: locales.filter((l) => l !== lang).map((l) => ogLocale[l]),
      url: `${siteUrl}/`,
      siteName: "KalkMate",
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
