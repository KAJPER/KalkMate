import { type Locale, SITE_URL, localeHomeUrl } from "@/lib/i18n";
import { faqs } from "@/lib/content/faq";
import { reviews, aggregateRating } from "@/lib/content/reviews";

const productName: Record<Locale, string> = {
  pl: "KalkMate — Kalkulator AI",
  en: "KalkMate — AI Calculator",
  de: "KalkMate — KI-Taschenrechner",
  cs: "KalkMate — AI kalkulačka",
  sk: "KalkMate — AI kalkulačka",
  lt: "KalkMate — DI skaičiuotuvas",
  be: "KalkMate — ШІ-калькулятар",
  es: "KalkMate — Calculadora con IA",
  pt: "KalkMate — Calculadora com IA",
  fr: "KalkMate — Calculatrice IA",
  it: "KalkMate — Calcolatrice con IA",
};

const productDescription: Record<Locale, string> = {
  pl: "Kalkulator z aparatem i AI do rozwiązywania zadań maturalnych. Zrób zdjęcie zadania z matematyki, fizyki, chemii lub biologii — pełne rozwiązanie krok po kroku pojawi się na ekranie OLED 256×64. Kalkulator do ściągania nowej generacji.",
  en: "AI camera calculator for exams — photograph any math, physics, chemistry or biology problem and the full step-by-step solution appears on the 256×64 OLED screen. Smart, discreet, no phone needed.",
  de: "KI Taschenrechner mit Kamera für Prüfungen. Fotografiere eine Aufgabe aus Mathematik, Physik, Chemie oder Biologie — die vollständige Schritt-für-Schritt-Lösung erscheint auf dem 256×64 OLED-Display.",
  cs: "AI kalkulačka s kamerou na zkoušky. Vyfoť úlohu z matematiky, fyziky, chemie nebo biologie — kompletní řešení krok za krokem se zobrazí na OLED displeji 256×64. Chytrá, nenápadná, bez telefonu.",
  sk: "AI kalkulačka s kamerou na skúšky. Odfoť úlohu z matematiky, fyziky, chémie alebo biológie — kompletné riešenie krok za krokom sa zobrazí na OLED displeji 256×64. Šikovná, nenápadná, bez telefónu.",
  lt: "Dirbtinio intelekto skaičiuotuvas su kamera egzaminams. Nufotografuok matematikos, fizikos, chemijos ar biologijos užduotį — visas sprendimas žingsnis po žingsnio atsiras 256×64 OLED ekrane. Išmanus, nepastebimas, be telefono.",
  be: "ШІ-калькулятар з камерай для экзаменаў. Сфатаграфуй задачу па матэматыцы, фізіцы, хіміі ці біялогіі — поўнае рашэнне крок за крокам з’явіцца на OLED-экране 256×64. Разумны, непрыкметны, без тэлефона.",
  es: "Calculadora con IA y cámara para exámenes. Fotografía un problema de matemáticas, física, química o biología y la solución completa paso a paso aparece en la pantalla OLED de 256×64. Inteligente, discreta y sin móvil.",
  pt: "Calculadora com IA e câmara para exames. Fotografa um exercício de matemática, física, química ou biologia e a resolução completa passo a passo aparece no ecrã OLED de 256×64. Inteligente, discreta e sem telemóvel.",
  fr: "Calculatrice IA avec caméra pour les examens. Photographie un exercice de maths, physique, chimie ou biologie : la solution complète, étape par étape, s’affiche sur l’écran OLED 256×64. Intelligente, discrète, sans téléphone.",
  it: "Calcolatrice con IA e fotocamera per gli esami. Fotografa un esercizio di matematica, fisica, chimica o biologia e la soluzione completa passo dopo passo compare sul display OLED 256×64. Intelligente, discreta, senza telefono.",
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
  // /be: Bialorus nie jest krajem wysylki — strona domyslnie pokazuje
  // Polske i cene w PLN, wiec dane strukturalne musza sie z tym zgadzac.
  const isPl = locale === "pl" || locale === "be";
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

/**
 * WebPage JSON-LD — jawny jezyk strony (inLanguage). <html lang> jest
 * renderowane jako "pl" na wszystkich wersjach (patrz HtmlLang), wiec to
 * jest serwerowy sygnal jezyka dla wyszukiwarek.
 */
export function webPageJsonLd(locale: Locale, siteUrl: string = SITE_URL) {
  const url = localeHomeUrl(locale, siteUrl);
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${url}#webpage`,
    url,
    name: productName[locale],
    description: productDescription[locale],
    inLanguage: locale,
    isPartOf: { "@type": "WebSite", name: "KalkMate", url: siteUrl },
    primaryImageOfPage: `${siteUrl}/galeria/kalkulator-kalkmate-gotowy-egzemplarz.webp`,
  };
}

/** Tablica skryptów JSON-LD jako stringi gotowe do wstrzyknięcia. */
export function homeJsonLd(locale: Locale, siteUrl: string = SITE_URL): string[] {
  return [
    webPageJsonLd(locale, siteUrl),
    productJsonLd(locale, siteUrl),
    { ...faqJsonLd(locale), inLanguage: locale },
  ].map((o) => JSON.stringify(o));
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
