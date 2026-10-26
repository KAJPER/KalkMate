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

const lang = "pt" as const;

// Dynamiczne (nie staly obiekt) — patrz komentarz w src/app/page.tsx.
export async function generateMetadata(): Promise<Metadata> {
  const siteUrl = siteUrlFromHost((await headers()).get("host"));
  return {
    title: "Calculadora IA com câmara que resolve exercícios | KalkMate",
    description:
      "Fotografa o exercício e o KalkMate mostra a resolução passo a passo. Matemática, física, química, biologia. 169 EUR com 2 milhões de tokens IA, sem subscrição.",
    keywords: [
      "calculadora com IA",
      "calculadora IA",
      "calculadora com câmara",
      "calculadora que resolve exercícios",
      "resolver exercícios com foto",
      "resolver exercícios de matemática com IA",
      "exercícios resolvidos passo a passo",
      "preparação para exames nacionais",
      "exame nacional de matemática",
      "estudar para o teste de matemática",
      "calculadora para o secundário",
      "calculadora inteligente",
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
      images: ogImages,
      title: "Calculadora com IA e câmara — KalkMate",
      description:
        "Tira uma foto ao exercício de matemática, física, química ou biologia: o KalkMate mostra a resolução passo a passo no ecrã OLED. Menu em 11 línguas. 169 EUR com 2 milhões de tokens IA, sem subscrição.",
      type: "website",
      locale: "pt_PT",
      alternateLocale: locales.filter((l) => l !== lang).map((l) => ogLocale[l]),
      url: `${siteUrl}/pt`,
      siteName: "KalkMate",
    },
    twitter: {
      images: ogImages,
      card: "summary_large_image",
      title: "Calculadora com IA e câmara — KalkMate",
      description:
        "Foto → IA → resolução passo a passo. Ajuda a preparar testes e exames nacionais. 169 EUR com 2 milhões de tokens IA, sem subscrição.",
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
