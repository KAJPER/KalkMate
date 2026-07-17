import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Regulamin Sklepu — KalkMate",
  description: "Regulamin sklepu internetowego KalkMate",
  robots: { index: true, follow: true },
  alternates: { canonical: "https://kalkmate.pl/regulamin" },
};

export default function ReguaminPage() {
  return (
    <main className="min-h-screen bg-[#0B0B0B] text-[#F2EDE3] px-4 py-16 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">Regulamin Sklepu KalkMate</h1>
      <p className="text-sm text-[#F2EDE3]/50 mb-10">Obowiązuje od: 1 stycznia 2026</p>

      <section className="space-y-8 text-sm leading-relaxed text-[#F2EDE3]/80">

        <div>
          <h2 className="text-lg font-semibold text-[#F2EDE3] mb-2">§1. Postanowienia ogólne</h2>
          <p>Niniejszy regulamin określa zasady sprzedaży produktów w sklepie internetowym dostępnym pod adresem kalkmate.pl, prowadzonym przez <strong>Kacper Popko</strong> prowadzącego działalność gospodarczą pod firmą <strong>KAJPA Kacper Popko</strong>, ul. Zastawie I 37, 16-070 Choroszcz, NIP: 9662222951, REGON: 545011444, zwanych dalej „Sprzedawcą".</p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-[#F2EDE3] mb-2">§2. Zamówienia</h2>
          <ol className="list-decimal pl-5 space-y-1">
            <li>Zamówienia przyjmowane są przez stronę internetową kalkmate.pl przez całą dobę, 7 dni w tygodniu.</li>
            <li>Złożenie zamówienia jest równoznaczne z akceptacją niniejszego regulaminu.</li>
            <li>Po złożeniu zamówienia Kupujący otrzymuje potwierdzenie na podany adres e-mail.</li>
            <li>Sprzedawca zastrzega sobie prawo do odmowy realizacji zamówienia w uzasadnionych przypadkach.</li>
          </ol>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-[#F2EDE3] mb-2">§3. Ceny i płatności</h2>
          <ol className="list-decimal pl-5 space-y-1">
            <li>Wszystkie ceny podane na stronie są cenami brutto (zawierają podatek VAT).</li>
            <li>Płatności obsługiwane są przez serwis Przelewy24 (PayPro SA, ul. Kanclerska 15, 60-327 Poznań).</li>
            <li>Dostępne metody płatności: karta płatnicza, BLIK, przelew bankowy oraz inne metody dostępne w serwisie Przelewy24.</li>
          </ol>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-[#F2EDE3] mb-2">§4. Realizacja i dostawa</h2>
          <ol className="list-decimal pl-5 space-y-1">
            <li>Produkt KalkMate jest wytwarzany na zamówienie jako produkcja własna.</li>
            <li>Termin realizacji wynosi do 4 tygodni od momentu zaksięgowania płatności. Standardowy czas realizacji to 1–2 tygodnie.</li>
            <li>Dostawa na terenie Polski realizowana jest za pośrednictwem InPost (paczkomat). Koszt dostawy w Polsce: 0 zł.</li>
            <li>Dostawa zagraniczna (kraje UE): 20 EUR. Dostawa poza UE: 35 EUR.</li>
            <li>Kupujący otrzymuje numer śledzenia przesyłki po jej nadaniu.</li>
          </ol>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-[#F2EDE3] mb-2">§5. Prawo do odstąpienia od umowy</h2>
          <ol className="list-decimal pl-5 space-y-1">
            <li>Konsument ma prawo odstąpić od umowy zawartej na odległość w terminie 14 dni kalendarzowych bez podania przyczyny.</li>
            <li>Termin do odstąpienia od umowy wygasa po upływie 14 dni od dnia, w którym Konsument wszedł w posiadanie rzeczy.</li>
            <li>Aby skorzystać z prawa odstąpienia, Konsument musi poinformować Sprzedawcę o swojej decyzji drogą mailową na adres: <strong>kontakt@kalkmate.pl</strong>.</li>
            <li>Zwrotu towaru należy dokonać na adres: <strong>KalkMate, ul. Zastawie I 37, 16-070 Choroszcz</strong>.</li>
            <li>Zwrot płatności następuje w terminie do 14 dni od dnia otrzymania zwracanego towaru.</li>
          </ol>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-[#F2EDE3] mb-2">§6. Reklamacje i gwarancja</h2>
          <ol className="list-decimal pl-5 space-y-1">
            <li>Produkty objęte są gwarancją Sprzedawcy na okres 24 miesięcy od daty zakupu.</li>
            <li>Reklamacje należy zgłaszać drogą mailową na adres: <strong>kontakt@kalkmate.pl</strong>, podając numer zamówienia i opis usterki.</li>
            <li>Sprzedawca rozpatruje reklamacje w terminie do 14 dni kalendarzowych.</li>
          </ol>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-[#F2EDE3] mb-2">§7. Ochrona danych osobowych</h2>
          <ol className="list-decimal pl-5 space-y-1">
            <li>Administratorem danych osobowych jest Sprzedawca.</li>
            <li>Dane osobowe przetwarzane są wyłącznie w celu realizacji zamówienia i nie są udostępniane podmiotom trzecim, z wyjątkiem firm kurierskich i operatorów płatności.</li>
            <li>Kupującemu przysługuje prawo wglądu do swoich danych, ich poprawiania oraz żądania usunięcia.</li>
            <li>Strona wykorzystuje pliki cookies, w tym narzędzie analityczne Microsoft Clarity (mapy ciepła, nagrania sesji), ładowane wyłącznie po wyrażeniu zgody w bannerze cookies. Szczegóły znajdują się w <a href="/polityka-prywatnosci#sek-9" className="text-[#D8FF3D] hover:underline">Polityce Prywatności</a>.</li>
          </ol>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-[#F2EDE3] mb-2">§8. Postanowienia końcowe</h2>
          <ol className="list-decimal pl-5 space-y-1">
            <li>W sprawach nieuregulowanych niniejszym regulaminem stosuje się przepisy Kodeksu Cywilnego oraz ustawy o prawach konsumenta.</li>
            <li>Sprzedawca zastrzega sobie prawo do zmiany regulaminu. Zmiany wchodzą w życie z dniem publikacji na stronie.</li>
            <li>Wszelkie spory rozstrzygane będą przez sąd właściwy dla siedziby Sprzedawcy.</li>
          </ol>
        </div>

        <div className="pt-4 border-t border-[#F2EDE3]/10 text-xs text-[#F2EDE3]/40">
          Kontakt: kontakt@kalkmate.pl
        </div>

      </section>
    </main>
  );
}
