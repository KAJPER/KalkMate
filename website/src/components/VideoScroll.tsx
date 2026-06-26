"use client";

import { useEffect, useRef } from "react";
import { type Locale } from "@/lib/i18n";

const FRAME_COUNT = 90;

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
};

export default function VideoScroll({ lang = "pl" }: { lang?: Locale }) {
  const t = dict[lang];
  const sectionRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const progressRef = useRef(0);
  const rafRef = useRef<number>(0);
  const framesRef = useRef<HTMLImageElement[]>([]);
  const currentFrameRef = useRef(-1);
  const deskRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Preload frames
  useEffect(() => {
    const imgs: HTMLImageElement[] = [];
    for (let i = 1; i <= FRAME_COUNT; i++) {
      const img = new window.Image();
      img.src = `/frames/frame_${String(i).padStart(3, "0")}.webp`;
      imgs.push(img);
    }
    framesRef.current = imgs;

    imgs[0].onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = imgs[0].naturalWidth;
      canvas.height = imgs[0].naturalHeight;
      canvas.getContext("2d")?.drawImage(imgs[0], 0, 0);
    };
  }, []);

  // Scroll + rAF loop
  useEffect(() => {
    const onScroll = () => {
      const section = sectionRef.current;
      if (!section) return;
      const rect = section.getBoundingClientRect();
      const scrollable = section.offsetHeight - window.innerHeight;
      progressRef.current = Math.min(1, Math.max(0, -rect.top / scrollable));
    };

    const animate = () => {
      const p = progressRef.current;

      // Draw current frame
      const idx = Math.min(FRAME_COUNT - 1, Math.floor(p * FRAME_COUNT));
      if (idx !== currentFrameRef.current) {
        const frame = framesRef.current[idx];
        if (frame?.complete && frame.naturalWidth > 0) {
          const canvas = canvasRef.current;
          if (canvas) {
            if (canvas.width !== frame.naturalWidth) {
              canvas.width = frame.naturalWidth;
              canvas.height = frame.naturalHeight;
            }
            const ctx = canvas.getContext("2d");
            if (ctx) {
              ctx.clearRect(0, 0, canvas.width, canvas.height);
              ctx.drawImage(frame, 0, 0);
            }
            currentFrameRef.current = idx;
          }
        }
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
    <section ref={sectionRef} className="relative bg-[#0B0B0B]" style={{ height: "400vh" }}>
      <div className="sticky top-0 h-screen flex flex-col items-center justify-center">

        {/* Heading */}
        <div className="absolute top-10 left-0 right-0 text-center pointer-events-none px-4">
          <p className="km-mono-eyebrow text-[#D8FF3D] text-[11px]">{t.eyebrow}</p>
          <h2 className="km-display text-[clamp(32px,4.5vw,64px)] text-[#F2EDE3] mt-2 leading-[0.95]">
            {t.heading}
            <span className="text-[#F2EDE3]/35"> {t.sub}</span>
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
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/frames/frame_001.png"
              alt="KalkMate demo"
              className="w-full h-auto block"
            />
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-5 w-full max-w-sm">
            {t.benefits.map((b, i) => (
              <div key={i}>
                <p className="km-mono-eyebrow text-[#D8FF3D] text-[10px] mb-0.5">{b.label}</p>
                <p className="text-[14px] text-[#F2EDE3] font-medium leading-tight">{b.title}</p>
                <p className="text-[12px] text-[#F2EDE3]/45 mt-1 leading-snug">{b.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Scroll hint */}
        <div className="absolute bottom-8 left-0 right-0 flex justify-center pointer-events-none">
          <p className="km-mono-eyebrow text-[#F2EDE3]/20 text-[10px] tracking-widest">SCROLL</p>
        </div>
      </div>
    </section>
  );
}
