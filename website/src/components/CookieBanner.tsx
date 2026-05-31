"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const STORAGE_KEY = "kalkmate-cookie-consent";
const VERSION = "1"; // bump zeby wymusic ponowna zgode po istotnej zmianie

type Choice = "all" | "essential";

interface ConsentRecord {
  v: string;
  choice: Choice;
  at: string;
}

function read(): ConsentRecord | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ConsentRecord;
    if (parsed?.v !== VERSION) return null; // stara wersja -> pytamy znow
    return parsed;
  } catch {
    return null;
  }
}

function write(choice: Choice) {
  const record: ConsentRecord = {
    v: VERSION,
    choice,
    at: new Date().toISOString(),
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
    window.dispatchEvent(
      new CustomEvent("kalkmate:cookie-consent", { detail: record }),
    );
  } catch {
    // localStorage zablokowany (private mode) — nic nie zapisujemy
  }
}

export default function CookieBanner() {
  // null = jeszcze nie wiemy (SSR / pre-mount), false = nie pokazuj, true = pokaz
  const [show, setShow] = useState<boolean | null>(null);

  useEffect(() => {
    setShow(!read());
  }, []);

  if (!show) return null;

  const accept = (choice: Choice) => {
    write(choice);
    setShow(false);
  };

  return (
    <div
      role="dialog"
      aria-label="Zgoda na pliki cookies"
      className="fixed inset-x-0 bottom-0 z-[100] px-4 pb-4 sm:px-6 sm:pb-6 pointer-events-none"
    >
      <div className="pointer-events-auto mx-auto max-w-4xl bg-[#0E0E0E]/95 backdrop-blur-md border border-[rgba(242,237,227,0.18)] shadow-2xl">
        {/* Top accent bar */}
        <div className="h-[2px] bg-gradient-to-r from-transparent via-[#D8FF3D] to-transparent" />

        <div className="p-5 sm:p-7 grid gap-5 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <span className="km-mono-eyebrow text-[#D8FF3D] flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-[#D8FF3D] rounded-full km-blink" />
                Cookies · zgoda
              </span>
              <span className="km-mono-eyebrow text-[#F2EDE3]/30 hidden sm:inline">
                RODO / e-Privacy
              </span>
            </div>
            <p className="text-[14px] leading-[1.55] text-[#F2EDE3]/80">
              Używamy ciasteczek — <strong className="text-[#F2EDE3]">niezbędnych</strong> do
              działania sklepu (logowanie, koszyk) oraz{" "}
              <strong className="text-[#F2EDE3]">analitycznych</strong>, żeby wiedzieć co
              poprawiać. Niezbędne nie wymagają zgody, analityczne — tak.
            </p>
            <p className="mt-2 text-[12px] text-[#F2EDE3]/45">
              Więcej w{" "}
              <Link
                href="/polityka-prywatnosci#sek-9"
                className="text-[#D8FF3D] hover:underline"
              >
                Polityce Prywatności
              </Link>
              . Decyzję możesz zmienić w przeglądarce w dowolnym momencie.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row lg:flex-col gap-2 lg:min-w-[200px]">
            <button
              onClick={() => accept("all")}
              className="km-mono-eyebrow bg-[#D8FF3D] text-[#0B0B0B] px-5 py-3 hover:bg-[#F2EDE3] transition-colors order-1"
            >
              Akceptuję wszystkie
            </button>
            <button
              onClick={() => accept("essential")}
              className="km-mono-eyebrow border border-[rgba(242,237,227,0.18)] text-[#F2EDE3]/80 px-5 py-3 hover:border-[#D8FF3D] hover:text-[#F2EDE3] transition-colors order-2"
            >
              Tylko niezbędne
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
