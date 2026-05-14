import type { Metadata } from "next";
import { Fraunces, JetBrains_Mono, Geist } from "next/font/google";
import "./globals.css";
import HeadSEO from "./head-seo";

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
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "KalkMate — Kalkulator AI na Maturę 2026 | Matematyka, Fizyka, Chemia, Biologia",
  description:
    "Kalkulator z AI do matury. Zrób zdjęcie zadania — dostaniesz rozwiązanie. Matematyka, fizyka, chemia, biologia. Polska produkcja. 699 zł.",
  keywords: [
    "kalkulator ai",
    "kalkulator na maturę",
    "kalkulator z ai",
    "kalkulator ai matura",
    "inteligentny kalkulator",
    "kalkulator z kamerą",
    "kalkulator do matury 2026",
    "kalkulator naukowy ai",
    "kalkmate",
  ],
  authors: [{ name: "KalkMate" }],
  creator: "KalkMate",
  publisher: "KalkMate",
  formatDetection: { email: false, address: false, telephone: false },
  metadataBase: new URL("https://kalkmate.pl"),
  alternates: { canonical: "/" },
  openGraph: {
    title: "KalkMate — Kalkulator AI na Maturę",
    description:
      "Kalkulator z wbudowaną sztuczną inteligencją. Zrób zdjęcie zadania — AI rozwiąże je za Ciebie.",
    type: "website",
    locale: "pl_PL",
    url: "https://kalkmate.pl",
    siteName: "KalkMate",
    images: [
      { url: "/KalkMate.png", width: 1200, height: 630, alt: "KalkMate — Kalkulator AI na Maturę" },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "KalkMate — Kalkulator AI na Maturę",
    description:
      "Kalkulator z AI. Zrób zdjęcie zadania — dostaniesz rozwiązanie. Matematyka, fizyka, chemia, biologia.",
    images: ["/KalkMate.png"],
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

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: "KalkMate — Kalkulator AI",
    image: "https://kalkmate.pl/KalkMate.png",
    description:
      "Inteligentny kalkulator z wbudowaną kamerą i AI. Rozwiązuje zadania z matematyki, fizyki, chemii i biologii.",
    brand: { "@type": "Brand", name: "KalkMate" },
    offers: {
      "@type": "Offer",
      url: "https://kalkmate.pl",
      priceCurrency: "PLN",
      price: "699",
      priceValidUntil: "2026-12-31",
      availability: "https://schema.org/InStock",
      seller: { "@type": "Organization", name: "KalkMate" },
    },
  };

  return (
    <html lang="pl" className="dark">
      <head>
        <link rel="icon" type="image/png" href="/favicon-96x96.png" sizes="96x96" />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="shortcut icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-title" content="KalkMate" />
        <meta name="theme-color" content="#0B0B0B" />
        <link rel="manifest" href="/site.webmanifest" />
        <meta name="geo.region" content="PL" />
        <meta name="language" content="Polish" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <HeadSEO />
      </head>
      <body
        className={`${geist.variable} ${instrument.variable} ${jetbrains.variable} antialiased km-grain bg-[#0B0B0B] text-[#F2EDE3]`}
      >
        {children}
      </body>
    </html>
  );
}
