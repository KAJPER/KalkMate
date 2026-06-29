import { type Locale } from "@/lib/i18n";

export interface FaqItem {
  q: string;
  a: string;
}

export const faqs: Record<Locale, FaqItem[]> = {
  pl: [
    {
      q: "Czy KalkMate to kalkulator do ściągania?",
      a: "Tak — to kalkulator z aparatem (kamerą), który robi zdjęcie zadania i wyświetla pełne rozwiązanie krok po kroku na ekranie. Obudowa, klawiatura i ekran są identyczne ze standardowymi kalkulatorami prostymi. Tryb AI uruchamiasz ukrytą kombinacją klawiszy — nie ma żadnych ikon ani wskaźników, które by Cię zdradzały.",
    },
    {
      q: "Jakie przedmioty obsługuje AI?",
      a: "Matematyka (poziom podstawowy i rozszerzony), fizyka, chemia i biologia. Model jest trenowany na tysiącach zadań z ostatnich 10 lat. Sukcesywnie dodajemy kolejne przedmioty.",
    },
    {
      q: "Czy potrzebuję WiFi?",
      a: "Tryb AI wymaga WiFi (konfigurujesz raz, w panelu użytkownika). Tryb klasycznego kalkulatora działa offline przez cały czas.",
    },
    {
      q: "Jak długo działa na baterii?",
      a: "Około 6 godzin w trybie mieszanym (AI + kalkulator). Sam tryb kalkulatora wytrzymuje znacznie dłużej. Ładowanie USB-C ~ 2 godziny.",
    },
    {
      q: "Czy moje dane są bezpieczne?",
      a: "Zdjęcia i zapytania przesyłamy szyfrowanym HTTPS. Po przetworzeniu nie przechowujemy zdjęć — są usuwane z serwera natychmiast po wysłaniu odpowiedzi.",
    },
    {
      q: "Czy mogę zwrócić produkt?",
      a: "Tak. Masz 14 dni na zwrot bez podania przyczyny, zgodnie z prawem konsumenckim. Zwracamy pełną kwotę po otrzymaniu urządzenia.",
    },
    {
      q: "Kiedy dostanę zamówienie?",
      a: "Standardowy czas realizacji to 1–2 tygodnie od zaksięgowania płatności (maksymalnie 4 tygodnie). Po wysyłce dostawa Paczkomatem InPost zajmuje 1–2 dni robocze. Numer przesyłki dostajesz mailem.",
    },
    {
      q: "Jaka jest gwarancja?",
      a: "24 miesiące gwarancji producenta na wszystkie elementy. Naprawiamy lub wymieniamy urządzenie w razie usterki.",
    },
  ],
  en: [
    {
      q: "Is KalkMate an AI camera calculator for exams?",
      a: "Yes — KalkMate is an AI camera calculator: it photographs the problem and shows the full step-by-step solution on screen. The casing, keypad and screen are identical to standard simple calculators. You launch AI mode with a hidden key combination — there are no icons or indicators that could give you away.",
    },
    {
      q: "Which subjects does the AI support?",
      a: "Mathematics (basic and extended level), physics, chemistry and biology. The model is trained on thousands of problems from the last 10 years. We keep adding more subjects.",
    },
    {
      q: "Do I need WiFi?",
      a: "AI mode requires WiFi (you configure it once in your user panel). The classic calculator mode works offline at all times.",
    },
    {
      q: "How long does the battery last?",
      a: "Around 6 hours in mixed use (AI + calculator). Calculator mode alone lasts considerably longer. USB-C charging takes about 2 hours.",
    },
    {
      q: "Is my data secure?",
      a: "Photos and queries are sent over encrypted HTTPS. We don't store photos after processing — they are deleted from the server immediately once the answer is sent.",
    },
    {
      q: "Can I return the product?",
      a: "Yes. You have 14 days to return it without giving a reason, in line with consumer law. We refund the full amount once we receive the device.",
    },
    {
      q: "When will I get my order?",
      a: "Standard processing time is 1–2 weeks from payment confirmation (up to 4 weeks maximum). After dispatch, InPost parcel-locker delivery takes 1–2 business days. You'll get your tracking number by email.",
    },
    {
      q: "What's the warranty?",
      a: "A 24-month manufacturer's warranty on all components. We repair or replace the device in case of a fault.",
    },
  ],
  de: [
    {
      q: "Ist KalkMate ein KI Taschenrechner mit Kamera?",
      a: "Ja — KalkMate ist ein KI Taschenrechner mit Kamera: Du fotografierst die Aufgabe und siehst die vollständige Schritt-für-Schritt-Lösung auf dem Display. Gehäuse, Tastatur und Display sind identisch mit handelsüblichen einfachen Taschenrechnern. Den KI-Modus startest du mit einer versteckten Tastenkombination — es gibt keine Symbole oder Anzeigen, die dich verraten könnten.",
    },
    {
      q: "Welche Fächer unterstützt die KI?",
      a: "Mathematik (Grund- und Leistungskurs), Physik, Chemie und Biologie. Das Modell ist auf Tausende von Aufgaben der letzten 10 Jahre trainiert. Wir ergänzen laufend weitere Fächer.",
    },
    {
      q: "Brauche ich WLAN?",
      a: "Der KI-Modus benötigt WLAN (du richtest es einmal im Benutzerbereich ein). Der klassische Taschenrechner-Modus funktioniert jederzeit offline.",
    },
    {
      q: "Wie lange hält der Akku?",
      a: "Etwa 6 Stunden bei gemischter Nutzung (KI + Taschenrechner). Der reine Taschenrechner-Modus hält deutlich länger. Das Laden per USB-C dauert ca. 2 Stunden.",
    },
    {
      q: "Sind meine Daten sicher?",
      a: "Fotos und Anfragen werden verschlüsselt über HTTPS übertragen. Nach der Verarbeitung speichern wir keine Fotos — sie werden sofort nach dem Senden der Antwort vom Server gelöscht.",
    },
    {
      q: "Kann ich das Produkt zurückgeben?",
      a: "Ja. Du hast 14 Tage Rückgaberecht ohne Angabe von Gründen, gemäß Verbraucherrecht. Den vollen Betrag erstatten wir, sobald wir das Gerät erhalten haben.",
    },
    {
      q: "Wann erhalte ich meine Bestellung?",
      a: "Die Standardbearbeitungszeit beträgt 1–2 Wochen ab Zahlungseingang (maximal 4 Wochen). Nach dem Versand dauert die Lieferung per InPost-Paketstation 1–2 Werktage. Die Sendungsnummer erhältst du per E-Mail.",
    },
    {
      q: "Wie sieht die Garantie aus?",
      a: "24 Monate Herstellergarantie auf alle Komponenten. Im Falle eines Defekts reparieren oder ersetzen wir das Gerät.",
    },
  ],
};
