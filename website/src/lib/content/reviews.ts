import { type Locale } from "@/lib/i18n";
import source from "./reviews-source.json";

export type Review = {
  author: string;
  location: string;
  rating: 1 | 2 | 3 | 4 | 5;
  date: string;
  body: string;
  /** false = opinia bez potwierdzonego zakupu (nie pokazujemy odznaki).
   *  undefined = jak dotad (starsze, tlumaczone opinie innych jezykow). */
  verified?: boolean;
};

// Opinie PL: prawdziwe dane (formularz Google + opinie z Allegro sprzed
// sklepu), wyeksportowane do reviews-source.json z oryginalnymi polami.
// Pokazujemy TYLKO te ze zgoda na publikacje; odznaka "zweryfikowany zakup"
// tylko tam, gdzie zweryfikowany_zakup = true. Najnowsze na poczatku.
type SourceReview = {
  id: number;
  tresc_opinii: string;
  ocena: number;
  imie: string;
  data: string; // "YYYY-MM-DD HH:mm"
  miasto: string;
  jezyk: string;
  zweryfikowany_zakup: boolean;
  zgoda_na_publikacje: boolean;
};

const realReviewsPl: Review[] = (source as SourceReview[])
  .filter((r) => r.zgoda_na_publikacje)
  .sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : b.id - a.id))
  .map((r) => ({
    author: r.imie,
    location: r.miasto,
    rating: Math.min(5, Math.max(1, Math.round(r.ocena))) as Review["rating"],
    date: r.data.slice(0, 10),
    body: r.tresc_opinii,
    verified: r.zweryfikowany_zakup,
  }));

// Pozostale jezyki: tlumaczone opinie jak dotad (bez zmian).
const translatedReviews: Record<Exclude<Locale, "pl">, Review[]> = {
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
  cs: [
    {
      author: "Marek K.",
      location: "Krakov",
      rating: 5,
      date: "2026-04-02",
      body: "Před maturitou z rozšířené matiky ho používám každý den. Integrály, analytická geometrie, kombinatorika. Dám to pod kameru a mám kompletní řešení. Upřímně jsem nevěřil, že to bude takhle fungovat.",
    },
    {
      author: "Anna W.",
      location: "Varšava",
      rating: 5,
      date: "2026-03-18",
      body: "Táta mi ho koupil na fyziku, protože doučování bylo moc drahé. V cvičném testu jsem měla 78 % místo 52 %. Nevím, jestli je to jen díky kalkulačce, ale hodně mi pomohla se silami a elektřinou.",
    },
    {
      author: "Petr S.",
      location: "Vratislav",
      rating: 5,
      date: "2026-04-10",
      body: "Zvenku vypadá úplně jako normální jednoduchá kalkulačka. Nikdo ve škole neví, co to je. Organická chemie a stechiometrie díky tomu přestaly být problém.",
    },
    {
      author: "Zofie M.",
      location: "Gdaňsk",
      rating: 5,
      date: "2026-03-25",
      body: "Rozšířená biologie byla noční můra, hlavně genetika a křížení. Teď prostě vyfotím úlohu a čtu, jak se řeší krok za krokem. Vřele doporučuju.",
    },
    {
      author: "Tomáš L.",
      location: "Poznaň",
      rating: 4,
      date: "2026-04-05",
      body: "Celkově fajn produkt. Baterie vydrží celý den učení. Jednou při slabém světle nechtěla úlohu pořádně přečíst, ale po lepším osvětlení v pohodě. Dobrý nákup.",
    },
    {
      author: "Kateřina R.",
      location: "Lodž",
      rating: 5,
      date: "2026-04-14",
      body: "Místo doučování za 30 eur na hodinu mám tohle. Jednorázový výdaj a funguje na všechny předměty. Máma byla skeptická, ale teď si taky myslí, že to byl dobrý nápad.",
    },
  ],
  sk: [
    {
      author: "Marek K.",
      location: "Krakov",
      rating: 5,
      date: "2026-04-02",
      body: "Pred maturitou z rozšírenej matiky ho používam každý deň. Integrály, analytická geometria, kombinatorika. Dám to pod kameru a mám kompletné riešenie. Úprimne som neveril, že to bude takto fungovať.",
    },
    {
      author: "Anna W.",
      location: "Varšava",
      rating: 5,
      date: "2026-03-18",
      body: "Otec mi ho kúpil na fyziku, lebo doučovanie bolo príliš drahé. V cvičnom teste som mala 78 % namiesto 52 %. Neviem, či je to len vďaka kalkulačke, ale veľmi mi pomohla so silami a elektrinou.",
    },
    {
      author: "Peter S.",
      location: "Vroclav",
      rating: 5,
      date: "2026-04-10",
      body: "Zvonku vyzerá úplne ako normálna jednoduchá kalkulačka. Nikto v škole nevie, čo to je. Organická chémia a stechiometria vďaka tomu prestali byť problém.",
    },
    {
      author: "Zuzana M.",
      location: "Gdansk",
      rating: 5,
      date: "2026-03-25",
      body: "Rozšírená biológia bola nočná mora, hlavne genetika a kríženie. Teraz jednoducho odfotím úlohu a čítam, ako sa rieši krok za krokom. Vrelo odporúčam.",
    },
    {
      author: "Tomáš L.",
      location: "Poznaň",
      rating: 4,
      date: "2026-04-05",
      body: "Celkovo fajn produkt. Batéria vydrží celý deň učenia. Raz pri slabom svetle nechcela úlohu poriadne prečítať, ale po lepšom osvetlení v pohode. Dobrý nákup.",
    },
    {
      author: "Katarína R.",
      location: "Lodž",
      rating: 5,
      date: "2026-04-14",
      body: "Namiesto doučovania za 30 eur na hodinu mám toto. Jednorazový výdavok a funguje na všetky predmety. Mama bola skeptická, ale teraz si tiež myslí, že to bol dobrý nápad.",
    },
  ],
  lt: [
    {
      author: "Markas K.",
      location: "Krokuva",
      rating: 5,
      date: "2026-04-02",
      body: "Prieš išplėstinės matematikos egzaminą naudoju kasdien. Integralai, analizinė geometrija, kombinatorika. Atkišu po kamera ir turiu visą sprendimą. Atvirai, netikėjau, kad tai taip veiks.",
    },
    {
      author: "Ona V.",
      location: "Varšuva",
      rating: 5,
      date: "2026-03-18",
      body: "Tėtis nupirko man fizikai, nes korepetitorius buvo per brangus. Bandomajame egzamine gavau 78 % vietoj 52 %. Nežinau, ar vien dėl skaičiuotuvo, bet labai padėjo su jėgomis ir elektra.",
    },
    {
      author: "Petras S.",
      location: "Vroclavas",
      rating: 5,
      date: "2026-04-10",
      body: "Iš išorės atrodo visai kaip paprastas skaičiuotuvas. Niekas mokykloje nežino, kas tai. Organinė chemija ir stechiometrija nustojo būti problema.",
    },
    {
      author: "Sofija M.",
      location: "Gdanskas",
      rating: 5,
      date: "2026-03-25",
      body: "Išplėstinė biologija buvo košmaras, ypač genetika ir kryžminimo uždaviniai. Dabar tiesiog nufotografuoju užduotį ir skaitau, kaip ją išspręsti žingsnis po žingsnio. Labai rekomenduoju.",
    },
    {
      author: "Tomas L.",
      location: "Poznanė",
      rating: 4,
      date: "2026-04-05",
      body: "Apskritai neblogas produktas. Baterija išlaiko visą mokymosi dieną. Kartą esant prastam apšvietimui sunkiai nuskaitė užduotį, bet pagerinus šviesą viskas gerai. Geras pirkinys.",
    },
    {
      author: "Kotryna R.",
      location: "Lodzė",
      rating: 5,
      date: "2026-04-14",
      body: "Vietoj korepetitoriaus už 30 eurų per valandą turiu šitą. Vienkartinė išlaida ir tinka visiems dalykams. Mama buvo skeptiška, bet dabar ir ji mano, kad tai buvo gera mintis.",
    },
  ],
  be: [
    {
      author: "Марак К.",
      location: "Кракаў",
      rating: 5,
      date: "2026-04-02",
      body: "Перад экзаменам па матэматыцы павышанага ўзроўню карыстаюся кожны дзень. Інтэгралы, аналітычная геаметрыя, камбінаторыка. Наводжу камеру — і маю поўнае рашэнне. Шчыра, не верыў, што гэта так працуе.",
    },
    {
      author: "Ганна В.",
      location: "Варшава",
      rating: 5,
      date: "2026-03-18",
      body: "Тата купіў мне для фізікі, бо рэпетытар быў занадта дарагі. На пробным экзамене атрымала 78 % замест 52 %. Не ведаю, ці толькі дзякуючы калькулятару, але ён вельмі дапамог з сіламі і электрычнасцю.",
    },
    {
      author: "Пётр С.",
      location: "Вроцлаў",
      rating: 5,
      date: "2026-04-10",
      body: "Звонку выглядае як звычайны просты калькулятар. Ніхто ў школе не ведае, што гэта. Арганічная хімія і стэхіяметрыя дзякуючы яму перасталі быць праблемай.",
    },
    {
      author: "Зоф’я М.",
      location: "Гданьск",
      rating: 5,
      date: "2026-03-25",
      body: "Біялогія павышанага ўзроўню была кашмарам, асабліва генетыка і задачы на скрыжаванне. Цяпер проста фатаграфую задачу і чытаю, як яе рашаць крок за крокам. Вельмі раю.",
    },
    {
      author: "Тамаш Л.",
      location: "Познань",
      rating: 4,
      date: "2026-04-05",
      body: "Увогуле нядрэнны прадукт. Батарэі хапае на ўвесь дзень вучобы. Аднойчы пры слабым асвятленні ён дрэнна прачытаў задачу, але пасля лепшага святла ўсё ок. Добрая купля.",
    },
    {
      author: "Кася Р.",
      location: "Лодзь",
      rating: 5,
      date: "2026-04-14",
      body: "Замест рэпетытара за 30 еўра ў гадзіну ў мяне ёсць гэта. Аднаразовы выдатак — і працуе для ўсіх прадметаў. Мама была скептычная, але цяпер і яна лічыць, што гэта была добрая ідэя.",
    },
  ],
  es: [
    {
      author: "Marcos K.",
      location: "Cracovia",
      rating: 5,
      date: "2026-04-02",
      body: "Lo uso a diario antes del examen de matemáticas avanzadas. Integrales, geometría analítica, combinatoria. Lo pongo bajo la cámara y tengo la solución completa. La verdad, no creía que funcionara así de bien.",
    },
    {
      author: "Ana W.",
      location: "Varsovia",
      rating: 5,
      date: "2026-03-18",
      body: "Mi padre me lo compró para física porque las clases particulares eran demasiado caras. En el simulacro saqué un 78 % en vez de un 52 %. No sé si es solo por la calculadora, pero me ayudó muchísimo con fuerzas y electricidad.",
    },
    {
      author: "Pedro S.",
      location: "Breslavia",
      rating: 5,
      date: "2026-04-10",
      body: "Por fuera parece una calculadora básica normal. Nadie en el instituto sabe lo que es. La química orgánica y la estequiometría han dejado de ser un problema gracias a ella.",
    },
    {
      author: "Sofía M.",
      location: "Gdansk",
      rating: 5,
      date: "2026-03-25",
      body: "Biología avanzada era una pesadilla, sobre todo la genética y los cruces. Ahora simplemente fotografío el problema y leo cómo se resuelve paso a paso. Muy recomendable.",
    },
    {
      author: "Tomás L.",
      location: "Poznań",
      rating: 4,
      date: "2026-04-05",
      body: "En general, un buen producto. La batería aguanta un día entero de estudio. Una vez, con poca luz, le costó leer el problema, pero al mejorar la iluminación todo bien. Buena compra.",
    },
    {
      author: "Catalina R.",
      location: "Lodz",
      rating: 5,
      date: "2026-04-14",
      body: "En vez de clases particulares a 30 euros la hora, tengo esto. Un pago único y sirve para todas las asignaturas. Mi madre era escéptica, pero ahora también cree que fue buena idea.",
    },
  ],
  pt: [
    {
      author: "Marcos K.",
      location: "Cracóvia",
      rating: 5,
      date: "2026-04-02",
      body: "Uso todos os dias antes do exame de matemática avançada. Integrais, geometria analítica, combinatória. Ponho debaixo da câmara e tenho a resolução completa. Sinceramente, não acreditava que funcionasse assim.",
    },
    {
      author: "Ana W.",
      location: "Varsóvia",
      rating: 5,
      date: "2026-03-18",
      body: "O meu pai comprou-ma para física porque as explicações eram demasiado caras. No exame de treino tive 78 % em vez de 52 %. Não sei se foi só por causa da calculadora, mas ajudou-me imenso com forças e eletricidade.",
    },
    {
      author: "Pedro S.",
      location: "Breslávia",
      rating: 5,
      date: "2026-04-10",
      body: "Por fora parece mesmo uma calculadora simples normal. Ninguém na escola sabe o que é. A química orgânica e a estequiometria deixaram de ser um problema graças a ela.",
    },
    {
      author: "Sofia M.",
      location: "Gdansk",
      rating: 5,
      date: "2026-03-25",
      body: "Biologia avançada era um pesadelo, sobretudo a genética e os cruzamentos. Agora fotografo o exercício e leio como se resolve passo a passo. Recomendo muito.",
    },
    {
      author: "Tomás L.",
      location: "Poznań",
      rating: 4,
      date: "2026-04-05",
      body: "No geral, um bom produto. A bateria aguenta um dia inteiro de estudo. Uma vez, com pouca luz, teve dificuldade em ler o exercício, mas depois de melhorar a iluminação ficou tudo bem. Boa compra.",
    },
    {
      author: "Catarina R.",
      location: "Lodz",
      rating: 5,
      date: "2026-04-14",
      body: "Em vez de explicações a 30 euros à hora, tenho isto. Um custo único e serve para todas as disciplinas. A minha mãe estava cética, mas agora também acha que foi boa ideia.",
    },
  ],
  fr: [
    {
      author: "Marc K.",
      location: "Cracovie",
      rating: 5,
      date: "2026-04-02",
      body: "Je l’utilise tous les jours avant mon examen de maths approfondies. Intégrales, géométrie analytique, combinatoire. Je le mets sous la caméra et j’ai la solution complète. Honnêtement, je ne pensais pas que ça marcherait aussi bien.",
    },
    {
      author: "Anne W.",
      location: "Varsovie",
      rating: 5,
      date: "2026-03-18",
      body: "Mon père me l’a acheté pour la physique parce que les cours particuliers coûtaient trop cher. Au bac blanc, j’ai eu 78 % au lieu de 52 %. Je ne sais pas si c’est seulement grâce à la calculatrice, mais elle m’a beaucoup aidée pour les forces et l’électricité.",
    },
    {
      author: "Pierre S.",
      location: "Wrocław",
      rating: 5,
      date: "2026-04-10",
      body: "De l’extérieur, on dirait vraiment une calculatrice simple ordinaire. Personne au lycée ne sait ce que c’est. La chimie organique et la stœchiométrie ne sont plus un problème grâce à elle.",
    },
    {
      author: "Sophie M.",
      location: "Gdańsk",
      rating: 5,
      date: "2026-03-25",
      body: "La biologie approfondie, c’était un cauchemar, surtout la génétique et les croisements. Maintenant je photographie l’exercice et je lis comment le résoudre étape par étape. Je recommande vivement.",
    },
    {
      author: "Thomas L.",
      location: "Poznań",
      rating: 4,
      date: "2026-04-05",
      body: "Globalement un bon produit. La batterie tient une journée entière de révisions. Une fois, avec un mauvais éclairage, elle a eu du mal à lire l’exercice, mais en améliorant la lumière tout est rentré dans l’ordre. Bon achat.",
    },
    {
      author: "Catherine R.",
      location: "Łódź",
      rating: 5,
      date: "2026-04-14",
      body: "Au lieu de cours particuliers à 30 euros de l’heure, j’ai ça. Un seul achat et ça marche pour toutes les matières. Ma mère était sceptique, mais maintenant elle trouve aussi que c’était une bonne idée.",
    },
  ],
  it: [
    {
      author: "Marco K.",
      location: "Cracovia",
      rating: 5,
      date: "2026-04-02",
      body: "Lo uso ogni giorno prima dell’esame di matematica avanzata. Integrali, geometria analitica, calcolo combinatorio. Lo metto sotto la fotocamera e ho la soluzione completa. Sinceramente non pensavo funzionasse così bene.",
    },
    {
      author: "Anna W.",
      location: "Varsavia",
      rating: 5,
      date: "2026-03-18",
      body: "Mio padre me l’ha comprata per fisica perché le ripetizioni costavano troppo. Alla simulazione ho preso 78% invece di 52%. Non so se sia solo merito della calcolatrice, ma mi ha aiutata tantissimo con forze ed elettricità.",
    },
    {
      author: "Pietro S.",
      location: "Breslavia",
      rating: 5,
      date: "2026-04-10",
      body: "Da fuori sembra proprio una normale calcolatrice semplice. Nessuno a scuola sa cos’è. Chimica organica e stechiometria grazie a lei non sono più un problema.",
    },
    {
      author: "Sofia M.",
      location: "Danzica",
      rating: 5,
      date: "2026-03-25",
      body: "Biologia avanzata era un incubo, soprattutto genetica ed esercizi sugli incroci. Ora fotografo l’esercizio e leggo come si risolve passo dopo passo. Consigliatissima.",
    },
    {
      author: "Tommaso L.",
      location: "Poznań",
      rating: 4,
      date: "2026-04-05",
      body: "Nel complesso un buon prodotto. La batteria regge un’intera giornata di studio. Una volta, con poca luce, faceva fatica a leggere l’esercizio, ma migliorando l’illuminazione è andato tutto bene. Buon acquisto.",
    },
    {
      author: "Caterina R.",
      location: "Łódź",
      rating: 5,
      date: "2026-04-14",
      body: "Invece di ripetizioni a 30 euro l’ora ho questa. Una spesa una tantum e funziona per tutte le materie. Mia madre era scettica, ma ora anche lei pensa che sia stata una buona idea.",
    },
  ],
};

export const reviews: Record<Locale, Review[]> = {
  ...translatedReviews,
  pl: realReviewsPl,
};

// Ocena zbiorcza liczona z prawdziwych opinii (nie wpisana recznie).
const _ratingSum = realReviewsPl.reduce((sum, r) => sum + r.rating, 0);
export const aggregateRating = {
  ratingValue: (_ratingSum / realReviewsPl.length).toFixed(1),
  reviewCount: String(realReviewsPl.length),
  bestRating: "5",
  worstRating: "1",
};
