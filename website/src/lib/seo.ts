import { type Locale, SITE_URL, localeHomeUrl } from "@/lib/i18n";
import { faqs } from "@/lib/content/faq";
import { reviews, aggregateRating } from "@/lib/content/reviews";

const productName: Record<Locale, string> = {
  pl: "KalkMate — Kalkulator AI",
  en: "KalkMate — AI Calculator",
  de: "KalkMate — KI-Taschenrechner",
};

const productDescription: Record<Locale, string> = {
  pl: "Inteligentny kalkulator z wbudowaną kamerą i AI. Rozwiązuje zadania z matematyki, fizyki, chemii i biologii — robisz zdjęcie zadania, a rozwiązanie krok po kroku pojawia się na ekranie OLED 256×64.",
  en: "Smart AI-powered calculator with a built-in camera. Photograph any math, physics, chemistry or biology problem and the full step-by-step solution appears on the 256×64 OLED screen.",
  de: "Intelligenter KI-Taschenrechner mit eingebauter Kamera. Fotografiere eine Aufgabe aus Mathematik, Physik, Chemie oder Biologie — die vollständige Schritt-für-Schritt-Lösung erscheint auf dem 256×64 OLED-Display.",
};

/** Product JSON-LD (schema.org) dla strony głównej w danym języku. */
export function productJsonLd(locale: Locale) {
  const isPl = locale === "pl";
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: productName[locale],
    image: `${SITE_URL}/KalkMate.png`,
    description: productDescription[locale],
    sku: "KM-V1",
    brand: { "@type": "Brand", name: "KalkMate" },
    offers: {
      "@type": "Offer",
      url: localeHomeUrl(locale),
      priceCurrency: isPl ? "PLN" : "EUR",
      price: isPl ? "699" : "169",
      priceValidUntil: "2026-12-31",
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
export function homeJsonLd(locale: Locale): string[] {
  return [productJsonLd(locale), faqJsonLd(locale)].map((o) =>
    JSON.stringify(o),
  );
}
