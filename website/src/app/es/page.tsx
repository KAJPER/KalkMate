import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { headers } from "next/headers";
import Navigation from "@/components/Navigation";
import Hero from "@/components/Hero";
import Footer from "@/components/Footer";
import HtmlLang from "@/components/HtmlLang";
import { homeJsonLd, ogImages } from "@/lib/seo";
import { getVerifiedAggregateRating } from "@/lib/reviews";
import { languageAlternates, locales, ogLocale, siteUrlFromHost } from "@/lib/i18n";
import { ClientBuyNow, ClientStickyBuyBar, ClientVideoScroll } from "@/components/ClientShell";

const HowItWorks   = dynamic(() => import("@/components/HowItWorks"));
const ExamBenefits = dynamic(() => import("@/components/ExamBenefits"));
const Specs        = dynamic(() => import("@/components/Specs"));
const Gallery      = dynamic(() => import("@/components/Gallery"));
const Reviews      = dynamic(() => import("@/components/Reviews"));
const FAQ          = dynamic(() => import("@/components/FAQ"));

const lang = "es" as const;

// Dynamiczne (nie staly obiekt) — patrz komentarz w src/app/page.tsx.
export async function generateMetadata(): Promise<Metadata> {
  const siteUrl = siteUrlFromHost((await headers()).get("host"));
  return {
    title: "Calculadora IA con cámara que resuelve problemas | KalkMate",
    description:
      "Haz una foto al ejercicio y KalkMate te muestra la solución paso a paso. Mates, física, química, biología. 169 EUR con 2 millones de tokens IA, sin suscripción.",
    keywords: [
      "calculadora con IA",
      "calculadora IA",
      "calculadora con cámara",
      "calculadora que resuelve problemas",
      "resolver ejercicios con foto",
      "resolver problemas de matemáticas con IA",
      "ejercicios resueltos paso a paso",
      "calculadora para selectividad",
      "preparar la EBAU",
      "preparar la PAU de matemáticas",
      "calculadora para bachillerato",
      "calculadora inteligente",
      "KalkMate",
    ],
    authors: [{ name: "KalkMate" }],
    creator: "KalkMate",
    publisher: "KalkMate",
    formatDetection: { email: false, address: false, telephone: false },
    metadataBase: new URL(siteUrl),
    alternates: {
      canonical: `${siteUrl}/es`,
      languages: languageAlternates(siteUrl),
    },
    openGraph: {
      images: ogImages,
      title: "Calculadora con IA y cámara — KalkMate",
      description:
        "Haz una foto al problema de matemáticas, física, química o biología: KalkMate muestra la solución paso a paso en su pantalla OLED. Menú en 11 idiomas. 169 EUR con 2 millones de tokens IA, sin suscripción.",
      type: "website",
      locale: "es_ES",
      alternateLocale: locales.filter((l) => l !== lang).map((l) => ogLocale[l]),
      url: `${siteUrl}/es`,
      siteName: "KalkMate",
    },
    twitter: {
      images: ogImages,
      card: "summary_large_image",
      title: "Calculadora con IA y cámara — KalkMate",
      description:
        "Foto → IA → solución paso a paso. Te ayuda a preparar exámenes y la EBAU/PAU. 169 EUR con 2 millones de tokens IA, sin suscripción.",
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

export default async function SpanishPage() {
  const siteUrl = siteUrlFromHost((await headers()).get("host"));
  return (
    <>
      <HtmlLang lang="es" />
      {homeJsonLd(lang, siteUrl, await getVerifiedAggregateRating().catch(() => null)).map((json, i) => (
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
        <ClientBuyNow lang={lang} defaultCountry="ES" />
        <ClientStickyBuyBar lang={lang} />
      </main>
      <Footer lang={lang} />
    </>
  );
}
