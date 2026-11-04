import { A, B, Callout, CalloutP, CompanyBox, OL, P, TierTable, type LegalDoc } from "@/components/legal/LegalPage";

// Regulamin sklepu — wersja polska (WIAZACA). Tlumaczenia w sasiednich plikach
// (en.tsx, de.tsx, ...) maja te same sekcje i kotwice; zmiana tresci tutaj =
// zmiana we wszystkich tlumaczeniach.
const doc: LegalDoc = {
  metaTitle: "Regulamin sklepu: zamówienia, zwroty i gwarancja | KalkMate",
  metaDescription:
    "Regulamin sklepu KalkMate: zamówienia, płatności (Przelewy24, karta), darmowa dostawa InPost, 14 dni na zwrot, 24 miesiące gwarancji i czat z asystentem AI.",
  badge: "Zgodny z ustawą o prawach konsumenta",
  dateLabel: "Obowiązuje od · 2026-01-01",
  eyebrow: "[ regulamin ] · 11 sekcji",
  h1: "Regulamin",
  h1Accent: "sklepu",
  intro: "Zasady składania zamówień, płatności, dostawy, zwrotów i reklamacji w sklepie internetowym kalkmate.pl.",
  sections: [
    {
      id: "sek-1", eyebrow: "01", short: "Postanowienia ogólne", title: "Postanowienia", accent: "ogólne",
      body: (
        <>
          <P>
            Niniejszy regulamin określa zasady sprzedaży produktów w sklepie internetowym
            dostępnym pod adresem kalkmate.pl, prowadzonym przez <B>Kacpra Popko</B>{" "}
            prowadzącego działalność gospodarczą pod firmą <B>KAJPA Kacper Popko</B>,
            zwanego dalej „Sprzedawcą”.
          </P>
          <CompanyBox
            rows={[
              { label: "NIP", value: "9662222951", mono: true },
              { label: "REGON", value: "545011444", mono: true },
              { label: "Adres siedziby", value: "ul. Zastawie I 37, 16-070 Choroszcz", wide: true },
            ]}
          />
        </>
      ),
    },
    {
      id: "sek-2", eyebrow: "02", short: "Zamówienia", title: "Zamówienia", accent: "",
      body: (
        <OL>
          <li>Zamówienia przyjmowane są przez stronę internetową kalkmate.pl przez całą dobę, 7 dni w tygodniu.</li>
          <li>Złożenie zamówienia jest równoznaczne z akceptacją niniejszego regulaminu.</li>
          <li>Po złożeniu zamówienia Kupujący otrzymuje potwierdzenie na podany adres e-mail.</li>
          <li>Sprzedawca zastrzega sobie prawo do odmowy realizacji zamówienia w uzasadnionych przypadkach.</li>
        </OL>
      ),
    },
    {
      id: "sek-3", eyebrow: "03", short: "Ceny i płatności", title: "Ceny", accent: "i płatności",
      body: (
        <OL>
          <li>Wszystkie ceny podane na stronie są cenami brutto (zawierają podatek VAT).</li>
          <li>Płatności obsługiwane są przez serwis Przelewy24 (PayPro SA, ul. Kanclerska 15, 60-327 Poznań).</li>
          <li>Dostępne metody płatności: karta płatnicza, BLIK, przelew bankowy oraz inne metody dostępne w serwisie Przelewy24.</li>
        </OL>
      ),
    },
    {
      id: "sek-4", eyebrow: "04", short: "Realizacja i dostawa", title: "Realizacja", accent: "i dostawa",
      body: (
        <OL>
          <li>Produkt KalkMate jest wytwarzany na zamówienie jako produkcja własna.</li>
          <li>Termin realizacji wynosi do 4 tygodni od momentu zaksięgowania płatności. Standardowy czas realizacji to 1–2 tygodnie.</li>
          <li>Dostawa na terenie Polski realizowana jest za pośrednictwem InPost (paczkomat). Koszt dostawy w Polsce: 0 zł.</li>
          <li>Dostawa zagraniczna (kraje UE): 20 EUR. Dostawa poza UE: 35 EUR.</li>
          <li>Kupujący otrzymuje numer śledzenia przesyłki po jej nadaniu.</li>
        </OL>
      ),
    },
    {
      id: "sek-5", eyebrow: "05", short: "Prawo do odstąpienia", title: "Prawo", accent: "odstąpienia",
      body: (
        <>
          <P>
            Konsument ma prawo odstąpić od umowy zawartej na odległość w terminie 14 dni
            kalendarzowych bez podania przyczyny, z zastrzeżeniem wyjątku opisanego poniżej.
          </P>
          <Callout title="Wyjątek — urządzenie personalizowane na zamówienie">
            <CalloutP>
              Każdy egzemplarz urządzenia KalkMate jest indywidualnie personalizowany na
              życzenie Konsumenta przed wysyłką: (a) wgrywany jest wybrany przez Konsumenta
              w formularzu zamówienia kod odblokowania funkcji AI oraz (b) na etykiecie danego
              egzemplarza drukowane jest podane przez Konsumenta imię/nick. Zgodnie z{" "}
              <B>art. 38 pkt 3 ustawy z dnia 30 maja 2014 r. o prawach konsumenta</B>,
              prawo odstąpienia od umowy nie przysługuje w odniesieniu do rzeczy wyprodukowanej
              według specyfikacji konsumenta lub służącej zaspokojeniu jego zindywidualizowanych
              potrzeb. Informacja ta oraz wymóg wyrażenia odrębnej zgody są przedstawiane
              Konsumentowi przed zawarciem umowy, w formularzu zamówienia.
            </CalloutP>
            <CalloutP className="mt-3">
              Wyjątek ten <B>nie dotyczy</B> zakupów pakietów
              (doładowań) tokenów AI, dla których prawo odstąpienia obowiązuje na zasadach ogólnych.
            </CalloutP>
          </Callout>
          <div className="mt-6">
            <P>
              Poniższe ustępy dotyczą przypadków, w których prawo odstąpienia przysługuje
              (tj. zakupów innych niż spersonalizowane urządzenie KalkMate):
            </P>
          </div>
          <OL>
            <li>Termin do odstąpienia od umowy wygasa po upływie 14 dni od dnia, w którym Konsument wszedł w posiadanie rzeczy.</li>
            <li>Aby skorzystać z prawa odstąpienia, Konsument musi poinformować Sprzedawcę o swojej decyzji drogą mailową na adres: <B>kontakt@kalkmate.pl</B>.</li>
            <li>
              Zwrotu towaru należy dokonać na adres: <B>KalkMate, ul. Zastawie I 37, 16-070 Choroszcz</B>.
              Zwrot płatności następuje w terminie do 14 dni od dnia otrzymania zwracanego towaru.
              Jeżeli Konsument wyraźnie zażądał rozpoczęcia świadczenia usługi (np. rozwiązań AI)
              przed upływem terminu do odstąpienia, Sprzedawca ma prawo potrącić z kwoty zwrotu
              wynagrodzenie za usługi faktycznie spełnione do chwili odstąpienia (art. 35 ustawy
              o prawach konsumenta), a w przypadku zwracanej rzeczy noszącej ślady użytkowania
              wykraczające poza konieczne do stwierdzenia charakteru i funkcjonowania towaru —
              także kwotę odpowiadającą zmniejszeniu jej wartości (art. 34 ust. 4 ustawy o prawach konsumenta).
            </li>
            <li>Prawo do reklamacji z tytułu rękojmi i gwarancji (§6) przysługuje niezależnie od powyższych postanowień i nie jest przez nie ograniczane.</li>
          </OL>
        </>
      ),
    },
    {
      id: "sek-6", eyebrow: "06", short: "Reklamacje i gwarancja", title: "Reklamacje", accent: "i gwarancja",
      body: (
        <OL>
          <li>Produkty objęte są gwarancją Sprzedawcy na okres 24 miesięcy od daty zakupu.</li>
          <li>Reklamacje należy zgłaszać drogą mailową na adres: <B>kontakt@kalkmate.pl</B>, podając numer zamówienia i opis usterki.</li>
          <li>Sprzedawca rozpatruje reklamacje w terminie do 14 dni kalendarzowych.</li>
        </OL>
      ),
    },
    {
      id: "sek-7", eyebrow: "07", short: "Ochrona danych osobowych", title: "Ochrona", accent: "danych",
      body: (
        <OL>
          <li>Administratorem danych osobowych jest Sprzedawca.</li>
          <li>Dane osobowe przetwarzane są wyłącznie w celu realizacji zamówienia i nie są udostępniane podmiotom trzecim, z wyjątkiem firm kurierskich i operatorów płatności.</li>
          <li>Kupującemu przysługuje prawo wglądu do swoich danych, ich poprawiania oraz żądania usunięcia.</li>
          <li>
            Strona wykorzystuje pliki cookies, w tym narzędzie analityczne Microsoft Clarity
            (mapy ciepła, nagrania sesji), ładowane wyłącznie po wyrażeniu zgody w bannerze
            cookies. Szczegóły znajdują się w{" "}
            <A href="/polityka-prywatnosci#sek-9">Polityce Prywatności</A>.
          </li>
        </OL>
      ),
    },
    {
      id: "sek-8", eyebrow: "08", short: "Czat z asystentem AI", title: "Czat", accent: "z asystentem AI",
      body: (
        <OL>
          <li>
            Na stronie kalkmate.pl Sprzedawca udostępnia bezpłatną usługę świadczoną drogą elektroniczną:
            czat z asystentem, którego odpowiedzi generuje <B>sztuczna inteligencja (AI)</B>.
            Asystent nie jest człowiekiem. Odpowiada na pytania o produkty, zamówienia i działanie kalkulatora.
          </li>
          <li>
            Do rozpoczęcia rozmowy potrzebne są: przeglądarka internetowa z włączonym JavaScriptem, podanie adresu
            e-mail, potwierdzenie, że użytkownik nie jest automatem (weryfikacja wykonywana w przeglądarce), oraz
            akceptacja niniejszego paragrafu. Umowa o świadczenie usługi zostaje zawarta z chwilą rozpoczęcia rozmowy
            i rozwiązuje się z chwilą jej zakończenia (przycisk „Zakończ” lub zamknięcie strony). Użytkownik może
            w każdej chwili przestać korzystać z czatu.
          </li>
          <li>
            Odpowiedzi asystenta mają charakter wyłącznie informacyjny, mogą zawierać błędy i nie stanowią oferty
            w rozumieniu Kodeksu cywilnego ani oświadczenia woli Sprzedawcy. W razie rozbieżności wiążące są
            niniejszy regulamin, opis produktu na stronie oraz informacje przekazane w potwierdzeniu zamówienia.
            Asystent nie ma dostępu do zamówień ani kont — sprawy konkretnych zamówień, zwrotów i reklamacji należy
            kierować na adres kontakt@kalkmate.pl.
          </li>
          <li>
            Sprzedawca może odpowiedzieć na pytanie z czatu wiadomością e-mail na podany adres, w szczególności gdy
            asystent nie zna odpowiedzi.
          </li>
          <li>
            Zabronione jest przesyłanie w czacie treści bezprawnych, obraźliwych lub naruszających prawa osób trzecich,
            a także danych szczególnie chronionych, haseł, danych kart płatniczych i kodu AI kalkulatora. Sprzedawca
            może zablokować rozmowę naruszającą te zasady oraz stosować limity liczby wiadomości.
          </li>
          <li>
            Asystent może sam zaproponować pomoc, wyświetlając krótką wiadomość obok przycisku czatu (np. po pewnym
            czasie na stronie lub przy cenniku). Taka wiadomość pojawia się najwyżej dwa razy w trakcie wizyty i nie
            pojawia się ponownie po jej zamknięciu.
          </li>
          <li>
            Treść rozmów, adres e-mail i informacje techniczne (strona, z której wysłano wiadomość, przeglądarka)
            są zapisywane i dostępne dla Sprzedawcy oraz upoważnionych przez niego osób w celu obsługi pytań
            i ulepszania obsługi klienta. Jeżeli użytkownik wyraził zgodę na cookies analityczne, do rozmowy
            przypisywany jest także przebieg wizyty na stronie (odwiedzone podstrony i obejrzane sekcje) oraz
            identyfikator nagrania sesji w Microsoft Clarity. Szczegóły, podstawy prawne i okres przechowywania
            (12 miesięcy od ostatniej wiadomości) opisuje{" "}
            <A href="/polityka-prywatnosci#sek-3">Polityka Prywatności</A>.
          </li>
          <li>
            Osoby, które nie ukończyły 16 lat, mogą korzystać z czatu za zgodą rodzica lub opiekuna prawnego.
          </li>
          <li>
            Reklamacje dotyczące działania czatu można składać na adres kontakt@kalkmate.pl. Sprzedawca rozpatruje
            je w terminie 14 dni.
          </li>
        </OL>
      ),
    },
    {
      // Zewnetrzne linki (panel klienta) uzywaja #program-partnerski.
      id: "sek-9", eyebrow: "09", short: "Program partnerski", title: "Program", accent: "partnerski",
      wrapperId: "program-partnerski",
      body: (
        <OL>
          <li>
            Uczestnikiem programu partnerskiego („Partnerem”) może być zarejestrowany użytkownik serwisu kalkmate.pl
            z potwierdzonym adresem e-mail. Partner tworzy w panelu klienta jeden własny kod partnerski
            (od 4 do 16 znaków: litery A–Z i cyfry).
          </li>
          <li>
            Kupujący, który poda kod partnerski przy zamówieniu, otrzymuje <B>7% rabatu</B>{" "}
            od ceny produktów. Kodu partnerskiego nie łączy się z innymi kuponami rabatowymi (formularz zamówienia
            przyjmuje jeden kod). Partner nie może użyć własnego kodu.
          </li>
          <li>
            Za każde opłacone zamówienie z kodem Partner otrzymuje prowizję liczoną od wartości produktów po rabacie,
            bez kosztów dostawy. Wysokość prowizji zależy od poziomu Partnera, ustalanego na podstawie liczby sztuk
            sprzedanych z jego kodem przed danym zamówieniem:
            <TierTable
              head={["Poziom", "Sprzedane sztuki", "Prowizja"]}
              rows={[
                ["Start", "0–2", "5%"],
                ["Brąz", "3–9", "7%"],
                ["Srebro", "10–24", "9%"],
                ["Złoto", "25–49", "11%"],
                ["Diament", "od 50", "13%"],
              ]}
            />
            <span className="block mt-3">
              Prowizje rozliczane są w złotych; wartość zamówień w EUR przeliczana jest po stałym kursie 4,25 zł za 1 EUR.
            </span>
          </li>
          <li>
            Prowizja staje się dostępna po 30 dniach od opłacenia zamówienia. Prowizja jest cofana w przypadku
            anulowania zamówienia, zwrotu płatności lub sporu dotyczącego płatności — również wtedy, gdy została już
            wymieniona lub wypłacona; saldo Partnera może wówczas stać się ujemne i jest wyrównywane z kolejnych prowizji.
          </li>
          <li>
            Dostępne środki Partner może: (a) wymienić na tokeny AI — od 10 zł, po kursie 1 zł = 65 000 tokenów,
            natychmiast; (b) wypłacić przelewem na rachunek bankowy — od 100 zł, wyłącznie jeśli Partner jest osobą
            pełnoletnią. Wypłata realizowana jest zwykle w ciągu 7 dni roboczych. Przed wypłatą Sprzedawca może
            poprosić o dane niezbędne do rozliczeń podatkowych.
          </li>
          <li>
            Zabronione jest: rozsyłanie spamu, podszywanie się pod KalkMate lub Sprzedawcę, reklamy w wyszukiwarkach
            na hasła zawierające markę KalkMate, polecanie samemu sobie oraz składanie fikcyjnych zamówień. W razie
            naruszeń Sprzedawca może wyłączyć kod partnerski i anulować nienależne prowizje.
          </li>
          <li>
            Sprzedawca może zmienić warunki programu partnerskiego z wyprzedzeniem 14 dni, informując o tym na stronie.
            Zmiany nie dotyczą prowizji naliczonych przed ich wejściem w życie.
          </li>
        </OL>
      ),
    },
    {
      // Kotwica "wypozyczenie" (nie "sek-N") — linki z /wypozyczenie i maili najmu.
      // Najem tylko w Polsce, wiec sekcja jest tylko w wersji polskiej.
      id: "wypozyczenie", eyebrow: "10", short: "Wypożyczenie kalkulatora", title: "Wypożyczenie", accent: "kalkulatora",
      body: (
        <OL>
          <li>
            Sprzedawca (dalej w tym paragrafie: „Wynajmujący”) oddaje w najem kalkulator KalkMate wraz z dostępem
            do funkcji AI na czas najmu. Kalkulator pozostaje własnością Wynajmującego. Najem jest dostępny wyłącznie
            z dostawą do Paczkomatu InPost na terenie Polski i zamawiany przez stronę <A href="/wypozyczenie">kalkmate.pl/wypozyczenie</A>.
          </li>
          <li>
            Najemcą może być wyłącznie osoba pełnoletnia, posiadająca pełną zdolność do czynności prawnych. Najemca może
            udostępnić kalkulator domownikowi (np. dziecku-uczniowi), odpowiadając za niego jak za siebie. Zakazany jest
            podnajem i udostępnianie kalkulatora osobom trzecim w zamian za wynagrodzenie.
          </li>
          <li>
            Okres najmu i opłata wynikają z cennika na stronie zamówienia (7, 30 lub 60 dni). Okres najmu liczony jest
            od dnia nadania przesyłki przez Wynajmującego i jest wydłużony o 3 dni na dostawę i odesłanie kalkulatora.
            Datę końca najmu Najemca otrzymuje e-mailem.
          </li>
          <li>
            Opłata za najem oraz zwrotna kaucja w wysokości <B>300 zł</B> płatne są z góry przez Przelewy24, wyłącznie
            BLIK-iem lub przelewem. Kaucja nie stanowi wynagrodzenia Wynajmującego.
          </li>
          <li>
            Po upływie okresu najmu funkcje AI kalkulatora są automatycznie wyłączane; kalkulator działa dalej jako zwykły
            kalkulator. Najemca zobowiązany jest nadać kalkulator (kompletny, z kablem, jeśli był w przesyłce) najpóźniej
            w ostatnim dniu najmu na adres: <B>KalkMate, ul. Zastawie I 37, 16-070 Choroszcz</B>, przesyłką z numerem
            śledzenia. Koszt odesłania pokrywa Najemca.
          </li>
          <li>
            Kaucja zwracana jest w terminie 7 dni od otrzymania przez Wynajmującego sprawnego kalkulatora, na rachunek,
            z którego dokonano płatności. Wynajmujący może potrącić z kaucji:
            (a) <B>10 zł za każdy dzień opóźnienia</B> w odesłaniu kalkulatora, licząc od 8. dnia po końcu najmu;
            (b) udokumentowany koszt naprawy uszkodzeń powstałych z winy Najemcy (zwykłe zużycie nie obciąża Najemcy).
            O potrąceniu Wynajmujący informuje e-mailem, podając jego podstawę i wysokość.
          </li>
          <li>
            Jeżeli kalkulator nie zostanie odesłany w ciągu 30 dni od końca najmu albo zostanie utracony, kaucja przepada
            na poczet jego wartości, a Wynajmujący może dochodzić od Najemcy pozostałej części wartości kalkulatora
            (według ceny sprzedaży nowego egzemplarza na kalkmate.pl), pomniejszonej o przepadłą kaucję.
          </li>
          <li>
            Najemca nie może otwierać obudowy, przerabiać kalkulatora ani wgrywać na niego oprogramowania. W razie naruszenia
            tych zasad lub zwłoki w zwrocie Wynajmujący może zdalnie wyłączyć funkcje AI, a na ekranie kalkulatora może
            wyświetlić się informacja o konieczności zwrotu.
          </li>
          <li>
            Usterkę niezawinioną przez Najemcę Wynajmujący usuwa na swój koszt (naprawa lub wymiana egzemplarza), a okres
            najmu przedłuża o czas, w którym kalkulator nie działał. Usterki należy zgłaszać na kontakt@kalkmate.pl.
          </li>
          <li>
            Najem można przedłużyć przed jego końcem — po zgłoszeniu e-mailem i dopłacie według cennika.
          </li>
          <li>
            Najemca będący konsumentem może odstąpić od umowy najmu w terminie 14 dni od otrzymania kalkulatora bez podania
            przyczyny (§5). Jeżeli przed upływem tego terminu korzystał z kalkulatora, Wynajmujący może potrącić opłatę
            proporcjonalną do liczby dni faktycznego korzystania. Kaucja zwracana jest w całości po zwrocie sprawnego kalkulatora.
          </li>
          <li>
            Po zwrocie kalkulator jest przywracany do ustawień fabrycznych: notatki, sprawdziany, historia rozwiązań i powiązanie
            z kontem Najemcy są usuwane z urządzenia. Dane osobowe Najemcy (imię i nazwisko, adres, telefon, e-mail) przetwarzane
            są w celu wykonania umowy najmu i rozliczenia kaucji — zob. <A href="/polityka-prywatnosci">Polityka Prywatności</A>.
          </li>
        </OL>
      ),
    },
    {
      id: "sek-10", eyebrow: "11", short: "Postanowienia końcowe", title: "Postanowienia", accent: "końcowe",
      body: (
        <OL>
          <li>W sprawach nieuregulowanych niniejszym regulaminem stosuje się przepisy Kodeksu Cywilnego, ustawy o prawach konsumenta oraz ustawy o świadczeniu usług drogą elektroniczną.</li>
          <li>Sprzedawca zastrzega sobie prawo do zmiany regulaminu. Zmiany wchodzą w życie z dniem publikacji na stronie.</li>
          <li>Wszelkie spory rozstrzygane będą przez sąd właściwy dla siedziby Sprzedawcy.</li>
        </OL>
      ),
    },
  ],
  thanks: (
    <>
      Dziękujemy za zaufanie i zakup KalkMate. W razie pytań dotyczących zamówienia,
      zwrotu lub reklamacji — jesteśmy pod ręką pod adresem kontakt@kalkmate.pl.
    </>
  ),
  footerNote: "Obowiązuje od · 2026-01-01 · ostatnia zmiana 2026-11-04 (§10 wypożyczenie kalkulatora)",
  otherDocLabel: "→ Polityka prywatności",
  homeLabel: "← Strona główna",
};

export default doc;

