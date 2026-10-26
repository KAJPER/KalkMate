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

const lang = "es" as const;

// Dynamiczne (nie staly obiekt) — patrz komentarz w src/app/page.tsx.
export async function generateMetadata(): Promise<Metadata> {
  const siteUrl = siteUrlFromHost((await headers()).get("host"));
  return {
    title: "KalkMate — Calculadora con IA y cámara | Haz una foto, obtén la solución",
    description:
      "KalkMate es una calculadora con IA y cámara integrada para exámenes y selectividad. Haz una foto del problema y verás la solución completa paso a paso en su pantalla OLED. Matemáticas, física, química y biología, con menú en español. 169 EUR con 2 millones de tokens de IA incluidos — sin suscripción.",
    keywords: [
      "calculadora IA",
      "calculadora con IA",
      "calculadora con cámara",
      "calculadora IA con cámara",
      "calculadora inteligente",
      "calculadora para exámenes",
      "calculadora selectividad",
      "resolver problemas con IA",
      "calculadora inteligencia artificial",
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
      title: "KalkMate — Calculadora con IA y cámara",
      description:
        "Apunta la cámara a cualquier problema: la IA de KalkMate muestra la solución paso a paso en su pantalla OLED. Sin móvil, sin app, sin suscripción. 2 millones de tokens de IA incluidos.",
      type: "website",
      locale: "es_ES",
      url: `${siteUrl}/es`,
      siteName: "KalkMate",
    },
    twitter: {
      card: "summary_large_image",
      title: "KalkMate — Calculadora con IA y cámara",
      description:
        "Foto → IA → solución. La calculadora inteligente que resuelve problemas de matemáticas, física, química y biología.",
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
        <ClientBuyNow lang={lang} defaultCountry="ES" />
      </main>
      <Footer lang={lang} />
    </>
  );
}
