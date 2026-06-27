import { type Locale } from "@/lib/i18n";

export type Review = {
  author: string;
  location: string;
  rating: 5 | 4;
  date: string;
  body: string;
};

export const reviews: Record<Locale, Review[]> = {
  pl: [
    {
      author: "Marek K.",
      location: "Kraków",
      rating: 5,
      date: "2026-04-02",
      body: "Korzystam od 3 tygodni przed maturą z matematyki rozszerzonej. Zadania z całek i geometrii analitycznej — podaję pod kamerę i mam pełny tok rozwiązania w 1–2 sekundy. Niesamowite.",
    },
    {
      author: "Ania W.",
      location: "Warszawa",
      rating: 5,
      date: "2026-03-18",
      body: "Kupił mój tata jako pomoc do fizyki. Wzory, siły, elektryczność — wszystko tłumaczone krok po kroku. Na egzaminie próbnym poprawiłam się z 52% na 78%.",
    },
    {
      author: "Piotr S.",
      location: "Wrocław",
      rating: 5,
      date: "2026-04-10",
      body: "Z zewnątrz wygląda jak zwykły kalkulator graficzny. W środku jest coś zupełnie innego. Chemia organiczna przestała być problemem — stechiometria, reakcje, rozwiązania molarności.",
    },
    {
      author: "Zofia M.",
      location: "Gdańsk",
      rating: 5,
      date: "2026-03-25",
      body: "Polecam każdemu maturzyście. Biologia na poziomie rozszerzonym była moją piętą achillesową. KalkMate rozwiązuje zadania genetyczne, ekologiczne — z opisem każdego kroku myślenia.",
    },
    {
      author: "Tomasz L.",
      location: "Poznań",
      rating: 4,
      date: "2026-04-05",
      body: "Bateria trzyma cały dzień intensywnej nauki. Obsługa intuicyjna, jeden przycisk do zdjęcia. Minusik za czas oczekiwania przy złym oświetleniu, ale generalnie bardzo dobry produkt.",
    },
    {
      author: "Kasia R.",
      location: "Łódź",
      rating: 5,
      date: "2026-04-14",
      body: "Zamiast korepetycji za 120 zł/h mam KalkMate. Jednorazowy koszt, zero abonamentu. Matematyka, fizyka, chemia i biologia w jednym urządzeniu — zwrot kosztów po 6 lekcjach.",
    },
  ],
  en: [
    {
      author: "Mark K.",
      location: "Kraków",
      rating: 5,
      date: "2026-04-02",
      body: "Using it for 3 weeks before my advanced math exam. Integrals, analytic geometry — I point the camera and get the full solution in 1–2 seconds. Incredible.",
    },
    {
      author: "Anna W.",
      location: "Warsaw",
      rating: 5,
      date: "2026-03-18",
      body: "My dad bought it for physics. Formulas, forces, electricity — all explained step by step. My mock exam score jumped from 52% to 78%.",
    },
    {
      author: "Peter S.",
      location: "Wrocław",
      rating: 5,
      date: "2026-04-10",
      body: "Looks like a regular graphing calculator on the outside. Inside it's something completely different. Organic chemistry stopped being a problem — stoichiometry, reactions, molarity.",
    },
    {
      author: "Sophie M.",
      location: "Gdańsk",
      rating: 5,
      date: "2026-03-25",
      body: "I recommend it to every student. Advanced biology was my weakness. KalkMate solves genetics and ecology problems with a description of every step of reasoning.",
    },
    {
      author: "Thomas L.",
      location: "Poznań",
      rating: 4,
      date: "2026-04-05",
      body: "Battery lasts a full day of intensive study. Intuitive operation, one button for a photo. Slight downside when lighting is poor, but overall a very good product.",
    },
    {
      author: "Kate R.",
      location: "Łódź",
      rating: 5,
      date: "2026-04-14",
      body: "Instead of tutoring at €30/h I have KalkMate. One-time cost, no subscription. Math, physics, chemistry and biology in one device — cost recovered after 6 lessons.",
    },
  ],
  de: [
    {
      author: "Marek K.",
      location: "Krakau",
      rating: 5,
      date: "2026-04-02",
      body: "Nutze es seit 3 Wochen vor meiner Abiturprüfung in erweiterter Mathematik. Integrale, analytische Geometrie — ich halte die Kamera hin und bekomme die vollständige Lösung in 1–2 Sekunden.",
    },
    {
      author: "Anna W.",
      location: "Warschau",
      rating: 5,
      date: "2026-03-18",
      body: "Mein Vater kaufte es für Physik. Formeln, Kräfte, Elektrizität — alles Schritt für Schritt erklärt. Meine Probeprüfungsnote stieg von 52% auf 78%.",
    },
    {
      author: "Peter S.",
      location: "Breslau",
      rating: 5,
      date: "2026-04-10",
      body: "Sieht von außen wie ein normaler Grafikrechner aus. Innen ist es etwas völlig anderes. Organische Chemie ist kein Problem mehr — Stöchiometrie, Reaktionen, Molarität.",
    },
    {
      author: "Sophie M.",
      location: "Danzig",
      rating: 5,
      date: "2026-03-25",
      body: "Ich empfehle es jedem Abiturienten. Erweiterte Biologie war meine Schwäche. KalkMate löst Genetik- und Ökologieaufgaben mit Beschreibung jedes Denkschritts.",
    },
    {
      author: "Thomas L.",
      location: "Posen",
      rating: 4,
      date: "2026-04-05",
      body: "Akku hält einen ganzen intensiven Lerntag. Intuitive Bedienung, ein Knopf für ein Foto. Kleiner Minuspunkt bei schlechter Beleuchtung, aber insgesamt sehr gutes Produkt.",
    },
    {
      author: "Katharina R.",
      location: "Lodz",
      rating: 5,
      date: "2026-04-14",
      body: "Statt Nachhilfe für 30€/h habe ich KalkMate. Einmalkosten, kein Abo. Mathe, Physik, Chemie und Biologie in einem Gerät — Kosten nach 6 Stunden amortisiert.",
    },
  ],
};

export const aggregateRating = {
  ratingValue: "4.8",
  reviewCount: String(reviews.pl.length),
  bestRating: "5",
  worstRating: "1",
};
