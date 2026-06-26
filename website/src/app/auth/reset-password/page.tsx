"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { usePanelLang } from "@/lib/usePanelLang";
import PanelLangSwitcher from "@/components/PanelLangSwitcher";
import { type Locale } from "@/lib/i18n";

const inputClass =
  "w-full bg-transparent border border-[rgba(242,237,227,0.18)] text-[#F2EDE3] placeholder-[#F2EDE3]/30 px-4 py-3.5 focus:outline-none focus:border-[#D8FF3D] transition-colors km-mono-eyebrow text-[13px]";

const DICT: Record<
  Locale,
  {
    auth: string;
    brandEyebrow: string;
    brandHeading1: string;
    brandHeading2: string;
    brandSub: string;
    statHashLabel: string;
    statTransportLabel: string;
    statLogsLabel: string;
    reset: string;
    newPassword: string;
    setNewHeading1: string;
    setNewHeading2: string;
    checkingLink: string;
    linkInvalidEyebrow: string;
    sendNewLink: string;
    passwordChangedEyebrow: string;
    passwordChangedBody: string;
    intro: string;
    errorEyebrow: string;
    newPasswordLabel: string;
    repeatPasswordLabel: string;
    submitting: string;
    submit: string;
    footer: string;
    noToken: string;
    invalidLink: string;
    networkError: string;
    somethingWrong: string;
    minLength: string;
    passwordsDiffer: string;
  }
> = {
  pl: {
    auth: "/AUTH",
    brandEyebrow: "[ 03 ] · Nowe hasło",
    brandHeading1: "Zabezpiecz",
    brandHeading2: "konto",
    brandSub:
      "Wybierz mocne hasło. Min. 6 znaków, ale my polecamy więcej — kombinacja liter, cyfr i znaków specjalnych.",
    statHashLabel: "Hashowanie",
    statTransportLabel: "Transport",
    statLogsLabel: "Logów haseł",
    reset: "/RESET",
    newPassword: "Nowe hasło",
    setNewHeading1: "Ustaw",
    setNewHeading2: "nowe",
    checkingLink: "SPRAWDZAM LINK...",
    linkInvalidEyebrow: "/ LINK NIEWAŻNY",
    sendNewLink: "Wyślij nowy link →",
    passwordChangedEyebrow: "/ HASŁO ZMIENIONE",
    passwordChangedBody:
      "Twoje hasło zostało zmienione. Przekierowuję do logowania...",
    intro:
      "Min. 6 znaków. Polecamy mieszankę liter, cyfr i znaków specjalnych.",
    errorEyebrow: "/ ERROR",
    newPasswordLabel: "Nowe hasło",
    repeatPasswordLabel: "Powtórz hasło",
    submitting: "Zapisuję...",
    submit: "Ustaw hasło",
    footer: "KalkMate · Kalkulator z AI",
    noToken: "Brak tokenu w linku",
    invalidLink: "Link nieprawidłowy",
    networkError: "Błąd sieci",
    somethingWrong: "Coś poszło nie tak",
    minLength: "Hasło musi mieć min. 6 znaków",
    passwordsDiffer: "Hasła się różnią",
  },
  en: {
    auth: "/AUTH",
    brandEyebrow: "[ 03 ] · New password",
    brandHeading1: "Secure your",
    brandHeading2: "account",
    brandSub:
      "Pick a strong password. Min. 6 characters, but we recommend more — a mix of letters, numbers and special characters.",
    statHashLabel: "Hashing",
    statTransportLabel: "Transport",
    statLogsLabel: "Password logs",
    reset: "/RESET",
    newPassword: "New password",
    setNewHeading1: "Set a",
    setNewHeading2: "new one",
    checkingLink: "CHECKING LINK...",
    linkInvalidEyebrow: "/ LINK INVALID",
    sendNewLink: "Send a new link →",
    passwordChangedEyebrow: "/ PASSWORD CHANGED",
    passwordChangedBody:
      "Your password has been changed. Redirecting to sign in...",
    intro:
      "Min. 6 characters. We recommend a mix of letters, numbers and special characters.",
    errorEyebrow: "/ ERROR",
    newPasswordLabel: "New password",
    repeatPasswordLabel: "Repeat password",
    submitting: "Saving...",
    submit: "Set password",
    footer: "KalkMate · AI-powered calculator",
    noToken: "No token in the link",
    invalidLink: "Invalid link",
    networkError: "Network error",
    somethingWrong: "Something went wrong",
    minLength: "Password must be at least 6 characters",
    passwordsDiffer: "Passwords do not match",
  },
  de: {
    auth: "/AUTH",
    brandEyebrow: "[ 03 ] · Neues Passwort",
    brandHeading1: "Sichere dein",
    brandHeading2: "Konto",
    brandSub:
      "Wähle ein starkes Passwort. Mind. 6 Zeichen, wir empfehlen aber mehr — eine Kombination aus Buchstaben, Zahlen und Sonderzeichen.",
    statHashLabel: "Hashing",
    statTransportLabel: "Transport",
    statLogsLabel: "Passwort-Logs",
    reset: "/RESET",
    newPassword: "Neues Passwort",
    setNewHeading1: "Lege ein",
    setNewHeading2: "neues fest",
    checkingLink: "LINK WIRD GEPRÜFT...",
    linkInvalidEyebrow: "/ LINK UNGÜLTIG",
    sendNewLink: "Neuen Link senden →",
    passwordChangedEyebrow: "/ PASSWORT GEÄNDERT",
    passwordChangedBody:
      "Dein Passwort wurde geändert. Weiterleitung zur Anmeldung...",
    intro:
      "Mind. 6 Zeichen. Wir empfehlen eine Mischung aus Buchstaben, Zahlen und Sonderzeichen.",
    errorEyebrow: "/ ERROR",
    newPasswordLabel: "Neues Passwort",
    repeatPasswordLabel: "Passwort wiederholen",
    submitting: "Speichern...",
    submit: "Passwort festlegen",
    footer: "KalkMate · KI-Taschenrechner",
    noToken: "Kein Token im Link",
    invalidLink: "Ungültiger Link",
    networkError: "Netzwerkfehler",
    somethingWrong: "Etwas ist schiefgelaufen",
    minLength: "Das Passwort muss mindestens 6 Zeichen lang sein",
    passwordsDiffer: "Die Passwörter stimmen nicht überein",
  },
};

function ResetInner() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token") || "";

  const { lang, setLang } = usePanelLang();
  const t = DICT[lang];

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
      setTokenError(t.noToken);
      return;
    }
    (async () => {
      try {
        const r = await fetch(`/api/auth/reset-password?token=${encodeURIComponent(token)}`);
        const j = await r.json();
        setValid(!!j.valid);
        if (!j.valid) setTokenError(j.error || t.invalidLink);
      } catch {
        setValid(false);
        setTokenError(t.networkError);
      } finally {
        setChecking(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 6) { setError(t.minLength); return; }
    if (password !== confirm) { setError(t.passwordsDiffer); return; }
    setSubmitting(true);
    try {
      const r = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const j = await r.json();
      if (!j.ok) setError(j.error || t.somethingWrong);
      else {
        setDone(true);
        setTimeout(() => router.push("/auth/signin"), 2500);
      }
    } catch {
      setError(t.networkError);
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
          <span className="km-mono-eyebrow text-[#F2EDE3]/40">{t.auth}</span>
        </div>

        <div className="relative z-10">
          <p className="km-mono-eyebrow text-[#D8FF3D]">{t.brandEyebrow}</p>
          <h2 className="km-display text-[clamp(48px,5.4vw,84px)] mt-6">
            {t.brandHeading1}<br />
            <span className="italic">{t.brandHeading2}</span>.
          </h2>
          <p className="mt-6 text-[15px] leading-[1.6] text-[#F2EDE3]/65 max-w-md">
            {t.brandSub}
          </p>
        </div>

        <div className="relative z-10 grid grid-cols-3 gap-6">
          <div>
            <p className="km-display text-3xl text-[#F2EDE3]">bcrypt</p>
            <p className="km-mono-eyebrow text-[#F2EDE3]/40 mt-1">{t.statHashLabel}</p>
          </div>
          <div>
            <p className="km-display text-3xl text-[#F2EDE3]">TLS</p>
            <p className="km-mono-eyebrow text-[#F2EDE3]/40 mt-1">{t.statTransportLabel}</p>
          </div>
          <div>
            <p className="km-display text-3xl text-[#F2EDE3]">0</p>
            <p className="km-mono-eyebrow text-[#F2EDE3]/40 mt-1">{t.statLogsLabel}</p>
          </div>
        </div>
      </div>

      {/* Right form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-10 relative">
        <div className="absolute top-6 right-6 z-20">
          <PanelLangSwitcher lang={lang} setLang={setLang} />
        </div>
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
                {t.newPassword}
              </span>
              <span className="km-mono-eyebrow text-[#F2EDE3]/40">{t.reset}</span>
            </div>

            <h1 className="km-display text-4xl lg:text-5xl mt-6 leading-[0.95]">
              {t.setNewHeading1} <span className="italic text-[#D8FF3D]">{t.setNewHeading2}</span>.
            </h1>

            {checking ? (
              <p className="mt-6 km-mono-eyebrow text-[#F2EDE3]/55">{t.checkingLink}</p>
            ) : !valid ? (
              <>
                <div className="mt-6 border border-[#FF4D2E]/40 bg-[#FF4D2E]/[0.06] p-4">
                  <p className="km-mono-eyebrow text-[#FF4D2E]">{t.linkInvalidEyebrow}</p>
                  <p className="text-sm text-[#FF4D2E]/90 mt-2">{tokenError}</p>
                </div>
                <div className="mt-6 pt-4 border-t border-[rgba(242,237,227,0.10)] text-center">
                  <Link
                    href="/auth/forgot-password"
                    className="km-mono-eyebrow text-[#D8FF3D] hover:text-[#F2EDE3] transition-colors"
                  >
                    {t.sendNewLink}
                  </Link>
                </div>
              </>
            ) : done ? (
              <div className="mt-6 border border-[#D8FF3D]/40 bg-[#D8FF3D]/[0.05] p-4">
                <p className="km-mono-eyebrow text-[#D8FF3D]">{t.passwordChangedEyebrow}</p>
                <p className="text-sm text-[#F2EDE3]/80 mt-2 leading-relaxed">
                  {t.passwordChangedBody}
                </p>
              </div>
            ) : (
              <>
                <p className="mt-3 text-[14.5px] text-[#F2EDE3]/55">
                  {t.intro}
                </p>

                {error && (
                  <div className="mt-6 border border-[#FF4D2E]/40 bg-[#FF4D2E]/[0.06] p-3">
                    <p className="km-mono-eyebrow text-[#FF4D2E]">{t.errorEyebrow}</p>
                    <p className="text-sm text-[#FF4D2E] mt-1">{error}</p>
                  </div>
                )}

                <form onSubmit={submit} className="mt-6 space-y-5">
                  <div>
                    <label htmlFor="password" className="km-mono-eyebrow text-[#F2EDE3]/55 block mb-2">
                      {t.newPasswordLabel}
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
                      {t.repeatPasswordLabel}
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
                    <span>{submitting ? t.submitting : t.submit}</span>
                    <span>→</span>
                  </button>
                </form>
              </>
            )}
          </div>

          <p className="text-center mt-6 km-mono-eyebrow text-[#F2EDE3]/30">
            {t.footer}
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
