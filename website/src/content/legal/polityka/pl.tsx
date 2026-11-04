import { A, B, BasisTable, CompanyBox, Gap, InfoBox, Mono, P, SubH, UL, ULWide, type LegalDoc } from "@/components/legal/LegalPage";

// Polityka prywatnosci — wersja polska (WIAZACA). Tlumaczenia w sasiednich
// plikach (en.tsx, de.tsx, ...) maja te same sekcje i kotwice (sek-3, sek-9
// sa linkowane z regulaminu, bannera cookies i czatu).
const doc: LegalDoc = {
  metaTitle: "Polityka prywatności: RODO i cookies | KalkMate",
  metaDescription:
    "Jak KalkMate chroni Twoje dane: co zbieramy i po co, jak długo przechowujemy, cookies i Microsoft Clarity, czat z AI oraz Twoje prawa wynikające z RODO.",
  badge: "RODO · zgodne z UE 2016/679",
  dateLabel: "Aktualizacja · 2026-10-28",
  eyebrow: "[ prywatność ] · 14 sekcji",
  h1: "Polityka",
  h1Accent: "prywatności",
  intro: "Jakie dane zbieramy, dlaczego je przetwarzamy, kto ma do nich dostęp i jak możecie skorzystać ze swoich praw. Zgodnie z RODO.",
  sections: [
    {
      id: "sek-1", eyebrow: "01", short: "Postanowienia ogólne", title: "Postanowienia", accent: "ogólne",
      body: (
        <>
          <P>
            Niniejsza Polityka Prywatności określa zasady przetwarzania i ochrony danych osobowych
            Użytkowników korzystających z serwisu KalkMate.pl (dalej: „Serwis”), prowadzonego przez
            KalkMate (dalej: „Administrator”).
          </P>
          <Gap>
            <P>
              Administrator przykłada szczególną wagę do poszanowania prywatności Użytkowników
              oraz bezpieczeństwa ich danych osobowych. Dane osobowe przetwarzane są zgodnie z
              Rozporządzeniem Parlamentu Europejskiego i Rady (UE) 2016/679 z dnia 27 kwietnia 2016 r.
              (RODO) oraz przepisami prawa krajowego.
            </P>
          </Gap>
        </>
      ),
    },
    {
      id: "sek-2", eyebrow: "02", short: "Administrator danych", title: "Administrator", accent: "danych",
      body: (
        <>
          <P>Administratorem danych osobowych zbieranych za pośrednictwem Serwisu jest:</P>
          <CompanyBox
            rows={[
              { label: "NIP", value: "9662222951", mono: true },
              { label: "REGON", value: "545011444", mono: true },
              { label: "Adres siedziby", value: "ul. Zastawie I 37, 16-070 Choroszcz" },
              { label: "Nazwa skrócona", value: "KAJPA", mono: true },
              { label: "E-mail", value: <A href="mailto:kontakt@kalkmate.pl">kontakt@kalkmate.pl</A> },
              { label: "Telefon", value: <A href="tel:+48600580888">+48 600 580 888</A>, mono: true },
            ]}
          />
          <Gap size={5}>
            <P>Kontakt z Administratorem w sprawach przetwarzania danych osobowych możliwy jest poprzez:</P>
          </Gap>
          <UL>
            <li>e-mail: <A href="mailto:kontakt@kalkmate.pl">kontakt@kalkmate.pl</A>,</li>
            <li>telefonicznie: <A href="tel:+48600580888">+48 600 580 888</A>,</li>
            <li>formularz kontaktowy dostępny na stronie.</li>
          </UL>
        </>
      ),
    },
    {
      id: "sek-3", eyebrow: "03", short: "Zakres zbieranych danych", title: "Zakres", accent: "danych",
      body: (
        <>
          <P>W ramach działalności Serwisu zbieramy następujące kategorie danych osobowych:</P>

          <SubH>3.1. Dane podawane przez użytkownika</SubH>
          <UL>
            <li>imię i nazwisko,</li>
            <li>adres email,</li>
            <li>numer telefonu,</li>
            <li>adres punktu odbioru InPost (Paczkomat).</li>
          </UL>

          <SubH>3.2. Dane zbierane automatycznie</SubH>
          <UL>
            <li>adres IP,</li>
            <li>typ i wersja przeglądarki,</li>
            <li>system operacyjny,</li>
            <li>dane o aktywności w Serwisie (odwiedzane strony, czas wizyty),</li>
            <li>informacje techniczne o urządzeniu.</li>
          </UL>

          <SubH>3.3. Dane transakcyjne</SubH>
          <UL>
            <li>historia zamówień,</li>
            <li>dane płatności (przetwarzane przez Stripe),</li>
            <li>informacje o saldzie, zakupach i aktywacjach tokenów AI (w tym aktywowanych kodach licencji z pudełka),</li>
            <li>historia konwersacji z AI Chat.</li>
          </UL>

          <SubH>3.4. Czat z asystentem AI na stronie</SubH>
          <P>Gdy rozpoczynasz rozmowę w okienku czatu na stronie (regulamin §8), przetwarzamy:</P>
          <UL>
            <li>adres e-mail podany przy rozpoczęciu rozmowy,</li>
            <li>treść Twoich wiadomości i odpowiedzi asystenta, z datą i godziną,</li>
            <li>adres podstrony, z której wysłano wiadomość, język strony i informację o przeglądarce (user-agent),</li>
            <li>
              <B>tylko jeśli zgodziłeś się na cookies analityczne</B>: przebieg
              wizyty na stronie (odwiedzone podstrony i obejrzane sekcje, z godziną) oraz identyfikator rozmowy
              dopisywany do nagrania sesji w Microsoft Clarity — dzięki temu możemy zobaczyć, czego szukałeś,
              i lepiej odpowiedzieć. Bez tej zgody przebieg wizyty nie jest zbierany.
            </li>
          </UL>
          <P>
            Potwierdzenie „Nie jestem robotem” wykonuje obliczenie w Twojej przeglądarce — nie korzysta z usług
            zewnętrznych firm i nie zapisuje cookies. Treść wiadomości jest przekazywana do dostawcy modelu AI
            (zob. sekcja 6) wyłącznie w celu wygenerowania odpowiedzi.
          </P>

          <SubH>3.5. Wypożyczenie kalkulatora</SubH>
          <P>Przy wypożyczeniu (regulamin §10) przetwarzamy dane najemcy (osoby pełnoletniej):</P>
          <UL>
            <li>imię i nazwisko, adres zamieszkania, e-mail i numer telefonu,</li>
            <li>wybrany Paczkomat, okres najmu, numer wypożyczonego kalkulatora (Device ID),</li>
            <li>dane płatności i rozliczenia kaucji (przez Przelewy24).</li>
          </UL>
          <P>
            Celem jest wykonanie umowy najmu, wysyłka, przypomnienia o końcu najmu, rozliczenie kaucji oraz — w razie
            braku zwrotu — dochodzenie roszczeń.
          </P>
        </>
      ),
    },
    {
      id: "sek-4", eyebrow: "04", short: "Cel i podstawa prawna", title: "Cel", accent: "przetwarzania",
      body: (
        <>
          <P>Przegląd celów przetwarzania i odpowiadających im podstaw prawnych z RODO.</P>
          <BasisTable
            head={["Cel przetwarzania", "Podstawa prawna RODO"]}
            rows={[
              ["Realizacja umowy sprzedaży", "Art. 6 ust. 1 lit. b) RODO"],
              ["Obsługa płatności", "Art. 6 ust. 1 lit. b) RODO"],
              ["Świadczenie usługi AI Chat", "Art. 6 ust. 1 lit. b) RODO"],
              ["Czat z asystentem AI na stronie (rozmowa, e-mail, odpowiedź mailem)", "Art. 6 ust. 1 lit. b) RODO (usługa na Twoje żądanie)"],
              ["Przegląd rozmów z czatu w celu ulepszania obsługi i asystenta", "Art. 6 ust. 1 lit. f) RODO (prawnie uzasadniony interes)"],
              ["Przypisanie przebiegu wizyty i nagrania Clarity do rozmowy", "Art. 6 ust. 1 lit. a) RODO (zgoda na cookies analityczne)"],
              ["Wysyłka produktów", "Art. 6 ust. 1 lit. b) RODO"],
              ["Wypożyczenie kalkulatora (umowa najmu, kaucja, przypomnienia)", "Art. 6 ust. 1 lit. b) RODO"],
              ["Dochodzenie roszczeń z najmu (brak zwrotu, uszkodzenia)", "Art. 6 ust. 1 lit. f) RODO (prawnie uzasadniony interes)"],
              ["Obsługa reklamacji", "Art. 6 ust. 1 lit. c) RODO (obowiązek prawny)"],
              ["Wystawianie faktur", "Art. 6 ust. 1 lit. c) RODO (obowiązek prawny)"],
              ["Marketing bezpośredni", "Art. 6 ust. 1 lit. f) RODO (prawnie uzasadniony interes)"],
              ["Analityka i statystyki", "Art. 6 ust. 1 lit. f) RODO (prawnie uzasadniony interes)"],
              ["Newsletter (jeśli wyrażono zgodę)", "Art. 6 ust. 1 lit. a) RODO (zgoda)"],
            ]}
          />
        </>
      ),
    },
    {
      id: "sek-5", eyebrow: "05", short: "Okres przechowywania", title: "Okres", accent: "przechowywania",
      body: (
        <>
          <P>
            Dane osobowe przechowujemy przez okresy wymagane przepisami prawa lub przez czas
            niezbędny do realizacji celów przetwarzania:
          </P>
          <ULWide>
            <li><B>Dane transakcyjne i faktury:</B> 5 lat od końca roku kalendarzowego, w którym powstał obowiązek podatkowy.</li>
            <li><B>Dane dotyczące umowy:</B> przez okres obowiązywania umowy oraz przez czas wymagany przepisami prawa (np. 6 lat w związku z przedawnieniem roszczeń).</li>
            <li><B>Dane związane z tokenami AI</B> (saldo, zakupy pakietów, aktywowane kody)<B>:</B> przez czas prowadzenia konta oraz 3 lata po jego usunięciu.</li>
            <li><B>Historia AI Chat:</B> przez czas prowadzenia konta (do usunięcia rozmowy lub konta przez użytkownika) oraz do 30 dni po usunięciu konta.</li>
            <li><B>Dane marketingowe (zgoda):</B> do momentu wycofania zgody lub wniesienia sprzeciwu.</li>
            <li><B>Dane analityczne:</B> do 25 miesięcy od ostatniej aktywności.</li>
            <li><B>Wypożyczenia</B> (dane najemcy, rozliczenie kaucji)<B>:</B> przez czas najmu, a następnie do upływu terminu przedawnienia roszczeń (co do zasady 6 lat, a w zakresie dokumentów księgowych — 5 lat od końca roku podatkowego).</li>
            <li><B>Rozmowy z czatu na stronie</B> (e-mail, treść, przebieg wizyty)<B>:</B> 12 miesięcy od ostatniej wiadomości w rozmowie, potem usuwane automatycznie; wcześniej — na Twoje żądanie.</li>
          </ULWide>
        </>
      ),
    },
    {
      id: "sek-6", eyebrow: "06", short: "Udostępnianie danych", title: "Udostępnianie", accent: "",
      body: (
        <>
          <P>Dane osobowe mogą być udostępniane następującym kategoriom odbiorców:</P>
          <ULWide>
            <li><B>Stripe</B> – operator płatności (przetwarzanie transakcji kartami płatniczymi, w tym zakupów pakietów tokenów AI).</li>
            <li><B>InPost</B> – firma kurierska (dostawa produktów do Paczkomatów).</li>
            <li><B>Resend</B> – usługa email (wysyłka wiadomości transakcyjnych i magic links).</li>
            <li><B>Google AI (Gemini)</B> – dostawca usługi AI Chat (przetwarzanie zapytań w chatbocie).</li>
            <li><B>OpenRouter, Inc.</B> (USA) – pośrednik w dostępie do modeli AI (m.in. Google Gemini); otrzymuje treść wiadomości z czatu na stronie i AI Chat w celu wygenerowania odpowiedzi. Nie przekazujemy mu adresu e-mail.</li>
            <li><B>Microsoft Clarity</B> – narzędzie analityczne (mapy ciepła, nagrania sesji) wykorzystywane wyłącznie po wyrażeniu zgody na cookies analityczne — zob. sekcja 9.</li>
            <li><B>Dostawca hostingu</B> – przechowywanie danych na serwerach VPS.</li>
            <li><B>Dostawca bazy danych PostgreSQL</B> – przechowywanie danych użytkowników.</li>
            <li><B>Podmioty uprawnione na mocy prawa</B> – organy państwowe, sądy (jeśli wymagają tego przepisy).</li>
          </ULWide>
          <Gap size={5}>
            <P>
              Wszyscy odbiorcy danych działają na podstawie umów powierzenia przetwarzania
              danych osobowych i są zobowiązani do zachowania ich poufności oraz stosowania
              odpowiednich środków bezpieczeństwa.
            </P>
          </Gap>
        </>
      ),
    },
    {
      id: "sek-7", eyebrow: "07", short: "Transfer poza EOG", title: "Transfer", accent: "poza EOG",
      body: (
        <>
          <P>
            Niektórzy dostawcy usług (np. Stripe, Google AI, OpenRouter, Microsoft Clarity) mogą przetwarzać
            dane poza Europejskim Obszarem Gospodarczym (EOG). W takich przypadkach:
          </P>
          <UL>
            <li>Zapewniamy odpowiednie zabezpieczenia zgodnie z RODO (standardowe klauzule umowne zatwierdzone przez Komisję Europejską).</li>
            <li>Transfer odbywa się wyłącznie do krajów zapewniających odpowiedni poziom ochrony danych lub do podmiotów stosujących odpowiednie gwarancje.</li>
          </UL>
        </>
      ),
    },
    {
      id: "sek-8", eyebrow: "08", short: "Prawa użytkowników", title: "Prawa", accent: "użytkowników",
      body: (
        <>
          <P>Zgodnie z RODO przysługują Państwu następujące prawa:</P>

          <SubH>8.1. Dostęp do danych — art. 15 RODO</SubH>
          <P>
            Mają Państwo prawo uzyskać potwierdzenie, czy przetwarzamy Państwa dane osobowe,
            a jeśli tak — uzyskać do nich dostęp oraz otrzymać ich kopię.
          </P>

          <SubH>8.2. Sprostowanie — art. 16 RODO</SubH>
          <P>
            Mają Państwo prawo żądać niezwłocznego sprostowania nieprawidłowych danych
            lub uzupełnienia niekompletnych danych.
          </P>

          <SubH>8.3. Usunięcie („prawo do bycia zapomnianym”) — art. 17 RODO</SubH>
          <P>W określonych przypadkach mają Państwo prawo żądać usunięcia danych osobowych.</P>

          <SubH>8.4. Ograniczenie przetwarzania — art. 18 RODO</SubH>
          <P>W określonych sytuacjach możecie Państwo żądać ograniczenia przetwarzania danych.</P>

          <SubH>8.5. Przenoszenie danych — art. 20 RODO</SubH>
          <P>
            Macie Państwo prawo otrzymać swoje dane w ustrukturyzowanym, powszechnie używanym
            formacie nadającym się do odczytu maszynowego i przesłać je innemu administratorowi.
          </P>

          <SubH>8.6. Sprzeciw — art. 21 RODO</SubH>
          <P>
            Macie Państwo prawo wnieść sprzeciw wobec przetwarzania danych w celach marketingowych
            lub na podstawie prawnie uzasadnionego interesu.
          </P>

          <SubH>8.7. Cofnięcie zgody — art. 7 ust. 3 RODO</SubH>
          <P>
            Jeśli przetwarzanie odbywa się na podstawie zgody, macie Państwo prawo ją cofnąć
            w dowolnym momencie.
          </P>

          <SubH>8.8. Skarga do organu nadzorczego — art. 77 RODO</SubH>
          <P>
            Macie Państwo prawo wnieść skargę do Prezesa Urzędu Ochrony Danych Osobowych (PUODO),
            jeśli uważacie, że przetwarzanie Waszych danych narusza przepisy RODO.
          </P>
          <InfoBox title="PUODO · kontakt">
            ul. Stawki 2, 00-193 Warszawa<br />
            <A href="https://uodo.gov.pl">uodo.gov.pl</A>
          </InfoBox>

          <Gap size={6}>
            <P>
              <B>W celu skorzystania z powyższych praw prosimy o kontakt poprzez email lub formularz kontaktowy.</B>
            </P>
          </Gap>
        </>
      ),
    },
    {
      id: "sek-9", eyebrow: "09", short: "Cookies", title: "Cookies", accent: "",
      body: (
        <>
          <SubH>9.1. Czym są cookies</SubH>
          <P>
            Cookies to małe pliki tekstowe zapisywane na urządzeniu użytkownika podczas
            odwiedzania strony internetowej.
          </P>

          <SubH>9.2. Jakie cookies stosujemy</SubH>
          <ULWide>
            <li><B>Niezbędne</B> — zapewniają podstawowe funkcjonalności strony (sesja użytkownika, koszyk, logowanie).</li>
            <li><B>Funkcjonalne</B> — zapamiętują Wasze preferencje (np. tryb ciemny).</li>
            <li><B>Analityczne</B> — pomagają nam zrozumieć, jak użytkownicy korzystają ze strony (mapy ciepła, nagrania sesji, statystyki odwiedzin). Wykorzystujemy do tego <B>Microsoft Clarity</B> (Microsoft Corporation).</li>
            <li><B>Marketingowe</B> — używane do personalizacji reklam (tylko za zgodą).</li>
          </ULWide>

          <SubH>9.3. Microsoft Clarity</SubH>
          <P>
            Microsoft Clarity ładowany jest wyłącznie po wyrażeniu zgody na cookies analityczne
            w bannerze zgody („Akceptuję wszystkie”). Narzędzie zapisuje na urządzeniu m.in.
            cookies <Mono>_clck</Mono>, <Mono>_clsk</Mono>, <Mono>CLID</Mono>, <Mono>ANONCHK</Mono>,{" "}
            <Mono>MR</Mono> i <Mono>SM</Mono>, służące do rozpoznania
            powracającego użytkownika, nagrywania sesji i generowania map ciepła. Dane
            przetwarzane są przez Microsoft Corporation zgodnie z{" "}
            <A href="https://learn.microsoft.com/en-us/clarity/faq">polityką prywatności Microsoft Clarity</A>.
            Zgodę można wycofać w dowolnym momencie, czyszcząc dane bannera zgody
            w ustawieniach przeglądarki (localStorage) i wybierając „Tylko niezbędne”.
          </P>

          <SubH>9.4. Pamięć przeglądarki używana przez czat</SubH>
          <P>
            Czat z asystentem zapisuje w pamięci przeglądarki (localStorage) identyfikator Twojej rozmowy, żeby
            można ją było kontynuować po przeładowaniu strony — to niezbędne do działania usługi, o którą prosisz,
            i znika po kliknięciu „Zakończ”. Tylko po zgodzie na cookies analityczne czat zapisuje też w sessionStorage
            (do zamknięcia karty) listę odwiedzonych podstron i sekcji, o której mowa w punkcie 3.4.
          </P>

          <SubH>9.5. Zarządzanie cookies</SubH>
          <P>
            Możecie Państwo zarządzać cookies poprzez ustawienia przeglądarki. Należy jednak
            pamiętać, że wyłączenie cookies może wpłynąć na funkcjonalność Serwisu
            (np. logowanie, koszyk zakupowy).
          </P>
        </>
      ),
    },
    {
      id: "sek-10", eyebrow: "10", short: "Bezpieczeństwo danych", title: "Bezpieczeństwo", accent: "",
      body: (
        <>
          <P>
            Stosujemy odpowiednie środki techniczne i organizacyjne w celu ochrony danych
            osobowych przed:
          </P>
          <UL>
            <li>nieautoryzowanym dostępem,</li>
            <li>utratą,</li>
            <li>zniszczeniem,</li>
            <li>nieuprawnioną modyfikacją,</li>
            <li>nieuprawnioną dystrybucją.</li>
          </UL>
          <Gap size={5}>
            <P>W szczególności stosujemy:</P>
          </Gap>
          <UL>
            <li>szyfrowanie połączeń SSL/TLS (HTTPS),</li>
            <li>bezpieczne przechowywanie haseł (algorytm bcrypt z solą),</li>
            <li>zabezpieczenie sesji użytkownika (ciasteczka HttpOnly, Secure),</li>
            <li>ograniczenie dostępu do danych wyłącznie dla upoważnionych osób,</li>
            <li>regularne aktualizacje oprogramowania i systemu,</li>
            <li>monitorowanie bezpieczeństwa infrastruktury,</li>
            <li>regularne kopie zapasowe bazy danych.</li>
          </UL>
        </>
      ),
    },
    {
      id: "sek-11", eyebrow: "11", short: "Automatyzacja i profilowanie", title: "Automatyzacja", accent: "",
      body: (
        <>
          <P>
            W ramach Serwisu nie stosujemy zautomatyzowanego podejmowania decyzji, w tym
            profilowania, które wywołałoby skutki prawne wobec Użytkowników lub w podobny
            sposób istotnie wpływało na ich sytuację.
          </P>
          <Gap>
            <P>
              AI Chat (Google Gemini) oraz asystent w czacie na stronie są narzędziami
              wspomagającymi, które odpowiadają na zapytania użytkowników, ale nie podejmują
              zautomatyzowanych decyzji mających wpływ prawny. Przebieg wizyty przypisany do
              rozmowy (tylko za zgodą) służy wyłącznie dopasowaniu odpowiedzi i ulepszaniu strony.
              O tym, że rozmawiasz z AI, informujemy w okienku czatu.
            </P>
          </Gap>
        </>
      ),
    },
    {
      id: "sek-12", eyebrow: "12", short: "Dane dzieci", title: "Dane", accent: "dzieci",
      body: (
        <>
          <P>
            Serwis KalkMate.pl może być używany przez osoby niepełnoletnie (uczniowie szkół
            średnich). Jeśli użytkownik nie ukończył 18 lat, zakup kalkulatora i korzystanie
            z AI Chat wymaga zgody rodzica lub opiekuna prawnego.
          </P>
          <Gap>
            <P>
              Nie zbieramy świadomie danych osobowych dzieci poniżej 13. roku życia bez
              zgody rodziców/opiekunów.
            </P>
          </Gap>
        </>
      ),
    },
    {
      id: "sek-13", eyebrow: "13", short: "Zmiany polityki", title: "Zmiany", accent: "polityki",
      body: (
        <>
          <P>
            Polityka Prywatności może ulegać zmianom w związku z rozwojem technologii,
            zmianami przepisów prawa lub zmianami w działalności Serwisu.
          </P>
          <Gap>
            <P>O wszelkich istotnych zmianach poinformujemy Użytkowników poprzez:</P>
          </Gap>
          <UL>
            <li>komunikat na stronie głównej Serwisu,</li>
            <li>wiadomość email (dla zarejestrowanych użytkowników).</li>
          </UL>
          <Gap>
            <P>
              Aktualna wersja Polityki Prywatności jest zawsze dostępna pod adresem:{" "}
              <A href="/polityka-prywatnosci">kalkmate.pl/polityka-prywatnosci</A>
            </P>
          </Gap>
        </>
      ),
    },
    {
      id: "sek-14", eyebrow: "14", short: "Kontakt", title: "Kontakt", accent: "",
      body: (
        <>
          <P>
            Wszelkie pytania dotyczące przetwarzania danych osobowych oraz korzystania
            z przysługujących Państwu praw prosimy kierować na:
          </P>
          <UL>
            <li>Email: <A href="mailto:kontakt@kalkmate.pl">kontakt@kalkmate.pl</A>,</li>
            <li>Telefon: <A href="tel:+48600580888">+48 600 580 888</A>,</li>
            <li><A href="/pomoc#kontakt">Formularz kontaktowy</A>{" "}dostępny na stronie.</li>
          </UL>
          <Gap size={5}>
            <P>Zobowiązujemy się odpowiedzieć na Państwa zapytania w ciągu 30 dni od ich otrzymania.</P>
          </Gap>
        </>
      ),
    },
  ],
  thanks: (
    <>
      Dziękujemy za zaufanie i korzystanie z KalkMate.pl. Przykładamy szczególną wagę
      do ochrony Państwa prywatności i bezpieczeństwa danych osobowych.
    </>
  ),
  footerNote: "Ostatnia aktualizacja · 2026-10-28 (czat z asystentem AI na stronie)",
  otherDocLabel: "→ Regulamin",
  homeLabel: "← Strona główna",
};

export default doc;
