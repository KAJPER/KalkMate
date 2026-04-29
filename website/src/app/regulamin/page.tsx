import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";

export const metadata = {
  title: "Regulamin - KalkMate",
  description: "Regulamin korzystania z serwisu KalkMate.pl",
};

export default function TermsOfService() {
  return (
    <>
      <Navigation />
      <main className="min-h-screen bg-[#F5F5F5] dark:bg-[#313338]">
        <div className="max-w-4xl mx-auto px-6 py-16 lg:py-24">
          <h1 className="text-4xl lg:text-5xl font-bold text-[#1a1a1a] dark:text-[#E0E0E0] mb-4">
            Regulamin serwisu KalkMate.pl
          </h1>

          <div className="bg-white dark:bg-[#2B2D31] rounded-2xl border border-gray-100 dark:border-[#3F4147] p-8 lg:p-12 mt-8">
            <p className="text-[#1a1a1a]/60 dark:text-[#E0E0E0]/60 text-sm">
              <strong>Ostatnia aktualizacja:</strong> 20 lutego 2026
            </p>

            <section className="mt-8">
              <h2 className="text-2xl font-bold text-[#1a1a1a] dark:text-[#E0E0E0] mt-8 mb-4">
                § 1. Postanowienia ogólne
              </h2>
              <ol className="list-decimal list-inside space-y-2 text-[#1a1a1a]/80 dark:text-[#E0E0E0]/80">
                <li>Regulamin określa zasady korzystania ze sklepu internetowego KalkMate.pl, prowadzonego przez KalkMate (dalej: „Sprzedawca").</li>
                <li>KalkMate oferuje sprzedaż kalkulatorów graficznych wraz z subskrypcją usługi AI Chat.</li>
                <li>Kontakt ze Sprzedawcą możliwy jest poprzez formularz kontaktowy na stronie lub email podany w stopce strony.</li>
                <li>Niniejszy Regulamin jest integralną częścią umowy sprzedaży zawieranej między Sprzedawcą a Klientem.</li>
                <li>Przed złożeniem zamówienia Klient zobowiązany jest zapoznać się z treścią Regulaminu.</li>
              </ol>
            </section>

            <section className="mt-8">
              <h2 className="text-2xl font-bold text-[#1a1a1a] dark:text-[#E0E0E0] mt-8 mb-4">
                § 2. Definicje
              </h2>
              <ol className="list-decimal list-inside space-y-2 text-[#1a1a1a]/80 dark:text-[#E0E0E0]/80">
                <li><strong>Klient</strong> – osoba fizyczna posiadająca pełną zdolność do czynności prawnych, osoba prawna lub jednostka organizacyjna nieposiadająca osobowości prawnej, która dokonuje zakupu w Sklepie.</li>
                <li><strong>Konsument</strong> – osoba fizyczna dokonująca zakupu w celach niezwiązanych z działalnością gospodarczą lub zawodową.</li>
                <li><strong>Kalkulator</strong> – kalkulator graficzny oferowany w Sklepie wraz z oprogramowaniem.</li>
                <li><strong>AI Chat</strong> – usługa subskrypcyjna umożliwiająca korzystanie z chatbota opartego na sztucznej inteligencji (Google Gemini Pro) do rozwiązywania zadań matematycznych.</li>
                <li><strong>Subskrypcja</strong> – usługa świadczona okresowo w modelu abonamentowym.</li>
                <li><strong>Konto</strong> – panel klienta dostępny po zalogowaniu, umożliwiający zarządzanie zamówieniami i subskrypcją.</li>
              </ol>
            </section>

            <section className="mt-8">
              <h2 className="text-2xl font-bold text-[#1a1a1a] dark:text-[#E0E0E0] mt-8 mb-4">
                § 3. Zasady składania zamówień
              </h2>
              <ol className="list-decimal list-inside space-y-2 text-[#1a1a1a]/80 dark:text-[#E0E0E0]/80">
                <li><strong>Każdy kalkulator oferowany w Sklepie jest produktem wykonywanym ręcznie, indywidualnie na zamówienie Klienta.</strong> Produkt jest tworzony wyłącznie po złożeniu i opłaceniu zamówienia — nie pochodzi z magazynu gotowych towarów.</li>
                <li>Złożenie zamówienia wymaga wypełnienia formularza zamówienia i podania:
                  <ul className="list-disc list-inside ml-6 mt-2">
                    <li>imienia i nazwiska,</li>
                    <li>adresu email,</li>
                    <li>numeru telefonu,</li>
                    <li>wybranego punktu odbioru InPost.</li>
                  </ul>
                </li>
                <li>Zamówienie uważa się za złożone z chwilą otrzymania przez Sprzedawcę potwierdzonego zamówienia wraz z płatnością.</li>
                <li>Cena produktu widoczna na stronie w momencie składania zamówienia jest ceną wiążącą.</li>
                <li>Klient otrzymuje potwierdzenie zamówienia na podany adres email.</li>
                <li>Umowa sprzedaży zostaje zawarta z chwilą wysłania przez Sprzedawcę potwierdzenia przyjęcia zamówienia do realizacji.</li>
              </ol>
            </section>

            <section className="mt-8">
              <h2 className="text-2xl font-bold text-[#1a1a1a] dark:text-[#E0E0E0] mt-8 mb-4">
                § 4. Płatności
              </h2>
              <ol className="list-decimal list-inside space-y-2 text-[#1a1a1a]/80 dark:text-[#E0E0E0]/80">
                <li>Płatności realizowane są przez system Stripe.</li>
                <li>Akceptowane metody płatności:
                  <ul className="list-disc list-inside ml-6 mt-2">
                    <li>karty płatnicze (Visa, Mastercard, American Express),</li>
                    <li>przelewy online (szybkie przelewy),</li>
                    <li>BLIK.</li>
                  </ul>
                </li>
                <li>Realizacja zamówienia następuje po otrzymaniu potwierdzenia płatności od operatora płatności.</li>
                <li>W przypadku subskrypcji AI Chat płatność pobierana jest automatycznie co miesiąc.</li>
              </ol>
            </section>

            <section className="mt-8">
              <h2 className="text-2xl font-bold text-[#1a1a1a] dark:text-[#E0E0E0] mt-8 mb-4">
                § 5. Dostawa
              </h2>
              <ol className="list-decimal list-inside space-y-2 text-[#1a1a1a]/80 dark:text-[#E0E0E0]/80">
                <li>Dostawa realizowana jest wyłącznie na terytorium Polski.</li>
                <li>Sprzedawca wysyła produkty za pośrednictwem InPost Paczkomaty.</li>
                <li>Czas realizacji zamówienia wynosi do 25 kwietnia 2026 r. od momentu zaksięgowania płatności.</li>
                <li>Wysyłka zamówień realizowana jest do dnia 25 kwietnia 2026 r.</li>
                <li><strong>Sprzedawca gwarantuje, że zamówienia złożone i opłacone najpóźniej do dnia 25 kwietnia 2026 r. zostaną dostarczone do Klienta (odebrane z Paczkomatu) najpóźniej do dnia 3 maja 2026 r.</strong></li>
                <li>Klient zostanie powiadomiony emailem oraz SMS o nadaniu paczki i możliwości odbioru.</li>
                <li>Produkt należy odebrać w ciągu 48 godzin od otrzymania powiadomienia. Po tym czasie paczka zostanie zwrócona do Sprzedawcy.</li>
              </ol>
            </section>

            <section className="mt-8">
              <h2 className="text-2xl font-bold text-[#1a1a1a] dark:text-[#E0E0E0] mt-8 mb-4">
                § 6. Prawo odstąpienia od umowy – wyłączenie
              </h2>
              <ol className="list-decimal list-inside space-y-2 text-[#1a1a1a]/80 dark:text-[#E0E0E0]/80">
                <li><strong>Prawo odstąpienia od umowy (zwrot towaru) nie przysługuje</strong> w odniesieniu do produktów oferowanych w Sklepie, tj. kalkulatorów graficznych wykonywanych ręcznie, indywidualnie na zamówienie Klienta.</li>
                <li>Podstawa prawna wyłączenia: art. 38 ust. 1 pkt 3 Ustawy z dnia 30 maja 2014 r. o prawach konsumenta (t.j. Dz.U. 2020 poz. 287 ze zm.) — prawo odstąpienia od umowy zawartej poza lokalem przedsiębiorstwa lub na odległość nie przysługuje konsumentowi w odniesieniu do umów, w których przedmiotem świadczenia jest rzecz nieprefabrykowana, wyprodukowana według specyfikacji konsumenta lub służąca zaspokojeniu jego zindywidualizowanych potrzeb.</li>
                <li>Każdy kalkulator jest wytwarzany ręcznie, od podstaw, wyłącznie po złożeniu i opłaceniu zamówienia przez konkretnego Klienta. Produkt nie istnieje przed złożeniem zamówienia i nie może być odsprzedany innemu nabywcy — z tego powodu zwrot nie jest możliwy.</li>
                <li>Powyższe wyłączenie nie ogranicza uprawnień Klienta z tytułu reklamacji (rękojmi za wady), opisanych w § 7 niniejszego Regulaminu.</li>
                <li>Składając zamówienie i dokonując płatności, Klient potwierdza, że zapoznał się z niniejszym wyłączeniem prawa odstąpienia od umowy i akceptuje jego warunki.</li>
              </ol>
            </section>

            <section className="mt-8">
              <h2 className="text-2xl font-bold text-[#1a1a1a] dark:text-[#E0E0E0] mt-8 mb-4">
                § 7. Reklamacje
              </h2>
              <ol className="list-decimal list-inside space-y-2 text-[#1a1a1a]/80 dark:text-[#E0E0E0]/80">
                <li>Sprzedawca odpowiada wobec Klienta za niezgodność produktu z umową.</li>
                <li>Reklamację można zgłosić:
                  <ul className="list-disc list-inside ml-6 mt-2">
                    <li>poprzez email na adres podany w stopce strony,</li>
                    <li>poprzez formularz kontaktowy na stronie.</li>
                  </ul>
                </li>
                <li>W zgłoszeniu reklamacyjnym należy podać:
                  <ul className="list-disc list-inside ml-6 mt-2">
                    <li>imię i nazwisko,</li>
                    <li>adres email,</li>
                    <li>numer zamówienia,</li>
                    <li>opis wady lub niezgodności,</li>
                    <li>żądanie Klienta (np. wymiana, naprawa, obniżenie ceny).</li>
                  </ul>
                </li>
                <li>Sprzedawca ustosunkuje się do reklamacji w ciągu 14 dni od jej otrzymania.</li>
                <li>W przypadku produktu wadliwego Klient może żądać:
                  <ul className="list-disc list-inside ml-6 mt-2">
                    <li>wymiany na nowy,</li>
                    <li>naprawy produktu,</li>
                    <li>obniżenia ceny,</li>
                    <li>odstąpienia od umowy i zwrotu środków.</li>
                  </ul>
                </li>
              </ol>
            </section>

            <section className="mt-8">
              <h2 className="text-2xl font-bold text-[#1a1a1a] dark:text-[#E0E0E0] mt-8 mb-4">
                § 8. Subskrypcja AI Chat
              </h2>
              <ol className="list-decimal list-inside space-y-2 text-[#1a1a1a]/80 dark:text-[#E0E0E0]/80">
                <li>Kup kalkulatora obejmuje 30-dniowy bezpłatny dostęp do AI Chat.</li>
                <li>Nowi użytkownicy otrzymują 1-dniowy okres próbny AI Chat.</li>
                <li>Po zakończeniu okresu bezpłatnego/próbnego, subskrypcja jest kontynuowana automatycznie za opłatą 29 zł/miesiąc.</li>
                <li>Płatność za subskrypcję pobierana jest automatycznie w cyklu miesięcznym.</li>
                <li>Klient może anulować subskrypcję w dowolnym momencie w panelu klienta.</li>
                <li>Anulowanie subskrypcji następuje z końcem bieżącego okresu rozliczeniowego.</li>
                <li>Po anulowaniu subskrypcji Klient nie otrzymuje zwrotu środków za niewykorzystany okres.</li>
                <li>Sprzedawca zastrzega sobie prawo do zmiany ceny subskrypcji z 30-dniowym wyprzedzeniem, powiadamiając Klientów drogą mailową.</li>
              </ol>
            </section>

            <section className="mt-8">
              <h2 className="text-2xl font-bold text-[#1a1a1a] dark:text-[#E0E0E0] mt-8 mb-4">
                § 9. Konto użytkownika
              </h2>
              <ol className="list-decimal list-inside space-y-2 text-[#1a1a1a]/80 dark:text-[#E0E0E0]/80">
                <li>Konto można utworzyć podczas rejestracji lub automatycznie podczas pierwszego zakupu.</li>
                <li>Logowanie wymaga podania adresu email oraz hasła (minimum 6 znaków).</li>
                <li>Klient ponosi pełną odpowiedzialność za zachowanie poufności hasła i danych dostępowych do konta.</li>
                <li>Zabronione jest udostępnianie danych logowania osobom trzecim.</li>
                <li>W panelu klienta dostępne są:
                  <ul className="list-disc list-inside ml-6 mt-2">
                    <li>historia zamówień,</li>
                    <li>tracking przesyłek,</li>
                    <li>AI Chat,</li>
                    <li>zarządzanie subskrypcją.</li>
                  </ul>
                </li>
                <li>W przypadku utraty hasła można je zresetować korzystając z funkcji odzyskiwania hasła.</li>
                <li>Klient może w każdej chwili zażądać usunięcia konta poprzez kontakt z obsługą klienta.</li>
              </ol>
            </section>

            <section className="mt-8">
              <h2 className="text-2xl font-bold text-[#1a1a1a] dark:text-[#E0E0E0] mt-8 mb-4">
                § 10. Ochrona danych osobowych
              </h2>
              <ol className="list-decimal list-inside space-y-2 text-[#1a1a1a]/80 dark:text-[#E0E0E0]/80">
                <li>Administratorem danych osobowych Klientów jest KalkMate.</li>
                <li>Dane osobowe przetwarzane są zgodnie z RODO i Polityką Prywatności.</li>
                <li>Szczegółowe informacje o przetwarzaniu danych znajdują się w <a href="/polityka-prywatnosci" className="text-blue-600 dark:text-blue-400 hover:underline">Polityce Prywatności</a>.</li>
              </ol>
            </section>

            <section className="mt-8">
              <h2 className="text-2xl font-bold text-[#1a1a1a] dark:text-[#E0E0E0] mt-8 mb-4">
                § 11. Właściwość intelektualna
              </h2>
              <ol className="list-decimal list-inside space-y-2 text-[#1a1a1a]/80 dark:text-[#E0E0E0]/80">
                <li>Wszystkie treści zamieszczone na stronie KalkMate.pl, w tym teksty, grafiki, logo, zdjęcia, są własnością Sprzedawcy i podlegają ochronie prawa autorskiego.</li>
                <li>Kopiowanie, rozpowszechnianie lub wykorzystywanie treści w celach komercyjnych bez zgody Sprzedawcy jest zabronione.</li>
                <li>Oprogramowanie kalkulatora jest własnością Sprzedawcy i jest licencjonowane Klientowi wyłącznie do użytku osobistego.</li>
              </ol>
            </section>

            <section className="mt-8">
              <h2 className="text-2xl font-bold text-[#1a1a1a] dark:text-[#E0E0E0] mt-8 mb-4">
                § 12. Postanowienia końcowe
              </h2>
              <ol className="list-decimal list-inside space-y-2 text-[#1a1a1a]/80 dark:text-[#E0E0E0]/80">
                <li>Sprzedawca zastrzega sobie prawo do zmiany Regulaminu z ważnych przyczyn technicznych, prawnych lub organizacyjnych.</li>
                <li>O zmianach Regulaminu Klienci zostaną powiadomieni poprzez email lub komunikat na stronie z 14-dniowym wyprzedzeniem.</li>
                <li>Zmiany Regulaminu nie wpływają na umowy zawarte przed datą wejścia w życie nowego Regulaminu.</li>
                <li>W sprawach nieuregulowanych Regulaminem zastosowanie mają przepisy Kodeksu Cywilnego oraz ustawy o prawach konsumenta.</li>
                <li>Ewentualne spory będą rozstrzygane przez sąd właściwy według przepisów Kodeksu postępowania cywilnego.</li>
                <li>Konsument ma prawo skorzystać z pozasądowych sposobów rozstrzygania sporów, w szczególności poprzez:
                  <ul className="list-disc list-inside ml-6 mt-2">
                    <li>Stałe Polubowne Sądy Konsumenckie,</li>
                    <li>Wojewódzkie Inspektoraty Inspekcji Handlowej,</li>
                    <li>platformę ODR: <a href="https://ec.europa.eu/consumers/odr" className="text-blue-600 dark:text-blue-400 hover:underline">https://ec.europa.eu/consumers/odr</a>.</li>
                  </ul>
                </li>
              </ol>
            </section>

            <section className="mt-8">
              <h2 className="text-2xl font-bold text-[#1a1a1a] dark:text-[#E0E0E0] mt-8 mb-4">
                § 13. Dane kontaktowe
              </h2>
              <p className="text-[#1a1a1a]/80 dark:text-[#E0E0E0]/80">
                W razie pytań dotyczących Regulaminu lub działalności sklepu prosimy o kontakt poprzez formularz kontaktowy na stronie lub email podany w stopce strony.
              </p>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
