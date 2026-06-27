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
      body: "Przed maturą z matmy rozszerzonej korzystam z tego codziennie. Całki, geometria analityczna, kombinatoryka. Daję pod kamerę i mam pełne rozwiązanie. Szczerze nie wierzyłem że to tak działa.",
    },
    {
      author: "Ania W.",
      location: "Warszawa",
      rating: 5,
      date: "2026-03-18",
      body: "Tata kupił mi do fizyki bo korepetycje były za drogie. Na próbnym dostałam 78% zamiast 52%. Nie wiem czy to tylko przez kalkulator ale bardzo mi pomógł przy siłach i elektryczności.",
    },
    {
      author: "Piotr S.",
      location: "Wrocław",
      rating: 5,
      date: "2026-04-10",
      body: "Z zewnątrz totalnie wygląda jak normalny kalkulator prosty. Nikt w szkole nie wie co to jest. Chemia organiczna i stechiometria przestały być problemem dzięki temu.",
    },
    {
      author: "Zofia M.",
      location: "Gdańsk",
      rating: 5,
      date: "2026-03-25",
      body: "Biologia rozszerzona to był koszmar, szczególnie genetyka i zadania z krzyżówkami. Teraz po prostu fotografuję zadanie i czytam jak to się robi krok po kroku. Bardzo polecam.",
    },
    {
      author: "Tomasz L.",
      location: "Poznań",
      rating: 4,
      date: "2026-04-05",
      body: "Generalnie spoko produkt. Bateria trzyma cały dzień nauki. Raz miałem problem że przy słabym świetle nie chciało dobrze odczytać zadania ale po poprawieniu oświetlenia ok. Dobry zakup.",
    },
    {
      author: "Kasia R.",
      location: "Łódź",
      rating: 5,
      date: "2026-04-14",
      body: "Zamiast korepetycji za 120 zł za godzinę mam to. Jednorazowy koszt i działa do wszystkich przedmiotów. Mama była sceptyczna ale teraz też uważa że to był dobry pomysł.",
    },
  ],
  en: [
    {
      author: "Mark K.",
      location: "Kraków",
      rating: 5,
      date: "2026-04-02",
      body: "Using it every day before my advanced math exam. Integrals, analytic geometry, combinatorics. Point the camera and I get the full solution. Honestly didn't believe it would work this well.",
    },
    {
      author: "Anna W.",
      location: "Warsaw",
      rating: 5,
      date: "2026-03-18",
      body: "Dad bought it for me for physics because tutoring was too expensive. Got 78% on the mock instead of 52%. Not sure if it's only because of the calculator but it helped a lot with forces and electricity.",
    },
    {
      author: "Peter S.",
      location: "Wrocław",
      rating: 5,
      date: "2026-04-10",
      body: "Looks exactly like a normal simple calculator on the outside. Nobody at school knows what it is. Organic chemistry and stoichiometry stopped being a problem because of this.",
    },
    {
      author: "Sophie M.",
      location: "Gdańsk",
      rating: 5,
      date: "2026-03-25",
      body: "Advanced biology was a nightmare, especially genetics and crossbreeding problems. Now I just photograph the problem and read how to solve it step by step. Highly recommend.",
    },
    {
      author: "Thomas L.",
      location: "Poznań",
      rating: 4,
      date: "2026-04-05",
      body: "Generally a solid product. Battery lasts a full day of studying. Once had an issue where poor lighting made it struggle to read the problem but fixing the lighting sorted it. Good purchase.",
    },
    {
      author: "Kate R.",
      location: "Łódź",
      rating: 5,
      date: "2026-04-14",
      body: "Instead of tutoring at 30 EUR per hour I have this. One-time cost and works for all subjects. My mum was sceptical but now she also thinks it was a good idea.",
    },
  ],
  de: [
    {
      author: "Marek K.",
      location: "Krakau",
      rating: 5,
      date: "2026-04-02",
      body: "Nutze es täglich vor meiner Abiturprüfung in Mathe. Integrale, analytische Geometrie, Kombinatorik. Kamera drauf und ich bekomme die vollständige Lösung. Hab ehrlich nicht geglaubt dass das so funktioniert.",
    },
    {
      author: "Anna W.",
      location: "Warschau",
      rating: 5,
      date: "2026-03-18",
      body: "Papa hat es mir für Physik gekauft weil Nachhilfe zu teuer war. In der Probeprüfung 78% statt 52% bekommen. Weiß nicht ob es nur am Rechner liegt aber er hat mir bei Kräften und Elektrizität sehr geholfen.",
    },
    {
      author: "Peter S.",
      location: "Breslau",
      rating: 5,
      date: "2026-04-10",
      body: "Sieht von außen genau wie ein normaler einfacher Taschenrechner aus. Keiner in der Schule weiß was das ist. Organische Chemie und Stöchiometrie sind damit kein Problem mehr.",
    },
    {
      author: "Sophie M.",
      location: "Danzig",
      rating: 5,
      date: "2026-03-25",
      body: "Erweiterte Biologie war ein Albtraum, besonders Genetik und Kreuzungsaufgaben. Jetzt fotografiere ich einfach die Aufgabe und lese wie man sie Schritt für Schritt löst. Sehr empfehlenswert.",
    },
    {
      author: "Thomas L.",
      location: "Posen",
      rating: 4,
      date: "2026-04-05",
      body: "Insgesamt ein solides Produkt. Akku hält einen ganzen Lerntag. Einmal hatte ich Probleme bei schlechter Beleuchtung aber nach Verbesserung des Lichts lief es wieder. Guter Kauf.",
    },
    {
      author: "Katharina R.",
      location: "Lodz",
      rating: 5,
      date: "2026-04-14",
      body: "Statt Nachhilfe für 30 Euro pro Stunde hab ich das hier. Einmalkosten und funktioniert für alle Fächer. Meine Mutter war skeptisch aber jetzt findet sie es auch eine gute Idee.",
    },
  ],
};

export const aggregateRating = {
  ratingValue: "4.8",
  reviewCount: String(reviews.pl.length),
  bestRating: "5",
  worstRating: "1",
};
