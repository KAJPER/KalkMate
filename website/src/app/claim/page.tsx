"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { type Locale } from "@/lib/i18n";
import { usePanelLang } from "@/lib/usePanelLang";
import PanelLangSwitcher from "@/components/PanelLangSwitcher";

// /claim?d=<MAC> — QR z ekranu kalkulatora (account_screen.h). Parowanie
// wymaga kodu AI ustawionego w kalkulatorze (POST /api/user/devices
// { deviceId, unlockCode }) — bez niego API zawsze zwraca 400.
// Parametr ?c= (kod w URL) celowo ignorujemy: kod to sekret, nie powinien
// siedziec w linkach/historii przegladarki.

const CODE_MIN = 4;
const CODE_MAX = 11;

const DICT: Record<Locale, {
  loading: string;
  eyebrow: string;
  tag: string;
  headingPre: string; headingItalic: string; headingPost: string;
  intro: string;
  deviceIdLabel: string;
  deviceIdPlaceholder: string;
  codeLabel: string;
  codePlaceholder: string;
  codeHint: string;
  submit: string;
  submitting: string;
  success: string;
  backToPanel: string;
  errNoDevice: string;
  errCodeFormat: string;
  errNetwork: string;
  errGeneric: string;
  errNotLoggedIn: string;
  errBadDevice: string;
  errNoStoredCode: string;
  errNotRegistered: string;
  errWrongCode: (attempt: string | null) => string;
  errOtherAccount: string;
  errLocked: (mins: string | null) => string;
}> = {
  pl: {
    loading: "Ładowanie...",
    eyebrow: "Parowanie urządzenia",
    tag: "/CLAIM",
    headingPre: "Sparuj ", headingItalic: "kalkulator", headingPost: ".",
    intro: "Zeskanowałeś kod QR z kalkulatora. Wpisz kod AI ustawiony w urządzeniu (Ustawienia → Kod AI), żeby połączyć je ze swoim kontem.",
    deviceIdLabel: "Device ID",
    deviceIdPlaceholder: "MAC z ekranu Ustawienia → Device ID",
    codeLabel: "Kod AI z kalkulatora",
    codePlaceholder: "np. 4271",
    codeHint: `Same cyfry, ${CODE_MIN}–${CODE_MAX} znaków.`,
    submit: "Sparuj urządzenie",
    submitting: "Paruję...",
    success: "Sparowano! Przekierowuję do panelu...",
    backToPanel: "← Wróć do panelu",
    errNoDevice: "Brak Device ID.",
    errCodeFormat: `Kod AI to ${CODE_MIN}–${CODE_MAX} cyfr.`,
    errNetwork: "Błąd połączenia. Spróbuj ponownie.",
    errGeneric: "Nie udało się sparować urządzenia.",
    errNotLoggedIn: "Sesja wygasła — zaloguj się ponownie.",
    errBadDevice: "Nieprawidłowy Device ID.",
    errNoStoredCode: "Kalkulator nie zgłosił jeszcze kodu AI. Zaktualizuj firmware i połącz go z WiFi.",
    errNotRegistered: "Kalkulator jeszcze nie zgłosił się do serwera. Połącz go z WiFi i odczekaj chwilę.",
    errWrongCode: (a) => `Nieprawidłowy kod AI${a ? ` (próba ${a})` : ""}.`,
    errOtherAccount: "To urządzenie jest sparowane z innym kontem.",
    errLocked: (m) => `Za dużo nieudanych prób. Spróbuj ponownie${m ? ` za ${m} min` : " później"}.`,
  },
  en: {
    loading: "Loading...",
    eyebrow: "Device pairing",
    tag: "/CLAIM",
    headingPre: "Pair your ", headingItalic: "calculator", headingPost: ".",
    intro: "You scanned the QR code from your calculator. Enter the AI code set on the device (Settings → AI code) to link it to your account.",
    deviceIdLabel: "Device ID",
    deviceIdPlaceholder: "MAC from Settings → Device ID",
    codeLabel: "AI code from the calculator",
    codePlaceholder: "e.g. 4271",
    codeHint: `Digits only, ${CODE_MIN}–${CODE_MAX} characters.`,
    submit: "Pair device",
    submitting: "Pairing...",
    success: "Paired! Redirecting to your panel...",
    backToPanel: "← Back to panel",
    errNoDevice: "Missing Device ID.",
    errCodeFormat: `The AI code is ${CODE_MIN}–${CODE_MAX} digits.`,
    errNetwork: "Connection error. Please try again.",
    errGeneric: "Could not pair the device.",
    errNotLoggedIn: "Your session has expired — please sign in again.",
    errBadDevice: "Invalid Device ID.",
    errNoStoredCode: "The calculator hasn't reported its AI code yet. Update the firmware and connect it to WiFi.",
    errNotRegistered: "The calculator hasn't checked in with the server yet. Connect it to WiFi and wait a moment.",
    errWrongCode: (a) => `Wrong AI code${a ? ` (attempt ${a})` : ""}.`,
    errOtherAccount: "This device is paired with another account.",
    errLocked: (m) => `Too many failed attempts. Try again${m ? ` in ${m} min` : " later"}.`,
  },
  de: {
    loading: "Wird geladen...",
    eyebrow: "Gerät koppeln",
    tag: "/CLAIM",
    headingPre: "Rechner ", headingItalic: "koppeln", headingPost: ".",
    intro: "Du hast den QR-Code von deinem Rechner gescannt. Gib den im Gerät eingestellten KI-Code ein (Einstellungen → KI-Code), um es mit deinem Konto zu verbinden.",
    deviceIdLabel: "Device ID",
    deviceIdPlaceholder: "MAC aus Einstellungen → Device ID",
    codeLabel: "KI-Code vom Rechner",
    codePlaceholder: "z. B. 4271",
    codeHint: `Nur Ziffern, ${CODE_MIN}–${CODE_MAX} Zeichen.`,
    submit: "Gerät koppeln",
    submitting: "Wird gekoppelt...",
    success: "Gekoppelt! Weiterleitung zum Panel...",
    backToPanel: "← Zurück zum Panel",
    errNoDevice: "Device ID fehlt.",
    errCodeFormat: `Der KI-Code hat ${CODE_MIN}–${CODE_MAX} Ziffern.`,
    errNetwork: "Verbindungsfehler. Bitte erneut versuchen.",
    errGeneric: "Das Gerät konnte nicht gekoppelt werden.",
    errNotLoggedIn: "Sitzung abgelaufen — bitte erneut anmelden.",
    errBadDevice: "Ungültige Device ID.",
    errNoStoredCode: "Der Rechner hat seinen KI-Code noch nicht gemeldet. Firmware aktualisieren und mit WLAN verbinden.",
    errNotRegistered: "Der Rechner hat sich noch nicht beim Server gemeldet. Mit WLAN verbinden und kurz warten.",
    errWrongCode: (a) => `Falscher KI-Code${a ? ` (Versuch ${a})` : ""}.`,
    errOtherAccount: "Dieses Gerät ist mit einem anderen Konto gekoppelt.",
    errLocked: (m) => `Zu viele Fehlversuche. Bitte${m ? ` in ${m} Min.` : " später"} erneut versuchen.`,
  },
};

type Dict = (typeof DICT)[Locale];

// API (/api/user/devices) odpowiada po polsku — dla PL pokazujemy jej tekst,
// dla EN/DE tlumaczymy po kodzie HTTP (+ liczby wyciagniete z komunikatu).
function apiError(t: Dict, lang: Locale, status: number, msg: string | undefined): string {
  if (lang === "pl" && msg) return msg;
  const m = msg || "";
  switch (status) {
    case 401: return t.errNotLoggedIn;
    case 403: return t.errWrongCode(m.match(/(\d+\/\d+)/)?.[1] ?? null);
    case 404: return t.errNotRegistered;
    case 409: return t.errOtherAccount;
    case 429: return t.errLocked(m.match(/(\d+)\s*min/)?.[1] ?? null);
    case 400:
      if (/device id/i.test(m)) return t.errBadDevice;
      if (/firmware|zapisanego/i.test(m)) return t.errNoStoredCode;
      return t.errCodeFormat;
    default: return t.errGeneric;
  }
}

const inputClass =
  "w-full px-4 py-3 bg-[#0B0B0B] border border-[rgba(242,237,227,0.18)] text-[#F2EDE3] text-[15px] placeholder:text-[#F2EDE3]/30 focus:outline-none focus:border-[#D8FF3D] transition-colors";

function ClaimInner() {
  const params = useSearchParams();
  const { status } = useSession();
  const router = useRouter();
  const { lang, setLang } = usePanelLang();
  const t = DICT[lang];
  const [deviceId, setDeviceId] = useState("");
  const [deviceFromQr, setDeviceFromQr] = useState(false);
  const [unlockCode, setUnlockCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const d = (params.get("d") || "").trim().toUpperCase();
    setDeviceId(d);
    setDeviceFromQr(!!d);
  }, [params]);

  // Wymagaj logowania
  useEffect(() => {
    if (status === "unauthenticated") {
      const url = new URL(window.location.href);
      router.push(`/auth/signin?callbackUrl=${encodeURIComponent(url.pathname + url.search)}`);
    }
  }, [status, router]);

  const codeValid = new RegExp(`^\\d{${CODE_MIN},${CODE_MAX}}$`).test(unlockCode);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deviceId.trim()) {
      setError(t.errNoDevice);
      return;
    }
    if (!codeValid) {
      setError(t.errCodeFormat);
      return;
    }
    setSubmitting(true);
    setError(null);
    setResult(null);
    try {
      const r = await fetch("/api/user/devices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId: deviceId.trim(), unlockCode }),
      });
      const j = await r.json().catch(() => ({} as { ok?: boolean; error?: string }));
      if (!r.ok || !j.ok) {
        setError(apiError(t, lang, r.status, j.error));
      } else {
        setUnlockCode("");
        setResult(t.success);
        setTimeout(() => router.push("/panel"), 1500);
      }
    } catch {
      setError(t.errNetwork);
    } finally {
      setSubmitting(false);
    }
  };

  if (status !== "authenticated") {
    return (
      <div className="min-h-screen bg-[#0B0B0B] flex items-center justify-center">
        <span className="km-mono-eyebrow text-[#F2EDE3]/55">{t.loading}</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B0B0B] text-[#F2EDE3] km-grain flex items-center justify-center p-6">
      <div className="w-full max-w-md relative">
        <div className="absolute -top-1.5 -left-1.5 w-3 h-3 border-l border-t border-[#D8FF3D]" />
        <div className="absolute -top-1.5 -right-1.5 w-3 h-3 border-r border-t border-[#D8FF3D]" />
        <div className="absolute -bottom-1.5 -left-1.5 w-3 h-3 border-l border-b border-[#D8FF3D]" />
        <div className="absolute -bottom-1.5 -right-1.5 w-3 h-3 border-r border-b border-[#D8FF3D]" />

        <div className="border border-[rgba(242,237,227,0.18)] bg-[#0B0B0B] p-6 lg:p-8">
          <div className="flex items-center justify-between mb-6">
            <Link href="/" className="inline-flex items-center gap-2">
              <span className="km-display text-2xl">
                Kalk<span className="italic text-[#D8FF3D]">Mate</span>
              </span>
            </Link>
            <PanelLangSwitcher lang={lang} setLang={setLang} compact />
          </div>

          <div className="flex items-center justify-between border-b border-[rgba(242,237,227,0.10)] pb-4">
            <span className="km-mono-eyebrow text-[#D8FF3D] flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-[#D8FF3D] rounded-full km-blink" />
              {t.eyebrow}
            </span>
            <span className="km-mono-eyebrow text-[#F2EDE3]/40">{t.tag}</span>
          </div>

          <h1 className="km-display text-4xl lg:text-5xl mt-6 leading-[0.95]">
            {t.headingPre}<span className="italic text-[#D8FF3D]">{t.headingItalic}</span>{t.headingPost}
          </h1>
          <p className="mt-3 text-[14.5px] leading-relaxed text-[#F2EDE3]/55">{t.intro}</p>

          <form onSubmit={submit} className="mt-6 space-y-5">
            <div>
              <label htmlFor="claim-device" className="km-mono-eyebrow text-[#F2EDE3]/55 block mb-2">
                {t.deviceIdLabel}
              </label>
              {deviceFromQr ? (
                <div className="px-4 py-3 border border-[#D8FF3D]/40 bg-[#D8FF3D]/[0.05] font-mono text-sm text-[#F2EDE3] break-all">
                  {deviceId}
                </div>
              ) : (
                <input
                  id="claim-device"
                  type="text"
                  value={deviceId}
                  onChange={(e) => setDeviceId(e.target.value.toUpperCase())}
                  placeholder={t.deviceIdPlaceholder}
                  autoComplete="off"
                  className={inputClass + " font-mono"}
                />
              )}
            </div>

            <div>
              <label htmlFor="claim-code" className="km-mono-eyebrow text-[#F2EDE3]/55 block mb-2">
                {t.codeLabel}
              </label>
              <input
                id="claim-code"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                pattern={`\\d{${CODE_MIN},${CODE_MAX}}`}
                minLength={CODE_MIN}
                maxLength={CODE_MAX}
                required
                value={unlockCode}
                onChange={(e) => setUnlockCode(e.target.value.replace(/\D/g, "").slice(0, CODE_MAX))}
                placeholder={t.codePlaceholder}
                className={inputClass + " font-mono tracking-[0.3em]"}
              />
              <p className="km-mono-eyebrow text-[#F2EDE3]/40 mt-2">{t.codeHint}</p>
            </div>

            {error && (
              <div className="border border-[#FF4D2E]/40 bg-[#FF4D2E]/[0.06] p-3">
                <p className="text-sm text-[#FF4D2E]">{error}</p>
              </div>
            )}
            {result && (
              <div className="border border-[#D8FF3D]/40 bg-[#D8FF3D]/[0.05] p-3">
                <p className="text-sm text-[#D8FF3D]">{result}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || !deviceId.trim() || !codeValid || !!result}
              className={`w-full px-5 py-4 km-mono-eyebrow flex items-center justify-between transition-colors ${
                submitting || !deviceId.trim() || !codeValid || !!result
                  ? "bg-[#D8FF3D]/30 text-[#0B0B0B]/50 cursor-not-allowed"
                  : "bg-[#D8FF3D] text-[#0B0B0B] hover:bg-[#F2EDE3]"
              }`}
            >
              <span>{submitting ? t.submitting : t.submit}</span>
              <span>→</span>
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-[rgba(242,237,227,0.10)]">
            <Link href="/panel" className="km-mono-eyebrow text-[#F2EDE3]/45 hover:text-[#F2EDE3] transition-colors">
              {t.backToPanel}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ClaimPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0B0B0B] flex items-center justify-center">
          <span className="km-mono-eyebrow text-[#F2EDE3]/55">Ładowanie...</span>
        </div>
      }
    >
      <ClaimInner />
    </Suspense>
  );
}
