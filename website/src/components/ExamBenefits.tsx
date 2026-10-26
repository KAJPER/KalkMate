import Reveal from "@/components/Reveal";
import { type Locale } from "@/lib/i18n";
import type { ReactNode } from "react";

type Subject = {
  code: string;
  name: string;
  sub: string;
  formula: string;
  bullets: string[];
  accent?: boolean;
};

type Stat = {
  value: ReactNode;
  label: string;
};

type Content = {
  eyebrow: string;
  heading: ReactNode;
  side: string;
  exampleLabel: string;
  subjects: Subject[];
  stats: Stat[];
};

const content: Record<Locale, Content> = {
  pl: {
    eyebrow: "[ 03 ] · Pokrycie przedmiotów",
    heading: (
      <>
        Cztery <span className="italic">kierunki</span><br />
        naukowe.
      </>
    ),
    side:
      "Trenowany na tysiącach zadań z ostatnich 10 lat. Rozpoznaje typ zadania, dobiera metodę rozwiązania, pokazuje pełne rozumowanie.",
    exampleLabel: "Przykład",
    subjects: [
      {
        code: "MAT",
        name: "Matematyka",
        sub: "podstawa · rozszerzenie",
        formula: "f(x) = ax² + bx + c",
        bullets: ["Funkcje, granice, pochodne", "Geometria analityczna", "Ciągi, prawd., kombinatoryka"],
        accent: true,
      },
      {
        code: "FIZ",
        name: "Fizyka",
        sub: "rozszerzenie",
        formula: "E = ½mv² + mgh",
        bullets: ["Mechanika, termodynamika", "Elektromagnetyzm", "Optyka, fizyka jądrowa"],
      },
      {
        code: "CHE",
        name: "Chemia",
        sub: "rozszerzenie",
        formula: "2H₂ + O₂ → 2H₂O",
        bullets: ["Stechiometria, równowagi", "Chemia organiczna", "Roztwory, elektrochemia"],
      },
      {
        code: "BIO",
        name: "Biologia",
        sub: "rozszerzenie",
        formula: "ATP ⇌ ADP + Pᵢ",
        bullets: ["Genetyka, biochemia", "Fizjologia, ekologia", "Ewolucja, biotechnologia"],
      },
    ],
    stats: [
      {
        value: (
          <>
            <span className="text-[#D8FF3D]">10</span> lat
          </>
        ),
        label: "lat danych treningowych",
      },
      {
        value: (
          <>
            <span className="text-[#D8FF3D]">94</span>%
          </>
        ),
        label: "Trafność rozwiązywania zadań",
      },
      {
        value: (
          <>
            <span className="text-[#D8FF3D]">1.2</span>s
          </>
        ),
        label: "Średni czas odpowiedzi",
      },
    ],
  },
  en: {
    eyebrow: "[ 03 ] · Subject coverage",
    heading: (
      <>
        Four <span className="italic">science</span><br />
        subjects.
      </>
    ),
    side:
      "Trained on thousands of problems from the last 10 years. It recognises the task type, picks the right method and shows the full reasoning.",
    exampleLabel: "Example",
    subjects: [
      {
        code: "MAT",
        name: "Mathematics",
        sub: "basic · extended",
        formula: "f(x) = ax² + bx + c",
        bullets: ["Functions, limits, derivatives", "Analytic geometry", "Sequences, probability, combinatorics"],
        accent: true,
      },
      {
        code: "FIZ",
        name: "Physics",
        sub: "extended",
        formula: "E = ½mv² + mgh",
        bullets: ["Mechanics, thermodynamics", "Electromagnetism", "Optics, nuclear physics"],
      },
      {
        code: "CHE",
        name: "Chemistry",
        sub: "extended",
        formula: "2H₂ + O₂ → 2H₂O",
        bullets: ["Stoichiometry, equilibria", "Organic chemistry", "Solutions, electrochemistry"],
      },
      {
        code: "BIO",
        name: "Biology",
        sub: "extended",
        formula: "ATP ⇌ ADP + Pᵢ",
        bullets: ["Genetics, biochemistry", "Physiology, ecology", "Evolution, biotechnology"],
      },
    ],
    stats: [
      {
        value: (
          <>
            <span className="text-[#D8FF3D]">10</span> years
          </>
        ),
        label: "years of training data",
      },
      {
        value: (
          <>
            <span className="text-[#D8FF3D]">94</span>%
          </>
        ),
        label: "Accuracy on exam problems",
      },
      {
        value: (
          <>
            <span className="text-[#D8FF3D]">1.2</span>s
          </>
        ),
        label: "Average response time",
      },
    ],
  },
  de: {
    eyebrow: "[ 03 ] · Fächerabdeckung",
    heading: (
      <>
        Vier <span className="italic">natur</span>-<br />
        wissenschaftliche Fächer.
      </>
    ),
    side:
      "Trainiert auf Tausenden von Aufgaben der letzten 10 Jahre. Er erkennt den Aufgabentyp, wählt die passende Methode und zeigt den vollständigen Lösungsweg.",
    exampleLabel: "Beispiel",
    subjects: [
      {
        code: "MAT",
        name: "Mathematik",
        sub: "Grund · Leistung",
        formula: "f(x) = ax² + bx + c",
        bullets: ["Funktionen, Grenzwerte, Ableitungen", "Analytische Geometrie", "Folgen, Wahrsch., Kombinatorik"],
        accent: true,
      },
      {
        code: "FIZ",
        name: "Physik",
        sub: "Leistung",
        formula: "E = ½mv² + mgh",
        bullets: ["Mechanik, Thermodynamik", "Elektromagnetismus", "Optik, Kernphysik"],
      },
      {
        code: "CHE",
        name: "Chemie",
        sub: "Leistung",
        formula: "2H₂ + O₂ → 2H₂O",
        bullets: ["Stöchiometrie, Gleichgewichte", "Organische Chemie", "Lösungen, Elektrochemie"],
      },
      {
        code: "BIO",
        name: "Biologie",
        sub: "Leistung",
        formula: "ATP ⇌ ADP + Pᵢ",
        bullets: ["Genetik, Biochemie", "Physiologie, Ökologie", "Evolution, Biotechnologie"],
      },
    ],
    stats: [
      {
        value: (
          <>
            <span className="text-[#D8FF3D]">10</span> Jahre
          </>
        ),
        label: "Jahre Trainingsdaten",
      },
      {
        value: (
          <>
            <span className="text-[#D8FF3D]">94</span>%
          </>
        ),
        label: "Trefferquote bei Aufgaben",
      },
      {
        value: (
          <>
            <span className="text-[#D8FF3D]">1.2</span>s
          </>
        ),
        label: "Durchschnittliche Antwortzeit",
      },
    ],
  },
  cs: {
    eyebrow: "[ 03 ] · Pokrytí předmětů",
    heading: (
      <>
        Čtyři <span className="italic">přírodovědné</span><br />
        předměty.
      </>
    ),
    side:
      "Natrénováno na tisících úloh z posledních 10 let. Rozpozná typ úlohy, zvolí správnou metodu a ukáže celý postup řešení.",
    exampleLabel: "Příklad",
    subjects: [
      {
        code: "MAT",
        name: "Matematika",
        sub: "základní · rozšířená",
        formula: "f(x) = ax² + bx + c",
        bullets: ["Funkce, limity, derivace", "Analytická geometrie", "Posloupnosti, pravděpodobnost, kombinatorika"],
        accent: true,
      },
      {
        code: "FYZ",
        name: "Fyzika",
        sub: "rozšířená",
        formula: "E = ½mv² + mgh",
        bullets: ["Mechanika, termodynamika", "Elektromagnetismus", "Optika, jaderná fyzika"],
      },
      {
        code: "CHE",
        name: "Chemie",
        sub: "rozšířená",
        formula: "2H₂ + O₂ → 2H₂O",
        bullets: ["Stechiometrie, rovnováhy", "Organická chemie", "Roztoky, elektrochemie"],
      },
      {
        code: "BIO",
        name: "Biologie",
        sub: "rozšířená",
        formula: "ATP ⇌ ADP + Pᵢ",
        bullets: ["Genetika, biochemie", "Fyziologie, ekologie", "Evoluce, biotechnologie"],
      },
    ],
    stats: [
      {
        value: (
          <>
            <span className="text-[#D8FF3D]">10</span> let
          </>
        ),
        label: "let trénovacích dat",
      },
      {
        value: (
          <>
            <span className="text-[#D8FF3D]">94</span>%
          </>
        ),
        label: "Přesnost řešení úloh",
      },
      {
        value: (
          <>
            <span className="text-[#D8FF3D]">1,2</span>s
          </>
        ),
        label: "Průměrná doba odpovědi",
      },
    ],
  },
  sk: {
    eyebrow: "[ 03 ] · Pokrytie predmetov",
    heading: (
      <>
        Štyri <span className="italic">prírodovedné</span><br />
        predmety.
      </>
    ),
    side:
      "Natrénovaný na tisíckach úloh z posledných 10 rokov. Rozpozná typ úlohy, zvolí správnu metódu a ukáže celý postup riešenia.",
    exampleLabel: "Príklad",
    subjects: [
      {
        code: "MAT",
        name: "Matematika",
        sub: "základná · rozšírená",
        formula: "f(x) = ax² + bx + c",
        bullets: ["Funkcie, limity, derivácie", "Analytická geometria", "Postupnosti, pravdepodobnosť, kombinatorika"],
        accent: true,
      },
      {
        code: "FYZ",
        name: "Fyzika",
        sub: "rozšírená",
        formula: "E = ½mv² + mgh",
        bullets: ["Mechanika, termodynamika", "Elektromagnetizmus", "Optika, jadrová fyzika"],
      },
      {
        code: "CHE",
        name: "Chémia",
        sub: "rozšírená",
        formula: "2H₂ + O₂ → 2H₂O",
        bullets: ["Stechiometria, rovnováhy", "Organická chémia", "Roztoky, elektrochémia"],
      },
      {
        code: "BIO",
        name: "Biológia",
        sub: "rozšírená",
        formula: "ATP ⇌ ADP + Pᵢ",
        bullets: ["Genetika, biochémia", "Fyziológia, ekológia", "Evolúcia, biotechnológia"],
      },
    ],
    stats: [
      {
        value: (
          <>
            <span className="text-[#D8FF3D]">10</span> rokov
          </>
        ),
        label: "rokov tréningových dát",
      },
      {
        value: (
          <>
            <span className="text-[#D8FF3D]">94</span>%
          </>
        ),
        label: "Presnosť riešenia úloh",
      },
      {
        value: (
          <>
            <span className="text-[#D8FF3D]">1,2</span>s
          </>
        ),
        label: "Priemerný čas odpovede",
      },
    ],
  },
  lt: {
    eyebrow: "[ 03 ] · Dalykų aprėptis",
    heading: (
      <>
        Keturi <span className="italic">mokslo</span><br />
        dalykai.
      </>
    ),
    side:
      "Apmokytas tūkstančiais užduočių iš pastarųjų 10 metų. Atpažįsta užduoties tipą, parenka tinkamą metodą ir parodo visą sprendimo eigą.",
    exampleLabel: "Pavyzdys",
    subjects: [
      {
        code: "MAT",
        name: "Matematika",
        sub: "bendrasis · išplėstinis",
        formula: "f(x) = ax² + bx + c",
        bullets: ["Funkcijos, ribos, išvestinės", "Analizinė geometrija", "Sekos, tikimybės, kombinatorika"],
        accent: true,
      },
      {
        code: "FIZ",
        name: "Fizika",
        sub: "išplėstinis",
        formula: "E = ½mv² + mgh",
        bullets: ["Mechanika, termodinamika", "Elektromagnetizmas", "Optika, branduolio fizika"],
      },
      {
        code: "CHE",
        name: "Chemija",
        sub: "išplėstinis",
        formula: "2H₂ + O₂ → 2H₂O",
        bullets: ["Stechiometrija, pusiausvyra", "Organinė chemija", "Tirpalai, elektrochemija"],
      },
      {
        code: "BIO",
        name: "Biologija",
        sub: "išplėstinis",
        formula: "ATP ⇌ ADP + Pᵢ",
        bullets: ["Genetika, biochemija", "Fiziologija, ekologija", "Evoliucija, biotechnologija"],
      },
    ],
    stats: [
      {
        value: (
          <>
            <span className="text-[#D8FF3D]">10</span> metų
          </>
        ),
        label: "metų mokymo duomenų",
      },
      {
        value: (
          <>
            <span className="text-[#D8FF3D]">94</span>%
          </>
        ),
        label: "Užduočių sprendimo tikslumas",
      },
      {
        value: (
          <>
            <span className="text-[#D8FF3D]">1,2</span>s
          </>
        ),
        label: "Vidutinis atsakymo laikas",
      },
    ],
  },
  be: {
    eyebrow: "[ 03 ] · Ахоп прадметаў",
    heading: (
      <>
        Чатыры <span className="italic">навуковыя</span><br />
        прадметы.
      </>
    ),
    side:
      "Навучаны на тысячах задач за апошнія 10 гадоў. Распазнае тып задачы, падбірае метад рашэння і паказвае ўвесь ход разважанняў.",
    exampleLabel: "Прыклад",
    subjects: [
      {
        code: "МАТ",
        name: "Матэматыка",
        sub: "базавы · павышаны",
        formula: "f(x) = ax² + bx + c",
        bullets: ["Функцыі, межы, вытворныя", "Аналітычная геаметрыя", "Паслядоўнасці, імавернасць, камбінаторыка"],
        accent: true,
      },
      {
        code: "ФІЗ",
        name: "Фізіка",
        sub: "павышаны",
        formula: "E = ½mv² + mgh",
        bullets: ["Механіка, тэрмадынаміка", "Электрамагнетызм", "Оптыка, ядзерная фізіка"],
      },
      {
        code: "ХІМ",
        name: "Хімія",
        sub: "павышаны",
        formula: "2H₂ + O₂ → 2H₂O",
        bullets: ["Стэхіяметрыя, раўнавагі", "Арганічная хімія", "Растворы, электрахімія"],
      },
      {
        code: "БІЯ",
        name: "Біялогія",
        sub: "павышаны",
        formula: "ATP ⇌ ADP + Pᵢ",
        bullets: ["Генетыка, біяхімія", "Фізіялогія, экалогія", "Эвалюцыя, біятэхналогія"],
      },
    ],
    stats: [
      {
        value: (
          <>
            <span className="text-[#D8FF3D]">10</span> гадоў
          </>
        ),
        label: "гадоў навучальных даных",
      },
      {
        value: (
          <>
            <span className="text-[#D8FF3D]">94</span>%
          </>
        ),
        label: "Дакладнасць рашэння задач",
      },
      {
        value: (
          <>
            <span className="text-[#D8FF3D]">1,2</span>с
          </>
        ),
        label: "Сярэдні час адказу",
      },
    ],
  },
  es: {
    eyebrow: "[ 03 ] · Asignaturas",
    heading: (
      <>
        Cuatro <span className="italic">asignaturas</span><br />
        de ciencias.
      </>
    ),
    side:
      "Entrenado con miles de problemas de los últimos 10 años. Reconoce el tipo de ejercicio, elige el método adecuado y muestra todo el razonamiento.",
    exampleLabel: "Ejemplo",
    subjects: [
      {
        code: "MAT",
        name: "Matemáticas",
        sub: "básico · avanzado",
        formula: "f(x) = ax² + bx + c",
        bullets: ["Funciones, límites, derivadas", "Geometría analítica", "Sucesiones, probabilidad, combinatoria"],
        accent: true,
      },
      {
        code: "FÍS",
        name: "Física",
        sub: "avanzado",
        formula: "E = ½mv² + mgh",
        bullets: ["Mecánica, termodinámica", "Electromagnetismo", "Óptica, física nuclear"],
      },
      {
        code: "QUÍ",
        name: "Química",
        sub: "avanzado",
        formula: "2H₂ + O₂ → 2H₂O",
        bullets: ["Estequiometría, equilibrios", "Química orgánica", "Disoluciones, electroquímica"],
      },
      {
        code: "BIO",
        name: "Biología",
        sub: "avanzado",
        formula: "ATP ⇌ ADP + Pᵢ",
        bullets: ["Genética, bioquímica", "Fisiología, ecología", "Evolución, biotecnología"],
      },
    ],
    stats: [
      {
        value: (
          <>
            <span className="text-[#D8FF3D]">10</span> años
          </>
        ),
        label: "años de datos de entrenamiento",
      },
      {
        value: (
          <>
            <span className="text-[#D8FF3D]">94</span>%
          </>
        ),
        label: "Precisión en problemas de examen",
      },
      {
        value: (
          <>
            <span className="text-[#D8FF3D]">1,2</span>s
          </>
        ),
        label: "Tiempo medio de respuesta",
      },
    ],
  },
  pt: {
    eyebrow: "[ 03 ] · Disciplinas",
    heading: (
      <>
        Quatro <span className="italic">disciplinas</span><br />
        de ciências.
      </>
    ),
    side:
      "Treinado com milhares de exercícios dos últimos 10 anos. Reconhece o tipo de exercício, escolhe o método certo e mostra todo o raciocínio.",
    exampleLabel: "Exemplo",
    subjects: [
      {
        code: "MAT",
        name: "Matemática",
        sub: "base · avançado",
        formula: "f(x) = ax² + bx + c",
        bullets: ["Funções, limites, derivadas", "Geometria analítica", "Sucessões, probabilidades, combinatória"],
        accent: true,
      },
      {
        code: "FÍS",
        name: "Física",
        sub: "avançado",
        formula: "E = ½mv² + mgh",
        bullets: ["Mecânica, termodinâmica", "Eletromagnetismo", "Ótica, física nuclear"],
      },
      {
        code: "QUÍ",
        name: "Química",
        sub: "avançado",
        formula: "2H₂ + O₂ → 2H₂O",
        bullets: ["Estequiometria, equilíbrios", "Química orgânica", "Soluções, eletroquímica"],
      },
      {
        code: "BIO",
        name: "Biologia",
        sub: "avançado",
        formula: "ATP ⇌ ADP + Pᵢ",
        bullets: ["Genética, bioquímica", "Fisiologia, ecologia", "Evolução, biotecnologia"],
      },
    ],
    stats: [
      {
        value: (
          <>
            <span className="text-[#D8FF3D]">10</span> anos
          </>
        ),
        label: "anos de dados de treino",
      },
      {
        value: (
          <>
            <span className="text-[#D8FF3D]">94</span>%
          </>
        ),
        label: "Precisão na resolução de exercícios",
      },
      {
        value: (
          <>
            <span className="text-[#D8FF3D]">1,2</span>s
          </>
        ),
        label: "Tempo médio de resposta",
      },
    ],
  },
  fr: {
    eyebrow: "[ 03 ] · Matières couvertes",
    heading: (
      <>
        Quatre <span className="italic">matières</span><br />
        scientifiques.
      </>
    ),
    side:
      "Entraîné sur des milliers d’exercices des 10 dernières années. Il reconnaît le type d’exercice, choisit la bonne méthode et détaille tout le raisonnement.",
    exampleLabel: "Exemple",
    subjects: [
      {
        code: "MATH",
        name: "Mathématiques",
        sub: "tronc commun · spécialité",
        formula: "f(x) = ax² + bx + c",
        bullets: ["Fonctions, limites, dérivées", "Géométrie analytique", "Suites, probabilités, dénombrement"],
        accent: true,
      },
      {
        code: "PHY",
        name: "Physique",
        sub: "spécialité",
        formula: "E = ½mv² + mgh",
        bullets: ["Mécanique, thermodynamique", "Électromagnétisme", "Optique, physique nucléaire"],
      },
      {
        code: "CHI",
        name: "Chimie",
        sub: "spécialité",
        formula: "2H₂ + O₂ → 2H₂O",
        bullets: ["Stœchiométrie, équilibres", "Chimie organique", "Solutions, électrochimie"],
      },
      {
        code: "BIO",
        name: "Biologie",
        sub: "spécialité",
        formula: "ATP ⇌ ADP + Pᵢ",
        bullets: ["Génétique, biochimie", "Physiologie, écologie", "Évolution, biotechnologies"],
      },
    ],
    stats: [
      {
        value: (
          <>
            <span className="text-[#D8FF3D]">10</span> ans
          </>
        ),
        label: "ans de données d’entraînement",
      },
      {
        value: (
          <>
            <span className="text-[#D8FF3D]">94</span>%
          </>
        ),
        label: "Précision sur les exercices d’examen",
      },
      {
        value: (
          <>
            <span className="text-[#D8FF3D]">1,2</span>s
          </>
        ),
        label: "Temps de réponse moyen",
      },
    ],
  },
  it: {
    eyebrow: "[ 03 ] · Materie coperte",
    heading: (
      <>
        Quattro <span className="italic">materie</span><br />
        scientifiche.
      </>
    ),
    side:
      "Addestrato su migliaia di esercizi degli ultimi 10 anni. Riconosce il tipo di esercizio, sceglie il metodo giusto e mostra tutto il ragionamento.",
    exampleLabel: "Esempio",
    subjects: [
      {
        code: "MAT",
        name: "Matematica",
        sub: "base · avanzato",
        formula: "f(x) = ax² + bx + c",
        bullets: ["Funzioni, limiti, derivate", "Geometria analitica", "Successioni, probabilità, combinatoria"],
        accent: true,
      },
      {
        code: "FIS",
        name: "Fisica",
        sub: "avanzato",
        formula: "E = ½mv² + mgh",
        bullets: ["Meccanica, termodinamica", "Elettromagnetismo", "Ottica, fisica nucleare"],
      },
      {
        code: "CHI",
        name: "Chimica",
        sub: "avanzato",
        formula: "2H₂ + O₂ → 2H₂O",
        bullets: ["Stechiometria, equilibri", "Chimica organica", "Soluzioni, elettrochimica"],
      },
      {
        code: "BIO",
        name: "Biologia",
        sub: "avanzato",
        formula: "ATP ⇌ ADP + Pᵢ",
        bullets: ["Genetica, biochimica", "Fisiologia, ecologia", "Evoluzione, biotecnologie"],
      },
    ],
    stats: [
      {
        value: (
          <>
            <span className="text-[#D8FF3D]">10</span> anni
          </>
        ),
        label: "anni di dati di addestramento",
      },
      {
        value: (
          <>
            <span className="text-[#D8FF3D]">94</span>%
          </>
        ),
        label: "Precisione sugli esercizi d’esame",
      },
      {
        value: (
          <>
            <span className="text-[#D8FF3D]">1,2</span>s
          </>
        ),
        label: "Tempo medio di risposta",
      },
    ],
  },
};

export default function ExamBenefits({ lang = "pl" }: { lang?: Locale }) {
  const t = content[lang];
  return (
    <section id="przedmioty" className="relative py-24 lg:py-36 bg-[#0E0E0E]">
      <div className="mx-auto max-w-[1400px] px-5 lg:px-10">
        <div className="grid lg:grid-cols-12 gap-8 items-end mb-16">
          <div className="lg:col-span-8">
            <p className="km-mono-eyebrow text-[#D8FF3D]">{t.eyebrow}</p>
            <h2 className="km-display text-[clamp(40px,7vw,108px)] text-[#F2EDE3] mt-4">
              {t.heading}
            </h2>
          </div>
          <div className="lg:col-span-4">
            <p className="text-[15px] leading-[1.65] text-[#F2EDE3]/65">
              {t.side}
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-px bg-[rgba(242,237,227,0.10)] border border-[rgba(242,237,227,0.10)]">
          {t.subjects.map((s, i) => (
            <Reveal
              key={s.code}
              y={24}
              amount={0.3}
              duration={0.55}
              delay={i * 0.08}
              className={`relative p-8 lg:p-10 bg-[#0E0E0E] hover:bg-[#0B0B0B] transition-colors group ${
                s.accent ? "lg:row-span-1" : ""
              }`}
            >
              <div className="flex items-start justify-between gap-6">
                <div>
                  <p className="km-mono-eyebrow text-[#D8FF3D]">{s.code} · {s.sub}</p>
                  <h3 className="km-display text-[clamp(40px,5vw,72px)] text-[#F2EDE3] mt-3 leading-none">
                    {s.name}
                  </h3>
                </div>
                <span className="km-mono-eyebrow text-[#F2EDE3]/55 border border-[rgba(242,237,227,0.18)] px-2 py-1 whitespace-nowrap">
                  0{i + 1}/04
                </span>
              </div>

              <div className="mt-8 border-l-2 border-[#D8FF3D]/60 pl-4">
                <p className="km-mono-eyebrow text-[#F2EDE3]/55">{t.exampleLabel}</p>
                <p className="km-led text-lg mt-1">{s.formula}</p>
              </div>

              <ul className="mt-8 space-y-2">
                {s.bullets.map((b, j) => (
                  <li key={j} className="flex items-baseline gap-3 text-[14.5px] text-[#F2EDE3]/75">
                    <span className="km-mono-eyebrow text-[#F2EDE3]/55">→</span>
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </Reveal>
          ))}
        </div>

        <div className="mt-12 grid md:grid-cols-3 gap-6 text-center md:text-left">
          {t.stats.map((stat, i) => (
            <div key={i} className="border-t border-[rgba(242,237,227,0.18)] pt-5">
              <p className="km-display text-5xl text-[#F2EDE3]">
                {stat.value}
              </p>
              <p className="km-mono-eyebrow text-[#F2EDE3]/55 mt-2">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
