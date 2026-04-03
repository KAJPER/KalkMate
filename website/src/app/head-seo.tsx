export default function HeadSEO() {
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "Co to jest kalkulator AI?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "KalkMate to inteligentny kalkulator z wbudowaną kamerą i sztuczną inteligencją. Wystarczy zrobić zdjęcie zadania, a AI automatycznie je rozwiąże. Obsługuje matematykę, fizykę, chemię i biologię na poziomie maturalnym.",
        },
      },
      {
        "@type": "Question",
        name: "Czy kalkulator AI jest dozwolony na maturze?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "KalkMate wygląda identycznie jak zwykły kalkulator, co sprawia że jest niedostrzegalny podczas egzaminów. Kalkulatory są dozwolone na większości egzaminów i maturze.",
        },
      },
      {
        "@type": "Question",
        name: "Ile kosztuje kalkulator AI na maturę?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "KalkMate kosztuje 499 zł (cena promocyjna, wcześniej 2199 zł). W cenie otrzymujesz kalkulator z AI, kabel USB-C, instrukcję obsługi i darmową wysyłkę InPost.",
        },
      },
      {
        "@type": "Question",
        name: "Jak działa kalkulator z AI?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Robisz zdjęcie zadania wbudowaną kamerą, KalkMate łączy się z WiFi, wysyła zadanie na serwer AI, który je analizuje i rozwiązuje, a następnie wyświetla odpowiedź na ekranie OLED. Cały proces trwa około 3 sekund.",
        },
      },
      {
        "@type": "Question",
        name: "Czy kalkulator AI rozpoznaje polskie zadania?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Tak, AI w KalkMate jest trenowane specjalnie pod polską podstawę programową z matematyki, fizyki, chemii i biologii. Rozpoznaje polskie wzory, wzory reakcji chemicznych i diagramy.",
        },
      },
    ],
  };

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Strona główna",
        item: "https://kalkmate.pl",
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
    </>
  );
}
