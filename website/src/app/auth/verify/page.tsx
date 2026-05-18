"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

function VerifyInner() {
  const params = useSearchParams();
  const token = params.get("token") || "";
  const [state, setState] = useState<"checking" | "valid" | "invalid" | "done" | "already">("checking");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) { setState("invalid"); setError("Brak tokenu w linku"); return; }
    (async () => {
      try {
        const r = await fetch(`/api/auth/verify-email?token=${encodeURIComponent(token)}`);
        const j = await r.json();
        if (j.alreadyVerified) { setState("already"); return; }
        if (!j.valid) { setState("invalid"); setError(j.error || "Link nieprawidłowy"); return; }
        setState("valid");
      } catch {
        setState("invalid"); setError("Błąd sieci");
      }
    })();
  }, [token]);

  const confirm = async () => {
    setSubmitting(true);
    try {
      const r = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const j = await r.json();
      if (j.ok) setState("done");
      else { setState("invalid"); setError(j.error || "Nie udało się"); }
    } catch {
      setError("Błąd sieci");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0B0B] text-[#F2EDE3] flex">
      <div className="hidden lg:flex lg:w-1/2 relative border-r border-[rgba(242,237,227,0.10)] flex-col justify-between p-10 xl:p-14 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none -z-0">
          <div className="absolute -top-32 -left-20 w-[520px] h-[520px] rounded-full bg-[#D8FF3D] opacity-[0.05] blur-[140px]" />
          <div className="absolute bottom-[-20%] right-[-10%] w-[420px] h-[420px] rounded-full bg-[#FF4D2E] opacity-[0.04] blur-[120px]" />
        </div>
        <div className="relative z-10 flex items-center justify-between">
          <Link href="/" className="km-display text-[28px] leading-none">Kalk<span className="italic text-[#D8FF3D]">Mate</span></Link>
          <span className="km-mono-eyebrow text-[#F2EDE3]/40">/AUTH</span>
        </div>
        <div className="relative z-10">
          <p className="km-mono-eyebrow text-[#D8FF3D]">[ 04 ] · Weryfikacja</p>
          <h2 className="km-display text-[clamp(48px,5.4vw,84px)] mt-6">
            Jedno <span className="italic">kliknięcie</span>.
          </h2>
          <p className="mt-6 text-[15px] leading-[1.6] text-[#F2EDE3]/65 max-w-md">
            Potwierdź swój email żeby aktywować konto. Bez weryfikacji nie zalogujesz się
            ani nie złożysz zamówienia.
          </p>
        </div>
        <div />
      </div>

      <div className="flex-1 flex items-center justify-center p-6 lg:p-10 relative">
        <div className="w-full max-w-md relative">
          <div className="absolute -top-1.5 -left-1.5 w-3 h-3 border-l border-t border-[#D8FF3D]" />
          <div className="absolute -top-1.5 -right-1.5 w-3 h-3 border-r border-t border-[#D8FF3D]" />
          <div className="absolute -bottom-1.5 -left-1.5 w-3 h-3 border-l border-b border-[#D8FF3D]" />
          <div className="absolute -bottom-1.5 -right-1.5 w-3 h-3 border-r border-b border-[#D8FF3D]" />

          <div className="border border-[rgba(242,237,227,0.18)] bg-[#0B0B0B] p-6 lg:p-8">
            <Link href="/" className="lg:hidden inline-flex items-center gap-2 mb-6">
              <span className="km-display text-2xl">Kalk<span className="italic text-[#D8FF3D]">Mate</span></span>
            </Link>

            <div className="flex items-center justify-between border-b border-[rgba(242,237,227,0.10)] pb-4">
              <span className="km-mono-eyebrow text-[#D8FF3D] flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-[#D8FF3D] rounded-full km-blink" />
                Weryfikacja email
              </span>
              <span className="km-mono-eyebrow text-[#F2EDE3]/40">/VERIFY</span>
            </div>

            <h1 className="km-display text-4xl lg:text-5xl mt-6 leading-[0.95]">
              Potwierdź <span className="italic text-[#D8FF3D]">email</span>.
            </h1>

            {state === "checking" && (
              <p className="mt-6 km-mono-eyebrow text-[#F2EDE3]/55">SPRAWDZAM LINK...</p>
            )}

            {state === "invalid" && (
              <>
                <div className="mt-6 border border-[#FF4D2E]/40 bg-[#FF4D2E]/[0.06] p-4">
                  <p className="km-mono-eyebrow text-[#FF4D2E]">/ LINK NIEWAŻNY</p>
                  <p className="text-sm text-[#FF4D2E]/90 mt-2">{error}</p>
                </div>
                <div className="mt-6 pt-4 border-t border-[rgba(242,237,227,0.10)] text-center">
                  <Link href="/auth/signin" className="km-mono-eyebrow text-[#D8FF3D] hover:text-[#F2EDE3] transition-colors">
                    Idź do logowania →
                  </Link>
                </div>
              </>
            )}

            {state === "already" && (
              <>
                <div className="mt-6 border border-[#D8FF3D]/40 bg-[#D8FF3D]/[0.05] p-4">
                  <p className="km-mono-eyebrow text-[#D8FF3D]">/ JUŻ ZWERYFIKOWANE</p>
                  <p className="text-sm text-[#F2EDE3]/80 mt-2">Konto było już aktywowane.</p>
                </div>
                <div className="mt-6 text-center">
                  <Link href="/auth/signin" className="km-mono-eyebrow text-[#D8FF3D] hover:text-[#F2EDE3] transition-colors">
                    Zaloguj się →
                  </Link>
                </div>
              </>
            )}

            {state === "valid" && (
              <>
                <p className="mt-3 text-[14.5px] text-[#F2EDE3]/55">
                  Klik poniżej aby aktywować swoje konto KalkMate.
                </p>
                <button
                  onClick={confirm}
                  disabled={submitting}
                  className={`mt-6 w-full px-5 py-4 km-mono-eyebrow flex items-center justify-between transition-colors ${
                    submitting
                      ? "bg-[#D8FF3D]/30 text-[#0B0B0B]/50 cursor-not-allowed"
                      : "bg-[#D8FF3D] text-[#0B0B0B] hover:bg-[#F2EDE3]"
                  }`}
                >
                  <span>{submitting ? "AKTYWUJĘ..." : "POTWIERDŹ EMAIL"}</span>
                  <span>→</span>
                </button>
              </>
            )}

            {state === "done" && (
              <>
                <div className="mt-6 border border-[#D8FF3D]/40 bg-[#D8FF3D]/[0.05] p-4">
                  <p className="km-mono-eyebrow text-[#D8FF3D]">/ KONTO AKTYWNE</p>
                  <p className="text-sm text-[#F2EDE3]/80 mt-2">
                    Twoje konto jest aktywne. Możesz się teraz zalogować.
                  </p>
                </div>
                <div className="mt-6 text-center">
                  <Link href="/auth/signin" className="km-mono-eyebrow text-[#D8FF3D] hover:text-[#F2EDE3] transition-colors">
                    Zaloguj się →
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0B0B0B] flex items-center justify-center"><p className="km-mono-eyebrow text-[#F2EDE3]/55">ŁADOWANIE...</p></div>}>
      <VerifyInner />
    </Suspense>
  );
}
