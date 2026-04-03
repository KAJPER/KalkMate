import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";

export const metadata = {
  title: "Polityka Prywatności - KalkMate",
  description: "Polityka prywatności i ochrony danych osobowych KalkMate.pl",
};

export default function PrivacyPolicy() {
  return (
    <>
      <Navigation />
      <main className="min-h-screen bg-[#F5F5F5] dark:bg-[#313338]">
        <div className="max-w-4xl mx-auto px-6 py-16 lg:py-24">
          <h1 className="text-4xl lg:text-5xl font-bold text-[#1a1a1a] dark:text-[#E0E0E0] mb-4">
            Polityka Prywatności KalkMate.pl
          </h1>

          <div className="bg-white dark:bg-[#2B2D31] rounded-2xl border border-gray-100 dark:border-[#3F4147] p-8 lg:p-12 mt-8">
            <p className="text-[#1a1a1a]/60 dark:text-[#E0E0E0]/60">
              <strong>Ostatnia aktualizacja:</strong> 20 lutego 2026
            </p>

            <section className="mt-8">
              <h2 className="text-2xl font-bold text-[#1a1a1a] dark:text-[#E0E0E0] mt-8 mb-4">
                1. Postanowienia ogólne
              </h2>
              <p className="text-[#1a1a1a]/80 dark:text-[#E0E0E0]/80">
                Niniejsza Polityka Prywatności określa zasady przetwarzania i ochrony danych osobowych
                Użytkowników korzystających z serwisu KalkMate.pl (dalej: „Serwis"), prowadzonego przez
                KalkMate (dalej: „Administrator").
              </p>
              <p className="text-[#1a1a1a]/80 dark:text-[#E0E0E0]/80 mt-4">
                Administrator przykłada szczególną wagę do poszanowania prywatności Użytkowników
                oraz bezpieczeństwa ich danych osobowych. Dane osobowe przetwarzane są zgodnie z
                Rozporządzeniem Parlamentu Europejskiego i Rady (UE) 2016/679 z dnia 27 kwietnia 2016 r.
                (RODO) oraz przepisami prawa krajowego.
              </p>
            </section>

            <section className="mt-8">
              <h2 className="text-2xl font-bold text-[#1a1a1a] dark:text-[#E0E0E0] mt-8 mb-4">
                2. Administrator danych osobowych
              </h2>
              <p className="text-[#1a1a1a]/80 dark:text-[#E0E0E0]/80">
                Administratorem danych osobowych zbieranych za pośrednictwem Serwisu jest:
              </p>
              <p className="text-[#1a1a1a]/80 dark:text-[#E0E0E0]/80 font-semibold mt-4">
                KalkMate
              </p>
              <p className="text-[#1a1a1a]/80 dark:text-[#E0E0E0]/80">
                Kontakt z Administratorem możliwy jest poprzez:
              </p>
              <ul className="list-disc list-inside text-[#1a1a1a]/80 dark:text-[#E0E0E0]/80 mt-2">
                <li>email: kontakt podany w stopce strony,</li>
                <li>formularz kontaktowy dostępny na stronie.</li>
              </ul>
            </section>

            <section className="mt-8">
              <h2 className="text-2xl font-bold text-[#1a1a1a] dark:text-[#E0E0E0] mt-8 mb-4">
                3. Zakres zbieranych danych
              </h2>
              <p className="text-[#1a1a1a]/80 dark:text-[#E0E0E0]/80">
                W ramach działalności Serwisu zbieramy następujące kategorie danych osobowych:
              </p>

              <h3 className="text-xl font-semibold text-[#1a1a1a] dark:text-[#E0E0E0] mt-6 mb-3">
                3.1. Dane podawane przez Użytkownika
              </h3>
              <ul className="list-disc list-inside text-[#1a1a1a]/80 dark:text-[#E0E0E0]/80 space-y-1">
                <li>imię i nazwisko,</li>
                <li>adres email,</li>
                <li>numer telefonu,</li>
                <li>adres punktu odbioru InPost (Paczkomat).</li>
              </ul>

              <h3 className="text-xl font-semibold text-[#1a1a1a] dark:text-[#E0E0E0] mt-6 mb-3">
                3.2. Dane zbierane automatycznie
              </h3>
              <ul className="list-disc list-inside text-[#1a1a1a]/80 dark:text-[#E0E0E0]/80 space-y-1">
                <li>adres IP,</li>
                <li>typ i wersja przeglądarki,</li>
                <li>system operacyjny,</li>
                <li>dane o aktywności w Serwisie (odwiedzane strony, czas wizyty),</li>
                <li>informacje techniczne o urządzeniu.</li>
              </ul>

              <h3 className="text-xl font-semibold text-[#1a1a1a] dark:text-[#E0E0E0] mt-6 mb-3">
                3.3. Dane transakcyjne
              </h3>
              <ul className="list-disc list-inside text-[#1a1a1a]/80 dark:text-[#E0E0E0]/80 space-y-1">
                <li>historia zamówień,</li>
                <li>dane płatności (przetwarzane przez Stripe),</li>
                <li>informacje o subskrypcji AI Chat,</li>
                <li>historia konwersacji z AI Chat.</li>
              </ul>
            </section>

            <section className="mt-8">
              <h2 className="text-2xl font-bold text-[#1a1a1a] dark:text-[#E0E0E0] mt-8 mb-4">
                4. Cel i podstawa prawna przetwarzania danych
              </h2>

              <div className="overflow-x-auto mt-4">
                <table className="min-w-full border border-gray-200 dark:border-[#3F4147]">
                  <thead className="bg-[#F5F5F5] dark:bg-[#313338]">
                    <tr>
                      <th className="border border-gray-200 dark:border-[#3F4147] px-4 py-2 text-left text-[#1a1a1a] dark:text-[#E0E0E0]">Cel przetwarzania</th>
                      <th className="border border-gray-200 dark:border-[#3F4147] px-4 py-2 text-left text-[#1a1a1a] dark:text-[#E0E0E0]">Podstawa prawna</th>
                    </tr>
                  </thead>
                  <tbody className="text-[#1a1a1a]/80 dark:text-[#E0E0E0]/80">
                    <tr>
                      <td className="border border-gray-200 dark:border-[#3F4147] px-4 py-2">Realizacja umowy sprzedaży</td>
                      <td className="border border-gray-200 dark:border-[#3F4147] px-4 py-2">Art. 6 ust. 1 lit. b) RODO</td>
                    </tr>
                    <tr>
                      <td className="border border-gray-200 dark:border-[#3F4147] px-4 py-2">Obsługa płatności</td>
                      <td className="border border-gray-200 dark:border-[#3F4147] px-4 py-2">Art. 6 ust. 1 lit. b) RODO</td>
                    </tr>
                    <tr>
                      <td className="border border-gray-200 dark:border-[#3F4147] px-4 py-2">Świadczenie usługi AI Chat</td>
                      <td className="border border-gray-200 dark:border-[#3F4147] px-4 py-2">Art. 6 ust. 1 lit. b) RODO</td>
                    </tr>
                    <tr>
                      <td className="border border-gray-200 dark:border-[#3F4147] px-4 py-2">Wysyłka produktów</td>
                      <td className="border border-gray-200 dark:border-[#3F4147] px-4 py-2">Art. 6 ust. 1 lit. b) RODO</td>
                    </tr>
                    <tr>
                      <td className="border border-gray-200 dark:border-[#3F4147] px-4 py-2">Obsługa reklamacji</td>
                      <td className="border border-gray-200 dark:border-[#3F4147] px-4 py-2">Art. 6 ust. 1 lit. c) RODO (obowiązek prawny)</td>
                    </tr>
                    <tr>
                      <td className="border border-gray-200 dark:border-[#3F4147] px-4 py-2">Wystawianie faktur</td>
                      <td className="border border-gray-200 dark:border-[#3F4147] px-4 py-2">Art. 6 ust. 1 lit. c) RODO (obowiązek prawny)</td>
                    </tr>
                    <tr>
                      <td className="border border-gray-200 dark:border-[#3F4147] px-4 py-2">Marketing bezpośredni</td>
                      <td className="border border-gray-200 dark:border-[#3F4147] px-4 py-2">Art. 6 ust. 1 lit. f) RODO (prawnie uzasadniony interes)</td>
                    </tr>
                    <tr>
                      <td className="border border-gray-200 dark:border-[#3F4147] px-4 py-2">Analityka i statystyki</td>
                      <td className="border border-gray-200 dark:border-[#3F4147] px-4 py-2">Art. 6 ust. 1 lit. f) RODO (prawnie uzasadniony interes)</td>
                    </tr>
                    <tr>
                      <td className="border border-gray-200 dark:border-[#3F4147] px-4 py-2">Newsletter (jeśli wyrażono zgodę)</td>
                      <td className="border border-gray-200 dark:border-[#3F4147] px-4 py-2">Art. 6 ust. 1 lit. a) RODO (zgoda)</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section className="mt-8">
              <h2 className="text-2xl font-bold text-[#1a1a1a] dark:text-[#E0E0E0] mt-8 mb-4">
                5. Okres przechowywania danych
              </h2>
              <p className="text-[#1a1a1a]/80 dark:text-[#E0E0E0]/80">
                Dane osobowe przechowujemy przez okresy wymagane przepisami prawa lub przez czas niezbędny do realizacji celów przetwarzania:
              </p>
              <ul className="list-disc list-inside text-[#1a1a1a]/80 dark:text-[#E0E0E0]/80 space-y-2 mt-4">
                <li><strong>Dane transakcyjne i faktury:</strong> 5 lat od końca roku kalendarzowego, w którym powstał obowiązek podatkowy (przepisy podatkowe).</li>
                <li><strong>Dane dotyczące umowy:</strong> przez okres obowiązywania umowy oraz przez czas wymagany przepisami prawa (np. 6 lat w związku z przedawnieniem roszczeń).</li>
                <li><strong>Dane związane z subskrypcją:</strong> przez czas trwania subskrypcji oraz 3 lata po jej zakończeniu.</li>
                <li><strong>Historia AI Chat:</strong> przez czas aktywnej subskrypcji oraz 30 dni po jej zakończeniu.</li>
                <li><strong>Dane marketingowe (zgoda):</strong> do momentu wycofania zgody lub wniesienia sprzeciwu.</li>
                <li><strong>Dane analityczne:</strong> do 25 miesięcy od ostatniej aktywności.</li>
              </ul>
            </section>

            <section className="mt-8">
              <h2 className="text-2xl font-bold text-[#1a1a1a] dark:text-[#E0E0E0] mt-8 mb-4">
                6. Udostępnianie danych osobowych
              </h2>
              <p className="text-[#1a1a1a]/80 dark:text-[#E0E0E0]/80">
                Dane osobowe mogą być udostępniane następującym kategoriom odbiorców:
              </p>
              <ul className="list-disc list-inside text-[#1a1a1a]/80 dark:text-[#E0E0E0]/80 space-y-2 mt-4">
                <li><strong>Stripe</strong> – operator płatności (przetwarzanie transakcji kartami płatniczymi i subskrypcji).</li>
                <li><strong>InPost</strong> – firma kurierska (dostawa produktów do Paczkomatów).</li>
                <li><strong>Resend</strong> – usługa email (wysyłka wiadomości transakcyjnych i magic links).</li>
                <li><strong>Google AI (Gemini)</strong> – dostawca usługi AI Chat (przetwarzanie zapytań w chatbocie).</li>
                <li><strong>Dostawca hostingu</strong> – przechowywanie danych na serwerach VPS.</li>
                <li><strong>Dostawca bazy danych PostgreSQL</strong> – przechowywanie danych użytkowników.</li>
                <li><strong>Podmioty uprawnione na mocy prawa</strong> – organy państwowe, sądy (jeśli wymagają tego przepisy).</li>
              </ul>
              <p className="text-[#1a1a1a]/80 dark:text-[#E0E0E0]/80 mt-4">
                Wszyscy odbiorcy danych działają na podstawie umów powierzenia przetwarzania danych osobowych i są zobowiązani do zachowania ich poufności oraz stosowania odpowiednich środków bezpieczeństwa.
              </p>
            </section>

            <section className="mt-8">
              <h2 className="text-2xl font-bold text-[#1a1a1a] dark:text-[#E0E0E0] mt-8 mb-4">
                7. Transfer danych poza EOG
              </h2>
              <p className="text-[#1a1a1a]/80 dark:text-[#E0E0E0]/80">
                Niektórzy dostawcy usług (np. Stripe, Google AI) mogą przetwarzać dane poza Europejskim Obszarem Gospodarczym (EOG). W takich przypadkach:
              </p>
              <ul className="list-disc list-inside text-[#1a1a1a]/80 dark:text-[#E0E0E0]/80 space-y-1 mt-4">
                <li>Zapewniamy odpowiednie zabezpieczenia zgodnie z RODO (standardowe klauzule umowne zatwierdzzone przez Komisję Europejską).</li>
                <li>Transfer odbywa się wyłącznie do krajów zapewniających odpowiedni poziom ochrony danych lub do podmiotów stosujących odpowiednie gwarancje.</li>
              </ul>
            </section>

            <section className="mt-8">
              <h2 className="text-2xl font-bold text-[#1a1a1a] dark:text-[#E0E0E0] mt-8 mb-4">
                8. Prawa użytkowników
              </h2>
              <p className="text-[#1a1a1a]/80 dark:text-[#E0E0E0]/80">
                Zgodnie z RODO przysługują Państwu następujące prawa:
              </p>

              <h3 className="text-xl font-semibold text-[#1a1a1a] dark:text-[#E0E0E0] mt-6 mb-3">
                8.1. Prawo dostępu do danych (art. 15 RODO)
              </h3>
              <p className="text-[#1a1a1a]/80 dark:text-[#E0E0E0]/80">
                Mają Państwo prawo uzyskać potwierdzenie, czy przetwarzamy Państwa dane osobowe,
                a jeśli tak – uzyskać do nich dostęp oraz otrzymać ich kopię.
              </p>

              <h3 className="text-xl font-semibold text-[#1a1a1a] dark:text-[#E0E0E0] mt-6 mb-3">
                8.2. Prawo do sprostowania danych (art. 16 RODO)
              </h3>
              <p className="text-[#1a1a1a]/80 dark:text-[#E0E0E0]/80">
                Mają Państwo prawo żądać niezwłocznego sprostowania nieprawidłowych danych
                lub uzupełnienia niekompletnych danych.
              </p>

              <h3 className="text-xl font-semibold text-[#1a1a1a] dark:text-[#E0E0E0] mt-6 mb-3">
                8.3. Prawo do usunięcia danych – „prawo do bycia zapomnianym" (art. 17 RODO)
              </h3>
              <p className="text-[#1a1a1a]/80 dark:text-[#E0E0E0]/80">
                W określonych przypadkach mają Państwo prawo żądać usunięcia danych osobowych.
              </p>

              <h3 className="text-xl font-semibold text-[#1a1a1a] dark:text-[#E0E0E0] mt-6 mb-3">
                8.4. Prawo do ograniczenia przetwarzania (art. 18 RODO)
              </h3>
              <p className="text-[#1a1a1a]/80 dark:text-[#E0E0E0]/80">
                W określonych sytuacjach możecie Państwo żądać ograniczenia przetwarzania danych.
              </p>

              <h3 className="text-xl font-semibold text-[#1a1a1a] dark:text-[#E0E0E0] mt-6 mb-3">
                8.5. Prawo do przenoszenia danych (art. 20 RODO)
              </h3>
              <p className="text-[#1a1a1a]/80 dark:text-[#E0E0E0]/80">
                Macie Państwo prawo otrzymać swoje dane w ustrukturyzowanym, powszechnie używanym
                formacie nadającym się do odczytu maszynowego i przesłać je innemu administratorowi.
              </p>

              <h3 className="text-xl font-semibold text-[#1a1a1a] dark:text-[#E0E0E0] mt-6 mb-3">
                8.6. Prawo sprzeciwu (art. 21 RODO)
              </h3>
              <p className="text-[#1a1a1a]/80 dark:text-[#E0E0E0]/80">
                Macie Państwo prawo wnieść sprzeciw wobec przetwarzania danych w celach marketingowych lub na podstawie prawnie uzasadnionego interesu.
              </p>

              <h3 className="text-xl font-semibold text-[#1a1a1a] dark:text-[#E0E0E0] mt-6 mb-3">
                8.7. Prawo do cofnięcia zgody (art. 7 ust. 3 RODO)
              </h3>
              <p className="text-[#1a1a1a]/80 dark:text-[#E0E0E0]/80">
                Jeśli przetwarzanie odbywa się na podstawie zgody, macie Państwo prawo ją cofnąć w dowolnym momencie.
              </p>

              <h3 className="text-xl font-semibold text-[#1a1a1a] dark:text-[#E0E0E0] mt-6 mb-3">
                8.8. Prawo wniesienia skargi do organu nadzorczego (art. 77 RODO)
              </h3>
              <p className="text-[#1a1a1a]/80 dark:text-[#E0E0E0]/80">
                Macie Państwo prawo wnieść skargę do Prezesa Urzędu Ochrony Danych Osobowych (PUODO),
                jeśli uważacie, że przetwarzanie Waszych danych narusza przepisy RODO.
              </p>
              <p className="text-[#1a1a1a]/80 dark:text-[#E0E0E0]/80 mt-2">
                <strong>Kontakt do PUODO:</strong><br />
                ul. Stawki 2, 00-193 Warszawa<br />
                <a href="https://uodo.gov.pl" className="text-blue-600 dark:text-blue-400 hover:underline">https://uodo.gov.pl</a>
              </p>

              <p className="text-[#1a1a1a]/80 dark:text-[#E0E0E0]/80 mt-6">
                <strong>W celu skorzystania z powyższych praw prosimy o kontakt poprzez email lub formularz kontaktowy.</strong>
              </p>
            </section>

            <section className="mt-8">
              <h2 className="text-2xl font-bold text-[#1a1a1a] dark:text-[#E0E0E0] mt-8 mb-4">
                9. Pliki cookies i technologie śledzące
              </h2>

              <h3 className="text-xl font-semibold text-[#1a1a1a] dark:text-[#E0E0E0] mt-6 mb-3">
                9.1. Czym są cookies?
              </h3>
              <p className="text-[#1a1a1a]/80 dark:text-[#E0E0E0]/80">
                Cookies to małe pliki tekstowe zapisywane na urządzeniu użytkownika podczas odwiedzania strony internetowej.
              </p>

              <h3 className="text-xl font-semibold text-[#1a1a1a] dark:text-[#E0E0E0] mt-6 mb-3">
                9.2. Jakie cookies stosujemy?
              </h3>
              <ul className="list-disc list-inside text-[#1a1a1a]/80 dark:text-[#E0E0E0]/80 space-y-2 mt-4">
                <li><strong>Cookies niezbędne</strong> – zapewniają podstawowe funkcjonalności strony (sesja użytkownika, koszyk, logowanie).</li>
                <li><strong>Cookies funkcjonalne</strong> – zapamiętują Wasze preferencje (np. tryb ciemny).</li>
                <li><strong>Cookies analityczne</strong> – pomagają nam zrozumieć, jak użytkownicy korzystają ze strony (anonimowe dane).</li>
                <li><strong>Cookies marketingowe</strong> – używane do personalizacji reklam (tylko za zgodą).</li>
              </ul>

              <h3 className="text-xl font-semibold text-[#1a1a1a] dark:text-[#E0E0E0] mt-6 mb-3">
                9.3. Zarządzanie cookies
              </h3>
              <p className="text-[#1a1a1a]/80 dark:text-[#E0E0E0]/80">
                Możecie Państwo zarządzać cookies poprzez ustawienia przeglądarki. Należy jednak pamiętać,
                że wyłączenie cookies może wpłynąć na funkcjonalność Serwisu (np. logowanie, koszyk zakupowy).
              </p>
            </section>

            <section className="mt-8">
              <h2 className="text-2xl font-bold text-[#1a1a1a] dark:text-[#E0E0E0] mt-8 mb-4">
                10. Bezpieczeństwo danych
              </h2>
              <p className="text-[#1a1a1a]/80 dark:text-[#E0E0E0]/80">
                Stosujemy odpowiednie środki techniczne i organizacyjne w celu ochrony danych osobowych przed:
              </p>
              <ul className="list-disc list-inside text-[#1a1a1a]/80 dark:text-[#E0E0E0]/80 space-y-1 mt-4">
                <li>nieautoryzowanym dostępem,</li>
                <li>utratą,</li>
                <li>zniszczeniem,</li>
                <li>nieuprawnioną modyfikacją,</li>
                <li>nieuprawnioną dystrybucją.</li>
              </ul>
              <p className="text-[#1a1a1a]/80 dark:text-[#E0E0E0]/80 mt-4">
                W szczególności stosujemy:
              </p>
              <ul className="list-disc list-inside text-[#1a1a1a]/80 dark:text-[#E0E0E0]/80 space-y-1 mt-2">
                <li>szyfrowanie połączeń SSL/TLS (HTTPS),</li>
                <li>bezpieczne przechowywanie haseł (algorytm bcrypt z solą),</li>
                <li>zabezpieczenie sesji użytkownika (ciasteczka HttpOnly, Secure),</li>
                <li>ograniczenie dostępu do danych wyłącznie dla upoważnionych osób,</li>
                <li>regularne aktualizacje oprogramowania i systemu,</li>
                <li>monitorowanie bezpieczeństwa infrastruktury,</li>
                <li>regularne kopie zapasowe bazy danych.</li>
              </ul>
            </section>

            <section className="mt-8">
              <h2 className="text-2xl font-bold text-[#1a1a1a] dark:text-[#E0E0E0] mt-8 mb-4">
                11. Zautomatyzowane podejmowanie decyzji i profilowanie
              </h2>
              <p className="text-[#1a1a1a]/80 dark:text-[#E0E0E0]/80">
                W ramach Serwisu nie stosujemy zautomatyzowanego podejmowania decyzji, w tym profilowania,
                które wywołałoby skutki prawne wobec Użytkowników lub w podobny sposób istotnie wpływało na ich sytuację.
              </p>
              <p className="text-[#1a1a1a]/80 dark:text-[#E0E0E0]/80 mt-4">
                AI Chat (Google Gemini) jest narzędziem wspomagającym, które odpowiada na zapytania użytkowników,
                ale nie podejmuje zautomatyzowanych decyzji mających wpływ prawny.
              </p>
            </section>

            <section className="mt-8">
              <h2 className="text-2xl font-bold text-[#1a1a1a] dark:text-[#E0E0E0] mt-8 mb-4">
                12. Dane dzieci
              </h2>
              <p className="text-[#1a1a1a]/80 dark:text-[#E0E0E0]/80">
                Serwis KalkMate.pl może być używany przez osoby niepełnoletnie (uczniowie szkół średnich).
                Jeśli użytkownik nie ukończył 18 lat, zakup kalkulatora i korzystanie z AI Chat wymaga zgody rodzica lub opiekuna prawnego.
              </p>
              <p className="text-[#1a1a1a]/80 dark:text-[#E0E0E0]/80 mt-4">
                Nie zbieramy świadomie danych osobowych dzieci poniżej 13. roku życia bez zgody rodziców/opiekunów.
              </p>
            </section>

            <section className="mt-8">
              <h2 className="text-2xl font-bold text-[#1a1a1a] dark:text-[#E0E0E0] mt-8 mb-4">
                13. Zmiany Polityki Prywatności
              </h2>
              <p className="text-[#1a1a1a]/80 dark:text-[#E0E0E0]/80">
                Polityka Prywatności może ulegać zmianom w związku z rozwojem technologii, zmianami przepisów prawa lub zmianami w działalności Serwisu.
              </p>
              <p className="text-[#1a1a1a]/80 dark:text-[#E0E0E0]/80 mt-4">
                O wszelkich istotnych zmianach poinformujemy Użytkowników poprzez:
              </p>
              <ul className="list-disc list-inside text-[#1a1a1a]/80 dark:text-[#E0E0E0]/80 space-y-1 mt-2">
                <li>komunikat na stronie głównej Serwisu,</li>
                <li>wiadomość email (dla zarejestrowanych użytkowników).</li>
              </ul>
              <p className="text-[#1a1a1a]/80 dark:text-[#E0E0E0]/80 mt-4">
                Aktualna wersja Polityki Prywatności jest zawsze dostępna pod adresem: <a href="/polityka-prywatnosci" className="text-blue-600 dark:text-blue-400 hover:underline">https://kalkmate.pl/polityka-prywatnosci</a>
              </p>
            </section>

            <section className="mt-8">
              <h2 className="text-2xl font-bold text-[#1a1a1a] dark:text-[#E0E0E0] mt-8 mb-4">
                14. Kontakt w sprawach prywatności
              </h2>
              <p className="text-[#1a1a1a]/80 dark:text-[#E0E0E0]/80">
                Wszelkie pytania dotyczące przetwarzania danych osobowych oraz korzystania z przysługujących Państwu praw prosimy kierować na:
              </p>
              <ul className="list-disc list-inside text-[#1a1a1a]/80 dark:text-[#E0E0E0]/80 space-y-1 mt-4">
                <li>Email: podany w stopce strony,</li>
                <li>Formularz kontaktowy dostępny na stronie.</li>
              </ul>
              <p className="text-[#1a1a1a]/80 dark:text-[#E0E0E0]/80 mt-4">
                Zobowiązujemy się odpowiedzieć na Państwa zapytania w ciągu 30 dni od ich otrzymania.
              </p>
            </section>

            <div className="mt-12 p-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-[#1a1a1a]/80 dark:text-[#E0E0E0]/80 font-semibold">
                Dziękujemy za zaufanie i korzystanie z KalkMate.pl. Przykładamy szczególną wagę do ochrony Państwa prywatności i bezpieczeństwa danych osobowych.
              </p>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
