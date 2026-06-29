import type { Metadata } from "next";
import { Fraunces, JetBrains_Mono, Geist } from "next/font/google";
import "./globals.css";
import SessionProvider from "@/components/SessionProvider";
import { CartProvider } from "@/components/CartContext";
import { ClientCartDrawer, ClientCookieBanner } from "@/components/ClientShell";

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
  title: "KalkMate — Kalkulator AI | Matematyka, Fizyka, Chemia, Biologia",
  description:
    "Kalkulator z aparatem i AI — zrób zdjęcie zadania, dostaniesz rozwiązanie krok po kroku. Matematyka, fizyka, chemia, biologia. Polska produkcja. 699 zł.",
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
  ],
  authors: [{ name: "KalkMate" }],
  creator: "KalkMate",
  publisher: "KalkMate",
  formatDetection: { email: false, address: false, telephone: false },
  metadataBase: new URL("https://kalkmate.pl"),
  // Weryfikacja Google Search Console metodą "tag HTML" — wystarczy ustawić
  // zmienną środowiskową GOOGLE_SITE_VERIFICATION (alternatywnie użyj weryfikacji
  // przez rekord DNS TXT, która nie wymaga zmian w kodzie).
  verification: process.env.GOOGLE_SITE_VERIFICATION
    ? { google: process.env.GOOGLE_SITE_VERIFICATION }
    : undefined,
  // UWAGA: NIE ustawiamy tu alternates.canonical — w App Router metadata roota
  // dziedziczą wszystkie podstrony, więc canonical wyciekłby na /pomoc, /regulamin
  // itd. (Google traktowałby je jako duplikaty strony głównej). Canonical + hreflang
  // ustawiamy per-strona (/, /en, /de, /pomoc, /regulamin, /polityka-prywatnosci).
  openGraph: {
    title: "KalkMate — Kalkulator AI",
    description:
      "Kalkulator z wbudowaną sztuczną inteligencją. Zrób zdjęcie zadania — AI rozwiąże je za Ciebie.",
    type: "website",
    locale: "pl_PL",
    url: "https://kalkmate.pl",
    siteName: "KalkMate",
    images: [
      { url: "/KalkMate.png", width: 1200, height: 630, alt: "KalkMate — Kalkulator AI" },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "KalkMate — Kalkulator AI",
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
      </head>
      <body
        className={`${geist.variable} ${instrument.variable} ${jetbrains.variable} antialiased km-grain bg-[#0B0B0B] text-[#F2EDE3]`}
      >
        <SessionProvider>
          <CartProvider>
            {children}
            <ClientCartDrawer />
          </CartProvider>
        </SessionProvider>
        <ClientCookieBanner />
      </body>
    </html>
  );
}
