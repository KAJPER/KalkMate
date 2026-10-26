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

const lang = "be" as const;

// Dynamiczne (nie staly obiekt) — patrz komentarz w src/app/page.tsx.
export async function generateMetadata(): Promise<Metadata> {
  const siteUrl = siteUrlFromHost((await headers()).get("host"));
  return {
    title: "KalkMate — калькулятар з ШІ і камерай | Сфатаграфуй задачу — атрымай рашэнне",
    description:
      "KalkMate — калькулятар з камерай і штучным інтэлектам для кантрольных і экзаменаў. Сфатаграфуй задачу — ШІ пакажа поўнае рашэнне крок за крокам на OLED-экране. Матэматыка, фізіка, хімія, біялогія, меню па-беларуску. 699 zł (169 EUR) з 2 млн токенаў ШІ — без падпіскі.",
    keywords: [
      "калькулятар ШІ",
      "калькулятар са штучным інтэлектам",
      "калькулятар з камерай",
      "разумны калькулятар",
      "калькулятар для экзамену",
      "рашэнне задач ШІ",
      "AI калькулятар",
      "KalkMate",
    ],
    authors: [{ name: "KalkMate" }],
    creator: "KalkMate",
    publisher: "KalkMate",
    formatDetection: { email: false, address: false, telephone: false },
    metadataBase: new URL(siteUrl),
    alternates: {
      canonical: `${siteUrl}/be`,
      languages: languageAlternates(siteUrl),
    },
    openGraph: {
      title: "KalkMate — калькулятар з ШІ і камерай",
      description:
        "Сфатаграфуй задачу — KalkMate рашыць яе з дапамогай ШІ проста на OLED-экране. Матэматыка, фізіка, хімія, біялогія. 699 zł з 2 млн токенаў ШІ — без падпіскі.",
      type: "website",
      locale: "be_BY",
      url: `${siteUrl}/be`,
      siteName: "KalkMate",
    },
    twitter: {
      card: "summary_large_image",
      title: "KalkMate — калькулятар з ШІ і камерай",
      description:
        "Фота → ШІ → рашэнне. Разумны калькулятар, які рашае задачы па матэматыцы, фізіцы, хіміі і біялогіі.",
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

export default async function BelarusianPage() {
  const siteUrl = siteUrlFromHost((await headers()).get("host"));
  return (
    <>
      <HtmlLang lang="be" />
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
        {/* Białoruś nie jest krajem wysyłki — domyślnie Polska (PLN), gdzie mieszka
            większość białoruskojęzycznych klientów; kraj można zmienić w formularzu. */}
        <ClientBuyNow lang={lang} defaultCountry="PL" />
      </main>
      <Footer lang={lang} />
    </>
  );
}
