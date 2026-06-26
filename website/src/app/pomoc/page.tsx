"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

const sections = [
  { id: "start",       label: "01 · Pierwsze uruchomienie" },
  { id: "klawiatura",  label: "02 · Nawigacja klawiaturą" },
  { id: "ai",          label: "03 · Tryb AI" },
  { id: "notatki",     label: "04 · Notatki i sprawdziany" },
  { id: "bateria",     label: "05 · Bateria i ładowanie" },
  { id: "ota",         label: "06 · Aktualizacje (OTA)" },
  { id: "problemy",    label: "07 · Rozwiązywanie problemów" },
  { id: "faq",         label: "08 · FAQ" },
  { id: "changelog",   label: "09 · Changelog firmware" },
  { id: "kontakt",     label: "10 · Kontakt" },
];

// Wartosc poczatkowa/fallback — realne dane ciagniemy z /api/firmware/changelog
// (single source of truth: firmware-private/releases.json karmiony przez deploy.ps1).
const CHANGELOG_FALLBACK = [
  { v: "1.4.1", date: "2026-05-28", notes: "Bezpieczeństwo: Signed OTA (ECDSA P-256) + obfuskacja API key w binarce — chronione przed wstrzyknięciem firmware i strings extraction" },
  { v: "1.4.0", date: "2026-05-28", notes: "Bezpieczeństwo: OTA wymaga autoryzacji (x-api-key + zarejestrowany device-id), pliki .bin poza public/" },
  { v: "1.3.9", date: "2026-05-28", notes: "Kamera: test rotacji — tylko vflip + Serial log z aktualną konfiguracją" },
  { v: "1.3.8", date: "2026-05-28", notes: "Kamera: hmirror+vflip dla rotacji 180° (sensor zamontowany do góry nogami)" },
  { v: "1.3.7", date: "2026-05-28", notes: "Kamera OV2640: AEC/AGC/AWB włączone + gamma/lens correction + 5-klatkowy warm-up (fix prześwietlenia + zielonego tintu)" },
  { v: "1.3.6", date: "2026-05-28", notes: "Polskie znaki UTF-8 → ASCII w odpowiedziach AI + błędach (wzorzec z tests.h)" },
  { v: "1.3.5", date: "2026-05-28", notes: "Auto-sync licencji z serwera do NVS (fix dla x-license-key 403)" },
  { v: "1.3.4", date: "2026-05-28", notes: "Kamera UXGA 1600×1200 (max sensora 2MP) + auto-WiFi po AI menu z 3s delay" },
  { v: "1.3.3", date: "2026-05-28", notes: "Solve_screen: camBegin → capture → camEnd przed WiFi (anty-XCLK interference)" },
  { v: "1.3.2", date: "2026-05-28", notes: "Wspólny bus I2C dla MCP23017 + OV2640 SCCB (fix Error 263)" },
  { v: "1.3.1", date: "2026-05-28", notes: "Kamera: CAMERA_GRAB_WHEN_EMPTY + fb_count=1 (fix freeze ekranu testu)" },
  { v: "1.3.0", date: "2026-05-28", notes: "Kamera OV2640 — realny test w Settings + pełna persistencja ustawień w NVS" },
  { v: "1.2.0", date: "2026-05-27", notes: "Production release PCB v4: kontrast 60, VBAT watchdog, early-battery splash" },
  { v: "1.1.5", date: "2026-05-27", notes: "Niski kontrast OLED (anty-brownout na batery LiPo) + VBAT watchdog co 2s" },
  { v: "1.1.4", date: "2026-05-27", notes: "Diagnostic markery wokół powrotu z runCalculator dla logowania crashy" },
  { v: "1.1.3", date: "2026-05-27", notes: "Wyłączenie auto-WiFi przy boot (peak prądu psuł LiPo)" },
  { v: "1.1.2", date: "2026-05-27", notes: "Early battery check + splash NISKA BATERIA przed boost EN" },
  { v: "1.1.1", date: "2026-05-27", notes: "Lazy WiFi init z 2s opóźnieniem po menu (anty-brownout)" },
  { v: "1.1.0", date: "2026-05-27", notes: "Pomiar baterii LiPo + ikonka + auto-shutdown + ekran w Ustawieniach + charging detect" },
  { v: "1.0.0", date: "2026-05-26", notes: "Migracja na PCB v4 (ESP32-S3-WROOM-1-N16R8 + native USB-C)" },
  { v: "0.6.8", date: "2026-05-18", notes: "Reset fabryczny w Settings (NVS + SPIFFS + restart)" },
  { v: "0.6.7", date: "2026-05-15", notes: "Streaming HTTP do PSRAM — fix przy 28+ sprawdzianach" },
  { v: "0.6.6", date: "2026-05-15", notes: "Streaming JSON do SPIFFS + polskie znaki w tytułach" },
  { v: "0.6.5", date: "2026-05-15", notes: "Cache tytułów sprawdzianów — eliminuje lagi listy" },
  { v: "0.6.4", date: "2026-05-15", notes: "WiFi scan: reset radia przed skanem (fix dla niedostępnej zapisanej sieci)" },
  { v: "0.6.3", date: "2026-05-15", notes: "LaTeX: sqrt[n], overrightarrow, środowiska cases/bmatrix" },
  { v: "0.6.2", date: "2026-05-15", notes: "LaTeX stripper: greckie, zbiory, logika, strzałki, mathbb, vec" },
  { v: "0.6.1", date: "2026-05-15", notes: "Funkcje matematyczne LaTeX (log, ln, sin, cos itd.)" },
  { v: "0.6.0", date: "2026-05-15", notes: "GPA7 OUTPUT HIGH przy boot — MT3608 EN nie floatuje" },
  { v: "0.5.8", date: "2026-05-09", notes: "Settings — reorganizacja (Preferencje/Konto/System/Diagnostyka)" },
  { v: "0.5.4", date: "2026-05-08", notes: "JSON-aware parser dla notes/tests (fix dla LaTeX z [ { } ])" },
  { v: "0.5.0", date: "2026-05-07", notes: "Parowanie deviceId + unlockCode, Status konta w Settings" },
  { v: "0.4.9", date: "2026-05-08", notes: "Nowy keyboard mapping po przelutowaniu klawiatury" },
  { v: "0.4.7", date: "2026-05-06", notes: "Mapowanie klawiatury — kreator z zapisem do NVS" },
  { v: "0.4.6", date: "2026-05-06", notes: "Pin Driver Test — diagnostyka MCP23017" },
  { v: "0.4.0", date: "2026-04-30", notes: "Notatki + Sprawdziany przez WiFi sync" },
  { v: "0.3.0", date: "2026-04-25", notes: "Tryb AI: zdjęcie / tekst / historia" },
  { v: "0.2.0", date: "2026-04-20", notes: "OTA update przez HTTPS" },
  { v: "0.1.0", date: "2026-04-15", notes: "Pierwsza działająca wersja: kalkulator + WiFi" },
];

const faqs: { q: string; a: string }[] = [
  {
    q: "Jak włączyć / wyłączyć kalkulator?",
    a: "Przesuń przełącznik suwakowy na boku. Wyłączenie nie kasuje notatek ani historii — wszystko jest zapisane w pamięci wewnętrznej.",
  },
  {
    q: "Jak długo trzyma bateria?",
    a: "Mieszane użycie (kilka godzin AI + reszta sleep): ~2–3 dni. Stand-by: 5–7 dni. Pełne ładowanie: ~3 godziny przez USB-C.",
  },
  {
    q: "Dlaczego AI Chat wymaga WiFi?",
    a: "Same odpowiedzi liczy serwer (model Gemini). Bez WiFi działa tylko kalkulator, notatki, sprawdziany. Konfiguracja: Ustawienia → WiFi.",
  },
  {
    q: "Co to jest klawisz Panic?",
    a: "Klawisz (domyślnie MU) który NATYCHMIAST cofa do trybu kalkulatora z dowolnego ekranu. Przydaje się gdy ktoś patrzy. Możesz go zmienić w Ustawienia → Panic key.",
  },
  {
    q: "Jak dodaję notatki / sprawdziany?",
    a: "Wyłącznie przez panel klienta na kalkmate.pl/panel. Kalkulator synchronizuje je przez WiFi (Notatki → Sync). Na urządzeniu tylko czytasz, nie edytujesz.",
  },
  {
    q: 'Co robi "Kod AI"?',
    a: "Czterocyfrowy kod (domyślnie 1111) który wpisujesz w trybie kalkulatora żeby odblokować menu AI. Bez tego kalkulator wygląda jak zwykła Esperanza T8809-2.",
  },
  {
    q: "Jak sparuję kalkulator z kontem?",
    a: "1) Załóż konto na kalkmate.pl 2) Przypisz licencję w zakładce Subskrypcja (jeśli kupowałeś online, jest auto-przypisana). 3) Na kalkulatorze: Ustawienia → Device ID + QR — zarejestruje się na serwerze. 4) W panelu Kalkulator wpisz Device ID + Kod AI.",
  },
  {
    q: "Ekran miga / pokazuje białe paski — co robić?",
    a: "Najczęściej buczy/niestabilna jest przetwornica 12V (MT3608). Skontaktuj się przez formularz — odeślemy ci nową płytkę. Reklamacja w gwarancji 24mc.",
  },
  {
    q: "Klawisz nie działa — można to naprawić softem?",
    a: "Jeśli to problem z mapowaniem (po lutowaniu) — tak, mamy narzędzie keymap_scan które przemapuje klawisze. Pisz przez formularz, wyślemy plik.",
  },
  {
    q: "Jak zaktualizować firmware?",
    a: "Ustawienia → Aktualizacje → OK. Kalkulator sprawdza serwer, pyta o zgodę, pobiera + flashuje + restartuje. Cały proces ~1 minuta z WiFi.",
  },
  {
    q: "Zapomniałem hasła do konta",
    a: "Wejdź kalkmate.pl/auth/forgot-password — wyślemy link resetujący na podany email (ważny 60 minut).",
  },
  {
    q: "Mogę zwrócić kalkulator?",
    a: "Tak, 14 dni od dostawy bez podania przyczyny (RODO + ustawa o prawach konsumenta). Wystarczy email na kontakt@kalkmate.pl ze swoim numerem zamówienia.",
  },
];

const inputClass =
  "w-full bg-transparent border border-[rgba(242,237,227,0.18)] text-[#F2EDE3] placeholder-[#F2EDE3]/30 px-4 py-3.5 focus:outline-none focus:border-[#D8FF3D] transition-colors km-mono-eyebrow text-[13px]";

export default function PomocPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Changelog + aktualna wersja serwera — pobierane z /api/firmware/changelog.
  // CHANGELOG_FALLBACK jako stan poczatkowy, zeby strona nie byla pusta zanim
  // fetch wroci (oraz gdy API jest chwilowo niedostepne).
  const [changelog, setChangelog] = useState(CHANGELOG_FALLBACK);
  const [serverVersion, setServerVersion] = useState(CHANGELOG_FALLBACK[0].v);

  useEffect(() => {
    let alive = true;
    fetch("/api/firmware/changelog")
      .then((r) => r.json())
      .then((d) => {
        if (!alive || !d?.ok) return;
        if (Array.isArray(d.releases) && d.releases.length > 0) setChangelog(d.releases);
        if (d.latest) setServerVersion(d.latest);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const submitContact = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const r = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const j = await r.json();
      if (!j.ok) setError(j.error || "Nie udało się wysłać");
      else { setSent(true); setForm({ name: "", email: "", subject: "", message: "" }); }
    } catch {
      setError("Błąd sieci");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0B0B] text-[#F2EDE3]">
      {/* Header */}
      <header className="border-b border-[rgba(242,237,227,0.10)] sticky top-0 bg-[#0B0B0B]/95 backdrop-blur-sm z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="km-display text-2xl">
            Kalk<span className="italic text-[#D8FF3D]">Mate</span>
          </Link>
          <div className="flex items-center gap-6">
            <Link href="/" className="km-mono-eyebrow text-[#F2EDE3]/55 hover:text-[#D8FF3D] transition-colors">
              ← Strona główna
            </Link>
            <Link href="/panel" className="km-mono-eyebrow text-[#D8FF3D]">Panel</Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="border-b border-[rgba(242,237,227,0.10)] relative overflow-hidden">
        <div className="absolute -top-32 -left-32 w-[520px] h-[520px] rounded-full bg-[#D8FF3D] opacity-[0.06] blur-[140px] pointer-events-none" />
        <div className="max-w-6xl mx-auto px-6 py-16 lg:py-24 relative">
          <p className="km-mono-eyebrow text-[#D8FF3D]">[ pomoc ] · v1.0</p>
          <h1 className="km-display text-[clamp(48px,7vw,96px)] mt-4 leading-[0.95]">
            Pomoc &<br />
            <span className="italic text-[#D8FF3D]">dokumentacja</span>.
          </h1>
          <p className="mt-6 text-[17px] leading-[1.6] text-[#F2EDE3]/65 max-w-2xl">
            Wszystko czego potrzebujesz żeby zacząć: instrukcja, wideo, FAQ
            i kontakt do nas. Materiały zaktualizowane dla firmware v{serverVersion}.
          </p>
        </div>
      </section>

      {/* Layout: nav + content */}
      <div className="max-w-6xl mx-auto px-6 py-12 lg:py-16 grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-12">
        {/* Sidebar nav */}
        <nav className="lg:sticky lg:top-24 self-start space-y-1">
          {sections.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="block km-mono-eyebrow text-[#F2EDE3]/55 hover:text-[#D8FF3D] py-1.5 transition-colors"
            >
              {s.label}
            </a>
          ))}
        </nav>

        {/* Content */}
        <main className="space-y-20 min-w-0">
          {/* 01 Start */}
          <Section id="start" eyebrow="01 · Start" title="Pierwsze uruchomienie." accent="uruchomienie">
            <Step n={1} title="Naładuj">
              Podłącz dołączony kabel USB-C do kalkulatora i ładowarki ≥5V/1A.
              Pełne ładowanie ~3h. LED na płytce świeci podczas ładowania.
            </Step>
            <Step n={2} title="Włącz">
              Przesuń przełącznik suwakowy na boku w pozycję ON.
              Po ~2s zobaczysz ekran powitalny i menu główne.
            </Step>
            <Step n={3} title="Skonfiguruj WiFi">
              Ustawienia → WiFi → wybierz sieć z listy → wpisz hasło (klawiatura
              ekranowa). To wymagane do działania AI, sync notatek i OTA.
            </Step>
            <Step n={4} title="Sparuj konto">
              Załóż konto na kalkmate.pl (potwierdź email), wpisz Device ID
              w panelu. Sparuje automatycznie. Bez tego — kalkulator działa
              w trybie offline (kalkulator, notatki/sprawdziany z poprzedniego sync).
            </Step>

            <VideoPlaceholder label="Wideo: pierwsze uruchomienie (1:30)" />
          </Section>

          {/* 02 Klawiatura */}
          <Section id="klawiatura" eyebrow="02 · Klawiatura" title="Nawigacja klawiszami." accent="klawiszami">
            <p className="text-[15px] leading-[1.65] text-[#F2EDE3]/65 mb-6">
              Klawiatura ma 27 klawiszy w układzie 5×6. W menu/ustawieniach
              poruszasz się <strong className="text-[#F2EDE3]">numpadem</strong>:
            </p>

            <KeyboardMap />

            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4 text-[14px]">
              <KeyRow keyLabel="8" desc="W górę" />
              <KeyRow keyLabel="2" desc="W dół" />
              <KeyRow keyLabel="4" desc="W lewo" />
              <KeyRow keyLabel="6" desc="W prawo" />
              <KeyRow keyLabel="5" desc="OK / Zatwierdź" accent />
              <KeyRow keyLabel="C/CE" desc="Wstecz / Anuluj" />
              <KeyRow keyLabel="MU" desc="PANIC — natychmiastowy powrót do kalkulatora" accent />
              <KeyRow keyLabel="▶" desc="W kalkulatorze: backspace" />
            </div>

            <Note>
              W trybie <strong>kalkulatora</strong> klawisze cyfr/operatorów
              działają normalnie (5 = piątka, 4 = czwórka itd.).
              Numpad jako nawigacja działa tylko w menu i ustawieniach.
            </Note>

            <GifPlaceholder label="GIF: nawigacja klawiaturą ekranową AI" />
          </Section>

          {/* 03 AI */}
          <Section id="ai" eyebrow="03 · Tryb AI" title="Rozwiązywanie zadań." accent="zadań">
            <p className="text-[15px] leading-[1.65] text-[#F2EDE3]/65 mb-6">
              KalkMate wysyła Twoje zadanie do AI (model Gemini przez nasz
              serwer) i zwraca rozwiązanie krok po kroku. Działa dla
              <strong className="text-[#F2EDE3]"> matematyki, fizyki, chemii, biologii</strong>.
            </p>

            <Step n={1} title="Wpisz kod AI">
              W trybie kalkulatora wpisz 4 cyfry (domyślnie <code className="km-mono-eyebrow text-[#D8FF3D]">1111</code>)
              bez żadnej operacji między cyframi. Otworzy się menu AI.
            </Step>
            <Step n={2} title="Wybierz tryb">
              <strong>Tekst</strong> — klawiatura ekranowa do wpisania treści zadania.
              <br />
              <strong>Historia</strong> — przeglądaj poprzednie rozwiązania (offline).
            </Step>
            <Step n={3} title="Tryb rozwiązania">
              W Ustawienia → Tryb wybierz:
              <ul className="mt-2 ml-4 list-disc text-[#F2EDE3]/65 space-y-1">
                <li><strong>Szczegółowy</strong> — krok po kroku z wyjaśnieniami</li>
                <li><strong>Obliczenia</strong> — same wzory + przejścia</li>
                <li><strong>Wynik</strong> — sama odpowiedź końcowa</li>
              </ul>
            </Step>
            <Step n={4} title="Czytanie odpowiedzi">
              Strzałkami 8 / 2 (góra/dół) scrollujesz długie odpowiedzi.
              C/CE wraca do menu. Każda odpowiedź jest auto-zapisana w historii.
            </Step>
          </Section>

          {/* 04 Notatki */}
          <Section id="notatki" eyebrow="04 · Pamięć" title="Notatki i sprawdziany." accent="sprawdziany">
            <p className="text-[15px] leading-[1.65] text-[#F2EDE3]/65 mb-6">
              KalkMate trzyma do <strong className="text-[#F2EDE3]">50 notatek (60 KB)</strong>
              i <strong className="text-[#F2EDE3]">50 sprawdzianów (160 KB)</strong> offline
              — czytasz je nawet bez WiFi. Edytujesz na kalkmate.pl/panel.
            </p>

            <Step n={1} title="Dodaj na stronie">
              Wejdź <Link href="/panel" className="text-[#D8FF3D] hover:underline">kalkmate.pl/panel</Link>
              → zakładka Notatki / Sprawdziany → dodaj treść (do 4000 znaków
              dla notatki, 30 000 dla sprawdzianu). LaTeX i markdown wspierane.
            </Step>
            <Step n={2} title="Sync do kalkulatora">
              Na kalkulatorze: Menu → Notatki → klik strzałka w dół (sync).
              Wymaga WiFi. Pobiera wszystko z konta.
            </Step>
            <Step n={3} title="Czytaj offline">
              Po sync są w pamięci flash kalkulatora — czytasz wszędzie.
              Format LaTeX automatycznie konwertowany do ASCII na ekranie OLED
              (∞ jako bitmap, ułamki jako `(a)/(b)`, itd.).
            </Step>
          </Section>

          {/* 05 Bateria */}
          <Section id="bateria" eyebrow="05 · Bateria" title="Ładowanie i bateria." accent="Ładowanie">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 text-[14px]">
              <Stat val="2000" unit="mAh" label="Pojemność (LiPo)" />
              <Stat val="~3" unit="h" label="Pełne ładowanie" />
              <Stat val="2–3" unit="dni" label="Typowe użycie" />
              <Stat val="5–7" unit="dni" label="Stand-by" />
            </div>

            <Note>
              Najwięcej prądu zżera <strong>OLED przy 12V</strong> (przetwornica MT3608).
              Skróć autosleep do 1–2 minut żeby wydłużyć czas pracy 2–3×.
              Ustawienia → Sleep.
            </Note>

            <p className="text-[15px] leading-[1.65] text-[#F2EDE3]/65 mt-6">
              <strong>Ładowanie</strong>: USB-C (PD nie wymagany, każdy zasilacz ≥5V/1A).
              LED na płytce świeci podczas ładowania, gaśnie przy 100%.
              Bateria jest chroniona przed przeładowaniem (MCP73831 + DW01A).
            </p>
          </Section>

          {/* 06 OTA */}
          <Section id="ota" eyebrow="06 · Aktualizacje" title="OTA — aktualizacje firmware." accent="aktualizacje">
            <Step n={1} title="Sprawdź dostępność">
              Ustawienia → Aktualizacje → OK. Kalkulator pyta serwer, czy jest
              nowsza wersja niż twoja aktualna (widoczna jako <code className="text-[#D8FF3D]">v{serverVersion}</code> itp.).
            </Step>
            <Step n={2} title="Zainstaluj">
              Jeśli jest nowa — pokazuje notes do zmian + przycisk Zainstaluj.
              Pobiera (~1 MB), flashuje partycję OTA, restartuje. ~1 minuta.
              Nie odłączaj zasilania podczas update'u.
            </Step>
            <Note>
              Aktualizacje są <strong>darmowe</strong> i dobrowolne. Stary firmware
              będzie nadal działał, ale nowe feature'y (np. lepszy LaTeX) wymagają update'u.
            </Note>

            <div className="mt-8">
              <p className="km-mono-eyebrow text-[#F2EDE3]/55 mb-3">/ AKTUALNA WERSJA SERWERA:</p>
              <p className="km-display text-3xl text-[#D8FF3D]">v{serverVersion}</p>
              <p className="km-mono-eyebrow text-[#F2EDE3]/40 mt-1">Sprawdź swoją wersję w Ustawienia → Aktualizacje</p>
            </div>
          </Section>

          {/* 07 Problemy */}
          <Section id="problemy" eyebrow="07 · Problemy" title="Rozwiązywanie problemów." accent="problemów">
            <Problem
              issue="Ekran się nie włącza / czarny"
              fix="1) Sprawdź switch (powinien być w pozycji ON). 2) Naładuj 30+ minut — bateria może być zerowa. 3) Jeśli LED ładowania nie świeci po podłączeniu USB-C — uszkodzony kabel/port."
            />
            <Problem
              issue="WiFi nie znajduje sieci / pusta lista"
              fix="Ustawienia → WiFi → Skanuj. Jeśli pusto — w v0.6.4 dodaliśmy auto-reset radia. Spróbuj jeszcze raz po 5 sekundach. Niektóre sieci 5GHz nie są wspierane (ESP32 = 2.4GHz only)."
            />
            <Problem
              issue="AI Chat: 'AI error 400' lub timeout"
              fix="1) Sprawdź WiFi (Ustawienia → Status konta — pokaże 'Podłączone'). 2) Konto musi mieć aktywny trial lub subskrypcję. 3) Spróbuj krótszego zadania — limit ~2000 znaków."
            />
            <Problem
              issue="Niektóre klawisze nie reagują"
              fix="Settings → Diagnostyka → Test klawiatury. Jeśli klawisz świeci się gdy wciskasz — działa OK (problem w innym miejscu). Jeśli nie świeci — fizyczny problem (zimna lutka, FFC). Pisz przez formularz."
            />
            <Problem
              issue="Notatki/sprawdziany nie syncują"
              fix="1) WiFi musi działać. 2) Konto musi być sparowane (Settings → Status konta = 'Podłączone'). 3) Na kalkmate.pl/panel sprawdź czy są na koncie. 4) Jeśli za dużo (>50 sprawdzianów lub łącznie >160 KB) — kalkulator nie pobierze wszystkich."
            />
            <Problem
              issue="Boost MT3608 buczy / ekran ma paski"
              fix="To problem sprzętowy z kondensatorami ceramicznymi (piezoelektrycznymi). Skontaktuj się przez formularz — wymienimy płytkę w gwarancji."
            />
          </Section>

          {/* 08 FAQ */}
          <Section id="faq" eyebrow="08 · FAQ" title="Często zadawane pytania." accent="pytania">
            <div className="border border-[rgba(242,237,227,0.18)] divide-y divide-[rgba(242,237,227,0.10)]">
              {faqs.map((f, i) => (
                <div key={i} className="">
                  <button
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-[#F2EDE3]/[0.02] transition-colors"
                  >
                    <span className="text-[15px] font-medium text-[#F2EDE3]">{f.q}</span>
                    <span className={`km-mono-eyebrow text-[#D8FF3D] transition-transform ${openFaq === i ? "rotate-45" : ""}`}>+</span>
                  </button>
                  {openFaq === i && (
                    <div className="px-5 pb-5 text-[14.5px] leading-[1.65] text-[#F2EDE3]/65">{f.a}</div>
                  )}
                </div>
              ))}
            </div>
          </Section>

          {/* 09 Changelog */}
          <Section id="changelog" eyebrow="09 · Changelog" title="Historia firmware." accent="firmware">
            <p className="text-[14.5px] text-[#F2EDE3]/55 mb-6">
              Wszystkie wydane wersje. Update przez Ustawienia → Aktualizacje.
            </p>
            <div className="border border-[rgba(242,237,227,0.18)]">
              {changelog.map((c, i) => (
                <div
                  key={c.v}
                  className={`px-5 py-4 grid grid-cols-[80px_100px_1fr] gap-4 items-baseline ${
                    i !== changelog.length - 1 ? "border-b border-[rgba(242,237,227,0.10)]" : ""
                  } ${i === 0 ? "bg-[#D8FF3D]/[0.04]" : ""}`}
                >
                  <span className={`km-mono-eyebrow ${i === 0 ? "text-[#D8FF3D]" : "text-[#F2EDE3]/55"}`}>
                    v{c.v} {i === 0 && "·"}
                  </span>
                  <span className="km-mono-eyebrow text-[#F2EDE3]/40">{c.date}</span>
                  <span className="text-[14px] text-[#F2EDE3]/80">{c.notes}</span>
                </div>
              ))}
            </div>
          </Section>

          {/* 10 Kontakt */}
          <Section id="kontakt" eyebrow="10 · Kontakt" title="Napisz do nas." accent="nas">
            <p className="text-[15px] leading-[1.65] text-[#F2EDE3]/65 mb-6">
              Odpowiadam w ciągu 24h (zwykle szybciej). Możesz też napisać bezpośrednio na{" "}
              <a href="mailto:kontakt@kalkmate.pl" className="text-[#D8FF3D] hover:underline">kontakt@kalkmate.pl</a>.
            </p>

            {sent ? (
              <div className="border border-[#D8FF3D]/40 bg-[#D8FF3D]/[0.05] p-4">
                <p className="km-mono-eyebrow text-[#D8FF3D]">/ WYSŁANO</p>
                <p className="text-sm text-[#F2EDE3]/80 mt-2">
                  Dzięki za wiadomość. Odezwę się jak najszybciej na podany email.
                </p>
                <button
                  onClick={() => setSent(false)}
                  className="mt-4 km-mono-eyebrow text-[#D8FF3D] hover:text-[#F2EDE3] transition-colors"
                >
                  Wyślij kolejną →
                </button>
              </div>
            ) : (
              <form onSubmit={submitContact} className="space-y-4 max-w-2xl">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="km-mono-eyebrow text-[#F2EDE3]/55 block mb-2">Imię</label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder="Jan Kowalski"
                      required
                      maxLength={100}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="km-mono-eyebrow text-[#F2EDE3]/55 block mb-2">Email</label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      placeholder="twoj@email.pl"
                      required
                      maxLength={150}
                      className={inputClass}
                    />
                  </div>
                </div>
                <div>
                  <label className="km-mono-eyebrow text-[#F2EDE3]/55 block mb-2">Temat <span className="text-[#F2EDE3]/30">· opcjonalny</span></label>
                  <input
                    type="text"
                    value={form.subject}
                    onChange={(e) => setForm({ ...form, subject: e.target.value })}
                    placeholder="np. Problem z WiFi"
                    maxLength={200}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="km-mono-eyebrow text-[#F2EDE3]/55 block mb-2">Wiadomość</label>
                  <textarea
                    value={form.message}
                    onChange={(e) => setForm({ ...form, message: e.target.value })}
                    placeholder="Opisz problem albo zadaj pytanie..."
                    required
                    minLength={5}
                    maxLength={5000}
                    rows={6}
                    className={inputClass + " resize-y"}
                  />
                  <p className="km-mono-eyebrow text-[#F2EDE3]/30 mt-2">{form.message.length}/5000</p>
                </div>

                {error && (
                  <div className="border border-[#FF4D2E]/40 bg-[#FF4D2E]/[0.06] p-3">
                    <p className="km-mono-eyebrow text-[#FF4D2E]">/ ERROR</p>
                    <p className="text-sm text-[#FF4D2E] mt-1">{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting || !form.name || !form.email || !form.message}
                  className={`group px-6 py-4 km-mono-eyebrow flex items-center justify-between transition-colors ${
                    submitting
                      ? "bg-[#D8FF3D]/30 text-[#0B0B0B]/50 cursor-not-allowed"
                      : "bg-[#D8FF3D] text-[#0B0B0B] hover:bg-[#F2EDE3]"
                  }`}
                >
                  <span>{submitting ? "Wysyłam..." : "Wyślij wiadomość"}</span>
                  <span className="ml-4">→</span>
                </button>
              </form>
            )}
          </Section>
        </main>
      </div>

      {/* Footer */}
      <footer className="border-t border-[rgba(242,237,227,0.10)] mt-20 py-12">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row justify-between items-start gap-6">
          <div>
            <Link href="/" className="km-display text-2xl">
              Kalk<span className="italic text-[#D8FF3D]">Mate</span>
            </Link>
            <p className="km-mono-eyebrow text-[#F2EDE3]/40 mt-2">Kalkulator z AI</p>
          </div>
          <div className="km-mono-eyebrow text-[#F2EDE3]/55 space-y-1">
            <Link href="/regulamin" className="block hover:text-[#D8FF3D] transition-colors">Regulamin</Link>
            <Link href="/polityka-prywatnosci" className="block hover:text-[#D8FF3D] transition-colors">Polityka prywatności</Link>
            <a href="mailto:kontakt@kalkmate.pl" className="block hover:text-[#D8FF3D] transition-colors">kontakt@kalkmate.pl</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ============================================================
// Components
// ============================================================

function Section({ id, eyebrow, title, accent, children }: {
  id: string; eyebrow: string; title: string; accent?: string; children: React.ReactNode;
}) {
  let titleHtml: React.ReactNode = title;
  if (accent && title.includes(accent)) {
    const parts = title.split(accent);
    titleHtml = <>{parts[0]}<span className="italic text-[#D8FF3D]">{accent}</span>{parts[1]}</>;
  }
  return (
    <section id={id} className="scroll-mt-24">
      <div className="border-b border-[rgba(242,237,227,0.10)] pb-3 mb-8 flex items-center gap-3">
        <span className="w-1.5 h-1.5 bg-[#D8FF3D] rounded-full" />
        <span className="km-mono-eyebrow text-[#D8FF3D]">{eyebrow}</span>
      </div>
      <h2 className="km-display text-[clamp(36px,4vw,56px)] leading-[1] mb-8">{titleHtml}</h2>
      <div className="space-y-6">{children}</div>
    </section>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[48px_1fr] gap-4">
      <div className="km-display text-2xl text-[#D8FF3D] leading-none">0{n}.</div>
      <div>
        <h3 className="text-[18px] font-semibold text-[#F2EDE3] mb-2">{title}</h3>
        <div className="text-[14.5px] leading-[1.65] text-[#F2EDE3]/65">{children}</div>
      </div>
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-l-2 border-[#D8FF3D] bg-[#D8FF3D]/[0.04] px-4 py-3 my-4">
      <p className="km-mono-eyebrow text-[#D8FF3D] mb-1">/ NOTKA</p>
      <p className="text-[14px] text-[#F2EDE3]/80 leading-[1.6]">{children}</p>
    </div>
  );
}

function VideoPlaceholder({ label }: { label: string }) {
  return (
    <div className="mt-6 aspect-video border border-[rgba(242,237,227,0.18)] bg-[#0B0B0B] flex items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-[#D8FF3D]/[0.03] to-transparent" />
      <div className="text-center relative z-10">
        <div className="w-16 h-16 mx-auto rounded-full border-2 border-[#D8FF3D] flex items-center justify-center mb-3">
          <span className="text-[#D8FF3D] text-2xl ml-1">▶</span>
        </div>
        <p className="km-mono-eyebrow text-[#F2EDE3]/55">{label}</p>
        <p className="km-mono-eyebrow text-[#F2EDE3]/30 mt-1">/ WKRÓTCE</p>
      </div>
    </div>
  );
}

function GifPlaceholder({ label }: { label: string }) {
  return (
    <div className="mt-6 h-64 border border-[rgba(242,237,227,0.18)] bg-[#0B0B0B] flex items-center justify-center relative">
      <div className="absolute inset-0 bg-gradient-to-br from-[#D8FF3D]/[0.03] to-transparent" />
      <div className="text-center relative z-10">
        <p className="km-display text-4xl text-[#D8FF3D] mb-2">.gif</p>
        <p className="km-mono-eyebrow text-[#F2EDE3]/55">{label}</p>
        <p className="km-mono-eyebrow text-[#F2EDE3]/30 mt-1">/ WKRÓTCE</p>
      </div>
    </div>
  );
}

function KeyboardMap() {
  // 6 rzedów × 5 kolumn = 30 slotów, 27 klawiszy fizycznych
  const layout: (string | null)[][] = [
    [null,  "√",   "%",   "MU",  null ],
    ["MC",  "MR",  "M−",  "M+",  "÷"  ],
    ["±",   "7",   "8",   "9",   "×"  ],
    ["▶",   "4",   "5",   "6",   "−"  ],
    ["C/CE","1",   "2",   "3",   "+"  ],
    ["0",   "00",  ".",   "=",   null ],
  ];
  const navKeys = new Set(["8", "2", "4", "6", "5"]);
  return (
    <div className="border border-[rgba(242,237,227,0.18)] p-4 bg-[#0B0B0B] inline-block">
      <div className="grid grid-cols-5 gap-2">
        {layout.flat().map((k, i) => {
          if (!k) return <div key={i} className="w-14 h-14" />;
          const isNav = navKeys.has(k);
          const isMu = k === "MU";
          return (
            <div
              key={i}
              className={`w-14 h-14 flex items-center justify-center font-bold text-[15px] border ${
                isNav
                  ? "bg-[#D8FF3D]/15 border-[#D8FF3D] text-[#D8FF3D]"
                  : isMu
                  ? "bg-[#FF4D2E]/15 border-[#FF4D2E] text-[#FF4D2E]"
                  : "border-[rgba(242,237,227,0.18)] text-[#F2EDE3]"
              }`}
            >
              {k}
            </div>
          );
        })}
      </div>
      <div className="mt-4 flex gap-4 text-[12px]">
        <span className="km-mono-eyebrow text-[#D8FF3D]">■ NAWIGACJA</span>
        <span className="km-mono-eyebrow text-[#FF4D2E]">■ PANIC</span>
        <span className="km-mono-eyebrow text-[#F2EDE3]/55">■ STANDARD</span>
      </div>
    </div>
  );
}

function KeyRow({ keyLabel, desc, accent }: { keyLabel: string; desc: string; accent?: boolean }) {
  return (
    <div className="flex items-center gap-4">
      <div className={`min-w-[60px] px-3 py-2 text-center font-bold border ${
        accent ? "bg-[#D8FF3D]/15 border-[#D8FF3D] text-[#D8FF3D]" : "border-[rgba(242,237,227,0.18)] text-[#F2EDE3]"
      }`}>
        {keyLabel}
      </div>
      <span className="text-[#F2EDE3]/70">{desc}</span>
    </div>
  );
}

function Problem({ issue, fix }: { issue: string; fix: string }) {
  return (
    <div className="border border-[rgba(242,237,227,0.18)] p-5">
      <div className="flex items-start gap-3 mb-3">
        <span className="km-mono-eyebrow text-[#FF4D2E] mt-1">/ PROBLEM</span>
      </div>
      <h3 className="text-[16px] font-semibold text-[#F2EDE3] mb-3">{issue}</h3>
      <div className="flex items-start gap-3">
        <span className="km-mono-eyebrow text-[#D8FF3D] min-w-[60px] mt-1">/ FIX</span>
        <p className="text-[14.5px] leading-[1.65] text-[#F2EDE3]/70 flex-1">{fix}</p>
      </div>
    </div>
  );
}

function Stat({ val, unit, label }: { val: string; unit?: string; label: string }) {
  return (
    <div className="border border-[rgba(242,237,227,0.18)] p-4">
      <div className="km-display text-3xl text-[#F2EDE3]">
        {val}
        {unit && <span className="text-[#F2EDE3]/40 text-lg ml-1">{unit}</span>}
      </div>
      <p className="km-mono-eyebrow text-[#F2EDE3]/55 mt-2">{label}</p>
    </div>
  );
}
