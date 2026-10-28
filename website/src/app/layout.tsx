import type { Metadata, Viewport } from "next";
import { Fraunces, JetBrains_Mono, Geist } from "next/font/google";
import "./globals.css";
import SessionProvider from "@/components/SessionProvider";
import { CartProvider } from "@/components/CartContext";
import { ClientCartDrawer, ClientCookieBanner, ClientClarityAnalytics, ClientSupportWidget } from "@/components/ClientShell";
import PageTracker from "@/components/PageTracker";
import { organizationJsonLd } from "@/lib/seo";

// Fonty: display "swap" + adjustFontFallback (domyslnie true w next/font/google
// — fallback z dopasowanymi metrykami), wiec H1 Hero (element LCP) maluje sie
// od razu fallbackiem. Preload zostaje dla WSZYSTKICH trzech rodzin: sprawdzone
// w Lighthouse — bez preloadu Geist/JetBrains sa odkrywane dopiero z CSS z
// priorytetem VeryHigh (blokuja FCP w symulacji, FCP 1.2 s -> 1.8 s) i daja
// widoczny przeskok po podmianie fontu (CLS 0.026 na przyciskach Hero).
const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

const instrument = Fraunces({
  variable: "--font-instrument",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "600"],
  style: ["normal", "italic"],
  display: "swap",
  adjustFontFallback: true,
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

// UWAGA kalkmate.eu: metadataBase/organizationJsonLd tutaj CELOWO zostaja
// statyczne (kalkmate.pl) — root layout owija KAZDA strone, wiec gdyby
// czytal headers() tutaj, cala witryna stracilaby prerenderowanie statyczne
// (kazda podstrona stalaby sie dynamiczna). To, co faktycznie decyduje czy
// Google zaindeksuje .eu osobno, to canonical/hreflang NA KONKRETNYCH
// stronach (page.tsx, en/de, pomoc, sitemap.ts) — te SA dynamiczne per-host,
// patrz siteUrlFromHost() w src/lib/i18n.ts. metadataBase tutaj sluzy tylko
// jako fallback dla ewentualnych wzglednych URLi, nie jest realnym sygnalem
// kanonicznosci (kazda strona i tak podaje pelny, absolutny canonical).
export const metadata: Metadata = {
  // GSC 2026-10: "inteligentny kalkulator" (poz. 7.7), "kalkulator z aparatem/ze zdjecia"
  // (poz. 7.4) — frazy w tytule, marka na koncu ("kalkulator ai" i tak poz. 1.2).
  title: "Inteligentny kalkulator AI z aparatem | KalkMate",
  description:
    "Inteligentny kalkulator z aparatem i AI: zrób zdjęcie zadania z matematyki, fizyki, chemii lub biologii i zobacz rozwiązanie krok po kroku. Polska produkcja, 699 zł z 2 mln tokenów AI.",
  keywords: [
    "kalkulator ai",
    "kalkulator z ai",
    "ai kalkulator",
    "kalkulator do ściągania",
    "kalkulator z aparatem",
    "kalkulator z kamerą",
    "inteligentny kalkulator",
    "kalkulator naukowy ai",
    "kalkulator matura ai",
    "kalkmate",
    "calculator ai",
    "ai calculator",
    "KI Taschenrechner",
    "ki taschenrechner mit kamera",
    "calculator ai kaufen",
    "ai kalkulačka",
    "kalkulačka s kamerou",
    "inteligentná kalkulačka",
    "DI skaičiuotuvas",
    "skaičiuotuvas su kamera",
    "калькулятар ШІ",
    "calculadora IA",
    "calculadora con cámara",
    "calculadora com câmara",
    "calculatrice IA",
    "calculatrice avec caméra",
    "calcolatrice IA",
    "calcolatrice con fotocamera",
  ],
  authors: [{ name: "KalkMate" }],
  creator: "KalkMate",
  publisher: "KalkMate",
  formatDetection: { email: false, address: false, telephone: false },
  metadataBase: new URL("https://kalkmate.pl"),
  // manifest/appleWebApp ida przez Metadata API (nie recznie w <head> JSX
  // ponizej) — dzieki temu src/app/admin/layout.tsx moze je NADPISAC dla
  // /admin (osobny manifest/nazwa PWA), zamiast dublowac oba tagi na stronie
  // (Next.js API "override" dziala tylko dla wartosci zadeklarowanych tutaj,
  // recznych <link>/<meta> w JSX ponizej nie widzi i by ich nie usunal).
  manifest: "/site.webmanifest",
  appleWebApp: { title: "KalkMate" },
  // Weryfikacja Google Search Console metodą "tag HTML" — wystarczy ustawić
  // zmienną środowiskową GOOGLE_SITE_VERIFICATION (alternatywnie użyj weryfikacji
  // przez rekord DNS TXT, która nie wymaga zmian w kodzie).
  verification: process.env.GOOGLE_SITE_VERIFICATION
    ? { google: process.env.GOOGLE_SITE_VERIFICATION }
    : undefined,
  // UWAGA: NIE ustawiamy tu alternates.canonical — w App Router metadata roota
  // dziedziczą wszystkie podstrony, więc canonical wyciekłby na /pomoc, /regulamin
  // itd. (Google traktowałby je jako duplikaty strony głównej). Canonical + hreflang
  // ustawiamy per-strona (/, /en, /de, /cs, /sk, /lt, /be, /es, /pt, /fr, /it,
  // /pomoc i jej wersje językowe, /regulamin, /polityka-prywatnosci).
  openGraph: {
    title: "KalkMate — Kalkulator AI",
    description:
      "Kalkulator z wbudowaną sztuczną inteligencją. Zrób zdjęcie zadania — AI rozwiąże je za Ciebie.",
    type: "website",
    locale: "pl_PL",
    url: "https://kalkmate.pl",
    siteName: "KalkMate",
  },
  twitter: {
    card: "summary_large_image",
    title: "KalkMate — Kalkulator AI",
    description:
      "Kalkulator z AI. Zrób zdjęcie zadania — dostaniesz rozwiązanie. Matematyka, fizyka, chemia, biologia.",
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

export const viewport: Viewport = {
  themeColor: "#0B0B0B",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pl" className="dark">
      <head>
        <link rel="icon" type="image/png" href="/favicon-96x96.png" sizes="96x96" />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="shortcut icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
      </head>
      <body
        className={`${geist.variable} ${instrument.variable} ${jetbrains.variable} antialiased km-grain bg-[#0B0B0B] text-[#F2EDE3]`}
      >
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: organizationJsonLd() }}
        />
        <SessionProvider>
          <CartProvider>
            {children}
            <ClientCartDrawer />
          </CartProvider>
        </SessionProvider>
        <PageTracker />
        <ClientClarityAnalytics />
        <ClientSupportWidget />
        <ClientCookieBanner />
      </body>
    </html>
  );
}
