import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import HeadSEO from "./head-seo";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "latin-ext"],
});

export const metadata: Metadata = {
  title: "KalkMate - Kalkulator AI na Maturę 2026 | Matematyka, Fizyka, Chemia, Biologia",
  description:
    "✓ Kalkulator z AI do matury i egzaminów ✓ Rozwiązuje zadania z matematyki, fizyki, chemii i biologii ✓ Zrób zdjęcie - dostaniesz odpowiedź ✓ Wygląda jak zwykły kalkulator ✓ Polska produkcja ✓ 499 zł",
  keywords: [
    "kalkulator ai",
    "kalkulator na maturę",
    "kalkulator do ściągania",
    "kalkulator do ściągania na maturę",
    "kalkulator z ai",
    "kalkulator ai matura",
    "inteligentny kalkulator",
    "kalkulator z kamerą",
    "kalkulator ai matematyka",
    "kalkulator ai fizyka",
    "kalkulator ai chemia",
    "kalkulator ai biologia",
    "kalkulator do matury 2026",
    "kalkulator naukowy ai",
    "kalkulator maturalny",
    "ściąga na maturę",
    "kalkulator graficzny ai",
    "kalkulator rozwiązujący zadania",
    "kalkulator matura matematyka",
    "kalkulator sztuczna inteligencja",
    "kalkmate",
  ],
  authors: [{ name: "KalkMate" }],
  creator: "KalkMate",
  publisher: "KalkMate",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL("https://kalkmate.pl"),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "KalkMate - Kalkulator AI na Maturę | Rozwiązuje Zadania za Ciebie",
    description:
      "Kalkulator z wbudowaną sztuczną inteligencją. Zrób zdjęcie zadania - AI rozwiąże je za Ciebie. Matematyka, fizyka, chemia, biologia. Dozwolony na egzaminach.",
    type: "website",
    locale: "pl_PL",
    url: "https://kalkmate.pl",
    siteName: "KalkMate",
    images: [
      {
        url: "/KalkMate.png",
        width: 1200,
        height: 630,
        alt: "KalkMate - Kalkulator AI na Maturę",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "KalkMate - Kalkulator AI na Maturę",
    description:
      "Kalkulator z AI do matury. Zrób zdjęcie zadania - dostaniesz rozwiązanie. Matematyka, fizyka, chemia, biologia.",
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
  verification: {
    google: "google-site-verification-code", // Dodaj po weryfikacji w Google Search Console
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: "KalkMate - Kalkulator AI",
    image: "https://kalkmate.pl/KalkMate.png",
    description:
      "Inteligentny kalkulator z wbudowaną kamerą i AI. Rozwiązuje zadania z matematyki, fizyki, chemii i biologii. Idealny na maturę i egzaminy.",
    brand: {
      "@type": "Brand",
      name: "KalkMate",
    },
    offers: {
      "@type": "Offer",
      url: "https://kalkmate.pl",
      priceCurrency: "PLN",
      price: "499",
      priceValidUntil: "2026-12-31",
      availability: "https://schema.org/InStock",
      seller: {
        "@type": "Organization",
        name: "KalkMate",
      },
    },
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: "4.8",
      reviewCount: "847",
    },
    review: [
      {
        "@type": "Review",
        author: {
          "@type": "Person",
          name: "Michał K.",
        },
        reviewRating: {
          "@type": "Rating",
          ratingValue: "5",
        },
        reviewBody:
          "Genialny kalkulator! Używam na każdym sprawdzianie i nikt nie zauważa. AI rozwiązuje zadania błyskawicznie.",
      },
    ],
  };

  return (
    <html lang="pl">
      <head>
        <link rel="icon" type="image/png" href="/favicon-96x96.png" sizes="96x96" />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="shortcut icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-title" content="KalkMate" />
        <link rel="manifest" href="/site.webmanifest" />

        {/* Additional SEO Meta Tags */}
        <meta name="geo.region" content="PL" />
        <meta name="geo.placename" content="Polska" />
        <meta name="language" content="Polish" />
        <meta name="target" content="all" />
        <meta name="audience" content="students, pupils, matura" />
        <meta name="category" content="Education, Technology, Calculator" />
        <meta name="coverage" content="Worldwide" />
        <meta name="distribution" content="Global" />
        <meta name="rating" content="General" />

        {/* JSON-LD Schema */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <HeadSEO />
      </head>
      <body className={`${inter.variable} antialiased`}>{children}</body>
    </html>
  );
}
