"use client";

import { useEffect, useRef } from "react";
import { type Locale } from "@/lib/i18n";

const FRAME_COUNT = 90;
// Klatki maja Cache-Control: immutable, max-age=1 rok (next.config.ts) —
// przy podmianie plikow pod tymi samymi nazwami trzeba podbic ta wersje,
// inaczej przegladarki ktore juz raz wczytaly strone NIGDY nie pobiora
// nowej wersji (immutable = zero rewalidacji az do wygasniecia).
const FRAME_VERSION = "2";
// Wymiary klatek (wszystkie 720x405) — canvas ma je od startu, zeby nie
// zmienial proporcji (300x150 -> 16:9) po wczytaniu pierwszej klatki (CLS).
const FRAME_W = 720;
const FRAME_H = 405;
// Ile klatek pobieramy naraz — reszta czeka w kolejce (nie zapychamy lacza
// 90 requestami na raz, a przewijanie od razu dostaje kolejne klatki).
const FRAME_CONCURRENCY = 4;

const frameUrl = (n: number) =>
  `/frames/frame_${String(n).padStart(3, "0")}.webp?v=${FRAME_VERSION}`;

type NetworkInformationLike = { saveData?: boolean; effectiveType?: string };

/**
 * Ktore klatki (indeksy 0-based, bez klatki 0 = plakat) pobrac i w jakiej
 * kolejnosci. Kolejnosc "od zgrubnej do dokladnej" (co 16., co 8., ... co
 * 1.) — przy przewijaniu w trakcie ladowania animacja jest od razu cala,
 * tylko mniej plynna, zamiast urywac sie na ostatniej zaladowanej klatce.
 * - Save-Data / 2G: zadnych — zostaje statyczny plakat (klatka 1).
 * - 3G: co 3. klatka (30 z 90).
 * - Mobile (<1024px, sekcja 220vh i maly canvas): co 2. klatka (45 z 90).
 * - Desktop: wszystkie 90 (zachowanie jak dotad).
 */
function framePlan(): number[] {
  const conn = (navigator as Navigator & { connection?: NetworkInformationLike }).connection;
  const type = conn?.effectiveType ?? "4g";
  if (conn?.saveData || type === "slow-2g" || type === "2g") return [];
  const mobile = window.matchMedia("(max-width: 1023.98px)").matches;
  const step = type === "3g" ? 3 : mobile ? 2 : 1;
  const order: number[] = [];
  const seen = new Set<number>([0]);
  for (const stride of [16, 8, 4, 2, 1]) {
    const s = stride * step;
    for (let i = 0; i < FRAME_COUNT; i += s) {
      if (!seen.has(i)) { seen.add(i); order.push(i); }
    }
  }
  return order;
}

interface Benefit {
  side: "left" | "right";
  label: string;
  title: string;
  desc: string;
}

const dict: Record<Locale, { eyebrow: string; heading: string; sub: string; benefits: Benefit[] }> = {
  pl: {
    eyebrow: "/ JAK TO DZIAŁA",
    heading: "Jeden przycisk.",
    sub: "Reszta robi się sama.",
    benefits: [
      { side: "left",  label: "01", title: "Sfotografuj zadanie",   desc: "Wbudowana kamera 2MP. Jeden przycisk — zdjęcie gotowe w ułamku sekundy." },
      { side: "right", label: "02", title: "AI analizuje w locie",  desc: "Model klasyfikuje przedmiot i typ zadania. Matematyka, fizyka, chemia, biologia." },
      { side: "left",  label: "03", title: "Krok po kroku",         desc: "Każdy krok wyświetlony na ekranie OLED 256×64. Zero skrótów — pełny tok myślenia." },
      { side: "right", label: "04", title: "Działa samodzielnie",   desc: "Nie potrzebuje smartfona. Ładowanie przez USB-C, bateria na cały dzień nauki." },
    ],
  },
  en: {
    eyebrow: "/ HOW IT WORKS",
    heading: "One button.",
    sub: "The rest happens by itself.",
    benefits: [
      { side: "left",  label: "01", title: "Photograph the problem", desc: "Built-in 2MP camera. One press — photo taken in a split second." },
      { side: "right", label: "02", title: "AI analyses on the fly", desc: "Model classifies the subject and task type. Math, physics, chemistry, biology." },
      { side: "left",  label: "03", title: "Step by step",           desc: "Every step shown on the 256×64 OLED display. No shortcuts — full reasoning." },
      { side: "right", label: "04", title: "Works standalone",       desc: "No smartphone needed. USB-C charging, battery lasts a full study day." },
    ],
  },
  de: {
    eyebrow: "/ SO FUNKTIONIERT'S",
    heading: "Ein Knopf.",
    sub: "Den Rest erledigt das Gerät.",
    benefits: [
      { side: "left",  label: "01", title: "Aufgabe fotografieren",     desc: "Eingebaute 2-MP-Kamera. Ein Druck — Foto in Sekundenbruchteilen." },
      { side: "right", label: "02", title: "KI analysiert live",        desc: "Das Modell erkennt Fach und Aufgabentyp. Mathe, Physik, Chemie, Biologie." },
      { side: "left",  label: "03", title: "Schritt für Schritt",       desc: "Jeder Schritt auf dem 256×64-OLED-Display. Kein Abkürzen — voller Lösungsweg." },
      { side: "right", label: "04", title: "Funktioniert eigenständig", desc: "Kein Smartphone nötig. USB-C-Laden, Akku für einen ganzen Lerntag." },
    ],
  },
  cs: {
    eyebrow: "/ JAK TO FUNGUJE",
    heading: "Jedno tlačítko.",
    sub: "Zbytek se udělá sám.",
    benefits: [
      { side: "left",  label: "01", title: "Vyfoť úlohu",          desc: "Vestavěná 2MP kamera. Jedno stisknutí — fotka je hotová ve zlomku sekundy." },
      { side: "right", label: "02", title: "AI analyzuje za běhu", desc: "Model rozpozná předmět a typ úlohy. Matematika, fyzika, chemie, biologie." },
      { side: "left",  label: "03", title: "Krok za krokem",       desc: "Každý krok na OLED displeji 256×64. Žádné zkratky — celý myšlenkový postup." },
      { side: "right", label: "04", title: "Funguje samostatně",   desc: "Nepotřebuje smartphone. Nabíjení přes USB-C, baterie vydrží celý den učení." },
    ],
  },
  sk: {
    eyebrow: "/ AKO TO FUNGUJE",
    heading: "Jedno tlačidlo.",
    sub: "Zvyšok sa urobí sám.",
    benefits: [
      { side: "left",  label: "01", title: "Odfoť úlohu",          desc: "Vstavaná 2MP kamera. Jedno stlačenie — fotka je hotová v zlomku sekundy." },
      { side: "right", label: "02", title: "AI analyzuje za behu", desc: "Model rozpozná predmet a typ úlohy. Matematika, fyzika, chémia, biológia." },
      { side: "left",  label: "03", title: "Krok za krokom",       desc: "Každý krok na OLED displeji 256×64. Žiadne skratky — celý myšlienkový postup." },
      { side: "right", label: "04", title: "Funguje samostatne",   desc: "Nepotrebuje smartfón. Nabíjanie cez USB-C, batéria vydrží celý deň učenia." },
    ],
  },
  lt: {
    eyebrow: "/ KAIP TAI VEIKIA",
    heading: "Vienas mygtukas.",
    sub: "Visa kita — savaime.",
    benefits: [
      { side: "left",  label: "01", title: "Nufotografuok užduotį",     desc: "Įmontuota 2MP kamera. Vienas paspaudimas — nuotrauka per sekundės dalį." },
      { side: "right", label: "02", title: "DI analizuoja akimirksniu", desc: "Modelis atpažįsta dalyką ir užduoties tipą. Matematika, fizika, chemija, biologija." },
      { side: "left",  label: "03", title: "Žingsnis po žingsnio",      desc: "Kiekvienas žingsnis 256×64 OLED ekrane. Jokių trumpinių — visa sprendimo eiga." },
      { side: "right", label: "04", title: "Veikia savarankiškai",      desc: "Išmaniojo telefono nereikia. Įkrovimas per USB-C, baterija ištveria visą mokymosi dieną." },
    ],
  },
  be: {
    eyebrow: "/ ЯК ГЭТА ПРАЦУЕ",
    heading: "Адна кнопка.",
    sub: "Астатняе — само сабой.",
    benefits: [
      { side: "left",  label: "01", title: "Сфатаграфуй задачу",  desc: "Убудаваная камера 2MP. Адно націсканне — і фота гатовае за долю секунды." },
      { side: "right", label: "02", title: "ШІ аналізуе імгненна", desc: "Мадэль вызначае прадмет і тып задачы. Матэматыка, фізіка, хімія, біялогія." },
      { side: "left",  label: "03", title: "Крок за крокам",       desc: "Кожны крок на OLED-экране 256×64. Ніякіх скарачэнняў — увесь ход думкі." },
      { side: "right", label: "04", title: "Працуе самастойна",    desc: "Смартфон не патрэбны. Зарадка праз USB-C, батарэі хапае на цэлы дзень вучобы." },
    ],
  },
  es: {
    eyebrow: "/ CÓMO FUNCIONA",
    heading: "Un botón.",
    sub: "El resto se hace solo.",
    benefits: [
      { side: "left",  label: "01", title: "Fotografía el problema",    desc: "Cámara integrada de 2MP. Una pulsación — foto lista en una fracción de segundo." },
      { side: "right", label: "02", title: "La IA analiza al instante", desc: "El modelo identifica la asignatura y el tipo de problema. Matemáticas, física, química, biología." },
      { side: "left",  label: "03", title: "Paso a paso",               desc: "Cada paso en la pantalla OLED de 256×64. Sin atajos — todo el razonamiento." },
      { side: "right", label: "04", title: "Funciona por sí sola",      desc: "No necesita smartphone. Carga por USB-C y batería para todo un día de estudio." },
    ],
  },
  pt: {
    eyebrow: "/ COMO FUNCIONA",
    heading: "Um botão.",
    sub: "O resto acontece sozinho.",
    benefits: [
      { side: "left",  label: "01", title: "Fotografa o exercício", desc: "Câmara integrada de 2MP. Um clique — foto tirada numa fração de segundo." },
      { side: "right", label: "02", title: "A IA analisa na hora",  desc: "O modelo identifica a disciplina e o tipo de exercício. Matemática, física, química, biologia." },
      { side: "left",  label: "03", title: "Passo a passo",         desc: "Cada passo no ecrã OLED de 256×64. Sem atalhos — o raciocínio completo." },
      { side: "right", label: "04", title: "Funciona sozinha",      desc: "Não precisa de smartphone. Carregamento por USB-C e bateria para um dia inteiro de estudo." },
    ],
  },
  fr: {
    eyebrow: "/ COMMENT ÇA MARCHE",
    heading: "Un bouton.",
    sub: "Le reste se fait tout seul.",
    benefits: [
      { side: "left",  label: "01", title: "Photographie l’exercice", desc: "Caméra intégrée de 2 MP. Une pression — la photo est prise en une fraction de seconde." },
      { side: "right", label: "02", title: "L’IA analyse en direct",  desc: "Le modèle identifie la matière et le type d’exercice. Maths, physique, chimie, biologie." },
      { side: "left",  label: "03", title: "Étape par étape",         desc: "Chaque étape sur l’écran OLED 256×64. Aucun raccourci — tout le raisonnement." },
      { side: "right", label: "04", title: "Totalement autonome",     desc: "Pas besoin de smartphone. Recharge en USB-C, batterie pour toute une journée de révisions." },
    ],
  },
  it: {
    eyebrow: "/ COME FUNZIONA",
    heading: "Un pulsante.",
    sub: "Il resto viene da sé.",
    benefits: [
      { side: "left",  label: "01", title: "Fotografa l’esercizio", desc: "Fotocamera integrata da 2 MP. Una pressione — foto pronta in una frazione di secondo." },
      { side: "right", label: "02", title: "L’IA analizza al volo", desc: "Il modello riconosce materia e tipo di esercizio. Matematica, fisica, chimica, biologia." },
      { side: "left",  label: "03", title: "Passo dopo passo",      desc: "Ogni passaggio sul display OLED 256×64. Nessuna scorciatoia — tutto il ragionamento." },
      { side: "right", label: "04", title: "Funziona da sola",      desc: "Non serve lo smartphone. Ricarica via USB-C, batteria per un’intera giornata di studio." },
    ],
  },
};

export default function VideoScroll({ lang = "pl" }: { lang?: Locale }) {
  const t = dict[lang];
  const sectionRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasMobileRef = useRef<HTMLCanvasElement>(null);
  const progressRef = useRef(0);
  const rafRef = useRef<number>(0);
  const framesRef = useRef<HTMLImageElement[]>([]);
  const currentFrameRef = useRef(-1);
  const deskRefs = useRef<(HTMLDivElement | null)[]>([]);
  const mobRefs  = useRef<(HTMLDivElement | null)[]>([]);

  // Klatki pobieramy leniwie: dopiero po zdarzeniu load + bezczynnosci
  // przegladarki (nic nie konkuruje z LCP/hydracja) ORAZ gdy sekcja jest
  // blisko viewportu. Wczesniej rootMargin 400px na mobile lapal sekcje od
  // razu po zaladowaniu (stoi tuz pod Hero) i 90 klatek (~3.3 MB) lecialo
  // na starcie strony. Najpierw klatka 1 (plakat, rysowana od razu), potem
  // reszta kolejka po FRAME_CONCURRENCY z niskim priorytetem.
  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    let cancelled = false;
    let observer: IntersectionObserver | null = null;
    let idleHandle: number | null = null;
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

    const makeImg = (n: number, onDone: () => void) => {
      const img = new window.Image();
      img.decoding = "async";
      (img as HTMLImageElement & { fetchPriority?: string }).fetchPriority = "low";
      img.onload = onDone;
      img.onerror = onDone;
      img.src = frameUrl(n);
      return img;
    };

    const startLoading = () => {
      if (cancelled || framesRef.current.length > 0) return;
      const imgs: HTMLImageElement[] = new Array(FRAME_COUNT);
      framesRef.current = imgs;

      const queue = framePlan();
      let active = 0;
      const pump = () => {
        while (!cancelled && active < FRAME_CONCURRENCY && queue.length > 0) {
          const i = queue.shift()!;
          active++;
          imgs[i] = makeImg(i + 1, () => { active--; pump(); });
        }
      };

      imgs[0] = makeImg(1, () => {
        if (cancelled) return;
        const first = imgs[0];
        if (first.naturalWidth > 0) {
          for (const canvas of [canvasRef.current, canvasMobileRef.current]) {
            if (!canvas) continue;
            canvas.width = first.naturalWidth;
            canvas.height = first.naturalHeight;
            canvas.getContext("2d")?.drawImage(first, 0, 0);
          }
          currentFrameRef.current = 0;
        }
        pump();
      });
    };

    const observe = () => {
      if (cancelled) return;
      // Desktop: wiekszy zapas (sekcja 400vh, wszystkie 90 klatek) — i tak
      // dopiero po load+idle. Mobile: sekcja stoi ~200px pod viewportem, wiec
      // maly margines = start dopiero gdy uzytkownik zacznie przewijac.
      const ahead = window.matchMedia("(min-width: 1024px)").matches ? 600 : 150;
      observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) {
            observer?.disconnect();
            startLoading();
          }
        },
        { rootMargin: `0px 0px ${ahead}px 0px` }
      );
      observer.observe(section);
    };

    const afterLoad = () => {
      const w = window as Window & {
        requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      };
      if (w.requestIdleCallback) idleHandle = w.requestIdleCallback(observe, { timeout: 2000 });
      else timeoutHandle = setTimeout(observe, 300);
    };

    if (document.readyState === "complete") afterLoad();
    else window.addEventListener("load", afterLoad, { once: true });

    return () => {
      cancelled = true;
      window.removeEventListener("load", afterLoad);
      observer?.disconnect();
      const w = window as Window & { cancelIdleCallback?: (h: number) => void };
      if (idleHandle !== null) w.cancelIdleCallback?.(idleHandle);
      if (timeoutHandle !== null) clearTimeout(timeoutHandle);
    };
  }, []);

  // Scroll + rAF loop
  useEffect(() => {
    const onScroll = () => {
      const section = sectionRef.current;
      if (!section) return;
      const rect = section.getBoundingClientRect();
      const scrollable = section.offsetHeight - window.innerHeight;
      if (scrollable <= 0) { progressRef.current = 0; return; }
      progressRef.current = Math.min(1, Math.max(0, -rect.top / scrollable));
    };

    const animate = () => {
      const p = progressRef.current;

      // Draw current frame — albo najblizsza juz wczytana (ladowanie
      // progresywne / mniej klatek na mobile i wolnym laczu).
      const target = Math.min(FRAME_COUNT - 1, Math.floor(p * FRAME_COUNT));
      const frames = framesRef.current;
      const ready = (i: number) => {
        const f = frames[i];
        return !!f && f.complete && f.naturalWidth > 0;
      };
      let idx = -1;
      if (frames.length > 0) {
        for (let d = 0; d < FRAME_COUNT; d++) {
          if (target - d >= 0 && ready(target - d)) { idx = target - d; break; }
          if (target + d < FRAME_COUNT && ready(target + d)) { idx = target + d; break; }
        }
      }
      if (idx !== -1 && idx !== currentFrameRef.current) {
        const frame = frames[idx];
        for (const canvas of [canvasRef.current, canvasMobileRef.current]) {
          if (!canvas) continue;
          if (canvas.width !== frame.naturalWidth) {
            canvas.width = frame.naturalWidth;
            canvas.height = frame.naturalHeight;
          }
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(frame, 0, 0);
          }
        }
        currentFrameRef.current = idx;
      }

      // Animate benefit cards
      const num = t.benefits.length;
      deskRefs.current.forEach((el, i) => {
        if (!el) return;
        const zone = 1 / num;
        const zStart = i * zone;
        const zEnd = (i + 1) * zone;
        const fade = zone * 0.4;
        let opacity = 0;
        let ty = 22;

        if (p >= zStart && p < zStart + fade) {
          const r = (p - zStart) / fade;
          opacity = r;
          ty = 22 * (1 - r);
        } else if (p >= zStart + fade && p <= zEnd - fade) {
          opacity = 1;
          ty = 0;
        } else if (p > zEnd - fade && p <= zEnd) {
          const r = (zEnd - p) / fade;
          opacity = r;
          ty = 0;
        }

        el.style.opacity = String(Math.max(0, Math.min(1, opacity)));
        el.style.transform = `translateY(${ty.toFixed(1)}px)`;
      });

      mobRefs.current.forEach((el, i) => {
        if (!el) return;
        const zone = 1 / num;
        const zStart = i * zone;
        const zEnd = (i + 1) * zone;
        const fade = zone * 0.4;
        let opacity = 0;
        let ty = 16;

        if (p >= zStart && p < zStart + fade) {
          const r = (p - zStart) / fade;
          opacity = r;
          ty = 16 * (1 - r);
        } else if (p >= zStart + fade && p <= zEnd - fade) {
          opacity = 1;
          ty = 0;
        } else if (p > zEnd - fade && p <= zEnd) {
          const r = (zEnd - p) / fade;
          opacity = r;
          ty = 0;
        }

        el.style.opacity = String(Math.max(0, Math.min(1, opacity)));
        el.style.transform = `translateY(${ty.toFixed(1)}px)`;
      });

      rafRef.current = requestAnimationFrame(animate);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    rafRef.current = requestAnimationFrame(animate);
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(rafRef.current);
    };
  }, [t.benefits.length]);

  const leftBenefits  = t.benefits.filter(b => b.side === "left");
  const rightBenefits = t.benefits.filter(b => b.side === "right");

  return (
    <section ref={sectionRef} className="relative bg-[#0B0B0B] h-[220vh] lg:h-[400vh]">
      <div className="sticky top-0 h-screen flex flex-col items-center justify-center">

        {/* Heading */}
        <div className="absolute top-10 left-0 right-0 text-center pointer-events-none px-4">
          <p className="km-mono-eyebrow text-[#D8FF3D] text-[11px]">{t.eyebrow}</p>
          <h2 className="km-display text-[clamp(32px,4.5vw,64px)] text-[#F2EDE3] mt-2 leading-[0.95]">
            {t.heading}
            <span className="text-[#F2EDE3]/50"> {t.sub}</span>
          </h2>
        </div>

        {/* Desktop: left + canvas + right */}
        <div className="hidden lg:flex w-full max-w-[1400px] px-10 items-center gap-10 xl:gap-16">

          {/* Left benefits */}
          <div className="flex flex-col justify-center gap-10 flex-1">
            {leftBenefits.map((b) => {
              const idx = t.benefits.indexOf(b);
              return (
                <div
                  key={idx}
                  ref={el => { deskRefs.current[idx] = el; }}
                  className="text-right"
                  style={{ opacity: 0, transform: "translateY(22px)" }}
                >
                  <p className="km-mono-eyebrow text-[#D8FF3D] text-[10px] mb-1">{b.label}</p>
                  <p className="km-display text-[20px] xl:text-[24px] text-[#F2EDE3] leading-[1.1]">{b.title}</p>
                  <p className="text-[13.5px] text-[#F2EDE3]/50 mt-2 leading-[1.55] max-w-[260px] ml-auto">{b.desc}</p>
                </div>
              );
            })}
          </div>

          {/* Canvas */}
          <div className="relative flex-shrink-0" style={{ width: "min(680px, 52vw)" }}>
            <div className="absolute inset-0 blur-[90px] opacity-20 bg-[#D8FF3D] rounded-full scale-90 pointer-events-none" />
            <canvas
              ref={canvasRef}
              width={FRAME_W}
              height={FRAME_H}
              className="relative w-full h-auto block"
              style={{ zIndex: 1 }}
            />
          </div>

          {/* Right benefits */}
          <div className="flex flex-col justify-center gap-10 flex-1">
            {rightBenefits.map((b) => {
              const idx = t.benefits.indexOf(b);
              return (
                <div
                  key={idx}
                  ref={el => { deskRefs.current[idx] = el; }}
                  className="text-left"
                  style={{ opacity: 0, transform: "translateY(22px)" }}
                >
                  <p className="km-mono-eyebrow text-[#D8FF3D] text-[10px] mb-1">{b.label}</p>
                  <p className="km-display text-[20px] xl:text-[24px] text-[#F2EDE3] leading-[1.1]">{b.title}</p>
                  <p className="text-[13.5px] text-[#F2EDE3]/50 mt-2 leading-[1.55] max-w-[260px]">{b.desc}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Mobile: first frame as img + static grid */}
        <div className="lg:hidden flex flex-col items-center w-full px-5 gap-6">
          <div className="w-full max-w-sm overflow-hidden" style={{ borderRadius: "2px" }}>
            <canvas
              ref={canvasMobileRef}
              width={FRAME_W}
              height={FRAME_H}
              className="w-full h-auto block"
            />
          </div>
          <div className="relative w-full max-w-sm" style={{ height: "80px" }}>
            {t.benefits.map((b, i) => (
              <div
                key={i}
                ref={el => { mobRefs.current[i] = el; }}
                className="absolute inset-0 flex flex-col items-center text-center px-4"
                style={{ opacity: 0, transform: "translateY(16px)" }}
              >
                <p className="km-mono-eyebrow text-[#D8FF3D] text-[10px] mb-1">{b.label}</p>
                <p className="text-[15px] text-[#F2EDE3] font-medium leading-tight">{b.title}</p>
                <p className="text-[12px] text-[#F2EDE3]/50 mt-1 leading-snug">{b.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Scroll hint */}
        <div className="absolute bottom-8 left-0 right-0 flex justify-center pointer-events-none">
          <p className="km-mono-eyebrow text-[#F2EDE3]/55 text-[10px] tracking-widest">SCROLL</p>
        </div>
      </div>
    </section>
  );
}
