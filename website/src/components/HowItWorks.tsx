import Reveal from "@/components/Reveal";
import { type ReactNode } from "react";
import { type Locale } from "@/lib/i18n";

type Step = {
  n: string;
  title: string;
  head: string;
  desc: string;
  tag: string;
};

type HowItWorksContent = {
  eyebrow: string;
  h2: ReactNode;
  side: string;
  avg: string;
  stepLabel: string;
  steps: Step[];
};

const content: Record<Locale, HowItWorksContent> = {
  pl: {
    eyebrow: "[ 02 ] · Workflow",
    h2: (
      <>
        Trzy ruchy. <span className="italic">Zero</span><br />
        wpisywania.
      </>
    ),
    side:
      "Cała interakcja zamyka się w jednym geście. Nie tłumaczysz zadania, nie literujesz wzoru, nie szukasz przycisku.",
    avg: "[ Avg. czas użycia: 5.4 sek ]",
    stepLabel: "STEP",
    steps: [
      {
        n: "01",
        title: "Wyceluj",
        head: "Kierujesz kamerę.",
        desc: "Ukryta kamera 2MP ostrzy automatycznie. Wszystko od jednego polecenia: zadanie z arkusza, zeszytu, ekranu — wystarczy że widać tekst.",
        tag: "OV2640 · AF",
      },
      {
        n: "02",
        title: "Analiza",
        head: "AI rozpoznaje treść.",
        desc: "Model AI czyta zadanie, klasyfikuje przedmiot i typ, dobiera metodę rozwiązania.",
        tag: "OCR + LLM",
      },
      {
        n: "03",
        title: "Odpowiedź",
        head: "Rozwiązanie na OLED.",
        desc: "Kompletne rozwiązanie krok po kroku z wzorami w formacie LaTeX. Wynik w mniej niż 1.2 sekundy.",
        tag: "256×64 OLED",
      },
    ],
  },
  en: {
    eyebrow: "[ 02 ] · Workflow",
    h2: (
      <>
        Three moves. <span className="italic">Zero</span><br />
        typing.
      </>
    ),
    side:
      "The whole interaction fits into a single gesture. No spelling out the problem, no keying in the formula, no hunting for a button.",
    avg: "[ Avg. time in use: 5.4 sec ]",
    stepLabel: "STEP",
    steps: [
      {
        n: "01",
        title: "Aim",
        head: "Point the camera.",
        desc: "The hidden 2MP camera focuses automatically. One command handles it all: a problem from an exam paper, a notebook or a screen — as long as the text is visible.",
        tag: "OV2640 · AF",
      },
      {
        n: "02",
        title: "Analysis",
        head: "AI reads it.",
        desc: "The AI model reads the problem, classifies the subject and type, and picks the right solving method.",
        tag: "OCR + LLM",
      },
      {
        n: "03",
        title: "Answer",
        head: "Solution on OLED.",
        desc: "A complete step-by-step solution with formulas in LaTeX format. The result in under 1.2 seconds.",
        tag: "256×64 OLED",
      },
    ],
  },
  de: {
    eyebrow: "[ 02 ] · Workflow",
    h2: (
      <>
        Drei Gesten. <span className="italic">Null</span><br />
        Tippen.
      </>
    ),
    side:
      "Die gesamte Interaktion passt in eine einzige Geste. Kein Abtippen der Aufgabe, kein Buchstabieren der Formel, kein Suchen nach einer Taste.",
    avg: "[ Durchschn. Nutzungsdauer: 5,4 Sek ]",
    stepLabel: "STEP",
    steps: [
      {
        n: "01",
        title: "Zielen",
        head: "Kamera draufhalten.",
        desc: "Die versteckte 2-MP-Kamera fokussiert automatisch. Ein Befehl genügt: eine Aufgabe aus dem Prüfungsbogen, dem Heft oder vom Bildschirm — Hauptsache, der Text ist sichtbar.",
        tag: "OV2640 · AF",
      },
      {
        n: "02",
        title: "Analyse",
        head: "KI erkennt alles.",
        desc: "Das KI-Modell liest die Aufgabe, klassifiziert Fach und Typ und wählt die passende Lösungsmethode.",
        tag: "OCR + LLM",
      },
      {
        n: "03",
        title: "Antwort",
        head: "Lösung auf OLED.",
        desc: "Eine vollständige Schritt-für-Schritt-Lösung mit Formeln im LaTeX-Format. Das Ergebnis in unter 1,2 Sekunden.",
        tag: "256×64 OLED",
      },
    ],
  },
  cs: {
    eyebrow: "[ 02 ] · Workflow",
    h2: (
      <>
        Tři pohyby. <span className="italic">Nula</span><br />
        psaní.
      </>
    ),
    side:
      "Celá interakce se vejde do jediného gesta. Nepřepisuješ zadání, nevyťukáváš vzorec, nehledáš tlačítko.",
    avg: "[ Prům. doba použití: 5,4 s ]",
    stepLabel: "STEP",
    steps: [
      {
        n: "01",
        title: "Zamiř",
        head: "Namíříš kameru.",
        desc: "Skrytá 2MP kamera zaostří automaticky. Jeden příkaz zvládne vše: úlohu z testu, sešitu nebo obrazovky — stačí, když je vidět text.",
        tag: "OV2640 · AF",
      },
      {
        n: "02",
        title: "Analýza",
        head: "AI pochopí zadání.",
        desc: "AI model přečte úlohu, rozpozná předmět a typ příkladu a zvolí vhodný postup řešení.",
        tag: "OCR + LLM",
      },
      {
        n: "03",
        title: "Odpověď",
        head: "Řešení na OLED.",
        desc: "Kompletní řešení krok za krokem se vzorci ve formátu LaTeX. Výsledek za méně než 1,2 sekundy.",
        tag: "256×64 OLED",
      },
    ],
  },
  sk: {
    eyebrow: "[ 02 ] · Workflow",
    h2: (
      <>
        Tri pohyby. <span className="italic">Nula</span><br />
        písania.
      </>
    ),
    side:
      "Celá interakcia sa zmestí do jediného gesta. Neprepisuješ zadanie, nevyťukávaš vzorec, nehľadáš tlačidlo.",
    avg: "[ Priem. doba použitia: 5,4 s ]",
    stepLabel: "KROK",
    steps: [
      {
        n: "01",
        title: "Zamier",
        head: "Namieriš kameru.",
        desc: "Skrytá 2MP kamera zaostrí automaticky. Jeden príkaz zvládne všetko: úlohu z testu, zošita či obrazovky — stačí, aby bolo vidieť text.",
        tag: "OV2640 · AF",
      },
      {
        n: "02",
        title: "Analýza",
        head: "AI pochopí zadanie.",
        desc: "AI model prečíta úlohu, rozpozná predmet a typ príkladu a zvolí vhodný postup riešenia.",
        tag: "OCR + LLM",
      },
      {
        n: "03",
        title: "Odpoveď",
        head: "Riešenie na OLED.",
        desc: "Kompletné riešenie krok za krokom so vzorcami vo formáte LaTeX. Výsledok za menej ako 1,2 sekundy.",
        tag: "256×64 OLED",
      },
    ],
  },
  lt: {
    eyebrow: "[ 02 ] · Eiga",
    h2: (
      <>
        Trys judesiai. <span className="italic">Jokio</span><br />
        rašymo.
      </>
    ),
    side:
      "Visa sąveika telpa į vieną gestą. Nereikia perrašinėti užduoties, vesti formulės ar ieškoti mygtuko.",
    avg: "[ Vid. naudojimo laikas: 5,4 s ]",
    stepLabel: "ŽINGSNIS",
    steps: [
      {
        n: "01",
        title: "Nusitaikyk",
        head: "Nukreipi kamerą.",
        desc: "Paslėpta 2MP kamera fokusuoja automatiškai. Viena komanda tinka viskam: užduočiai iš egzamino lapo, sąsiuvinio ar ekrano — svarbu, kad matytųsi tekstas.",
        tag: "OV2640 · AF",
      },
      {
        n: "02",
        title: "Analizė",
        head: "DI atpažįsta turinį.",
        desc: "DI modelis perskaito užduotį, nustato dalyką ir užduoties tipą bei parenka sprendimo metodą.",
        tag: "OCR + LLM",
      },
      {
        n: "03",
        title: "Atsakymas",
        head: "Sprendimas OLED ekrane.",
        desc: "Išsamus sprendimas žingsnis po žingsnio su formulėmis LaTeX formatu. Rezultatas greičiau nei per 1,2 sekundės.",
        tag: "256×64 OLED",
      },
    ],
  },
  be: {
    eyebrow: "[ 02 ] · Працэс",
    h2: (
      <>
        Тры рухі. <span className="italic">Ніякага</span><br />
        набору.
      </>
    ),
    side:
      "Уся ўзаемадзея змяшчаецца ў адзін жэст. Не перапісваеш задачу, не набіраеш формулу, не шукаеш кнопку.",
    avg: "[ Сяр. час выкарыстання: 5,4 с ]",
    stepLabel: "КРОК",
    steps: [
      {
        n: "01",
        title: "Навядзі",
        head: "Наводзіш камеру.",
        desc: "Схаваная камера 2MP факусуецца аўтаматычна. Адна каманда для ўсяго: задача з экзаменацыйнага ліста, сшытка ці экрана — галоўнае, каб быў бачны тэкст.",
        tag: "OV2640 · AF",
      },
      {
        n: "02",
        title: "Аналіз",
        head: "ШІ распазнае змест.",
        desc: "Мадэль ШІ чытае задачу, вызначае прадмет і тып задання і падбірае метад рашэння.",
        tag: "OCR + LLM",
      },
      {
        n: "03",
        title: "Адказ",
        head: "Рашэнне на OLED.",
        desc: "Поўнае рашэнне крок за крокам з формуламі ў фармаце LaTeX. Вынік менш чым за 1,2 секунды.",
        tag: "256×64 OLED",
      },
    ],
  },
  es: {
    eyebrow: "[ 02 ] · Proceso",
    h2: (
      <>
        Tres gestos. <span className="italic">Cero</span><br />
        tecleo.
      </>
    ),
    side:
      "Toda la interacción cabe en un solo gesto. No transcribes el enunciado, no tecleas la fórmula, no buscas ningún botón.",
    avg: "[ Tiempo medio de uso: 5,4 s ]",
    stepLabel: "PASO",
    steps: [
      {
        n: "01",
        title: "Apunta",
        head: "Apunta, dispara.",
        desc: "La cámara oculta de 2MP enfoca automáticamente. Un solo comando sirve para todo: un problema del examen, del cuaderno o de una pantalla — basta con que se vea el texto.",
        tag: "OV2640 · AF",
      },
      {
        n: "02",
        title: "Análisis",
        head: "La IA reconoce el contenido.",
        desc: "El modelo de IA lee el enunciado, clasifica la asignatura y el tipo de problema, y elige el método de resolución.",
        tag: "OCR + LLM",
      },
      {
        n: "03",
        title: "Respuesta",
        head: "Solución inmediata en OLED.",
        desc: "Una solución completa paso a paso con fórmulas en formato LaTeX. El resultado, en menos de 1,2 segundos.",
        tag: "256×64 OLED",
      },
    ],
  },
  pt: {
    eyebrow: "[ 02 ] · Processo",
    h2: (
      <>
        Três gestos. <span className="italic">Zero</span><br />
        escrita.
      </>
    ),
    side:
      "Toda a interação cabe num único gesto. Não transcreves o enunciado, não escreves a fórmula, não procuras nenhum botão.",
    avg: "[ Tempo médio de utilização: 5,4 s ]",
    stepLabel: "PASSO",
    steps: [
      {
        n: "01",
        title: "Aponta",
        head: "Aponta, dispara.",
        desc: "A câmara oculta de 2MP foca automaticamente. Um só comando serve para tudo: um exercício do exame, do caderno ou de um ecrã — basta que o texto se veja.",
        tag: "OV2640 · AF",
      },
      {
        n: "02",
        title: "Análise",
        head: "A IA reconhece o conteúdo.",
        desc: "O modelo de IA lê o enunciado, identifica a disciplina e o tipo de exercício e escolhe o método de resolução.",
        tag: "OCR + LLM",
      },
      {
        n: "03",
        title: "Resposta",
        head: "Resolução imediata no OLED.",
        desc: "Uma resolução completa passo a passo, com fórmulas em formato LaTeX. O resultado em menos de 1,2 segundos.",
        tag: "256×64 OLED",
      },
    ],
  },
  fr: {
    eyebrow: "[ 02 ] · Workflow",
    h2: (
      <>
        Trois gestes. <span className="italic">Zéro</span><br />
        saisie.
      </>
    ),
    side:
      "Toute l’interaction tient en un seul geste. Pas besoin de recopier l’énoncé, de taper la formule ni de chercher un bouton.",
    avg: "[ Durée moy. d’utilisation : 5,4 s ]",
    stepLabel: "ÉTAPE",
    steps: [
      {
        n: "01",
        title: "Vise",
        head: "Vise, déclenche.",
        desc: "La caméra cachée de 2 MP fait la mise au point toute seule. Une seule commande pour tout : un exercice d’examen, un cahier ou un écran — il suffit que le texte soit lisible.",
        tag: "OV2640 · AF",
      },
      {
        n: "02",
        title: "Analyse",
        head: "L’IA comprend l’énoncé.",
        desc: "Le modèle d’IA lit l’exercice, identifie la matière et le type de problème, puis choisit la méthode de résolution.",
        tag: "OCR + LLM",
      },
      {
        n: "03",
        title: "Réponse",
        head: "Solution affichée sur OLED.",
        desc: "Une solution complète, étape par étape, avec des formules au format LaTeX. Le résultat en moins de 1,2 seconde.",
        tag: "256×64 OLED",
      },
    ],
  },
  it: {
    eyebrow: "[ 02 ] · Workflow",
    h2: (
      <>
        Tre gesti. <span className="italic">Zero</span><br />
        digitazione.
      </>
    ),
    side:
      "L’intera interazione sta in un solo gesto. Non ricopi il testo, non digiti la formula, non cerchi nessun tasto.",
    avg: "[ Tempo medio d’uso: 5,4 s ]",
    stepLabel: "PASSO",
    steps: [
      {
        n: "01",
        title: "Inquadra",
        head: "Inquadra, scatta.",
        desc: "La fotocamera nascosta da 2 MP mette a fuoco da sola. Un solo comando per tutto: un esercizio dal compito, dal quaderno o da uno schermo — basta che il testo sia visibile.",
        tag: "OV2640 · AF",
      },
      {
        n: "02",
        title: "Analisi",
        head: "L’IA riconosce il contenuto.",
        desc: "Il modello di IA legge l’esercizio, riconosce materia e tipologia e sceglie il metodo di risoluzione.",
        tag: "OCR + LLM",
      },
      {
        n: "03",
        title: "Risposta",
        head: "Soluzione immediata su OLED.",
        desc: "Una soluzione completa passo dopo passo, con formule in formato LaTeX. Il risultato in meno di 1,2 secondi.",
        tag: "256×64 OLED",
      },
    ],
  },
};

export default function HowItWorks({ lang = "pl" }: { lang?: Locale }) {
  const t = content[lang];

  return (
    <section id="jak-dziala" className="relative py-24 lg:py-36">
      <div className="mx-auto max-w-[1400px] px-5 lg:px-10">
        <div className="grid lg:grid-cols-12 gap-8 items-end mb-16">
          <div className="lg:col-span-7">
            <p className="km-mono-eyebrow text-[#D8FF3D]">{t.eyebrow}</p>
            <h2 className="km-display text-[clamp(40px,7vw,108px)] text-[#F2EDE3] mt-4">
              {t.h2}
            </h2>
          </div>
          <div className="lg:col-span-4 lg:col-start-9">
            <p className="text-[15px] leading-[1.65] text-[#F2EDE3]/65">
              {t.side}
            </p>
            <div className="km-mono-eyebrow text-[#F2EDE3]/55 mt-4">
              {t.avg}
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-px bg-[rgba(242,237,227,0.10)] border border-[rgba(242,237,227,0.10)]">
          {t.steps.map((s, i) => (
            <Reveal
              key={s.n}
              y={24}
              amount={0.4}
              duration={0.6}
              delay={i * 0.1}
              className="bg-[#0B0B0B] p-8 lg:p-10 group relative hover:bg-[#111] transition-colors"
            >
              <div className="flex items-start justify-between">
                <span className="km-display text-7xl text-[#F2EDE3]/40 group-hover:text-[#D8FF3D] transition-colors">
                  {s.n}
                </span>
                <span className="km-mono-eyebrow text-[#F2EDE3]/55 border border-[rgba(242,237,227,0.18)] px-2 py-1">
                  {s.tag}
                </span>
              </div>

              <h3 className="km-display text-4xl mt-12 text-[#F2EDE3]">
                {s.head.split(" ").map((w, idx) => (
                  <span key={idx} className={idx === 1 ? "italic text-[#D8FF3D]" : ""}>
                    {w}{" "}
                  </span>
                ))}
              </h3>

              <p className="text-[14.5px] leading-[1.65] text-[#F2EDE3]/65 mt-4">
                {s.desc}
              </p>

              <p className="km-mono-eyebrow text-[#F2EDE3]/55 mt-10">
                {t.stepLabel} / {s.title.toUpperCase()}
              </p>
            </Reveal>
          ))}
        </div>

        <div className="mt-10 border border-[rgba(242,237,227,0.10)] bg-[#0E0E0E] p-5 lg:p-6 font-mono text-[12.5px] leading-[1.7] text-[#F2EDE3]/65 overflow-x-auto km-no-scrollbar">
          <p>
            <span className="text-[#F2EDE3]/55">$</span>{" "}
            <span className="text-[#D8FF3D]">kalkmate</span> --capture --solve
          </p>
          <p className="text-[#F2EDE3]/55">[ok] zdjęcie · 1632×1232 · 218 KB</p>
          <p className="text-[#F2EDE3]/55">[ok] klasyfikator: matematyka / całki / oznaczone</p>
          <p className="text-[#F2EDE3]/55">[ok] model: kalkmate-r1</p>
          <p>
            <span className="text-[#D8FF3D]">→</span> ∫₀¹ (3x² + 2x) dx ={" "}
            <span className="text-[#D8FF3D]">2</span>
          </p>
        </div>
      </div>
    </section>
  );
}
