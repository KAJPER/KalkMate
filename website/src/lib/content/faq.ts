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
      q: "Czym różni się KalkMate od aplikacji jak Photomath czy Gauth?",
      a: "To fizyczne urządzenie, nie aplikacja na telefon — a telefony i smartwatche są zabronione na sali maturalnej. Photomath czy Gauth świetnie sprawdzają się do nauki w domu, ale nie da się ich użyć w trakcie egzaminu. KalkMate wygląda i działa jak zwykły, dozwolony kalkulator prosty, więc AI masz przy sobie także podczas samego testu.",
    },
    {
      q: "Jakie przedmioty obsługuje AI?",
      a: "Tryb „Egzamin” jest dostrojony pod maturę: matematyka (poziom podstawowy i rozszerzony), fizyka, chemia i biologia. Do wszystkiego innego jest tryb „Czysty AI” (przełączasz go w panelu na kalkmate.pl) — działa jak ogólny asystent AI i rozwiązuje zadania z dowolnego przedmiotu, także ze studiów: elektrotechnika, mechanika, ekonomia, rachunkowość, informatyka czy języki obce.",
    },
    {
      q: "Czy potrzebuję WiFi?",
      a: "Tryb AI wymaga WiFi 2.4 GHz (5 GHz nie jest obsługiwane) — sieć wybierasz na kalkulatorze w Ustawienia → WiFi i konto. Najprościej użyć hotspotu z telefonu (na iPhonie włącz „Maksymalna zgodność”). Nie zadziałają sieci z logowaniem przez stronę WWW (np. w hotelu czy szkole). Tryb klasycznego kalkulatora działa offline przez cały czas.",
    },
    {
      q: "Czy AI wymaga abonamentu?",
      a: "Nie. AI działa na tokenach z Twojego konta, bez abonamentu. W zestawie dostajesz 2 mln tokenów AI (kod w pudełku), a nowe konto ma 200 tys. tokenów na start. Gdy się skończą, dokupisz paczkę tokenów w panelu na kalkmate.pl/panel.",
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
      q: "Kiedy dostanę zamówienie?",
      a: "Każdy kalkulator składamy ręcznie: standardowo 1–2 tygodnie od zaksięgowania płatności (maksymalnie 4 tygodnie). W Polsce dostawa Paczkomatem InPost (gratis) zajmuje potem 1–2 dni robocze. Za granicę wysyłamy kurierem — UE 20 EUR, reszta świata 35 EUR — łącznie zwykle 2–4 tygodnie. Nie mamy wysyłki ekspresowej; jeśli potrzebujesz kalkulatora na konkretną datę, napisz przed zamówieniem na kontakt@kalkmate.pl. Numer przesyłki dostajesz mailem.",
    },
    {
      q: "Na ile zadań wystarczą tokeny z zestawu?",
      a: "Zależy od długości rozwiązania i modelu AI wybranego w panelu. Przy domyślnym modelu jedno zadanie ze zdjęcia zużywa zwykle kilka–kilkanaście tysięcy tokenów, więc 2,2 mln tokenów na start (2 mln z kodu w pudełku + 200 tys. za założenie konta) wystarcza na kilkaset zadań. Tokeny nie wygasają i nie odnawiają się same — saldo widzisz w panelu, a gdy się skończą, dokupisz paczkę.",
    },
    {
      q: "Gdzie zobaczę, jak to działa na prawdziwym urządzeniu?",
      a: "Na stronie pomocy (kalkmate.pl/pomoc) są filmy z prawdziwego KalkMate: pierwsze uruchomienie i obsługa klawiszy, a zdjęcia urządzenia znajdziesz w galerii na stronie głównej. Masz konkretne pytanie o działanie? Napisz na czacie albo na kontakt@kalkmate.pl.",
    },
    {
      q: "Jaka jest gwarancja?",
      a: "24 miesiące gwarancji producenta na wszystkie elementy. Naprawiamy lub wymieniamy urządzenie w razie usterki.",
    },
    {
      q: "W jakich językach działa KalkMate?",
      a: "Kalkulator działa w 11 językach: po polsku, angielsku, niemiecku, czesku, słowacku, litewsku, białorusku, hiszpańsku, portugalsku, francusku i włosku. Język zmieniasz w Ustawienia → Język — AI odpowiada wtedy w wybranym języku, nawet jeśli zadanie na zdjęciu jest w innym. Sklep i panel użytkownika też są dostępne we wszystkich 11 językach.",
    },
  ],
  en: [
    {
      q: "Is KalkMate an AI camera calculator for exams?",
      a: "Yes — KalkMate is an AI camera calculator: it photographs the problem and shows the full step-by-step solution on screen. The casing, keypad and screen are identical to standard simple calculators. You launch AI mode with a hidden key combination — there are no icons or indicators that could give you away.",
    },
    {
      q: "How is KalkMate different from apps like Photomath or Gauth?",
      a: "KalkMate is a physical device, not a phone app — and phones and smartwatches are banned in exam rooms. Apps like Photomath or Gauth are great for studying at home, but you simply can't use them during the actual exam. KalkMate looks and works like a standard, permitted simple calculator, so you have AI with you during the test itself.",
    },
    {
      q: "Which subjects does the AI support?",
      a: "“Exam” mode is tuned for high-school finals: mathematics (basic and extended level), physics, chemistry and biology. For everything else there's “Raw AI” mode (switch it in your panel on kalkmate.pl) — it works like a general AI assistant and solves problems from any subject, including university courses: electrical engineering, statics and mechanics, economics, accounting, computer science or foreign languages.",
    },
    {
      q: "Do I need WiFi?",
      a: "AI mode needs 2.4 GHz WiFi (5 GHz isn't supported) — you pick the network on the calculator in Settings → WiFi & account. The easiest option is your phone's hotspot (on iPhone turn on “Maximize Compatibility”). Networks that require logging in through a web page (hotels, schools) won't work. The classic calculator mode works offline at all times. There's no SIM card.",
    },
    {
      q: "Do I need a subscription for the AI?",
      a: "No. The AI runs on tokens from your account, with no subscription. The box includes 2M AI tokens (code inside), and every new account gets 200K tokens to start. When they run out, you can buy a token pack in your panel at kalkmate.pl/panel.",
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
      q: "When will I get my order?",
      a: "Every calculator is assembled by hand: usually 1–2 weeks from payment confirmation (up to 4 weeks maximum). Outside Poland we ship by courier — EU €20, rest of the world (incl. USA and Canada) €35 — so the total is typically 2–4 weeks. There's no express shipping; if you need it by a specific date, email kontakt@kalkmate.pl before ordering. You'll get your tracking number by email.",
    },
    {
      q: "How many problems can I solve with the included tokens?",
      a: "It depends on the length of the solution and the AI model chosen in your panel. With the default model, one photographed problem usually uses several thousand to a dozen-or-so thousand tokens, so the 2.2M starting tokens (2M from the code in the box + 200K for creating an account) cover several hundred problems. Tokens never expire and don't regenerate on their own — you see your balance in the panel and can buy a pack when they run out.",
    },
    {
      q: "Where can I see it working on a real device?",
      a: "Our help page (kalkmate.pl/en/pomoc) has videos of a real KalkMate: first start-up and how the keys work, and you'll find photos of the device in the gallery on the home page. Got a specific question about how it works? Ask in the chat or email kontakt@kalkmate.pl.",
    },
    {
      q: "What's the warranty?",
      a: "A 24-month manufacturer's warranty on all components. We repair or replace the device in case of a fault.",
    },
    {
      q: "Which languages does KalkMate support?",
      a: "The calculator works in 11 languages: Polish, English, German, Czech, Slovak, Lithuanian, Belarusian, Spanish, Portuguese, French and Italian. You switch the language in Settings → Language, and the AI then answers in that language, even if the problem in the photo is written in another one. The shop and user panel are available in all 11 languages too.",
    },
  ],
  de: [
    {
      q: "Ist KalkMate ein KI Taschenrechner mit Kamera?",
      a: "Ja — KalkMate ist ein KI Taschenrechner mit Kamera: Du fotografierst die Aufgabe und siehst die vollständige Schritt-für-Schritt-Lösung auf dem Display. Gehäuse, Tastatur und Display sind identisch mit handelsüblichen einfachen Taschenrechnern. Den KI-Modus startest du mit einer versteckten Tastenkombination — es gibt keine Symbole oder Anzeigen, die dich verraten könnten.",
    },
    {
      q: "Wie unterscheidet sich KalkMate von Apps wie Photomath oder Gauth?",
      a: "KalkMate ist ein physisches Gerät, keine Handy-App — und Handys sowie Smartwatches sind im Prüfungsraum verboten. Apps wie Photomath oder Gauth eignen sich hervorragend zum Lernen zu Hause, lassen sich aber während der eigentlichen Prüfung nicht nutzen. KalkMate sieht aus wie ein normaler, zugelassener einfacher Taschenrechner und funktioniert auch so — die KI hast du also direkt während der Prüfung dabei.",
    },
    {
      q: "Welche Fächer unterstützt die KI?",
      a: "Der „Prüfungsmodus“ ist auf Abschlussprüfungen abgestimmt: Mathematik (Grund- und Leistungskurs), Physik, Chemie und Biologie. Für alles andere gibt es den Modus „Reines AI“ (umschaltbar in deinem Panel auf kalkmate.pl) — er arbeitet wie ein allgemeiner KI-Assistent und löst Aufgaben aus jedem Fach, auch aus dem Studium: Elektrotechnik, Statik und Mechanik, Wirtschaft, Rechnungswesen, Informatik oder Fremdsprachen.",
    },
    {
      q: "Brauche ich WLAN?",
      a: "Der KI-Modus benötigt WLAN mit 2,4 GHz (5 GHz wird nicht unterstützt) — das Netzwerk wählst du direkt am Rechner unter Einstellungen → WLAN & Konto. Am einfachsten nutzt du den Hotspot deines Handys (auf dem iPhone „Kompatibilität maximieren“ einschalten). Netzwerke, bei denen man sich über eine Webseite anmelden muss (z. B. im Hotel oder in der Schule), funktionieren nicht. Der klassische Taschenrechner-Modus funktioniert jederzeit offline. Eine SIM-Karte gibt es nicht.",
    },
    {
      q: "Brauche ich ein Abo für die KI?",
      a: "Nein. Die KI läuft über Tokens auf deinem Konto, ganz ohne Abo. Im Lieferumfang sind 2 Mio. KI-Tokens enthalten (Code in der Verpackung), und jedes neue Konto erhält 200.000 Tokens zum Start. Sind sie aufgebraucht, kaufst du im Panel unter kalkmate.pl/panel ein Token-Paket nach.",
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
      q: "Wann erhalte ich meine Bestellung?",
      a: "Jeder Rechner wird von Hand zusammengebaut: in der Regel 1–2 Wochen ab Zahlungseingang (maximal 4 Wochen). Außerhalb Polens versenden wir per Kurier — EU 20 EUR, Rest der Welt (inkl. USA und Kanada) 35 EUR —, insgesamt dauert es also meist 2–4 Wochen. Einen Expressversand gibt es nicht; wenn du den Rechner zu einem bestimmten Termin brauchst, schreib uns vor der Bestellung an kontakt@kalkmate.pl. Die Sendungsnummer erhältst du per E-Mail.",
    },
    {
      q: "Für wie viele Aufgaben reichen die mitgelieferten Tokens?",
      a: "Das hängt von der Länge der Lösung und dem im Panel gewählten KI-Modell ab. Mit dem Standardmodell verbraucht eine fotografierte Aufgabe meist einige tausend bis über zehntausend Tokens — die 2,2 Mio. Start-Tokens (2 Mio. aus dem Code in der Verpackung + 200.000 für die Kontoerstellung) reichen also für mehrere hundert Aufgaben. Tokens verfallen nicht und laden sich nicht von selbst wieder auf — dein Guthaben siehst du im Panel, und wenn es aufgebraucht ist, kaufst du ein Paket nach.",
    },
    {
      q: "Wo kann ich sehen, wie es auf einem echten Gerät funktioniert?",
      a: "Auf unserer Hilfeseite (kalkmate.pl/de/pomoc) gibt es Videos von einem echten KalkMate: die erste Inbetriebnahme und wie die Tasten funktionieren. Fotos des Geräts findest du in der Galerie auf der Startseite. Du hast eine konkrete Frage zur Funktionsweise? Frag im Chat oder schreib an kontakt@kalkmate.pl.",
    },
    {
      q: "Wie sieht die Garantie aus?",
      a: "24 Monate Herstellergarantie auf alle Komponenten. Im Falle eines Defekts reparieren oder ersetzen wir das Gerät.",
    },
    {
      q: "In welchen Sprachen funktioniert KalkMate?",
      a: "Der Rechner funktioniert in 11 Sprachen: Polnisch, Englisch, Deutsch, Tschechisch, Slowakisch, Litauisch, Belarussisch, Spanisch, Portugiesisch, Französisch und Italienisch. Die Sprache stellst du unter Einstellungen → Sprache ein — die KI antwortet dann in der gewählten Sprache, auch wenn die Aufgabe auf dem Foto in einer anderen steht. Shop und Benutzerbereich gibt es ebenfalls in allen 11 Sprachen.",
    },
  ],
  cs: [
    {
      q: "Je KalkMate AI kalkulačka s kamerou?",
      a: "Ano — KalkMate je AI kalkulačka s kamerou: vyfotí úlohu a na displeji zobrazí kompletní řešení krok za krokem. Pouzdro, klávesnice i displej jsou stejné jako u běžných jednoduchých kalkulaček. Režim AI spustíš skrytou kombinací kláves — nejsou tu žádné ikony ani kontrolky, které by tě prozradily.",
    },
    {
      q: "Čím se KalkMate liší od aplikací jako Photomath nebo Gauth?",
      a: "KalkMate je fyzické zařízení, ne aplikace v telefonu — a telefony i chytré hodinky jsou při zkoušce zakázané. Photomath nebo Gauth se skvěle hodí na učení doma, ale během samotné zkoušky je použít nemůžeš. KalkMate vypadá a funguje jako běžná povolená jednoduchá kalkulačka, takže AI máš u sebe i při samotném testu.",
    },
    {
      q: "Které předměty AI zvládá?",
      a: "Režim „Zkouška“ je vyladěný na maturitu: matematika (základní i rozšířená úroveň), fyzika, chemie a biologie. Na všechno ostatní je tu režim „Čisté AI“ (přepneš ho v panelu na kalkmate.pl) — funguje jako obecný AI asistent a řeší úlohy z jakéhokoli předmětu, i z vysoké školy: elektrotechnika, statika a mechanika, ekonomie, účetnictví, informatika nebo cizí jazyky.",
    },
    {
      q: "Potřebuji Wi-Fi?",
      a: "Režim AI potřebuje Wi-Fi 2,4 GHz (5 GHz není podporováno) — síť vybereš přímo na kalkulačce v Nastavení → WiFi a účet. Nejjednodušší je použít hotspot z telefonu (na iPhonu zapni „Maximalizovat kompatibilitu“). Nefungují sítě, kde se přihlašuje přes webovou stránku (např. v hotelu nebo ve škole). Klasický režim kalkulačky funguje kdykoli offline. SIM karta tu není.",
    },
    {
      q: "Potřebuji k AI předplatné?",
      a: "Ne. AI běží na tokenech z tvého účtu, bez předplatného. V balení dostaneš 2 mil. AI tokenů (kód v krabičce) a každý nový účet má na začátek 200 tis. tokenů. Až dojdou, dokoupíš balíček tokenů v panelu na kalkmate.pl/panel.",
    },
    {
      q: "Jak dlouho vydrží baterie?",
      a: "Zhruba 6 hodin při smíšeném používání (AI + kalkulačka). Samotný režim kalkulačky vydrží výrazně déle. Nabíjení přes USB-C trvá asi 2 hodiny.",
    },
    {
      q: "Jsou moje data v bezpečí?",
      a: "Fotky a dotazy posíláme šifrovaně přes HTTPS. Po zpracování fotky neukládáme — ze serveru se mažou hned po odeslání odpovědi.",
    },
    {
      q: "Kdy dostanu objednávku?",
      a: "Každou kalkulačku skládáme ručně: obvykle 1–2 týdny od připsání platby (maximálně 4 týdny). Mimo Polsko posíláme kurýrem — EU 20 EUR, zbytek světa (vč. USA a Kanady) 35 EUR — celkem tedy obvykle 2–4 týdny. Expresní doprava není k dispozici; pokud potřebuješ kalkulačku ke konkrétnímu datu, napiš nám před objednávkou na kontakt@kalkmate.pl. Číslo zásilky dostaneš e-mailem.",
    },
    {
      q: "Na kolik úloh vystačí tokeny z balení?",
      a: "Záleží na délce řešení a na modelu AI zvoleném v panelu. S výchozím modelem spotřebuje jedna vyfocená úloha obvykle několik až několikanáct tisíc tokenů, takže 2,2 mil. tokenů na začátek (2 mil. z kódu v krabičce + 200 tis. za založení účtu) vystačí na několik set úloh. Tokeny nevyprší a samy se neobnovují — zůstatek vidíš v panelu, a až dojdou, dokoupíš balíček.",
    },
    {
      q: "Kde uvidím, jak to funguje na skutečném zařízení?",
      a: "Na stránce nápovědy (kalkmate.pl/cs/pomoc) najdeš videa se skutečným KalkMate: první spuštění a ovládání kláves. Fotky zařízení jsou v galerii na hlavní stránce. Máš konkrétní dotaz, jak to funguje? Napiš do chatu nebo na kontakt@kalkmate.pl.",
    },
    {
      q: "Jaká je záruka?",
      a: "24 měsíců záruky výrobce na všechny součásti. V případě závady zařízení opravíme nebo vyměníme.",
    },
    {
      q: "V jakých jazycích KalkMate funguje?",
      a: "Kalkulačka funguje v 11 jazycích: česky, slovensky, polsky, anglicky, německy, litevsky, bělorusky, španělsky, portugalsky, francouzsky a italsky. Jazyk přepneš v Nastavení → Jazyk — AI pak odpovídá ve zvoleném jazyce, i když je úloha na fotce napsaná v jiném. Obchod i uživatelský panel jsou také dostupné ve všech 11 jazycích.",
    },
  ],
  sk: [
    {
      q: "Je KalkMate AI kalkulačka s kamerou?",
      a: "Áno — KalkMate je AI kalkulačka s kamerou: odfotí úlohu a na displeji zobrazí kompletné riešenie krok za krokom. Puzdro, klávesnica aj displej sú rovnaké ako pri bežných jednoduchých kalkulačkách. Režim AI spustíš skrytou kombináciou klávesov — nie sú tu žiadne ikony ani kontrolky, ktoré by ťa prezradili.",
    },
    {
      q: "Čím sa KalkMate líši od aplikácií ako Photomath alebo Gauth?",
      a: "KalkMate je fyzické zariadenie, nie aplikácia v telefóne — a telefóny aj inteligentné hodinky sú na skúške zakázané. Photomath alebo Gauth sa skvele hodia na učenie doma, ale počas samotnej skúšky ich použiť nemôžeš. KalkMate vyzerá a funguje ako bežná povolená jednoduchá kalkulačka, takže AI máš pri sebe aj počas samotného testu.",
    },
    {
      q: "Ktoré predmety AI zvláda?",
      a: "Režim „Skúška“ je vyladený na maturitu: matematika (základná aj rozšírená úroveň), fyzika, chémia a biológia. Na všetko ostatné je tu režim „Čisté AI“ (prepneš ho v paneli na kalkmate.pl) — funguje ako všeobecný AI asistent a rieši úlohy z akéhokoľvek predmetu, aj z vysokej školy: elektrotechnika, statika a mechanika, ekonómia, účtovníctvo, informatika či cudzie jazyky.",
    },
    {
      q: "Potrebujem Wi-Fi?",
      a: "Režim AI potrebuje Wi-Fi 2,4 GHz (5 GHz nie je podporované) — sieť vyberieš priamo na kalkulačke v Nastavenia → WiFi a účet. Najjednoduchšie je použiť hotspot z telefónu (na iPhone zapni „Maximalizovať kompatibilitu“). Nefungujú siete, kde sa prihlasuje cez webovú stránku (napr. v hoteli alebo v škole). Klasický režim kalkulačky funguje kedykoľvek offline. SIM karta tu nie je.",
    },
    {
      q: "Potrebujem na AI predplatné?",
      a: "Nie. AI beží na tokenoch z tvojho účtu, bez predplatného. V balení dostaneš 2 mil. AI tokenov (kód v krabičke) a každý nový účet má na začiatok 200 tis. tokenov. Keď sa minú, dokúpiš balík tokenov v paneli na kalkmate.pl/panel.",
    },
    {
      q: "Ako dlho vydrží batéria?",
      a: "Približne 6 hodín pri zmiešanom používaní (AI + kalkulačka). Samotný režim kalkulačky vydrží výrazne dlhšie. Nabíjanie cez USB-C trvá asi 2 hodiny.",
    },
    {
      q: "Sú moje údaje v bezpečí?",
      a: "Fotky a otázky posielame šifrovane cez HTTPS. Po spracovaní fotky neukladáme — zo servera sa mažú hneď po odoslaní odpovede.",
    },
    {
      q: "Kedy dostanem objednávku?",
      a: "Každú kalkulačku skladáme ručne: zvyčajne 1–2 týždne od pripísania platby (maximálne 4 týždne). Mimo Poľska posielame kuriérom — EÚ 20 EUR, zvyšok sveta (vr. USA a Kanady) 35 EUR — celkovo teda zvyčajne 2–4 týždne. Expresné doručenie neponúkame; ak potrebuješ kalkulačku ku konkrétnemu dátumu, napíš nám pred objednávkou na kontakt@kalkmate.pl. Číslo zásielky dostaneš e-mailom.",
    },
    {
      q: "Na koľko úloh vystačia tokeny z balenia?",
      a: "Závisí to od dĺžky riešenia a od modelu AI zvoleného v paneli. S predvoleným modelom spotrebuje jedna odfotená úloha zvyčajne niekoľko až niekoľkonásť tisíc tokenov, takže 2,2 mil. tokenov na začiatok (2 mil. z kódu v krabičke + 200 tis. za založenie účtu) vystačí na niekoľko stoviek úloh. Tokeny nevypršia a samy sa neobnovujú — zostatok vidíš v paneli, a keď sa minú, dokúpiš balík.",
    },
    {
      q: "Kde uvidím, ako to funguje na skutočnom zariadení?",
      a: "Na stránke pomoci (kalkmate.pl/sk/pomoc) nájdeš videá so skutočným KalkMate: prvé spustenie a ovládanie klávesov. Fotky zariadenia sú v galérii na hlavnej stránke. Máš konkrétnu otázku, ako to funguje? Napíš do chatu alebo na kontakt@kalkmate.pl.",
    },
    {
      q: "Aká je záruka?",
      a: "24 mesiacov záruky výrobcu na všetky súčasti. V prípade poruchy zariadenie opravíme alebo vymeníme.",
    },
    {
      q: "Funguje KalkMate po slovensky?",
      a: "Áno. Kalkulačka funguje v 11 jazykoch: po slovensky, česky, poľsky, anglicky, nemecky, litovsky, bielorusky, španielsky, portugalsky, francúzsky a taliansky. Jazyk prepneš v Nastavenia → Jazyk — AI potom odpovedá vo zvolenom jazyku, aj keď je úloha na fotke napísaná v inom. Obchod aj používateľský panel sú tiež dostupné vo všetkých 11 jazykoch.",
    },
  ],
  lt: [
    {
      q: "Ar KalkMate — dirbtinio intelekto skaičiuotuvas su kamera?",
      a: "Taip — KalkMate yra DI skaičiuotuvas su kamera: jis nufotografuoja užduotį ir ekrane parodo visą sprendimą žingsnis po žingsnio. Korpusas, klaviatūra ir ekranas tokie pat kaip įprastų paprastų skaičiuotuvų. DI režimą įjungi slaptu klavišų deriniu — nėra jokių piktogramų ar indikatorių, kurie galėtų tave išduoti.",
    },
    {
      q: "Kuo KalkMate skiriasi nuo programėlių, tokių kaip Photomath ar Gauth?",
      a: "KalkMate — fizinis įrenginys, o ne programėlė telefone, o telefonai ir išmanieji laikrodžiai egzamino metu draudžiami. Photomath ar Gauth puikiai tinka mokytis namuose, bet per patį egzaminą jų naudoti negali. KalkMate atrodo ir veikia kaip įprastas leidžiamas paprastas skaičiuotuvas, todėl DI turi su savimi ir per patį testą.",
    },
    {
      q: "Kokius dalykus palaiko DI?",
      a: "Režimas „Egzaminas“ pritaikytas brandos egzaminams: matematikai (bendrasis ir išplėstinis kursas), fizikai, chemijai ir biologijai. Visam kitam yra režimas „Grynas DI“ (jį perjungi savo skydelyje kalkmate.pl) — jis veikia kaip bendrasis DI asistentas ir sprendžia bet kurio dalyko užduotis, taip pat ir universitetinių studijų: elektrotechnikos, statikos ir mechanikos, ekonomikos, apskaitos, informatikos ar užsienio kalbų.",
    },
    {
      q: "Ar man reikia Wi-Fi?",
      a: "DI režimui reikia 2,4 GHz Wi-Fi (5 GHz nepalaikomas) — tinklą pasirenki pačiame skaičiuotuve, meniu Nustatymai → WiFi ir paskyra. Paprasčiausia naudoti telefono interneto prieigos tašką (iPhone telefone įjunk „Maksimizuoti suderinamumą“). Tinklai, kuriuose reikia prisijungti per tinklalapį (viešbučiuose, mokyklose), neveiks. Klasikinis skaičiuotuvo režimas visada veikia ir be interneto. SIM kortelės nėra.",
    },
    {
      q: "Ar DI reikia prenumeratos?",
      a: "Ne. DI veikia naudodamas tavo paskyros žetonus, be jokios prenumeratos. Komplekte gauni 2 mln. DI žetonų (kodas dėžutėje), o kiekviena nauja paskyra pradžiai gauna 200 tūkst. žetonų. Kai jie baigsis, žetonų paketą nusipirksi skydelyje kalkmate.pl/panel.",
    },
    {
      q: "Kiek laiko veikia baterija?",
      a: "Apie 6 valandas mišriai naudojant (DI + skaičiuotuvas). Vien skaičiuotuvo režimu veikia gerokai ilgiau. Įkrovimas per USB-C trunka apie 2 valandas.",
    },
    {
      q: "Ar mano duomenys saugūs?",
      a: "Nuotraukas ir užklausas siunčiame šifruotu HTTPS ryšiu. Po apdorojimo nuotraukų nesaugome — jos ištrinamos iš serverio iš karto, kai išsiunčiamas atsakymas.",
    },
    {
      q: "Kada gausiu užsakymą?",
      a: "Kiekvieną skaičiuotuvą surenkame rankomis: paprastai per 1–2 savaites nuo mokėjimo įskaitymo (daugiausia per 4 savaites). Už Lenkijos ribų siunčiame per kurjerį — ES 20 €, kitur pasaulyje (įskaitant JAV ir Kanadą) 35 € — taigi iš viso paprastai užtrunka 2–4 savaites. Skubaus pristatymo neturime; jei skaičiuotuvo reikia iki konkrečios datos, prieš užsakymą parašyk kontakt@kalkmate.pl. Siuntos sekimo numerį gausi el. paštu.",
    },
    {
      q: "Kiek užduočių išspręsiu su komplekte esančiais žetonais?",
      a: "Priklauso nuo sprendimo ilgio ir skydelyje pasirinkto DI modelio. Naudojant numatytąjį modelį, viena nufotografuota užduotis paprastai sunaudoja nuo kelių iki keliolikos tūkstančių žetonų, todėl 2,2 mln. pradinių žetonų (2 mln. iš kodo dėžutėje + 200 tūkst. už paskyros sukūrimą) užtenka keliems šimtams užduočių. Žetonai nenustoja galioti ir patys nepasipildo — likutį matai skydelyje, o kai jie baigsis, galėsi nusipirkti paketą.",
    },
    {
      q: "Kur galiu pamatyti, kaip jis veikia tikrame įrenginyje?",
      a: "Pagalbos puslapyje (kalkmate.pl/lt/pomoc) rasi vaizdo įrašų su tikru KalkMate: pirmasis paleidimas ir kaip veikia klavišai, o įrenginio nuotraukų yra pagrindinio puslapio galerijoje. Turi konkretų klausimą apie veikimą? Parašyk pokalbyje arba el. paštu kontakt@kalkmate.pl.",
    },
    {
      q: "Kokia garantija?",
      a: "24 mėnesių gamintojo garantija visoms dalims. Gedimo atveju įrenginį suremontuosime arba pakeisime.",
    },
    {
      q: "Ar KalkMate veikia lietuviškai?",
      a: "Taip. Skaičiuotuvas veikia 11 kalbomis: lietuvių, lenkų, anglų, vokiečių, čekų, slovakų, baltarusių, ispanų, portugalų, prancūzų ir italų. Kalbą pakeisi meniu Nustatymai → Kalba — DI tada atsako pasirinkta kalba, net jei užduotis nuotraukoje parašyta kita kalba. Parduotuvė ir naudotojo skydelis taip pat prieinami visomis 11 kalbomis.",
    },
  ],
  be: [
    {
      q: "Ці з’яўляецца KalkMate ШІ-калькулятарам з камерай?",
      a: "Так — KalkMate гэта ШІ-калькулятар з камерай: ён фатаграфуе задачу і паказвае на экране поўнае рашэнне крок за крокам. Корпус, клавіятура і экран такія ж, як у звычайных простых калькулятараў. Рэжым ШІ ўключаецца схаванай камбінацыяй клавіш — няма ніякіх значкоў ці індыкатараў, якія маглі б цябе выдаць.",
    },
    {
      q: "Чым KalkMate адрозніваецца ад праграм накшталт Photomath ці Gauth?",
      a: "KalkMate — фізічная прылада, а не праграма ў тэлефоне, а тэлефоны і смарт-гадзіннікі на экзамене забароненыя. Photomath ці Gauth выдатна падыходзяць для вучобы дома, але падчас самога экзамену імі не скарыстаешся. KalkMate выглядае і працуе як звычайны дазволены просты калькулятар, таму ШІ ў цябе пад рукой і падчас самога тэсту.",
    },
    {
      q: "Якія прадметы падтрымлівае ШІ?",
      a: "Рэжым «Экзамен» настроены пад выпускныя экзамены: матэматыка (базавы і павышаны ўзровень), фізіка, хімія і біялогія. Для ўсяго астатняга ёсць рэжым «Чысты ШІ» (пераключаеш яго ў панэлі на kalkmate.pl) — ён працуе як агульны ШІ-асістэнт і рашае задачы з любога прадмета, у тым ліку з універсітэцкіх курсаў: электратэхніка, статыка і механіка, эканоміка, бухгалтарскі ўлік, інфарматыка ці замежныя мовы.",
    },
    {
      q: "Ці патрэбны Wi-Fi?",
      a: "Рэжым ШІ патрабуе Wi-Fi 2,4 ГГц (5 ГГц не падтрымліваецца) — сетку выбіраеш на самім калькулятары ў Налады → WiFi і акаўнт. Прасцей за ўсё скарыстацца хот-спотам з тэлефона (на iPhone уключы «Максимальная совместимость» / «Maximize Compatibility»). Сеткі, дзе трэба ўваходзіць праз вэб-старонку (у гатэлях, школах), не спрацуюць. Класічны рэжым калькулятара заўсёды працуе без інтэрнэту. SIM-карты няма.",
    },
    {
      q: "Ці патрэбна падпіска на ШІ?",
      a: "Не. ШІ працуе на токенах з твайго акаўнта, без падпіскі. У камплекце — 2 млн ШІ-токенаў (код у каробцы), а кожны новы акаўнт атрымлівае 200 тыс. токенаў на старт. Калі яны скончацца, дакупіш пакет токенаў у панэлі на kalkmate.pl/panel.",
    },
    {
      q: "Колькі працуе батарэя?",
      a: "Каля 6 гадзін у змешаным рэжыме (ШІ + калькулятар). У рэжыме самога калькулятара — значна даўжэй. Зарадка праз USB-C займае каля 2 гадзін.",
    },
    {
      q: "Ці ў бяспецы мае даныя?",
      a: "Фота і запыты перадаюцца па зашыфраваным HTTPS. Пасля апрацоўкі мы не захоўваем фота — яны выдаляюцца з сервера адразу пасля адпраўкі адказу.",
    },
    {
      q: "Калі я атрымаю заказ?",
      a: "Кожны калькулятар мы збіраем уручную: звычайна 1–2 тыдні з моманту паступлення аплаты (максімум 4 тыдні). За межы Польшчы адпраўляем кур’ерам — ЕС 20 €, астатні свет (у тым ліку ЗША і Канада) 35 € — таму агулам звычайна выходзіць 2–4 тыдні. Экспрэс-дастаўкі няма; калі калькулятар патрэбны да пэўнай даты, напішы на kontakt@kalkmate.pl перад заказам. Нумар адпраўлення прыйдзе на e-mail.",
    },
    {
      q: "На колькі задач хопіць токенаў з камплекта?",
      a: "Залежыць ад даўжыні рашэння і мадэлі ШІ, абранай у панэлі. З мадэллю па змаўчанні адна сфатаграфаваная задача звычайна расходуе ад некалькіх да больш як дзесяці тысяч токенаў, таму 2,2 млн стартавых токенаў (2 млн з кода ў каробцы + 200 тыс. за стварэнне акаўнта) хопіць на некалькі сотняў задач. Токены не згараюць і самі не аднаўляюцца — баланс бачыш у панэлі, а калі яны скончацца, дакупіш пакет.",
    },
    {
      q: "Дзе можна паглядзець, як гэта працуе на сапраўднай прыладзе?",
      a: "На старонцы дапамогі (kalkmate.pl/be/pomoc) ёсць відэа з сапраўдным KalkMate: першы запуск і праца з клавішамі, а фота прылады знойдзеш у галерэі на галоўнай старонцы. Ёсць канкрэтнае пытанне пра тое, як ён працуе? Напішы ў чат або на kontakt@kalkmate.pl.",
    },
    {
      q: "Якая гарантыя?",
      a: "24 месяцы гарантыі вытворцы на ўсе кампаненты. У выпадку няспраўнасці мы адрамантуем або заменім прыладу.",
    },
    {
      q: "Ці працуе KalkMate па-беларуску?",
      a: "Так. Калькулятар працуе на 11 мовах: беларускай, польскай, англійскай, нямецкай, чэшскай, славацкай, літоўскай, іспанскай, партугальскай, французскай і італьянскай. Мову змяняеш у Налады → Мова — ШІ тады адказвае на абранай мове, нават калі задача на фота напісаная на іншай. Крама і панэль карыстальніка таксама даступныя на ўсіх 11 мовах.",
    },
  ],
  es: [
    {
      q: "¿KalkMate es una calculadora con IA y cámara?",
      a: "Sí: KalkMate es una calculadora con IA y cámara que fotografía el problema y muestra en pantalla la solución completa paso a paso. La carcasa, el teclado y la pantalla son idénticos a los de una calculadora básica normal. El modo IA se activa con una combinación de teclas oculta: no hay iconos ni indicadores que puedan delatarte.",
    },
    {
      q: "¿En qué se diferencia KalkMate de apps como Photomath o Gauth?",
      a: "KalkMate es un dispositivo físico, no una app para el móvil, y los móviles y relojes inteligentes están prohibidos en el aula del examen. Photomath o Gauth van genial para estudiar en casa, pero no puedes usarlas durante el examen. KalkMate tiene el aspecto y el funcionamiento de una calculadora básica permitida, así que tienes la IA contigo también durante la prueba.",
    },
    {
      q: "¿Qué asignaturas cubre la IA?",
      a: "El modo «Examen» está ajustado para los exámenes finales de bachillerato: matemáticas (nivel básico y avanzado), física, química y biología. Para todo lo demás está el modo «IA pura» (lo cambias en tu panel en kalkmate.pl): funciona como un asistente de IA general y resuelve problemas de cualquier asignatura, también de la universidad: electrotecnia, estática y mecánica, economía, contabilidad, informática o idiomas.",
    },
    {
      q: "¿Necesito wifi?",
      a: "El modo IA necesita wifi de 2,4 GHz (5 GHz no es compatible): la red se elige en la propia calculadora, en Ajustes → WiFi y cuenta. Lo más fácil es usar el punto de acceso de tu móvil (en el iPhone activa «Maximizar compatibilidad»). No funcionan las redes que piden iniciar sesión en una página web (hoteles, centros educativos). El modo de calculadora clásica funciona sin conexión en todo momento. No lleva tarjeta SIM.",
    },
    {
      q: "¿La IA necesita suscripción?",
      a: "No. La IA funciona con tokens de tu cuenta, sin suscripción. La caja incluye 2 millones de tokens de IA (código dentro) y cada cuenta nueva recibe 200.000 tokens para empezar. Cuando se acaben, puedes comprar un paquete de tokens en tu panel en kalkmate.pl/panel.",
    },
    {
      q: "¿Cuánto dura la batería?",
      a: "Unas 6 horas en uso mixto (IA + calculadora). Solo en modo calculadora dura bastante más. La carga por USB-C tarda unas 2 horas.",
    },
    {
      q: "¿Están seguros mis datos?",
      a: "Las fotos y consultas se envían cifradas por HTTPS. No guardamos las fotos después de procesarlas: se eliminan del servidor en cuanto se envía la respuesta.",
    },
    {
      q: "¿Cuándo recibiré mi pedido?",
      a: "Cada calculadora se monta a mano: normalmente 1–2 semanas desde que se confirma el pago (máximo 4 semanas). Fuera de Polonia enviamos por mensajería (UE 20 €, resto del mundo, incluidos EE. UU. y Canadá, 35 €), así que en total suele tardar 2–4 semanas. No tenemos envío urgente; si la necesitas para una fecha concreta, escribe a kontakt@kalkmate.pl antes de hacer el pedido. Recibirás el número de seguimiento por correo electrónico.",
    },
    {
      q: "¿Para cuántos problemas dan los tokens incluidos?",
      a: "Depende de la longitud de la solución y del modelo de IA elegido en tu panel. Con el modelo predeterminado, un problema fotografiado suele gastar entre unos pocos miles y algo más de diez mil tokens, así que los 2,2 millones de tokens iniciales (2 millones del código de la caja + 200.000 por crear la cuenta) dan para varios cientos de problemas. Los tokens no caducan ni se renuevan solos: ves tu saldo en el panel y puedes comprar un paquete cuando se acaben.",
    },
    {
      q: "¿Dónde puedo verla funcionando en un dispositivo real?",
      a: "En nuestra página de ayuda (kalkmate.pl/es/pomoc) hay vídeos de un KalkMate real: el primer encendido y cómo funcionan las teclas, y en la galería de la página principal encontrarás fotos del dispositivo. ¿Tienes alguna pregunta concreta sobre su funcionamiento? Escríbenos en el chat o a kontakt@kalkmate.pl.",
    },
    {
      q: "¿Qué garantía tiene?",
      a: "24 meses de garantía del fabricante en todos los componentes. Si hay una avería, reparamos o sustituimos el dispositivo.",
    },
    {
      q: "¿KalkMate funciona en español?",
      a: "Sí. La calculadora funciona en 11 idiomas: español, polaco, inglés, alemán, checo, eslovaco, lituano, bielorruso, portugués, francés e italiano. El idioma se cambia en Ajustes → Idioma, y la IA responde en el idioma elegido, aunque el problema de la foto esté escrito en otro. La tienda y el panel de usuario también están disponibles en los 11 idiomas.",
    },
  ],
  pt: [
    {
      q: "O KalkMate é uma calculadora com IA e câmara?",
      a: "Sim — o KalkMate é uma calculadora com IA e câmara: fotografa o exercício e mostra no ecrã a resolução completa passo a passo. A caixa, o teclado e o ecrã são idênticos aos de uma calculadora simples comum. O modo IA ativa-se com uma combinação de teclas escondida — não há ícones nem indicadores que te possam denunciar.",
    },
    {
      q: "Em que é que o KalkMate é diferente de apps como o Photomath ou o Gauth?",
      a: "O KalkMate é um dispositivo físico, não uma app de telemóvel — e telemóveis e smartwatches são proibidos na sala de exame. O Photomath ou o Gauth são ótimos para estudar em casa, mas não os podes usar durante o exame. O KalkMate tem o aspeto e o funcionamento de uma calculadora simples permitida, por isso tens a IA contigo também durante a prova.",
    },
    {
      q: "Que disciplinas a IA suporta?",
      a: "O modo «Exame» está afinado para os exames finais do secundário: matemática (nível básico e avançado), física, química e biologia. Para tudo o resto há o modo «IA pura» (escolhes no painel em kalkmate.pl) — funciona como um assistente de IA geral e resolve exercícios de qualquer disciplina, incluindo cadeiras da universidade: engenharia eletrotécnica, estática e mecânica, economia, contabilidade, informática ou línguas estrangeiras.",
    },
    {
      q: "Preciso de Wi-Fi?",
      a: "O modo IA precisa de Wi-Fi de 2,4 GHz (5 GHz não é suportado) — escolhes a rede na própria calculadora, em Definições → WiFi e conta. O mais simples é usar o hotspot do telemóvel (no iPhone ativa «Maximizar compatibilidade»). Redes que exigem início de sessão através de uma página web (hotéis, escolas) não funcionam. O modo de calculadora clássica funciona sempre offline. Não tem cartão SIM.",
    },
    {
      q: "A IA precisa de subscrição?",
      a: "Não. A IA funciona com tokens da tua conta, sem subscrição. A caixa inclui 2 milhões de tokens de IA (código lá dentro) e cada conta nova recebe 200 mil tokens para começar. Quando acabarem, podes comprar um pacote de tokens no painel em kalkmate.pl/panel.",
    },
    {
      q: "Quanto tempo dura a bateria?",
      a: "Cerca de 6 horas em uso misto (IA + calculadora). Só no modo calculadora dura bastante mais. O carregamento por USB-C demora cerca de 2 horas.",
    },
    {
      q: "Os meus dados estão seguros?",
      a: "As fotos e os pedidos são enviados de forma cifrada por HTTPS. Não guardamos as fotos depois de as processar — são apagadas do servidor logo após o envio da resposta.",
    },
    {
      q: "Quando recebo a minha encomenda?",
      a: "Cada calculadora é montada à mão: normalmente 1–2 semanas após a confirmação do pagamento (no máximo 4 semanas). Para fora da Polónia enviamos por transportadora — UE 20 €, resto do mundo (incl. EUA e Canadá) 35 € — por isso o prazo total é normalmente de 2–4 semanas. Não temos envio expresso; se precisares dela até uma data específica, escreve para kontakt@kalkmate.pl antes de encomendar. Recebes o número de seguimento por e-mail.",
    },
    {
      q: "Para quantos exercícios chegam os tokens incluídos?",
      a: "Depende do tamanho da resolução e do modelo de IA escolhido no painel. Com o modelo predefinido, um exercício fotografado gasta normalmente entre alguns milhares e pouco mais de dez mil tokens, por isso os 2,2 milhões de tokens iniciais (2 milhões do código na caixa + 200 mil por criares conta) chegam para várias centenas de exercícios. Os tokens não expiram nem se renovam sozinhos — vês o saldo no painel e, quando acabarem, podes comprar um pacote.",
    },
    {
      q: "Onde posso ver o KalkMate a funcionar num dispositivo real?",
      a: "Na página de ajuda (kalkmate.pl/pt/pomoc) há vídeos de um KalkMate real: o primeiro arranque e como funcionam as teclas; as fotos do dispositivo estão na galeria da página inicial. Tens uma pergunta concreta sobre o funcionamento? Escreve no chat ou para kontakt@kalkmate.pl.",
    },
    {
      q: "Qual é a garantia?",
      a: "24 meses de garantia do fabricante em todos os componentes. Em caso de avaria, reparamos ou substituímos o dispositivo.",
    },
    {
      q: "O KalkMate funciona em português?",
      a: "Sim. A calculadora funciona em 11 idiomas: português, polaco, inglês, alemão, checo, eslovaco, lituano, bielorrusso, espanhol, francês e italiano. Mudas o idioma em Definições → Idioma e a IA responde no idioma escolhido, mesmo que o exercício na foto esteja escrito noutra língua. A loja e o painel de utilizador também estão disponíveis nos 11 idiomas.",
    },
  ],
  fr: [
    {
      q: "KalkMate est-elle une calculatrice IA avec caméra ?",
      a: "Oui — KalkMate est une calculatrice IA avec caméra : elle photographie l’exercice et affiche à l’écran la solution complète, étape par étape. Le boîtier, le clavier et l’écran sont identiques à ceux d’une calculatrice simple classique. Le mode IA se lance avec une combinaison de touches cachée — aucune icône ni aucun voyant ne peut te trahir.",
    },
    {
      q: "En quoi KalkMate diffère-t-elle d’applis comme Photomath ou Gauth ?",
      a: "KalkMate est un appareil physique, pas une appli pour téléphone — et les téléphones comme les montres connectées sont interdits en salle d’examen. Photomath ou Gauth sont parfaits pour réviser à la maison, mais impossible de les utiliser pendant l’épreuve. KalkMate ressemble à une calculatrice simple autorisée et fonctionne comme elle : tu as donc l’IA avec toi pendant l’examen lui-même.",
    },
    {
      q: "Quelles matières l’IA prend-elle en charge ?",
      a: "Le mode « Examen » est optimisé pour les examens de fin de lycée : mathématiques (niveau de base et approfondi), physique, chimie et biologie. Pour tout le reste, il y a le mode « IA brute » (à activer dans ton espace sur kalkmate.pl) — il fonctionne comme un assistant IA généraliste et résout des exercices de n’importe quelle matière, y compris de niveau universitaire : électrotechnique, statique et mécanique, économie, comptabilité, informatique ou langues étrangères.",
    },
    {
      q: "Ai-je besoin du Wi-Fi ?",
      a: "Le mode IA nécessite un Wi-Fi 2,4 GHz (le 5 GHz n’est pas pris en charge) — tu choisis le réseau directement sur la calculatrice, dans Paramètres → WiFi et compte. Le plus simple est d’utiliser le partage de connexion de ton téléphone (sur iPhone, active « Optimiser la compatibilité »). Les réseaux qui demandent une connexion via une page web (hôtels, écoles) ne fonctionnent pas. Le mode calculatrice classique fonctionne hors ligne en permanence. Il n’y a pas de carte SIM.",
    },
    {
      q: "Faut-il un abonnement pour l’IA ?",
      a: "Non. L’IA fonctionne avec les tokens de ton compte, sans abonnement. La boîte contient 2 millions de tokens IA (code à l’intérieur) et chaque nouveau compte reçoit 200 000 tokens pour démarrer. Une fois épuisés, tu peux acheter un pack de tokens dans ton espace sur kalkmate.pl/panel.",
    },
    {
      q: "Quelle est l’autonomie de la batterie ?",
      a: "Environ 6 heures en usage mixte (IA + calculatrice). En mode calculatrice seul, elle tient nettement plus longtemps. La recharge en USB-C prend environ 2 heures.",
    },
    {
      q: "Mes données sont-elles en sécurité ?",
      a: "Les photos et les requêtes sont envoyées de façon chiffrée via HTTPS. Nous ne conservons pas les photos après traitement : elles sont supprimées du serveur dès que la réponse est envoyée.",
    },
    {
      q: "Quand vais-je recevoir ma commande ?",
      a: "Chaque calculatrice est assemblée à la main : en général 1 à 2 semaines après la réception du paiement (4 semaines maximum). Hors de Pologne, nous expédions par transporteur — UE 20 €, reste du monde (y compris États-Unis et Canada) 35 € — soit au total 2 à 4 semaines en général. Il n’y a pas de livraison express ; si tu en as besoin pour une date précise, écris à kontakt@kalkmate.pl avant de commander. Tu reçois le numéro de suivi par e-mail.",
    },
    {
      q: "Pour combien d’exercices les tokens inclus suffisent-ils ?",
      a: "Cela dépend de la longueur de la solution et du modèle IA choisi dans ton espace. Avec le modèle par défaut, un exercice photographié consomme en général de quelques milliers à un peu plus de dix mille tokens : les 2,2 millions de tokens de départ (2 millions grâce au code dans la boîte + 200 000 pour la création du compte) suffisent donc pour plusieurs centaines d’exercices. Les tokens n’expirent pas et ne se rechargent pas tout seuls — tu vois ton solde dans ton espace et tu peux acheter un pack quand ils sont épuisés.",
    },
    {
      q: "Où puis-je voir KalkMate fonctionner sur un vrai appareil ?",
      a: "Notre page d’aide (kalkmate.pl/fr/pomoc) propose des vidéos d’une vraie KalkMate : la première mise en route et le fonctionnement des touches ; tu trouveras aussi des photos de l’appareil dans la galerie de la page d’accueil. Une question précise sur son fonctionnement ? Pose-la dans le chat ou écris à kontakt@kalkmate.pl.",
    },
    {
      q: "Quelle est la garantie ?",
      a: "24 mois de garantie constructeur sur tous les composants. En cas de panne, nous réparons ou remplaçons l’appareil.",
    },
    {
      q: "KalkMate fonctionne-t-elle en français ?",
      a: "Oui. La calculatrice fonctionne en 11 langues : français, polonais, anglais, allemand, tchèque, slovaque, lituanien, biélorusse, espagnol, portugais et italien. Tu changes la langue dans Paramètres → Langue, et l’IA répond alors dans la langue choisie, même si l’exercice sur la photo est rédigé dans une autre langue. La boutique et l’espace utilisateur sont eux aussi disponibles dans les 11 langues.",
    },
  ],
  it: [
    {
      q: "KalkMate è una calcolatrice con IA e fotocamera?",
      a: "Sì — KalkMate è una calcolatrice con IA e fotocamera: fotografa l’esercizio e mostra sul display la soluzione completa passo dopo passo. Scocca, tastiera e display sono identici a quelli di una normale calcolatrice semplice. La modalità IA si attiva con una combinazione di tasti nascosta: non ci sono icone né spie che possano tradirti.",
    },
    {
      q: "In cosa KalkMate è diversa da app come Photomath o Gauth?",
      a: "KalkMate è un dispositivo fisico, non un’app per smartphone — e telefoni e smartwatch sono vietati in aula d’esame. Photomath o Gauth sono ottime per studiare a casa, ma durante l’esame vero e proprio non puoi usarle. KalkMate ha l’aspetto e il funzionamento di una calcolatrice semplice consentita, quindi hai l’IA con te anche durante la prova.",
    },
    {
      q: "Quali materie supporta l’IA?",
      a: "La modalità «Esame» è ottimizzata per l’esame di maturità: matematica (livello base e avanzato), fisica, chimica e biologia. Per tutto il resto c’è la modalità «IA pura» (la attivi nel pannello su kalkmate.pl): funziona come un assistente IA generico e risolve esercizi di qualsiasi materia, anche universitari: elettrotecnica, statica e meccanica, economia, contabilità, informatica o lingue straniere.",
    },
    {
      q: "Mi serve il Wi-Fi?",
      a: "La modalità IA richiede il Wi-Fi a 2,4 GHz (il 5 GHz non è supportato): scegli la rete direttamente sulla calcolatrice, in Impostazioni → WiFi e account. La soluzione più semplice è l’hotspot del telefono (su iPhone attiva «Massimizza compatibilità»). Le reti che richiedono l’accesso tramite una pagina web (hotel, scuole) non funzionano. La modalità calcolatrice classica funziona sempre offline. Non c’è nessuna SIM.",
    },
    {
      q: "Serve un abbonamento per l’IA?",
      a: "No. L’IA funziona con i token del tuo account, senza abbonamento. Nella confezione trovi 2 milioni di token IA (codice nella scatola) e ogni nuovo account riceve 200.000 token per iniziare. Quando finiscono, puoi acquistare un pacchetto di token nel pannello su kalkmate.pl/panel.",
    },
    {
      q: "Quanto dura la batteria?",
      a: "Circa 6 ore in uso misto (IA + calcolatrice). La sola modalità calcolatrice dura molto di più. La ricarica tramite USB-C richiede circa 2 ore.",
    },
    {
      q: "I miei dati sono al sicuro?",
      a: "Foto e richieste vengono inviate in modo cifrato tramite HTTPS. Non conserviamo le foto dopo l’elaborazione: vengono eliminate dal server subito dopo l’invio della risposta.",
    },
    {
      q: "Quando riceverò il mio ordine?",
      a: "Ogni calcolatrice è assemblata a mano: di solito 1–2 settimane dall’accredito del pagamento (massimo 4 settimane). Fuori dalla Polonia spediamo con corriere — UE 20 €, resto del mondo (inclusi USA e Canada) 35 € — quindi in totale di solito 2–4 settimane. Non offriamo la spedizione espressa; se ti serve entro una data precisa, scrivi a kontakt@kalkmate.pl prima di ordinare. Riceverai il numero di tracking via e-mail.",
    },
    {
      q: "Per quanti esercizi bastano i token inclusi?",
      a: "Dipende dalla lunghezza della soluzione e dal modello IA scelto nel pannello. Con il modello predefinito, un esercizio fotografato consuma di solito da qualche migliaio a poco più di diecimila token, quindi i 2,2 milioni di token iniziali (2 milioni dal codice nella scatola + 200.000 per la creazione dell’account) bastano per diverse centinaia di esercizi. I token non scadono e non si ricaricano da soli: vedi il saldo nel pannello e, quando finiscono, puoi acquistare un pacchetto.",
    },
    {
      q: "Dove posso vedere KalkMate in funzione su un dispositivo reale?",
      a: "Nella pagina di aiuto (kalkmate.pl/it/pomoc) trovi i video di una vera KalkMate: la prima accensione e l’uso dei tasti; le foto del dispositivo sono nella galleria della home page. Hai una domanda precisa sul funzionamento? Scrivi in chat o a kontakt@kalkmate.pl.",
    },
    {
      q: "Che garanzia c’è?",
      a: "24 mesi di garanzia del produttore su tutti i componenti. In caso di guasto ripariamo o sostituiamo il dispositivo.",
    },
    {
      q: "KalkMate funziona in italiano?",
      a: "Sì. La calcolatrice funziona in 11 lingue: italiano, polacco, inglese, tedesco, ceco, slovacco, lituano, bielorusso, spagnolo, portoghese e francese. Cambi la lingua in Impostazioni → Lingua e l’IA risponde nella lingua scelta, anche se l’esercizio nella foto è scritto in un’altra lingua. Anche lo shop e il pannello utente sono disponibili in tutte le 11 lingue.",
    },
  ],
};
