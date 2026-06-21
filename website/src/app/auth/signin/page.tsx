"use client";

import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/panel";
  // Tryb formularza: ?mode=register | ?mode=signup | ?signup=1 -> rejestracja, domyslnie login
  const initialMode = searchParams.get("mode") || (searchParams.get("signup") ? "register" : "");
  const startAsRegister = initialMode === "register" || initialMode === "signup";

  const urlError = searchParams.get("error");
  const urlErrorMsg = urlError === "OAuthCallback" || urlError === "OAuthSignin"
    ? "Błąd logowania przez Google. Spróbuj ponownie."
    : urlError === "OAuthAccountNotLinked"
    ? "Ten email jest już zarejestrowany hasłem. Zaloguj się emailem i hasłem."
    : urlError === "AccessDenied"
    ? "Dostęp odmówiony przez Google."
    : urlError
    ? `Błąd: ${urlError}`
    : "";

  const [isLogin, setIsLogin] = useState(!startAsRegister);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(urlErrorMsg);
  const [verificationSent, setVerificationSent] = useState(false);
  const [showResend, setShowResend] = useState(false);
  const [resending, setResending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setVerificationSent(false);
    setShowResend(false);
    setIsLoading(true);

    try {
      if (isLogin) {
        const result = await signIn("credentials", { email, password, redirect: false });
        if (result?.error) {
          setError(result.error);
          if (result.error.toLowerCase().includes("niezweryfikowany")) setShowResend(true);
        } else if (result?.ok) {
          // Hard navigation - upewniamy sie ze cookie sesji jest widoczne w SSR
          window.location.href = callbackUrl;
        }
      } else {
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, name }),
        });
        const data = await res.json();
        if (!res.ok) setError(data.error || "Błąd rejestracji");
        else {
          // Konto utworzone — NIE logujemy automatycznie. User musi zweryfikowac email.
          setVerificationSent(true);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Wystąpił błąd");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setVerificationSent(true);
      setShowResend(false);
      setError("");
    } finally {
      setResending(false);
    }
  };

  const inputClass =
    "w-full px-4 py-3 bg-[#0B0B0B] border border-[rgba(242,237,227,0.18)] text-[#F2EDE3] text-[15px] placeholder:text-[#F2EDE3]/30 focus:outline-none focus:border-[#D8FF3D] transition-colors";

  return (
    <div className="min-h-screen bg-[#0B0B0B] text-[#F2EDE3] km-grain flex">
      {/* Left: brand panel — hidden on mobile */}
      <div className="hidden lg:flex lg:w-1/2 relative border-r border-[rgba(242,237,227,0.10)] flex-col justify-between p-10 xl:p-14 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none -z-0">
          <div className="absolute -top-32 -left-20 w-[520px] h-[520px] rounded-full bg-[#D8FF3D] opacity-[0.05] blur-[140px]" />
          <div className="absolute bottom-[-20%] right-[-10%] w-[420px] h-[420px] rounded-full bg-[#FF4D2E] opacity-[0.04] blur-[120px]" />
        </div>

        <div className="relative z-10 flex items-center justify-between">
          <Link href="/" className="km-display text-[28px] leading-none">
            Kalk<span className="italic text-[#D8FF3D]">Mate</span>
          </Link>
          <span className="km-mono-eyebrow text-[#F2EDE3]/40">v0.6.4</span>
        </div>

        <div className="relative z-10">
          <p className="km-mono-eyebrow text-[#D8FF3D]">[ 01 ] · Panel klienta</p>
          <h2 className="km-display text-[clamp(48px,5.4vw,84px)] mt-6">
            Twój sprzęt.<br />
            <span className="italic">Twoje</span> rozwiązania.
          </h2>
          <p className="mt-6 text-[15px] leading-[1.6] text-[#F2EDE3]/65 max-w-md">
            Zaloguj się, żeby skonfigurować WiFi w kalkulatorze,
            przeglądać historię rozwiązań, zarządzać licencjami AI Chat
            i aktywować nowe urządzenia.
          </p>
        </div>

        <div className="relative z-10 grid grid-cols-3 gap-6">
          <div>
            <p className="km-display text-3xl text-[#F2EDE3]">04</p>
            <p className="km-mono-eyebrow text-[#F2EDE3]/40 mt-1">Przedmiotów</p>
          </div>
          <div>
            <p className="km-display text-3xl text-[#F2EDE3]">1.2<span className="text-[#F2EDE3]/40 text-lg">s</span></p>
            <p className="km-mono-eyebrow text-[#F2EDE3]/40 mt-1">Odpowiedź</p>
          </div>
          <div>
            <p className="km-display text-3xl text-[#F2EDE3]">24<span className="text-[#F2EDE3]/40 text-lg">mc</span></p>
            <p className="km-mono-eyebrow text-[#F2EDE3]/40 mt-1">Gwarancja</p>
          </div>
        </div>
      </div>

      {/* Right: form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-10 relative">
        <div className="w-full max-w-md relative">
          {/* Frame ticks */}
          <div className="absolute -top-1.5 -left-1.5 w-3 h-3 border-l border-t border-[#D8FF3D]" />
          <div className="absolute -top-1.5 -right-1.5 w-3 h-3 border-r border-t border-[#D8FF3D]" />
          <div className="absolute -bottom-1.5 -left-1.5 w-3 h-3 border-l border-b border-[#D8FF3D]" />
          <div className="absolute -bottom-1.5 -right-1.5 w-3 h-3 border-r border-b border-[#D8FF3D]" />

          <div className="border border-[rgba(242,237,227,0.18)] bg-[#0B0B0B] p-6 lg:p-8">
            {/* Mobile brand */}
            <Link href="/" className="lg:hidden inline-flex items-center gap-2 mb-6">
              <span className="km-display text-2xl">
                Kalk<span className="italic text-[#D8FF3D]">Mate</span>
              </span>
            </Link>

            <div className="flex items-center justify-between border-b border-[rgba(242,237,227,0.10)] pb-4">
              <span className="km-mono-eyebrow text-[#D8FF3D] flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-[#D8FF3D] rounded-full km-blink" />
                {isLogin ? "Logowanie" : "Rejestracja"}
              </span>
              <span className="km-mono-eyebrow text-[#F2EDE3]/40">
                /AUTH · v0.6.4
              </span>
            </div>

            <h1 className="km-display text-4xl lg:text-5xl mt-6 leading-[0.95]">
              {isLogin ? (
                <>Wejdź na <span className="italic text-[#D8FF3D]">panel</span>.</>
              ) : (
                <>Załóż <span className="italic text-[#D8FF3D]">konto</span>.</>
              )}
            </h1>
            <p className="mt-3 text-[14.5px] text-[#F2EDE3]/55">
              {isLogin
                ? "Zaloguj się i przejmij kontrolę nad swoim KalkMate."
                : "Utwórz konto, żeby zacząć aktywować urządzenia."}
            </p>

            {error && (
              <div className="mt-6 border border-[#FF4D2E]/40 bg-[#FF4D2E]/[0.06] p-3">
                <p className="km-mono-eyebrow text-[#FF4D2E]">/ ERROR</p>
                <p className="text-sm text-[#FF4D2E] mt-1">{error}</p>
                {showResend && (
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={resending || !email}
                    className="mt-3 km-mono-eyebrow text-[#D8FF3D] hover:text-[#F2EDE3] disabled:opacity-50 transition-colors"
                  >
                    {resending ? "WYSYŁAM..." : "WYŚLIJ NOWY LINK WERYFIKACYJNY →"}
                  </button>
                )}
              </div>
            )}

            {verificationSent && (
              <div className="mt-6 border border-[#D8FF3D]/40 bg-[#D8FF3D]/[0.05] p-4">
                <p className="km-mono-eyebrow text-[#D8FF3D]">/ SPRAWDŹ SKRZYNKĘ</p>
                <p className="text-sm text-[#F2EDE3]/80 mt-2 leading-relaxed">
                  Wysłaliśmy link aktywacyjny na <strong className="text-[#F2EDE3]">{email}</strong>.
                  Kliknij go żeby aktywować konto (link wygasa za 24h). Sprawdź też SPAM.
                </p>
              </div>
            )}

            {/* Google OAuth */}
            <div className="mt-6">
              <button
                type="button"
                onClick={() => signIn("google", { callbackUrl })}
                className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-[rgba(242,237,227,0.18)] bg-transparent text-[#F2EDE3]/80 hover:border-[rgba(242,237,227,0.35)] hover:text-[#F2EDE3] transition-colors km-mono-eyebrow"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Kontynuuj z Google
              </button>
              <div className="relative my-5">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-[rgba(242,237,227,0.10)]" />
                </div>
                <div className="relative flex justify-center">
                  <span className="px-3 bg-[#0B0B0B] km-mono-eyebrow text-[#F2EDE3]/30 text-[11px]">lub</span>
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {!isLogin && (
                <div>
                  <label htmlFor="name" className="km-mono-eyebrow text-[#F2EDE3]/55 block mb-2">
                    Imię <span className="text-[#F2EDE3]/30">· opcjonalne</span>
                  </label>
                  <input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Jan Kowalski"
                    className={inputClass}
                  />
                </div>
              )}

              <div>
                <label htmlFor="email" className="km-mono-eyebrow text-[#F2EDE3]/55 block mb-2">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="twoj@email.pl"
                  required
                  className={inputClass}
                />
              </div>

              <div>
                <label htmlFor="password" className="km-mono-eyebrow text-[#F2EDE3]/55 block mb-2">
                  Hasło
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  className={inputClass}
                />
                {!isLogin && (
                  <p className="km-mono-eyebrow text-[#F2EDE3]/40 mt-2">
                    Min. 6 znaków
                  </p>
                )}
                {isLogin && (
                  <div className="mt-2 text-right">
                    <a
                      href="/auth/forgot-password"
                      className="km-mono-eyebrow text-[#F2EDE3]/55 hover:text-[#D8FF3D] transition-colors"
                    >
                      Zapomniałem hasła
                    </a>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className={`group w-full px-5 py-4 km-mono-eyebrow flex items-center justify-between transition-colors ${
                  isLoading
                    ? "bg-[#D8FF3D]/30 text-[#0B0B0B]/50 cursor-not-allowed"
                    : "bg-[#D8FF3D] text-[#0B0B0B] hover:bg-[#F2EDE3]"
                }`}
              >
                <span className="flex items-center gap-2">
                  {!isLoading && <span className="w-1.5 h-1.5 bg-[#0B0B0B] rounded-full km-blink" />}
                  {isLoading
                    ? isLogin ? "Logowanie..." : "Tworzenie konta..."
                    : isLogin ? "Zaloguj się" : "Zarejestruj się"}
                </span>
                {!isLoading && <span>→</span>}
              </button>
            </form>

            <div className="mt-6 pt-6 border-t border-[rgba(242,237,227,0.10)] flex flex-col gap-3">
              <button
                onClick={() => { setIsLogin(!isLogin); setError(""); }}
                className="km-mono-eyebrow text-[#D8FF3D] hover:text-[#F2EDE3] transition-colors text-left"
              >
                {isLogin ? "Nie masz konta? → Załóż konto" : "Masz już konto? → Zaloguj się"}
              </button>
              <Link
                href="/"
                className="km-mono-eyebrow text-[#F2EDE3]/45 hover:text-[#F2EDE3] transition-colors"
              >
                ← Powrót do strony głównej
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0B0B0B] flex items-center justify-center">
          <span className="km-mono-eyebrow text-[#F2EDE3]/55">Ładowanie...</span>
        </div>
      }
    >
      <SignInForm />
    </Suspense>
  );
}
