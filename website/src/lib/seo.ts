import { type Locale, SITE_URL, localeHomeUrl } from "@/lib/i18n";
import { faqs } from "@/lib/content/faq";
import { reviews, aggregateRating } from "@/lib/content/reviews";

const productName: Record<Locale, string> = {
  pl: "KalkMate — Kalkulator AI",
  en: "KalkMate — AI Calculator",
  de: "KalkMate — KI-Taschenrechner",
};

const productDescription: Record<Locale, string> = {
  pl: "Kalkulator z aparatem i AI do rozwiązywania zadań maturalnych. Zrób zdjęcie zadania z matematyki, fizyki, chemii lub biologii — pełne rozwiązanie krok po kroku pojawi się na ekranie OLED 256×64. Kalkulator do ściągania nowej generacji.",
  en: "AI camera calculator for exams — photograph any math, physics, chemistry or biology problem and the full step-by-step solution appears on the 256×64 OLED screen. Smart, discreet, no phone needed.",
  de: "KI Taschenrechner mit Kamera für Prüfungen. Fotografiere eine Aufgabe aus Mathematik, Physik, Chemie oder Biologie — die vollständige Schritt-für-Schritt-Lösung erscheint auf dem 256×64 OLED-Display.",
};

// Wysylka do danych strukturalnych — te same stawki co w koszyku
// (components/BuyNow.tsx: PL 0 zl InPost, UE 20 EUR, reszta swiata 35 EUR)
// i czas realizacji "do 4 tygodni" (reczne skladanie). Google pokazuje to
// w wynikach produktowych i ostrzega w GSC, gdy brakuje.
const EU_NON_PL = ["AT","BE","BG","HR","CY","CZ","DK","EE","FI","FR","DE","GR","HU","IE","IT","LV","LT","LU","MT","NL","PT","RO","SK","SI","ES","SE"];
const WORLD_MAIN = ["GB","US","CA","AU","CH","NO","IL"];

function shippingDetails(currency: "PLN" | "EUR", rate: string, countries: string[], transit: [number, number]) {
  return {
    "@type": "OfferShippingDetails",
    shippingRate: { "@type": "MonetaryAmount", value: rate, currency },
    shippingDestination: { "@type": "DefinedRegion", addressCountry: countries },
    deliveryTime: {
      "@type": "ShippingDeliveryTime",
      handlingTime: { "@type": "QuantitativeValue", minValue: 1, maxValue: 20, unitCode: "DAY" },
      transitTime: { "@type": "QuantitativeValue", minValue: transit[0], maxValue: transit[1], unitCode: "DAY" },
    },
  };
}

/** Product JSON-LD (schema.org) dla strony głównej w danym języku. */
export function productJsonLd(locale: Locale, siteUrl: string = SITE_URL) {
  const isPl = locale === "pl";
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: productName[locale],
    description: productDescription[locale],
    image: [
      `${siteUrl}/galeria/kalkulator-kalkmate-gotowy-egzemplarz.webp`,
      `${siteUrl}/galeria/kalkulator-kalkmate-opakowanie-pudelko.webp`,
      `${siteUrl}/galeria/kalkulator-kalkmate-ekran-menu-glowne.webp`,
    ],
    sku: "KM-V3",
    brand: { "@type": "Brand", name: "KalkMate" },
    offers: {
      "@type": "Offer",
      url: localeHomeUrl(locale, siteUrl),
      priceCurrency: isPl ? "PLN" : "EUR",
      price: isPl ? "699" : "169",
      // Zawsze koniec przyszlego roku — stala data po uplywie robi z ceny
      // "nieaktualna" i Google przestaje pokazywac wynik z cena.
      priceValidUntil: `${new Date().getFullYear() + 1}-12-31`,
      shippingDetails: isPl
        ? [shippingDetails("PLN", "0", ["PL"], [1, 3])]
        : [shippingDetails("EUR", "20", EU_NON_PL, [3, 8]), shippingDetails("EUR", "35", WORLD_MAIN, [5, 15])],
      availability: "https://schema.org/InStock",
      seller: { "@type": "Organization", name: "KalkMate" },
    },
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: aggregateRating.ratingValue,
      reviewCount: aggregateRating.reviewCount,
      bestRating: aggregateRating.bestRating,
      worstRating: aggregateRating.worstRating,
    },
    review: reviews[locale].map((r) => ({
      "@type": "Review",
      author: { "@type": "Person", name: r.author },
      reviewRating: {
        "@type": "Rating",
        ratingValue: String(r.rating),
        bestRating: "5",
      },
      reviewBody: r.body,
      datePublished: r.date,
    })),
  };
}

/** FAQPage JSON-LD zbudowane z tego samego źródła co widoczne FAQ. */
export function faqJsonLd(locale: Locale) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs[locale].map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}

/** Tablica skryptów JSON-LD jako stringi gotowe do wstrzyknięcia. */
export function homeJsonLd(locale: Locale, siteUrl: string = SITE_URL): string[] {
  return [productJsonLd(locale, siteUrl), faqJsonLd(locale)].map((o) =>
    JSON.stringify(o),
  );
}

/**
 * Organization JSON-LD — encja marki (dane zgodne z Footer/wpisem CEIDG).
 * Renderowane raz, w root layout, żeby było obecne na każdej stronie —
 * pomaga wyszukiwarkom i modelom AI rozpoznać "KalkMate" jako konkretny,
 * weryfikowalny podmiot (a nie tylko frazę w tekście).
 */
export function organizationJsonLd(siteUrl: string = SITE_URL): string {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "KalkMate",
    legalName: "KAJPA Kacper Popko",
    url: siteUrl,
    email: "kontakt@kalkmate.pl",
    telephone: "+48600580888",
    address: {
      "@type": "PostalAddress",
      streetAddress: "ul. Zastawie I 37",
      postalCode: "16-070",
      addressLocality: "Choroszcz",
      addressCountry: "PL",
    },
    taxID: "9662222951",
  });
}
