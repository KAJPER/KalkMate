"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";

const inputClass =
  "w-full bg-transparent border border-[rgba(242,237,227,0.18)] text-[#F2EDE3] placeholder-[#F2EDE3]/30 px-4 py-3.5 focus:outline-none focus:border-[#D8FF3D] transition-colors km-mono-eyebrow text-[13px]";

function ResetInner() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token") || "";

  const [checking, setChecking] = useState(true);
  const [valid, setValid] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setChecking(false);
      setValid(false);
      setTokenError("Brak tokenu w linku");
      return;
    }
    (async () => {
      try {
        const r = await fetch(`/api/auth/reset-password?token=${encodeURIComponent(token)}`);
        const j = await r.json();
        setValid(!!j.valid);
        if (!j.valid) setTokenError(j.error || "Link nieprawidłowy");
      } catch {
        setValid(false);
        setTokenError("Błąd sieci");
      } finally {
        setChecking(false);
      }
    })();
  }, [token]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 6) { setError("Hasło musi mieć min. 6 znaków"); return; }
    if (password !== confirm) { setError("Hasła się różnią"); return; }
    setSubmitting(true);
    try {
      const r = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const j = await r.json();
      if (!j.ok) setError(j.error || "Coś poszło nie tak");
      else {
        setDone(true);
        setTimeout(() => router.push("/auth/signin"), 2500);
      }
    } catch {
      setError("Błąd sieci");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0B0B] flex">
      {/* Left brand panel */}
      <div className="hidden lg:flex lg:w-1/2 relative border-r border-[rgba(242,237,227,0.10)] flex-col justify-between p-10 xl:p-14 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none -z-0">
          <div className="absolute -top-32 -left-20 w-[520px] h-[520px] rounded-full bg-[#D8FF3D] opacity-[0.05] blur-[140px]" />
          <div className="absolute bottom-[-20%] right-[-10%] w-[420px] h-[420px] rounded-full bg-[#FF4D2E] opacity-[0.04] blur-[120px]" />
        </div>

        <div className="relative z-10 flex items-center justify-between">
          <Link href="/" className="km-display text-[28px] leading-none">
            Kalk<span className="italic text-[#D8FF3D]">Mate</span>
          </Link>
          <span className="km-mono-eyebrow text-[#F2EDE3]/40">/AUTH</span>
        </div>

        <div className="relative z-10">
          <p className="km-mono-eyebrow text-[#D8FF3D]">[ 03 ] · Nowe hasło</p>
          <h2 className="km-display text-[clamp(48px,5.4vw,84px)] mt-6">
            Zabezpiecz<br />
            <span className="italic">konto</span>.
          </h2>
          <p className="mt-6 text-[15px] leading-[1.6] text-[#F2EDE3]/65 max-w-md">
            Wybierz mocne hasło. Min. 6 znaków, ale my polecamy więcej —
            kombinacja liter, cyfr i znaków specjalnych.
          </p>
        </div>

        <div className="relative z-10 grid grid-cols-3 gap-6">
          <div>
            <p className="km-display text-3xl text-[#F2EDE3]">bcrypt</p>
            <p className="km-mono-eyebrow text-[#F2EDE3]/40 mt-1">Hashowanie</p>
          </div>
          <div>
            <p className="km-display text-3xl text-[#F2EDE3]">TLS</p>
            <p className="km-mono-eyebrow text-[#F2EDE3]/40 mt-1">Transport</p>
          </div>
          <div>
            <p className="km-display text-3xl text-[#F2EDE3]">0</p>
            <p className="km-mono-eyebrow text-[#F2EDE3]/40 mt-1">Logów haseł</p>
          </div>
        </div>
      </div>

      {/* Right form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-10 relative">
        <div className="w-full max-w-md relative">
          <div className="absolute -top-1.5 -left-1.5 w-3 h-3 border-l border-t border-[#D8FF3D]" />
          <div className="absolute -top-1.5 -right-1.5 w-3 h-3 border-r border-t border-[#D8FF3D]" />
          <div className="absolute -bottom-1.5 -left-1.5 w-3 h-3 border-l border-b border-[#D8FF3D]" />
          <div className="absolute -bottom-1.5 -right-1.5 w-3 h-3 border-r border-b border-[#D8FF3D]" />

          <div className="border border-[rgba(242,237,227,0.18)] bg-[#0B0B0B] p-6 lg:p-8">
            <Link href="/" className="lg:hidden inline-flex items-center gap-2 mb-6">
              <span className="km-display text-2xl">
                Kalk<span className="italic text-[#D8FF3D]">Mate</span>
              </span>
            </Link>

            <div className="flex items-center justify-between border-b border-[rgba(242,237,227,0.10)] pb-4">
              <span className="km-mono-eyebrow text-[#D8FF3D] flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-[#D8FF3D] rounded-full km-blink" />
                Nowe hasło
              </span>
              <span className="km-mono-eyebrow text-[#F2EDE3]/40">/RESET</span>
            </div>

            <h1 className="km-display text-4xl lg:text-5xl mt-6 leading-[0.95]">
              Ustaw <span className="italic text-[#D8FF3D]">nowe</span>.
            </h1>

            {checking ? (
              <p className="mt-6 km-mono-eyebrow text-[#F2EDE3]/55">SPRAWDZAM LINK...</p>
            ) : !valid ? (
              <>
                <div className="mt-6 border border-[#FF4D2E]/40 bg-[#FF4D2E]/[0.06] p-4">
                  <p className="km-mono-eyebrow text-[#FF4D2E]">/ LINK NIEWAŻNY</p>
                  <p className="text-sm text-[#FF4D2E]/90 mt-2">{tokenError}</p>
                </div>
                <div className="mt-6 pt-4 border-t border-[rgba(242,237,227,0.10)] text-center">
                  <Link
                    href="/auth/forgot-password"
                    className="km-mono-eyebrow text-[#D8FF3D] hover:text-[#F2EDE3] transition-colors"
                  >
                    Wyślij nowy link →
                  </Link>
                </div>
              </>
            ) : done ? (
              <div className="mt-6 border border-[#D8FF3D]/40 bg-[#D8FF3D]/[0.05] p-4">
                <p className="km-mono-eyebrow text-[#D8FF3D]">/ HASŁO ZMIENIONE</p>
                <p className="text-sm text-[#F2EDE3]/80 mt-2 leading-relaxed">
                  Twoje hasło zostało zmienione. Przekierowuję do logowania...
                </p>
              </div>
            ) : (
              <>
                <p className="mt-3 text-[14.5px] text-[#F2EDE3]/55">
                  Min. 6 znaków. Polecamy mieszankę liter, cyfr i znaków specjalnych.
                </p>

                {error && (
                  <div className="mt-6 border border-[#FF4D2E]/40 bg-[#FF4D2E]/[0.06] p-3">
                    <p className="km-mono-eyebrow text-[#FF4D2E]">/ ERROR</p>
                    <p className="text-sm text-[#FF4D2E] mt-1">{error}</p>
                  </div>
                )}

                <form onSubmit={submit} className="mt-6 space-y-5">
                  <div>
                    <label htmlFor="password" className="km-mono-eyebrow text-[#F2EDE3]/55 block mb-2">
                      Nowe hasło
                    </label>
                    <input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      autoFocus
                      minLength={6}
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label htmlFor="confirm" className="km-mono-eyebrow text-[#F2EDE3]/55 block mb-2">
                      Powtórz hasło
                    </label>
                    <input
                      id="confirm"
                      type="password"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      placeholder="••••••••"
                      required
                      minLength={6}
                      className={inputClass}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submitting || !password || !confirm}
                    className={`group w-full px-5 py-4 km-mono-eyebrow flex items-center justify-between transition-colors ${
                      submitting
                        ? "bg-[#D8FF3D]/30 text-[#0B0B0B]/50 cursor-not-allowed"
                        : "bg-[#D8FF3D] text-[#0B0B0B] hover:bg-[#F2EDE3]"
                    }`}
                  >
                    <span>{submitting ? "Zapisuję..." : "Ustaw hasło"}</span>
                    <span>→</span>
                  </button>
                </form>
              </>
            )}
          </div>

          <p className="text-center mt-6 km-mono-eyebrow text-[#F2EDE3]/30">
            KalkMate · Maturalny kalkulator z AI
          </p>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0B0B0B] flex items-center justify-center">
          <p className="km-mono-eyebrow text-[#F2EDE3]/55">ŁADOWANIE...</p>
        </div>
      }
    >
      <ResetInner />
    </Suspense>
  );
}
