import Link from "next/link";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";

export const metadata = {
  title: "Polityka Prywatności - KalkMate",
  description: "Polityka prywatności i ochrony danych osobowych KalkMate.pl",
  robots: { index: true, follow: true },
  alternates: { canonical: "https://kalkmate.pl/polityka-prywatnosci" },
};

const sections = [
  { id: "sek-1",  eyebrow: "01", short: "Postanowienia ogólne",       title: "Postanowienia",     accent: "ogólne" },
  { id: "sek-2",  eyebrow: "02", short: "Administrator danych",        title: "Administrator",     accent: "danych" },
  { id: "sek-3",  eyebrow: "03", short: "Zakres zbieranych danych",   title: "Zakres",            accent: "danych" },
  { id: "sek-4",  eyebrow: "04", short: "Cel i podstawa prawna",       title: "Cel",               accent: "przetwarzania" },
  { id: "sek-5",  eyebrow: "05", short: "Okres przechowywania",        title: "Okres",             accent: "przechowywania" },
  { id: "sek-6",  eyebrow: "06", short: "Udostępnianie danych",         title: "Udostępnianie",     accent: "" },
  { id: "sek-7",  eyebrow: "07", short: "Transfer poza EOG",            title: "Transfer",          accent: "poza EOG" },
  { id: "sek-8",  eyebrow: "08", short: "Prawa użytkowników",           title: "Prawa",             accent: "użytkowników" },
  { id: "sek-9",  eyebrow: "09", short: "Cookies",                       title: "Cookies",           accent: "" },
  { id: "sek-10", eyebrow: "10", short: "Bezpieczeństwo danych",         title: "Bezpieczeństwo",    accent: "" },
  { id: "sek-11", eyebrow: "11", short: "Automatyzacja i profilowanie", title: "Automatyzacja",     accent: "" },
  { id: "sek-12", eyebrow: "12", short: "Dane dzieci",                   title: "Dane",              accent: "dzieci" },
  { id: "sek-13", eyebrow: "13", short: "Zmiany polityki",               title: "Zmiany",            accent: "polityki" },
  { id: "sek-14", eyebrow: "14", short: "Kontakt",                       title: "Kontakt",           accent: "" },
];

function H({ id, eyebrow, title, accent }: { id: string; eyebrow: string; title: string; accent: string }) {
  return (
    <header className="mb-8 scroll-mt-28" id={id}>
      <p className="km-mono-eyebrow text-[#D8FF3D]">{eyebrow}</p>
      <h2 className="km-display text-[clamp(36px,5.5vw,72px)] mt-3 leading-[0.95] text-[#F2EDE3]">
        {title}
        {accent && <> <span className="italic text-[#D8FF3D]">{accent}</span></>}
        <span className="text-[#D8FF3D]">.</span>
      </h2>
    </header>
  );
}

function SubH({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="km-mono-eyebrow text-[#F2EDE3]/55 mt-8 mb-3">{children}</h3>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-[15px] leading-[1.65] text-[#F2EDE3]/75">{children}</p>;
}

function UL({ children }: { children: React.ReactNode }) {
  return (
    <ul className="list-disc list-outside ml-6 mt-3 space-y-1.5 text-[14px] text-[#F2EDE3]/70 marker:text-[#D8FF3D]/60">
      {children}
    </ul>
  );
}

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-[#0B0B0B] text-[#F2EDE3]">
      <Navigation />

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-[rgba(242,237,227,0.10)] pt-28 lg:pt-32">
        <div className="pointer-events-none absolute -top-32 -left-20 w-[520px] h-[520px] rounded-full bg-[#D8FF3D] opacity-[0.06] blur-[140px]" />
        <div className="pointer-events-none absolute top-[20%] -right-32 w-[420px] h-[420px] rounded-full bg-[#FF4D2E] opacity-[0.05] blur-[140px]" />

        <div className="max-w-6xl mx-auto px-6 pb-14 lg:pb-20 relative">
          <div className="flex items-center justify-between gap-6 border-b border-[rgba(242,237,227,0.10)] pb-5 mb-12">
            <span className="km-mono-eyebrow text-[#F2EDE3]/55 flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-[#D8FF3D] rounded-full km-blink" />
              RODO · zgodne z UE 2016/679
            </span>
            <span className="km-mono-eyebrow text-[#F2EDE3]/40 hidden md:inline">
              Aktualizacja · 2026-05-31
            </span>
          </div>

          <p className="km-mono-eyebrow text-[#D8FF3D]">[ prywatność ] · 14 sekcji</p>
          <h1 className="km-display text-[clamp(56px,8.5vw,128px)] mt-4 leading-[0.92] text-[#F2EDE3]">
            Polityka<br />
            <span className="italic text-[#D8FF3D]">prywatności</span>.
          </h1>
          <p className="mt-8 text-[16px] leading-[1.65] text-[#F2EDE3]/65 max-w-2xl">
            Jakie dane zbieramy, dlaczego je przetwarzamy, kto ma do nich dostęp
            i jak możecie skorzystać ze swoich praw. Zgodnie z RODO.
          </p>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-6 py-12 lg:py-16 grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-12">
        {/* Sidebar nav */}
        <nav className="lg:sticky lg:top-24 self-start space-y-1">
          {sections.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="block km-mono-eyebrow text-[#F2EDE3]/55 hover:text-[#D8FF3D] py-1.5 transition-colors"
            >
              {s.eyebrow} · {s.short}
            </a>
          ))}
        </nav>

        <main className="space-y-24 min-w-0">
          {/* 1 */}
          <section>
            <H id="sek-1" eyebrow="01" title="Postanowienia" accent="ogólne" />
            <P>
              Niniejsza Polityka Prywatności określa zasady przetwarzania i ochrony danych osobowych
              Użytkowników korzystających z serwisu KalkMate.pl (dalej: „Serwis"), prowadzonego przez
              KalkMate (dalej: „Administrator").
            </P>
            <div className="mt-4">
              <P>
                Administrator przykłada szczególną wagę do poszanowania prywatności Użytkowników
                oraz bezpieczeństwa ich danych osobowych. Dane osobowe przetwarzane są zgodnie z
                Rozporządzeniem Parlamentu Europejskiego i Rady (UE) 2016/679 z dnia 27 kwietnia 2016 r.
                (RODO) oraz przepisami prawa krajowego.
              </P>
            </div>
          </section>

          {/* 2 */}
          <section>
            <H id="sek-2" eyebrow="02" title="Administrator" accent="danych" />
            <P>Administratorem danych osobowych zbieranych za pośrednictwem Serwisu jest:</P>

            <div className="mt-5 p-5 border border-[rgba(242,237,227,0.10)] bg-[#0E0E0E]">
              <p className="km-mono-eyebrow text-[#D8FF3D] mb-3">KAJPA Kacper Popko</p>
              <div className="grid sm:grid-cols-2 gap-y-2 gap-x-6 text-[14px] text-[#F2EDE3]/80">
                <div>
                  <span className="text-[#F2EDE3]/45">NIP:</span>{" "}
                  <span className="font-mono">9662222951</span>
                </div>
                <div>
                  <span className="text-[#F2EDE3]/45">REGON:</span>{" "}
                  <span className="font-mono">545011444</span>
                </div>
                <div>
                  <span className="text-[#F2EDE3]/45">Adres siedziby:</span>{" "}
                  <span>ul. Zastawie I 37, 16-070 Choroszcz</span>
                </div>
                <div>
                  <span className="text-[#F2EDE3]/45">Nazwa skrócona:</span>{" "}
                  <span className="font-mono">KAJPA</span>
                </div>
                <div>
                  <span className="text-[#F2EDE3]/45">E-mail:</span>{" "}
                  <a href="mailto:kontakt@kajpa.pl" className="text-[#D8FF3D] hover:underline">kontakt@kajpa.pl</a>
                </div>
                <div>
                  <span className="text-[#F2EDE3]/45">Telefon:</span>{" "}
                  <a href="tel:+48600580888" className="text-[#D8FF3D] hover:underline font-mono">+48 600 580 888</a>
                </div>
              </div>
            </div>

            <div className="mt-5">
              <P>Kontakt z Administratorem w sprawach przetwarzania danych osobowych możliwy jest poprzez:</P>
            </div>
            <UL>
              <li>e-mail: <a href="mailto:kontakt@kajpa.pl" className="text-[#D8FF3D] hover:underline">kontakt@kajpa.pl</a>,</li>
              <li>telefonicznie: <a href="tel:+48600580888" className="text-[#D8FF3D] hover:underline">+48 600 580 888</a>,</li>
              <li>formularz kontaktowy dostępny na stronie.</li>
            </UL>
          </section>

          {/* 3 */}
          <section>
            <H id="sek-3" eyebrow="03" title="Zakres" accent="danych" />
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
              <li>informacje o subskrypcji AI Chat,</li>
              <li>historia konwersacji z AI Chat.</li>
            </UL>
          </section>

          {/* 4 */}
          <section>
            <H id="sek-4" eyebrow="04" title="Cel" accent="przetwarzania" />
            <P>Przegląd celów przetwarzania i odpowiadających im podstaw prawnych z RODO.</P>
            <div className="overflow-x-auto mt-6 border border-[rgba(242,237,227,0.10)] bg-[#0E0E0E]">
              <table className="min-w-full text-[14px]">
                <thead>
                  <tr className="border-b border-[rgba(242,237,227,0.10)]">
                    <th className="px-4 py-3 text-left km-mono-eyebrow text-[#D8FF3D]">Cel przetwarzania</th>
                    <th className="px-4 py-3 text-left km-mono-eyebrow text-[#D8FF3D]">Podstawa prawna RODO</th>
                  </tr>
                </thead>
                <tbody className="text-[#F2EDE3]/75">
                  {[
                    ["Realizacja umowy sprzedaży",          "Art. 6 ust. 1 lit. b) RODO"],
                    ["Obsługa płatności",                    "Art. 6 ust. 1 lit. b) RODO"],
                    ["Świadczenie usługi AI Chat",          "Art. 6 ust. 1 lit. b) RODO"],
                    ["Wysyłka produktów",                    "Art. 6 ust. 1 lit. b) RODO"],
                    ["Obsługa reklamacji",                   "Art. 6 ust. 1 lit. c) RODO (obowiązek prawny)"],
                    ["Wystawianie faktur",                   "Art. 6 ust. 1 lit. c) RODO (obowiązek prawny)"],
                    ["Marketing bezpośredni",                "Art. 6 ust. 1 lit. f) RODO (prawnie uzasadniony interes)"],
                    ["Analityka i statystyki",               "Art. 6 ust. 1 lit. f) RODO (prawnie uzasadniony interes)"],
                    ["Newsletter (jeśli wyrażono zgodę)",   "Art. 6 ust. 1 lit. a) RODO (zgoda)"],
                  ].map(([cel, basis]) => (
                    <tr key={cel} className="border-t border-[rgba(242,237,227,0.06)]">
                      <td className="px-4 py-3">{cel}</td>
                      <td className="px-4 py-3 text-[#F2EDE3]/60 font-mono text-[13px]">{basis}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* 5 */}
          <section>
            <H id="sek-5" eyebrow="05" title="Okres" accent="przechowywania" />
            <P>
              Dane osobowe przechowujemy przez okresy wymagane przepisami prawa lub przez czas
              niezbędny do realizacji celów przetwarzania:
            </P>
            <ul className="list-disc list-outside ml-6 mt-4 space-y-2.5 text-[14px] text-[#F2EDE3]/70 marker:text-[#D8FF3D]/60">
              <li><strong className="text-[#F2EDE3]">Dane transakcyjne i faktury:</strong> 5 lat od końca roku kalendarzowego, w którym powstał obowiązek podatkowy.</li>
              <li><strong className="text-[#F2EDE3]">Dane dotyczące umowy:</strong> przez okres obowiązywania umowy oraz przez czas wymagany przepisami prawa (np. 6 lat w związku z przedawnieniem roszczeń).</li>
              <li><strong className="text-[#F2EDE3]">Dane związane z subskrypcją:</strong> przez czas trwania subskrypcji oraz 3 lata po jej zakończeniu.</li>
              <li><strong className="text-[#F2EDE3]">Historia AI Chat:</strong> przez czas aktywnej subskrypcji oraz 30 dni po jej zakończeniu.</li>
              <li><strong className="text-[#F2EDE3]">Dane marketingowe (zgoda):</strong> do momentu wycofania zgody lub wniesienia sprzeciwu.</li>
              <li><strong className="text-[#F2EDE3]">Dane analityczne:</strong> do 25 miesięcy od ostatniej aktywności.</li>
            </ul>
          </section>

          {/* 6 */}
          <section>
            <H id="sek-6" eyebrow="06" title="Udostępnianie" accent="" />
            <P>Dane osobowe mogą być udostępniane następującym kategoriom odbiorców:</P>
            <ul className="list-disc list-outside ml-6 mt-4 space-y-2.5 text-[14px] text-[#F2EDE3]/70 marker:text-[#D8FF3D]/60">
              <li><strong className="text-[#F2EDE3]">Stripe</strong> – operator płatności (przetwarzanie transakcji kartami płatniczymi i subskrypcji).</li>
              <li><strong className="text-[#F2EDE3]">InPost</strong> – firma kurierska (dostawa produktów do Paczkomatów).</li>
              <li><strong className="text-[#F2EDE3]">Resend</strong> – usługa email (wysyłka wiadomości transakcyjnych i magic links).</li>
              <li><strong className="text-[#F2EDE3]">Google AI (Gemini)</strong> – dostawca usługi AI Chat (przetwarzanie zapytań w chatbocie).</li>
              <li><strong className="text-[#F2EDE3]">Dostawca hostingu</strong> – przechowywanie danych na serwerach VPS.</li>
              <li><strong className="text-[#F2EDE3]">Dostawca bazy danych PostgreSQL</strong> – przechowywanie danych użytkowników.</li>
              <li><strong className="text-[#F2EDE3]">Podmioty uprawnione na mocy prawa</strong> – organy państwowe, sądy (jeśli wymagają tego przepisy).</li>
            </ul>
            <div className="mt-5">
              <P>
                Wszyscy odbiorcy danych działają na podstawie umów powierzenia przetwarzania
                danych osobowych i są zobowiązani do zachowania ich poufności oraz stosowania
                odpowiednich środków bezpieczeństwa.
              </P>
            </div>
          </section>

          {/* 7 */}
          <section>
            <H id="sek-7" eyebrow="07" title="Transfer" accent="poza EOG" />
            <P>
              Niektórzy dostawcy usług (np. Stripe, Google AI) mogą przetwarzać dane poza
              Europejskim Obszarem Gospodarczym (EOG). W takich przypadkach:
            </P>
            <UL>
              <li>Zapewniamy odpowiednie zabezpieczenia zgodnie z RODO (standardowe klauzule umowne zatwierdzone przez Komisję Europejską).</li>
              <li>Transfer odbywa się wyłącznie do krajów zapewniających odpowiedni poziom ochrony danych lub do podmiotów stosujących odpowiednie gwarancje.</li>
            </UL>
          </section>

          {/* 8 */}
          <section>
            <H id="sek-8" eyebrow="08" title="Prawa" accent="użytkowników" />
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

            <SubH>8.3. Usunięcie („prawo do bycia zapomnianym") — art. 17 RODO</SubH>
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
            <div className="mt-4 p-4 border border-[rgba(242,237,227,0.10)] bg-[#0E0E0E] text-[14px] text-[#F2EDE3]/75">
              <span className="km-mono-eyebrow text-[#D8FF3D] block mb-2">PUODO · kontakt</span>
              ul. Stawki 2, 00-193 Warszawa<br />
              <a href="https://uodo.gov.pl" target="_blank" rel="noopener" className="text-[#D8FF3D] hover:underline">
                uodo.gov.pl
              </a>
            </div>

            <div className="mt-6">
              <P>
                <strong className="text-[#F2EDE3]">
                  W celu skorzystania z powyższych praw prosimy o kontakt poprzez email lub formularz kontaktowy.
                </strong>
              </P>
            </div>
          </section>

          {/* 9 */}
          <section>
            <H id="sek-9" eyebrow="09" title="Cookies" accent="" />

            <SubH>9.1. Czym są cookies</SubH>
            <P>
              Cookies to małe pliki tekstowe zapisywane na urządzeniu użytkownika podczas
              odwiedzania strony internetowej.
            </P>

            <SubH>9.2. Jakie cookies stosujemy</SubH>
            <ul className="list-disc list-outside ml-6 mt-3 space-y-2 text-[14px] text-[#F2EDE3]/70 marker:text-[#D8FF3D]/60">
              <li><strong className="text-[#F2EDE3]">Niezbędne</strong> — zapewniają podstawowe funkcjonalności strony (sesja użytkownika, koszyk, logowanie).</li>
              <li><strong className="text-[#F2EDE3]">Funkcjonalne</strong> — zapamiętują Wasze preferencje (np. tryb ciemny).</li>
              <li><strong className="text-[#F2EDE3]">Analityczne</strong> — pomagają nam zrozumieć, jak użytkownicy korzystają ze strony (anonimowe dane).</li>
              <li><strong className="text-[#F2EDE3]">Marketingowe</strong> — używane do personalizacji reklam (tylko za zgodą).</li>
            </ul>

            <SubH>9.3. Zarządzanie cookies</SubH>
            <P>
              Możecie Państwo zarządzać cookies poprzez ustawienia przeglądarki. Należy jednak
              pamiętać, że wyłączenie cookies może wpłynąć na funkcjonalność Serwisu
              (np. logowanie, koszyk zakupowy).
            </P>
          </section>

          {/* 10 */}
          <section>
            <H id="sek-10" eyebrow="10" title="Bezpieczeństwo" accent="" />
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
            <div className="mt-5">
              <P>W szczególności stosujemy:</P>
            </div>
            <UL>
              <li>szyfrowanie połączeń SSL/TLS (HTTPS),</li>
              <li>bezpieczne przechowywanie haseł (algorytm bcrypt z solą),</li>
              <li>zabezpieczenie sesji użytkownika (ciasteczka HttpOnly, Secure),</li>
              <li>ograniczenie dostępu do danych wyłącznie dla upoważnionych osób,</li>
              <li>regularne aktualizacje oprogramowania i systemu,</li>
              <li>monitorowanie bezpieczeństwa infrastruktury,</li>
              <li>regularne kopie zapasowe bazy danych.</li>
            </UL>
          </section>

          {/* 11 */}
          <section>
            <H id="sek-11" eyebrow="11" title="Automatyzacja" accent="" />
            <P>
              W ramach Serwisu nie stosujemy zautomatyzowanego podejmowania decyzji, w tym
              profilowania, które wywołałoby skutki prawne wobec Użytkowników lub w podobny
              sposób istotnie wpływało na ich sytuację.
            </P>
            <div className="mt-4">
              <P>
                AI Chat (Google Gemini) jest narzędziem wspomagającym, które odpowiada na
                zapytania użytkowników, ale nie podejmuje zautomatyzowanych decyzji mających
                wpływ prawny.
              </P>
            </div>
          </section>

          {/* 12 */}
          <section>
            <H id="sek-12" eyebrow="12" title="Dane" accent="dzieci" />
            <P>
              Serwis KalkMate.pl może być używany przez osoby niepełnoletnie (uczniowie szkół
              średnich). Jeśli użytkownik nie ukończył 18 lat, zakup kalkulatora i korzystanie
              z AI Chat wymaga zgody rodzica lub opiekuna prawnego.
            </P>
            <div className="mt-4">
              <P>
                Nie zbieramy świadomie danych osobowych dzieci poniżej 13. roku życia bez
                zgody rodziców/opiekunów.
              </P>
            </div>
          </section>

          {/* 13 */}
          <section>
            <H id="sek-13" eyebrow="13" title="Zmiany" accent="polityki" />
            <P>
              Polityka Prywatności może ulegać zmianom w związku z rozwojem technologii,
              zmianami przepisów prawa lub zmianami w działalności Serwisu.
            </P>
            <div className="mt-4">
              <P>O wszelkich istotnych zmianach poinformujemy Użytkowników poprzez:</P>
            </div>
            <UL>
              <li>komunikat na stronie głównej Serwisu,</li>
              <li>wiadomość email (dla zarejestrowanych użytkowników).</li>
            </UL>
            <div className="mt-4">
              <P>
                Aktualna wersja Polityki Prywatności jest zawsze dostępna pod adresem:{" "}
                <Link href="/polityka-prywatnosci" className="text-[#D8FF3D] hover:underline">
                  kalkmate.pl/polityka-prywatnosci
                </Link>
              </P>
            </div>
          </section>

          {/* 14 */}
          <section>
            <H id="sek-14" eyebrow="14" title="Kontakt" accent="" />
            <P>
              Wszelkie pytania dotyczące przetwarzania danych osobowych oraz korzystania
              z przysługujących Państwu praw prosimy kierować na:
            </P>
            <UL>
              <li>Email: <a href="mailto:kontakt@kajpa.pl" className="text-[#D8FF3D] hover:underline">kontakt@kajpa.pl</a>,</li>
              <li>Telefon: <a href="tel:+48600580888" className="text-[#D8FF3D] hover:underline">+48 600 580 888</a>,</li>
              <li>
                <Link href="/pomoc#kontakt" className="text-[#D8FF3D] hover:underline">
                  Formularz kontaktowy
                </Link>{" "}
                dostępny na stronie.
              </li>
            </UL>
            <div className="mt-5">
              <P>Zobowiązujemy się odpowiedzieć na Państwa zapytania w ciągu 30 dni od ich otrzymania.</P>
            </div>
          </section>

          {/* Podziekowanie */}
          <div className="border-l-2 border-[#D8FF3D] pl-6 py-4 bg-[#D8FF3D]/[0.04]">
            <p className="text-[15px] leading-[1.65] text-[#F2EDE3]/85">
              Dziękujemy za zaufanie i korzystanie z KalkMate.pl. Przykładamy szczególną wagę
              do ochrony Państwa prywatności i bezpieczeństwa danych osobowych.
            </p>
          </div>

          {/* Stopka dokumentu */}
          <div className="pt-8 border-t border-[rgba(242,237,227,0.10)] flex flex-wrap items-center justify-between gap-4">
            <span className="km-mono-eyebrow text-[#F2EDE3]/45">
              Ostatnia aktualizacja · 2026-05-31
            </span>
            <div className="flex items-center gap-4">
              <Link href="/regulamin" className="km-mono-eyebrow text-[#F2EDE3]/55 hover:text-[#D8FF3D] transition-colors">
                → Regulamin
              </Link>
              <Link href="/" className="km-mono-eyebrow text-[#F2EDE3]/55 hover:text-[#D8FF3D] transition-colors">
                ← Strona główna
              </Link>
            </div>
          </div>
        </main>
      </div>

      <Footer />
    </div>
  );
}
