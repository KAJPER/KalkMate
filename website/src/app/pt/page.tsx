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

const lang = "pt" as const;

// Dynamiczne (nie staly obiekt) — patrz komentarz w src/app/page.tsx.
export async function generateMetadata(): Promise<Metadata> {
  const siteUrl = siteUrlFromHost((await headers()).get("host"));
  return {
    title: "KalkMate — Calculadora com IA e câmara | Tira uma foto, recebe a resolução",
    description:
      "O KalkMate é uma calculadora com IA e câmara integrada para testes e exames nacionais. Tira uma foto ao exercício e vês a resolução completa passo a passo no ecrã OLED. Matemática, física, química e biologia, com menu em português. 169 EUR com 2 milhões de tokens de IA incluídos — sem subscrição.",
    keywords: [
      "calculadora IA",
      "calculadora com IA",
      "calculadora com câmara",
      "calculadora IA com câmara",
      "calculadora inteligente",
      "calculadora para exames",
      "calculadora exames nacionais",
      "resolver exercícios com IA",
      "calculadora inteligência artificial",
      "KalkMate",
    ],
    authors: [{ name: "KalkMate" }],
    creator: "KalkMate",
    publisher: "KalkMate",
    formatDetection: { email: false, address: false, telephone: false },
    metadataBase: new URL(siteUrl),
    alternates: {
      canonical: `${siteUrl}/pt`,
      languages: languageAlternates(siteUrl),
    },
    openGraph: {
      title: "KalkMate — Calculadora com IA e câmara",
      description:
        "Aponta a câmara a qualquer exercício: a IA do KalkMate mostra a resolução passo a passo no ecrã OLED. Sem telemóvel, sem app, sem subscrição. 2 milhões de tokens de IA incluídos.",
      type: "website",
      locale: "pt_PT",
      url: `${siteUrl}/pt`,
      siteName: "KalkMate",
    },
    twitter: {
      card: "summary_large_image",
      title: "KalkMate — Calculadora com IA e câmara",
      description:
        "Foto → IA → resolução. A calculadora inteligente que resolve exercícios de matemática, física, química e biologia.",
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

export default async function PortuguesePage() {
  const siteUrl = siteUrlFromHost((await headers()).get("host"));
  return (
    <>
      <HtmlLang lang="pt" />
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
        <ClientBuyNow lang={lang} defaultCountry="PT" />
      </main>
      <Footer lang={lang} />
    </>
  );
}
