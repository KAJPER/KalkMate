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
      a: "Matematyka (poziom podstawowy i rozszerzony), fizyka, chemia i biologia. Model jest trenowany na tysiącach zadań z ostatnich 10 lat. Sukcesywnie dodajemy kolejne przedmioty.",
    },
    {
      q: "Czy potrzebuję WiFi?",
      a: "Tryb AI wymaga WiFi (konfigurujesz raz, w panelu użytkownika). Tryb klasycznego kalkulatora działa offline przez cały czas.",
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
      a: "Standardowy czas realizacji to 1–2 tygodnie od zaksięgowania płatności (maksymalnie 4 tygodnie). Po wysyłce dostawa Paczkomatem InPost zajmuje 1–2 dni robocze. Numer przesyłki dostajesz mailem.",
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
      a: "Mathematics (basic and extended level), physics, chemistry and biology. The model is trained on thousands of problems from the last 10 years. We keep adding more subjects.",
    },
    {
      q: "Do I need WiFi?",
      a: "AI mode requires WiFi (you configure it once in your user panel). The classic calculator mode works offline at all times.",
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
      a: "Standard processing time is 1–2 weeks from payment confirmation (up to 4 weeks maximum). After dispatch, InPost parcel-locker delivery takes 1–2 business days. You'll get your tracking number by email.",
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
      a: "Mathematik (Grund- und Leistungskurs), Physik, Chemie und Biologie. Das Modell ist auf Tausende von Aufgaben der letzten 10 Jahre trainiert. Wir ergänzen laufend weitere Fächer.",
    },
    {
      q: "Brauche ich WLAN?",
      a: "Der KI-Modus benötigt WLAN (du richtest es einmal im Benutzerbereich ein). Der klassische Taschenrechner-Modus funktioniert jederzeit offline.",
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
      a: "Die Standardbearbeitungszeit beträgt 1–2 Wochen ab Zahlungseingang (maximal 4 Wochen). Nach dem Versand dauert die Lieferung per InPost-Paketstation 1–2 Werktage. Die Sendungsnummer erhältst du per E-Mail.",
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
      a: "Matematiku (základní i rozšířenou úroveň), fyziku, chemii a biologii. Model je natrénovaný na tisících úloh z posledních 10 let. Postupně přidáváme další předměty.",
    },
    {
      q: "Potřebuji Wi-Fi?",
      a: "Režim AI vyžaduje Wi-Fi (nastavíš ji jednou v uživatelském panelu). Klasický režim kalkulačky funguje kdykoli offline.",
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
      a: "Standardní doba vyřízení je 1–2 týdny od připsání platby (maximálně 4 týdny). Po odeslání trvá doručení kurýrem obvykle 3–8 pracovních dnů. Číslo zásilky dostaneš e-mailem.",
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
      a: "Matematiku (základnú aj rozšírenú úroveň), fyziku, chémiu a biológiu. Model je natrénovaný na tisícoch úloh z posledných 10 rokov. Postupne pridávame ďalšie predmety.",
    },
    {
      q: "Potrebujem Wi-Fi?",
      a: "Režim AI vyžaduje Wi-Fi (nastavíš ju raz v používateľskom paneli). Klasický režim kalkulačky funguje kedykoľvek offline.",
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
      a: "Štandardná doba vybavenia je 1–2 týždne od pripísania platby (maximálne 4 týždne). Po odoslaní trvá doručenie kuriérom zvyčajne 3–8 pracovných dní. Číslo zásielky dostaneš e-mailom.",
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
      a: "Matematiką (bendrąjį ir išplėstinį kursą), fiziką, chemiją ir biologiją. Modelis apmokytas su tūkstančiais paskutinių 10 metų užduočių. Nuolat pridedame naujų dalykų.",
    },
    {
      q: "Ar man reikia Wi-Fi?",
      a: "DI režimui reikia Wi-Fi (jį nustatai vieną kartą naudotojo skydelyje). Klasikinis skaičiuotuvo režimas visada veikia ir be interneto.",
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
      a: "Įprastas įvykdymo laikas — 1–2 savaitės nuo mokėjimo įskaitymo (daugiausia 4 savaitės). Išsiuntus kurjeris paprastai pristato per 3–8 darbo dienas. Siuntos numerį gausi el. paštu.",
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
      a: "Матэматыку (базавы і павышаны ўзровень), фізіку, хімію і біялогію. Мадэль навучаная на тысячах задач за апошнія 10 гадоў. Мы паступова дадаём новыя прадметы.",
    },
    {
      q: "Ці патрэбны Wi-Fi?",
      a: "Рэжым ШІ патрабуе Wi-Fi (наладжваеш яго адзін раз у панэлі карыстальніка). Класічны рэжым калькулятара заўсёды працуе без інтэрнэту.",
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
      a: "Стандартны тэрмін выканання — 1–2 тыдні з моманту паступлення аплаты (максімум 4 тыдні). Пасля адпраўкі дастаўка кур’ерам па ЕС звычайна займае 3–8 працоўных дзён. Нумар адпраўлення прыйдзе на e-mail.",
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
      a: "Matemáticas (nivel básico y avanzado), física, química y biología. El modelo está entrenado con miles de problemas de los últimos 10 años. Vamos añadiendo más asignaturas.",
    },
    {
      q: "¿Necesito wifi?",
      a: "El modo IA necesita wifi (lo configuras una sola vez en tu panel de usuario). El modo de calculadora clásica funciona sin conexión en todo momento.",
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
      a: "El plazo de preparación habitual es de 1–2 semanas desde que se confirma el pago (máximo 4 semanas). Tras el envío, la entrega por mensajería suele tardar 3–8 días laborables. Recibirás el número de seguimiento por correo electrónico.",
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
      a: "Matemática (nível básico e avançado), física, química e biologia. O modelo foi treinado com milhares de exercícios dos últimos 10 anos. Estamos sempre a acrescentar novas disciplinas.",
    },
    {
      q: "Preciso de Wi-Fi?",
      a: "O modo IA precisa de Wi-Fi (configuras uma vez no painel de utilizador). O modo de calculadora clássica funciona sempre offline.",
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
      a: "O prazo normal de preparação é de 1–2 semanas após a confirmação do pagamento (no máximo 4 semanas). Depois do envio, a entrega por transportadora demora normalmente 3–8 dias úteis. Recebes o número de seguimento por e-mail.",
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
      a: "Les mathématiques (niveau de base et approfondi), la physique, la chimie et la biologie. Le modèle est entraîné sur des milliers d’exercices des 10 dernières années. Nous ajoutons régulièrement de nouvelles matières.",
    },
    {
      q: "Ai-je besoin du Wi-Fi ?",
      a: "Le mode IA nécessite le Wi-Fi (à configurer une seule fois dans ton espace utilisateur). Le mode calculatrice classique fonctionne hors ligne en permanence.",
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
      a: "Le délai de préparation habituel est de 1 à 2 semaines après la réception du paiement (4 semaines maximum). Après l’expédition, la livraison par transporteur prend généralement 3 à 8 jours ouvrés. Tu reçois le numéro de suivi par e-mail.",
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
      a: "Matematica (livello base e avanzato), fisica, chimica e biologia. Il modello è addestrato su migliaia di esercizi degli ultimi 10 anni. Aggiungiamo continuamente nuove materie.",
    },
    {
      q: "Mi serve il Wi-Fi?",
      a: "La modalità IA richiede il Wi-Fi (lo configuri una sola volta nel pannello utente). La modalità calcolatrice classica funziona sempre offline.",
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
      a: "Il tempo standard di evasione è di 1–2 settimane dall’accredito del pagamento (massimo 4 settimane). Dopo la spedizione, la consegna tramite corriere richiede di solito 3–8 giorni lavorativi. Riceverai il numero di tracking via e-mail.",
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
