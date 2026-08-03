"use client";

import { useState, useEffect } from "react";
import type React from "react";
import Link from "next/link";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { localeHome, type Locale } from "@/lib/i18n";

// ============================================================
// Tłumaczenia — współlokalizowane jak w Navigation.tsx / PANEL_DICT.
// Tekst wspiera lekki markup: **pogrubienie** i `kod`, obsłużone przez
// richText() poniżej. "\n\n" w Step.body = nowy akapit (odstęp jak <br/><br/>).
// ============================================================

type Faq = { q: string; a: string };
type ProblemT = { issue: string; fix: string };
type StepT = { title: string; body: string; list?: string[] };
type SectionNav = { id: string; label: string };
type KeyRowT = { key: string; desc: string; accent?: boolean };
type StatT = { val: string; unit?: string; label: string };

type Dict = {
  metaTitle: string;
  metaDesc: string;
  navHome: string;
  navPanel: string;
  heroEyebrow: string;
  heroTitleLine1: string;
  heroTitleAccent: string;
  heroDesc: (v: string) => string;
  sections: SectionNav[];
  s1: { eyebrow: string; title: string; accent: string; steps: StepT[]; videoLabel: string };
  s2: {
    eyebrow: string; title: string; accent: string; intro: string;
    keyRows: KeyRowT[]; note: string; videoLabel: string;
    legend: { nav: string; panic: string; standard: string };
  };
  s3: { eyebrow: string; title: string; accent: string; intro: string; steps: StepT[] };
  s4: { eyebrow: string; title: string; accent: string; intro: string; steps: StepT[] };
  s5: { eyebrow: string; title: string; accent: string; stats: StatT[]; note: string; body: string };
  s6: {
    eyebrow: string; title: string; accent: string;
    step1: (v: string) => string; step1Title: string;
    step2Title: string; step2: string;
    note: string; versionLabel: string; versionHint: string;
  };
  s7: { eyebrow: string; title: string; accent: string; problems: ProblemT[] };
  s8: { eyebrow: string; title: string; accent: string; faqs: Faq[] };
  s9: { eyebrow: string; title: string; accent: string; intro: string };
  s10: {
    eyebrow: string; title: string; accent: string; intro: string;
    sentTitle: string; sentBody: string; sentAgain: string;
    labelName: string; labelEmail: string; labelSubject: string; labelSubjectOptional: string; labelMessage: string;
    placeholderName: string; placeholderEmail: string; placeholderSubject: string; placeholderMessage: string;
    errorLabel: string; sending: string; send: string;
  };
  footerTagline: string;
  footerTerms: string;
  footerPrivacy: string;
  footerCe: string;
};

const DICT: Record<Locale, Dict> = {
  pl: {
    metaTitle: "Pomoc i instrukcja obsługi — KalkMate",
    metaDesc:
      "Instrukcja obsługi kalkulatora KalkMate: pierwsze uruchomienie, konfiguracja WiFi, tryb AI, rozwiązywanie problemów i historia firmware.",
    navHome: "← Strona główna",
    navPanel: "Panel",
    heroEyebrow: "[ pomoc ] · v1.0",
    heroTitleLine1: "Pomoc &",
    heroTitleAccent: "dokumentacja",
    heroDesc: (v) =>
      `Wszystko czego potrzebujesz żeby zacząć: instrukcja, wideo, FAQ i kontakt do nas. Materiały zaktualizowane dla firmware v${v}.`,
    sections: [
      { id: "start", label: "01 · Pierwsze uruchomienie" },
      { id: "klawiatura", label: "02 · Nawigacja klawiaturą" },
      { id: "ai", label: "03 · Tryb AI" },
      { id: "notatki", label: "04 · Notatki i sprawdziany" },
      { id: "bateria", label: "05 · Bateria i ładowanie" },
      { id: "ota", label: "06 · Aktualizacje (OTA)" },
      { id: "problemy", label: "07 · Rozwiązywanie problemów" },
      { id: "faq", label: "08 · FAQ" },
      { id: "changelog", label: "09 · Changelog firmware" },
      { id: "kontakt", label: "10 · Kontakt" },
    ],
    s1: {
      eyebrow: "01 · Start", title: "Pierwsze uruchomienie.", accent: "uruchomienie",
      videoLabel: "Wideo: pierwsze uruchomienie",
      steps: [
        { title: "Naładuj", body: "Podłącz dołączony kabel USB-C do kalkulatora i ładowarki ≥5V/1A. Pełne ładowanie ~3h. LED na płytce świeci podczas ładowania." },
        { title: "Włącz", body: "Przesuń przełącznik suwakowy na boku w pozycję ON. Po ~2s zobaczysz ekran powitalny KalkMate, a następnie **ekran kalkulatora** (cyfrowy wyświetlacz)." },
        { title: "Wejdź do menu AI", body: "Na klawiaturze kalkulatora wpisz **kod odblokowujący** (domyślnie `1111`) — same cyfry, bez operatorów między nimi. Ekran na chwilę pokaże „AI\" i otworzy menu główne. Dopiero teraz dostępne są Ustawienia i inne funkcje." },
        { title: "Skonfiguruj WiFi", body: "Ustawienia → WiFi → wybierz sieć z listy → wpisz hasło (klawiatura ekranowa). To wymagane do działania AI, sync notatek i OTA." },
        { title: "Sparuj konto", body: "Załóż konto na kalkmate.pl (potwierdź email). Na kalkulatorze: Ustawienia → Device ID + QR — zarejestruje się na serwerze i wyświetli QR do skanowania. W panelu kalkmate.pl potwierdź sparowanie. Bez tego — kalkulator działa w trybie offline." },
      ],
    },
    s2: {
      eyebrow: "02 · Klawiatura", title: "Nawigacja klawiszami.", accent: "klawiszami",
      intro: "Klawiatura ma 27 klawiszy w układzie 5×6. W menu/ustawieniach poruszasz się **numpadem**:",
      note: "W trybie **kalkulatora** klawisze cyfr/operatorów działają normalnie (5 = piątka, 4 = czwórka itd.). Numpad jako nawigacja działa tylko w menu i ustawieniach.",
      videoLabel: "Nawigacja klawiaturą ekranową AI",
      legend: { nav: "NAWIGACJA", panic: "PANIC", standard: "STANDARD" },
      keyRows: [
        { key: "8", desc: "W górę" },
        { key: "2", desc: "W dół" },
        { key: "4", desc: "W lewo" },
        { key: "6", desc: "W prawo" },
        { key: "5", desc: "OK / Zatwierdź", accent: true },
        { key: "C/CE", desc: "Wstecz / Anuluj" },
        { key: "MU", desc: "PANIC — natychmiastowy powrót do kalkulatora", accent: true },
        { key: "▶", desc: "W kalkulatorze: backspace" },
      ],
    },
    s3: {
      eyebrow: "03 · Tryb AI", title: "Rozwiązywanie zadań.", accent: "zadań",
      intro: "KalkMate wysyła Twoje zadanie do AI (model Gemini przez nasz serwer) i zwraca rozwiązanie krok po kroku. Działa dla **matematyki, fizyki, chemii, biologii**.",
      steps: [
        { title: "Wpisz kod AI", body: "W trybie kalkulatora wpisz 4 cyfry (domyślnie `1111`) bez żadnej operacji między cyframi. Otworzy się menu AI." },
        { title: "Wybierz tryb", body: "**Zdjęcie** — skieruj kamerę na zadanie. Podgląd live na ekranie (wskaźnik ostrości po prawej), wciśnij `5 (OK)` żeby zrobić zdjęcie i wysłać do AI.\n\n**Tekst** — klawiatura ekranowa QWERTY: 8/4/6/2 = nawigacja, 5 = wybierz znak, zatwierdź przyciskiem ZADANIE (maks. 2000 znaków).\n\n**Historia** — przeglądaj poprzednie rozwiązania (offline). Przycisk → (prawo) otwiera edycję pytania i ponowne wysłanie do AI." },
        { title: "Tryb rozwiązania", body: "W Ustawienia → Tryb wybierz:", list: ["**Szczegółowy** — krok po kroku z wyjaśnieniami", "**Obliczenia** — same wzory + przejścia", "**Wynik** — sama odpowiedź końcowa"] },
        { title: "Czytanie odpowiedzi", body: "Strzałkami 8 / 2 (góra/dół) scrollujesz długie odpowiedzi. C/CE wraca do menu. Każda odpowiedź jest auto-zapisana w historii." },
      ],
    },
    s4: {
      eyebrow: "04 · Pamięć", title: "Notatki i sprawdziany.", accent: "sprawdziany",
      intro: "KalkMate trzyma do **50 notatek (60 KB)** i **50 sprawdzianów (160 KB)** offline — czytasz je nawet bez WiFi. Edytujesz na kalkmate.pl/panel.",
      steps: [
        { title: "Dodaj na stronie", body: "Wejdź na kalkmate.pl/panel → zakładka Notatki / Sprawdziany → dodaj treść (do 4000 znaków dla notatki, 30 000 dla sprawdzianu). LaTeX i markdown wspierane." },
        { title: "Sync do kalkulatora", body: "Na kalkulatorze: Menu → Notatki → klik strzałka w dół (sync). Wymaga WiFi. Pobiera wszystko z konta." },
        { title: "Czytaj offline", body: "Po sync są w pamięci flash kalkulatora — czytasz wszędzie. Format LaTeX automatycznie konwertowany do ASCII na ekranie OLED (∞ jako bitmap, ułamki jako `(a)/(b)`, itd.)." },
      ],
    },
    s5: {
      eyebrow: "05 · Bateria", title: "Ładowanie i bateria.", accent: "Ładowanie",
      note: "Najwięcej prądu zżera **OLED przy 12V** (przetwornica MT3608). Skróć autosleep do 1–2 minut żeby wydłużyć czas pracy 2–3×. Ustawienia → Sleep.",
      body: "**Ładowanie**: USB-C (PD nie wymagany, każdy zasilacz ≥5V/1A). LED na płytce świeci podczas ładowania, gaśnie przy 100%. Bateria jest chroniona przed przeładowaniem (MCP73831 + DW01A).",
      stats: [
        { val: "2000", unit: "mAh", label: "Pojemność (LiPo)" },
        { val: "~3", unit: "h", label: "Pełne ładowanie" },
        { val: "2–3", unit: "dni", label: "Typowe użycie" },
        { val: "5–7", unit: "dni", label: "Stand-by" },
      ],
    },
    s6: {
      eyebrow: "06 · Aktualizacje", title: "OTA — aktualizacje firmware.", accent: "aktualizacje",
      step1Title: "Sprawdź dostępność",
      step1: (v) => `Ustawienia → Aktualizacje → OK. Kalkulator pyta serwer, czy jest nowsza wersja niż twoja aktualna (widoczna jako \`v${v}\` itp.).`,
      step2Title: "Zainstaluj",
      step2: "Jeśli jest nowa — pokazuje notes do zmian + przycisk Zainstaluj. Pobiera (~1 MB), flashuje partycję OTA, restartuje. ~1 minuta. Nie odłączaj zasilania podczas update'u.",
      note: "Aktualizacje są **darmowe** i dobrowolne. Stary firmware będzie nadal działał, ale nowe feature'y (np. lepszy LaTeX) wymagają update'u.",
      versionLabel: "/ AKTUALNA WERSJA SERWERA:",
      versionHint: "Sprawdź swoją wersję w Ustawienia → Aktualizacje",
    },
    s7: {
      eyebrow: "07 · Problemy", title: "Rozwiązywanie problemów.", accent: "problemów",
      problems: [
        { issue: "Ekran się nie włącza / czarny", fix: "1) Sprawdź switch (powinien być w pozycji ON). 2) Naładuj 30+ minut — bateria może być zerowa. 3) Jeśli LED ładowania nie świeci po podłączeniu USB-C — uszkodzony kabel/port." },
        { issue: "WiFi nie znajduje sieci / pusta lista", fix: "Ustawienia → WiFi → Skanuj. Jeśli pusto — w v0.6.4 dodaliśmy auto-reset radia. Spróbuj jeszcze raz po 5 sekundach. Niektóre sieci 5GHz nie są wspierane (ESP32 = 2.4GHz only)." },
        { issue: "AI Chat: 'AI error 400' lub timeout", fix: "1) Sprawdź WiFi (Ustawienia → Status konta — pokaże 'Podłączone'). 2) Konto musi mieć aktywny trial lub subskrypcję. 3) Spróbuj krótszego zadania — limit ~2000 znaków." },
        { issue: "Niektóre klawisze nie reagują", fix: "Settings → Diagnostyka → Test klawiatury. Jeśli klawisz świeci się gdy wciskasz — działa OK (problem w innym miejscu). Jeśli nie świeci — fizyczny problem (zimna lutka, FFC). Pisz przez formularz." },
        { issue: "Notatki/sprawdziany nie syncują", fix: "1) WiFi musi działać. 2) Konto musi być sparowane (Settings → Status konta = 'Podłączone'). 3) Na kalkmate.pl/panel sprawdź czy są na koncie. 4) Jeśli za dużo (>50 sprawdzianów lub łącznie >160 KB) — kalkulator nie pobierze wszystkich." },
        { issue: "Boost MT3608 buczy / ekran ma paski", fix: "To problem sprzętowy z kondensatorami ceramicznymi (piezoelektrycznymi). Skontaktuj się przez formularz — wymienimy płytkę w gwarancji." },
      ],
    },
    s8: {
      eyebrow: "08 · FAQ", title: "Często zadawane pytania.", accent: "pytania",
      faqs: [
        { q: "Jak włączyć / wyłączyć kalkulator?", a: "Przesuń przełącznik suwakowy na boku. Wyłączenie nie kasuje notatek ani historii — wszystko jest zapisane w pamięci wewnętrznej." },
        { q: "Jak długo trzyma bateria?", a: "Mieszane użycie (kilka godzin AI + reszta sleep): ~2–3 dni. Stand-by: 5–7 dni. Pełne ładowanie: ~3 godziny przez USB-C." },
        { q: "Dlaczego AI Chat wymaga WiFi?", a: "Same odpowiedzi liczy serwer (model Gemini). Bez WiFi działa tylko kalkulator, notatki, sprawdziany. Konfiguracja: Ustawienia → WiFi." },
        { q: "Co to jest klawisz Panic?", a: "Klawisz (domyślnie MU) który NATYCHMIAST cofa do trybu kalkulatora z dowolnego ekranu. Przydaje się gdy ktoś patrzy. Możesz go zmienić w Ustawienia → Panic key." },
        { q: "Jak dodaję notatki / sprawdziany?", a: "Wyłącznie przez panel klienta na kalkmate.pl/panel. Kalkulator synchronizuje je przez WiFi (Notatki → Sync). Na urządzeniu tylko czytasz, nie edytujesz." },
        { q: 'Co robi "Kod AI"?', a: "Czterocyfrowy kod (domyślnie 1111) który wpisujesz w trybie kalkulatora żeby odblokować menu AI. Bez tego kalkulator wygląda jak zwykła Esperanza T8809-2." },
        { q: "Jak sparuję kalkulator z kontem?", a: "1) Załóż konto na kalkmate.pl 2) Przypisz licencję w zakładce Subskrypcja (jeśli kupowałeś online, jest auto-przypisana). 3) Na kalkulatorze: Ustawienia → Device ID + QR — zarejestruje się na serwerze. 4) W panelu Kalkulator wpisz Device ID + Kod AI." },
        { q: "Ekran miga / pokazuje białe paski — co robić?", a: "Najczęściej buczy/niestabilna jest przetwornica 12V (MT3608). Skontaktuj się przez formularz — odeślemy ci nową płytkę. Reklamacja w gwarancji 24mc." },
        { q: "Klawisz nie działa — można to naprawić softem?", a: "Jeśli to problem z mapowaniem (po lutowaniu) — tak, mamy narzędzie keymap_scan które przemapuje klawisze. Pisz przez formularz, wyślemy plik." },
        { q: "Jak zaktualizować firmware?", a: "Ustawienia → Aktualizacje → OK. Kalkulator sprawdza serwer, pyta o zgodę, pobiera + flashuje + restartuje. Cały proces ~1 minuta z WiFi." },
        { q: "Zapomniałem hasła do konta", a: "Wejdź kalkmate.pl/auth/forgot-password — wyślemy link resetujący na podany email (ważny 60 minut)." },
        { q: "Mogę zwrócić kalkulator?", a: "Tak, 14 dni od dostawy bez podania przyczyny (RODO + ustawa o prawach konsumenta). Wystarczy email na kontakt@kalkmate.pl ze swoim numerem zamówienia." },
      ],
    },
    s9: {
      eyebrow: "09 · Changelog", title: "Historia firmware.", accent: "firmware",
      intro: "Wszystkie wydane wersje. Update przez Ustawienia → Aktualizacje.",
    },
    s10: {
      eyebrow: "10 · Kontakt", title: "Napisz do nas.", accent: "nas",
      intro: "Odpowiadam w ciągu 24h (zwykle szybciej). Możesz też napisać bezpośrednio na kontakt@kalkmate.pl.",
      sentTitle: "/ WYSŁANO",
      sentBody: "Dzięki za wiadomość. Odezwę się jak najszybciej na podany email.",
      sentAgain: "Wyślij kolejną →",
      labelName: "Imię", labelEmail: "Email", labelSubject: "Temat", labelSubjectOptional: "opcjonalny", labelMessage: "Wiadomość",
      placeholderName: "Jan Kowalski", placeholderEmail: "twoj@email.pl", placeholderSubject: "np. Problem z WiFi", placeholderMessage: "Opisz problem albo zadaj pytanie...",
      errorLabel: "/ ERROR", sending: "Wysyłam...", send: "Wyślij wiadomość",
    },
    footerTagline: "Kalkulator z AI",
    footerTerms: "Regulamin",
    footerPrivacy: "Polityka prywatności",
    footerCe: "Deklaracja zgodności CE",
  },

  en: {
    metaTitle: "Help & User Guide — KalkMate",
    metaDesc:
      "KalkMate calculator user guide: first setup, WiFi configuration, AI mode, troubleshooting and firmware history.",
    navHome: "← Home",
    navPanel: "Panel",
    heroEyebrow: "[ help ] · v1.0",
    heroTitleLine1: "Help &",
    heroTitleAccent: "documentation",
    heroDesc: (v) =>
      `Everything you need to get started: manual, videos, FAQ and how to reach us. Content updated for firmware v${v}.`,
    sections: [
      { id: "start", label: "01 · First setup" },
      { id: "klawiatura", label: "02 · Keyboard navigation" },
      { id: "ai", label: "03 · AI mode" },
      { id: "notatki", label: "04 · Notes & tests" },
      { id: "bateria", label: "05 · Battery & charging" },
      { id: "ota", label: "06 · Updates (OTA)" },
      { id: "problemy", label: "07 · Troubleshooting" },
      { id: "faq", label: "08 · FAQ" },
      { id: "changelog", label: "09 · Firmware changelog" },
      { id: "kontakt", label: "10 · Contact" },
    ],
    s1: {
      eyebrow: "01 · Start", title: "First setup.", accent: "setup",
      videoLabel: "Video: first setup",
      steps: [
        { title: "Charge it", body: "Connect the included USB-C cable to the calculator and a ≥5V/1A charger. A full charge takes ~3h. The LED on the board lights up while charging." },
        { title: "Turn it on", body: "Slide the switch on the side to ON. After ~2s you'll see the KalkMate splash screen, then the **calculator screen** (digital display)." },
        { title: "Open the AI menu", body: "On the calculator keypad, type the **unlock code** (default `1111`) — digits only, no operators in between. The screen briefly shows „AI\" and opens the main menu. Only now are Settings and other features available." },
        { title: "Set up WiFi", body: "Settings → WiFi → pick a network from the list → enter the password (on-screen keyboard). Required for AI, note sync and OTA updates." },
        { title: "Pair your account", body: "Create an account at kalkmate.pl (confirm your email). On the calculator: Settings → Device ID + QR — it registers with the server and shows a QR code to scan. Confirm the pairing in the kalkmate.pl panel. Without this, the calculator runs in offline mode." },
      ],
    },
    s2: {
      eyebrow: "02 · Keyboard", title: "Keyboard navigation.", accent: "navigation",
      intro: "The keyboard has 27 keys in a 5×6 layout. In menus/settings you navigate with the **numpad**:",
      note: "In **calculator mode** the digit/operator keys work normally (5 = five, 4 = four, etc.). The numpad only acts as navigation inside menus and settings.",
      videoLabel: "Navigating the AI on-screen keyboard",
      legend: { nav: "NAVIGATION", panic: "PANIC", standard: "STANDARD" },
      keyRows: [
        { key: "8", desc: "Up" },
        { key: "2", desc: "Down" },
        { key: "4", desc: "Left" },
        { key: "6", desc: "Right" },
        { key: "5", desc: "OK / Confirm", accent: true },
        { key: "C/CE", desc: "Back / Cancel" },
        { key: "MU", desc: "PANIC — instantly returns to calculator mode", accent: true },
        { key: "▶", desc: "In calculator mode: backspace" },
      ],
    },
    s3: {
      eyebrow: "03 · AI mode", title: "Solving problems.", accent: "problems",
      intro: "KalkMate sends your problem to AI (Gemini model, via our server) and returns a step-by-step solution. Works for **math, physics, chemistry, biology**.",
      steps: [
        { title: "Enter the AI code", body: "In calculator mode type the 4 digits (default `1111`) with no operation in between. The AI menu opens." },
        { title: "Choose a mode", body: "**Photo** — point the camera at the problem. Live preview on screen (focus indicator on the right), press `5 (OK)` to take the photo and send it to AI.\n\n**Text** — on-screen QWERTY keyboard: 8/4/6/2 = navigate, 5 = pick a character, confirm with the SOLVE button (max. 2000 characters).\n\n**History** — browse previous solutions (offline). The → (right) button opens the question for editing and resubmitting to AI." },
        { title: "Solution detail", body: "In Settings → Mode choose:", list: ["**Detailed** — step by step with explanations", "**Calculations** — just the formulas + steps", "**Result** — only the final answer"] },
        { title: "Reading the answer", body: "Use 8 / 2 (up/down) to scroll long answers. C/CE returns to the menu. Every answer is auto-saved to history." },
      ],
    },
    s4: {
      eyebrow: "04 · Storage", title: "Notes & tests.", accent: "tests",
      intro: "KalkMate stores up to **50 notes (60 KB)** and **50 tests (160 KB)** offline — you can read them even without WiFi. You edit them at kalkmate.pl/panel.",
      steps: [
        { title: "Add them on the site", body: "Go to kalkmate.pl/panel → the Notes / Tests tab → add content (up to 4000 characters for a note, 30,000 for a test). LaTeX and markdown supported." },
        { title: "Sync to the calculator", body: "On the calculator: Menu → Notes → click the down arrow (sync). Requires WiFi. Downloads everything from your account." },
        { title: "Read offline", body: "After syncing, they live in the calculator's flash storage — read them anywhere. LaTeX is automatically converted to ASCII on the OLED screen (∞ as a bitmap, fractions as `(a)/(b)`, etc.)." },
      ],
    },
    s5: {
      eyebrow: "05 · Battery", title: "Charging and battery.", accent: "Charging",
      note: "The **OLED at 12V** (MT3608 boost converter) draws the most power. Shorten auto-sleep to 1–2 minutes for 2–3× more runtime. Settings → Sleep.",
      body: "**Charging**: USB-C (PD not required, any ≥5V/1A charger works). The LED on the board lights up while charging and turns off at 100%. The battery is protected against overcharging (MCP73831 + DW01A).",
      stats: [
        { val: "2000", unit: "mAh", label: "Capacity (LiPo)" },
        { val: "~3", unit: "h", label: "Full charge" },
        { val: "2–3", unit: "days", label: "Typical use" },
        { val: "5–7", unit: "days", label: "Standby" },
      ],
    },
    s6: {
      eyebrow: "06 · Updates", title: "OTA — firmware updates.", accent: "updates",
      step1Title: "Check for updates",
      step1: (v) => `Settings → Updates → OK. The calculator asks the server whether there's a newer version than yours (shown as \`v${v}\` etc.).`,
      step2Title: "Install",
      step2: "If there's a new one — it shows the changelog + an Install button. Downloads (~1 MB), flashes the OTA partition, restarts. ~1 minute. Don't unplug power during the update.",
      note: "Updates are **free** and optional. Old firmware keeps working, but new features (e.g. better LaTeX) require the update.",
      versionLabel: "/ CURRENT SERVER VERSION:",
      versionHint: "Check your version in Settings → Updates",
    },
    s7: {
      eyebrow: "07 · Issues", title: "Troubleshooting common issues.", accent: "issues",
      problems: [
        { issue: "Screen won't turn on / stays black", fix: "1) Check the switch (should be in the ON position). 2) Charge for 30+ minutes — the battery may be fully drained. 3) If the charging LED doesn't light up when you plug in USB-C — the cable/port is damaged." },
        { issue: "WiFi can't find networks / empty list", fix: "Settings → WiFi → Scan. If it's empty — since v0.6.4 we added an automatic radio reset. Try again after 5 seconds. Some 5GHz networks aren't supported (ESP32 = 2.4GHz only)." },
        { issue: "AI Chat: 'AI error 400' or timeout", fix: "1) Check WiFi (Settings → Account status — should show 'Connected'). 2) Your account needs an active trial or subscription. 3) Try a shorter problem — limit is ~2000 characters." },
        { issue: "Some keys don't respond", fix: "Settings → Diagnostics → Keyboard test. If the key lights up when pressed — it's working fine (the issue is elsewhere). If it doesn't light up — it's a physical problem (cold solder joint, FFC cable). Contact us through the form." },
        { issue: "Notes/tests won't sync", fix: "1) WiFi must be working. 2) Your account must be paired (Settings → Account status = 'Connected'). 3) Check kalkmate.pl/panel to make sure they're on your account. 4) If there's too much data (>50 tests or >160 KB total) — the calculator won't download everything." },
        { issue: "MT3608 boost converter buzzes / screen has stripes", fix: "This is a hardware issue with the ceramic (piezoelectric) capacitors. Contact us through the form — we'll replace the board under warranty." },
      ],
    },
    s8: {
      eyebrow: "08 · FAQ", title: "Frequently asked questions.", accent: "questions",
      faqs: [
        { q: "How do I turn the calculator on / off?", a: "Slide the switch on the side. Turning it off doesn't erase notes or history — everything is saved in internal memory." },
        { q: "How long does the battery last?", a: "Mixed use (a few hours of AI + the rest in sleep): ~2–3 days. Standby: 5–7 days. Full charge: ~3 hours via USB-C." },
        { q: "Why does AI Chat need WiFi?", a: "The answers themselves are computed by the server (Gemini model). Without WiFi only the calculator, notes and tests work. Setup: Settings → WiFi." },
        { q: "What is the Panic key?", a: "A key (MU by default) that IMMEDIATELY switches back to calculator mode from any screen. Handy when someone's looking. You can change it in Settings → Panic key." },
        { q: "How do I add notes / tests?", a: "Only through the customer panel at kalkmate.pl/panel. The calculator syncs them over WiFi (Notes → Sync). On the device you can only read them, not edit." },
        { q: 'What does the "AI code" do?', a: "A four-digit code (default 1111) you type in calculator mode to unlock the AI menu. Without it, the calculator looks like a plain Esperanza T8809-2." },
        { q: "How do I pair the calculator with my account?", a: "1) Create an account at kalkmate.pl. 2) Assign a license under the Subscription tab (auto-assigned if you bought online). 3) On the calculator: Settings → Device ID + QR — it registers with the server. 4) In the panel, under Calculator, enter the Device ID + AI code." },
        { q: "The screen flickers / shows white stripes — what do I do?", a: "Usually it's the 12V boost converter (MT3608) buzzing/unstable. Contact us through the form — we'll send you a new board. Covered under the 24-month warranty." },
        { q: "A key doesn't work — can this be fixed with software?", a: "If it's a mapping issue (after resoldering) — yes, we have a keymap_scan tool that remaps the keys. Reach out through the form and we'll send you the file." },
        { q: "How do I update the firmware?", a: "Settings → Updates → OK. The calculator checks the server, asks for confirmation, downloads + flashes + restarts. The whole process takes ~1 minute with WiFi." },
        { q: "I forgot my account password", a: "Go to kalkmate.pl/auth/forgot-password — we'll send a reset link to your email (valid for 60 minutes)." },
        { q: "Can I return the calculator?", a: "Yes, within 14 days of delivery, no reason needed (GDPR + consumer rights law). Just email kontakt@kalkmate.pl with your order number." },
      ],
    },
    s9: {
      eyebrow: "09 · Changelog", title: "Firmware history.", accent: "history",
      intro: "Every released version. Update via Settings → Updates.",
    },
    s10: {
      eyebrow: "10 · Contact", title: "Get in touch.", accent: "touch",
      intro: "I reply within 24h (usually faster). You can also email directly at kontakt@kalkmate.pl.",
      sentTitle: "/ SENT",
      sentBody: "Thanks for your message. I'll get back to you as soon as possible at the email you provided.",
      sentAgain: "Send another →",
      labelName: "Name", labelEmail: "Email", labelSubject: "Subject", labelSubjectOptional: "optional", labelMessage: "Message",
      placeholderName: "Jane Doe", placeholderEmail: "your@email.com", placeholderSubject: "e.g. WiFi issue", placeholderMessage: "Describe the issue or ask your question...",
      errorLabel: "/ ERROR", sending: "Sending...", send: "Send message",
    },
    footerTagline: "AI-powered calculator",
    footerTerms: "Terms of Service",
    footerPrivacy: "Privacy Policy",
    footerCe: "CE Declaration of Conformity",
  },

  de: {
    metaTitle: "Hilfe und Bedienungsanleitung — KalkMate",
    metaDesc:
      "Bedienungsanleitung für den KalkMate-Taschenrechner: erste Inbetriebnahme, WLAN-Einrichtung, KI-Modus, Fehlerbehebung und Firmware-Verlauf.",
    navHome: "← Startseite",
    navPanel: "Panel",
    heroEyebrow: "[ hilfe ] · v1.0",
    heroTitleLine1: "Hilfe &",
    heroTitleAccent: "Dokumentation",
    heroDesc: (v) =>
      `Alles, was du zum Starten brauchst: Anleitung, Videos, FAQ und Kontakt zu uns. Inhalte aktualisiert für Firmware v${v}.`,
    sections: [
      { id: "start", label: "01 · Erste Inbetriebnahme" },
      { id: "klawiatura", label: "02 · Tastatur-Navigation" },
      { id: "ai", label: "03 · KI-Modus" },
      { id: "notatki", label: "04 · Notizen & Tests" },
      { id: "bateria", label: "05 · Akku & Laden" },
      { id: "ota", label: "06 · Updates (OTA)" },
      { id: "problemy", label: "07 · Fehlerbehebung" },
      { id: "faq", label: "08 · FAQ" },
      { id: "changelog", label: "09 · Firmware-Changelog" },
      { id: "kontakt", label: "10 · Kontakt" },
    ],
    s1: {
      eyebrow: "01 · Start", title: "Erste Inbetriebnahme.", accent: "Inbetriebnahme",
      videoLabel: "Video: Erste Inbetriebnahme",
      steps: [
        { title: "Aufladen", body: "Verbinde das mitgelieferte USB-C-Kabel mit dem Rechner und einem Ladegerät mit ≥5V/1A. Volle Ladung dauert ~3h. Die LED auf der Platine leuchtet während des Ladens." },
        { title: "Einschalten", body: "Schiebe den Schalter an der Seite auf ON. Nach ~2s siehst du den KalkMate-Startbildschirm, danach den **Taschenrechner-Bildschirm** (Digitalanzeige)." },
        { title: "KI-Menü öffnen", body: "Gib auf der Tastatur den **Entsperrcode** ein (Standard `1111`) — nur Ziffern, ohne Rechenzeichen dazwischen. Der Bildschirm zeigt kurz „AI\" und öffnet das Hauptmenü. Erst jetzt sind Einstellungen und weitere Funktionen verfügbar." },
        { title: "WLAN einrichten", body: "Einstellungen → WLAN → Netzwerk aus der Liste wählen → Passwort eingeben (Bildschirmtastatur). Erforderlich für KI, Notizen-Sync und OTA-Updates." },
        { title: "Konto verknüpfen", body: "Erstelle ein Konto auf kalkmate.pl (E-Mail bestätigen). Auf dem Rechner: Einstellungen → Geräte-ID + QR — registriert sich beim Server und zeigt einen QR-Code zum Scannen. Bestätige die Verknüpfung im kalkmate.pl-Panel. Ohne das läuft der Rechner im Offline-Modus." },
      ],
    },
    s2: {
      eyebrow: "02 · Tastatur", title: "Navigation mit der Tastatur.", accent: "Tastatur",
      intro: "Die Tastatur hat 27 Tasten im 5×6-Layout. In Menüs/Einstellungen navigierst du mit dem **Nummernblock**:",
      note: "Im **Taschenrechner-Modus** funktionieren Zifferntasten/Rechenzeichen normal (5 = fünf, 4 = vier usw.). Der Nummernblock dient nur in Menüs und Einstellungen der Navigation.",
      videoLabel: "Navigation der KI-Bildschirmtastatur",
      legend: { nav: "NAVIGATION", panic: "PANIC", standard: "STANDARD" },
      keyRows: [
        { key: "8", desc: "Hoch" },
        { key: "2", desc: "Runter" },
        { key: "4", desc: "Links" },
        { key: "6", desc: "Rechts" },
        { key: "5", desc: "OK / Bestätigen", accent: true },
        { key: "C/CE", desc: "Zurück / Abbrechen" },
        { key: "MU", desc: "PANIC — sofort zurück zum Taschenrechner-Modus", accent: true },
        { key: "▶", desc: "Im Taschenrechner-Modus: Rückschritt" },
      ],
    },
    s3: {
      eyebrow: "03 · KI-Modus", title: "Aufgaben lösen.", accent: "lösen",
      intro: "KalkMate sendet deine Aufgabe an die KI (Gemini-Modell über unseren Server) und liefert eine Schritt-für-Schritt-Lösung. Funktioniert für **Mathe, Physik, Chemie, Biologie**.",
      steps: [
        { title: "KI-Code eingeben", body: "Gib im Taschenrechner-Modus die 4 Ziffern ein (Standard `1111`) ohne Rechenzeichen dazwischen. Das KI-Menü öffnet sich." },
        { title: "Modus wählen", body: "**Foto** — richte die Kamera auf die Aufgabe. Live-Vorschau auf dem Bildschirm (Schärfeanzeige rechts), drücke `5 (OK)`, um das Foto aufzunehmen und an die KI zu senden.\n\n**Text** — Bildschirm-QWERTZ-Tastatur: 8/4/6/2 = navigieren, 5 = Zeichen wählen, mit der AUFGABE-Taste bestätigen (max. 2000 Zeichen).\n\n**Verlauf** — vorherige Lösungen durchsehen (offline). Die Taste → (rechts) öffnet die Frage zum Bearbeiten und erneuten Senden an die KI." },
        { title: "Lösungsdetail", body: "Unter Einstellungen → Modus wählst du:", list: ["**Ausführlich** — Schritt für Schritt mit Erklärungen", "**Berechnungen** — nur Formeln + Rechenschritte", "**Ergebnis** — nur die Endantwort"] },
        { title: "Antwort lesen", body: "Mit 8 / 2 (hoch/runter) scrollst du lange Antworten. C/CE geht zurück zum Menü. Jede Antwort wird automatisch im Verlauf gespeichert." },
      ],
    },
    s4: {
      eyebrow: "04 · Speicher", title: "Notizen und Tests.", accent: "Tests",
      intro: "KalkMate speichert bis zu **50 Notizen (60 KB)** und **50 Tests (160 KB)** offline — du liest sie auch ohne WLAN. Bearbeitet werden sie auf kalkmate.pl/panel.",
      steps: [
        { title: "Auf der Webseite hinzufügen", body: "Gehe zu kalkmate.pl/panel → Tab Notizen / Tests → Inhalt hinzufügen (bis 4000 Zeichen pro Notiz, 30.000 pro Test). LaTeX und Markdown werden unterstützt." },
        { title: "Mit dem Rechner synchronisieren", body: "Auf dem Rechner: Menü → Notizen → Pfeil nach unten klicken (Sync). Erfordert WLAN. Lädt alles vom Konto herunter." },
        { title: "Offline lesen", body: "Nach dem Sync liegen sie im Flash-Speicher des Rechners — überall lesbar. LaTeX wird automatisch in ASCII für das OLED-Display umgewandelt (∞ als Bitmap, Brüche als `(a)/(b)` usw.)." },
      ],
    },
    s5: {
      eyebrow: "05 · Akku", title: "Laden und Akku.", accent: "Laden",
      note: "Am meisten Strom zieht das **OLED bei 12V** (MT3608-Boost-Wandler). Verkürze den Auto-Sleep auf 1–2 Minuten für 2–3× mehr Laufzeit. Einstellungen → Sleep.",
      body: "**Laden**: USB-C (PD nicht erforderlich, jedes Ladegerät ≥5V/1A funktioniert). Die LED auf der Platine leuchtet beim Laden und erlischt bei 100%. Der Akku ist vor Überladung geschützt (MCP73831 + DW01A).",
      stats: [
        { val: "2000", unit: "mAh", label: "Kapazität (LiPo)" },
        { val: "~3", unit: "h", label: "Volle Ladung" },
        { val: "2–3", unit: "Tage", label: "Typische Nutzung" },
        { val: "5–7", unit: "Tage", label: "Standby" },
      ],
    },
    s6: {
      eyebrow: "06 · Updates", title: "OTA — Firmware-Updates.", accent: "Updates",
      step1Title: "Verfügbarkeit prüfen",
      step1: (v) => `Einstellungen → Updates → OK. Der Rechner fragt den Server, ob es eine neuere Version als deine aktuelle gibt (angezeigt als \`v${v}\` usw.).`,
      step2Title: "Installieren",
      step2: "Falls es eine neue Version gibt — werden die Änderungen angezeigt + ein Installieren-Button. Lädt (~1 MB) herunter, flasht die OTA-Partition, startet neu. ~1 Minute. Trenne während des Updates nicht die Stromversorgung.",
      note: "Updates sind **kostenlos** und freiwillig. Alte Firmware funktioniert weiterhin, aber neue Funktionen (z. B. besseres LaTeX) erfordern das Update.",
      versionLabel: "/ AKTUELLE SERVER-VERSION:",
      versionHint: "Prüfe deine Version unter Einstellungen → Updates",
    },
    s7: {
      eyebrow: "07 · Probleme", title: "Häufige Probleme lösen.", accent: "Probleme",
      problems: [
        { issue: "Bildschirm geht nicht an / bleibt schwarz", fix: "1) Schalter prüfen (sollte auf ON stehen). 2) 30+ Minuten laden — der Akku könnte leer sein. 3) Leuchtet die Lade-LED beim Anschließen von USB-C nicht — Kabel/Anschluss defekt." },
        { issue: "WLAN findet keine Netzwerke / leere Liste", fix: "Einstellungen → WLAN → Scannen. Bleibt es leer — seit v0.6.4 gibt es einen automatischen Radio-Reset. Nach 5 Sekunden erneut versuchen. Manche 5-GHz-Netzwerke werden nicht unterstützt (ESP32 = nur 2,4 GHz)." },
        { issue: "KI-Chat: „AI error 400\" oder Timeout", fix: "1) WLAN prüfen (Einstellungen → Kontostatus — sollte „Verbunden\" zeigen). 2) Das Konto braucht einen aktiven Trial oder ein Abo. 3) Kürzere Aufgabe versuchen — Limit ~2000 Zeichen." },
        { issue: "Manche Tasten reagieren nicht", fix: "Einstellungen → Diagnose → Tastaturtest. Leuchtet die Taste beim Drücken — funktioniert sie einwandfrei (Problem liegt anderswo). Leuchtet sie nicht — physisches Problem (kalte Lötstelle, FFC-Kabel). Melde dich über das Formular." },
        { issue: "Notizen/Tests synchronisieren nicht", fix: "1) WLAN muss funktionieren. 2) Das Konto muss verknüpft sein (Einstellungen → Kontostatus = „Verbunden\"). 3) Prüfe auf kalkmate.pl/panel, ob sie im Konto vorhanden sind. 4) Bei zu vielen Daten (>50 Tests oder insgesamt >160 KB) lädt der Rechner nicht alles herunter." },
        { issue: "MT3608-Boost-Wandler summt / Bildschirm hat Streifen", fix: "Das ist ein Hardware-Problem mit den keramischen (piezoelektrischen) Kondensatoren. Melde dich über das Formular — wir tauschen die Platine im Rahmen der Garantie aus." },
      ],
    },
    s8: {
      eyebrow: "08 · FAQ", title: "Häufig gestellte Fragen.", accent: "Fragen",
      faqs: [
        { q: "Wie schalte ich den Rechner ein / aus?", a: "Schiebe den Schalter an der Seite. Ausschalten löscht keine Notizen oder den Verlauf — alles bleibt im internen Speicher erhalten." },
        { q: "Wie lange hält der Akku?", a: "Gemischte Nutzung (einige Stunden KI + Rest im Sleep): ~2–3 Tage. Standby: 5–7 Tage. Volle Ladung: ~3 Stunden über USB-C." },
        { q: "Warum braucht der KI-Chat WLAN?", a: "Die Antworten selbst berechnet der Server (Gemini-Modell). Ohne WLAN funktionieren nur Taschenrechner, Notizen und Tests. Einrichtung: Einstellungen → WLAN." },
        { q: "Was ist die Panic-Taste?", a: "Eine Taste (standardmäßig MU), die SOFORT von jedem Bildschirm zurück in den Taschenrechner-Modus wechselt. Praktisch, wenn jemand zuschaut. Änderbar unter Einstellungen → Panic-Taste." },
        { q: "Wie füge ich Notizen / Tests hinzu?", a: "Nur über das Kundenpanel auf kalkmate.pl/panel. Der Rechner synchronisiert sie über WLAN (Notizen → Sync). Auf dem Gerät kannst du sie nur lesen, nicht bearbeiten." },
        { q: 'Was macht der „KI-Code"?', a: "Ein vierstelliger Code (Standard 1111), den du im Taschenrechner-Modus eingibst, um das KI-Menü freizuschalten. Ohne ihn sieht der Rechner aus wie ein gewöhnlicher Esperanza T8809-2." },
        { q: "Wie verknüpfe ich den Rechner mit meinem Konto?", a: "1) Erstelle ein Konto auf kalkmate.pl. 2) Weise eine Lizenz im Tab Abo zu (bei Online-Kauf automatisch zugewiesen). 3) Auf dem Rechner: Einstellungen → Geräte-ID + QR — registriert sich beim Server. 4) Gib im Panel unter Rechner die Geräte-ID + den KI-Code ein." },
        { q: "Der Bildschirm flackert / zeigt weiße Streifen — was tun?", a: "Meist summt/instabil der 12V-Boost-Wandler (MT3608). Melde dich über das Formular — wir senden dir eine neue Platine. Abgedeckt durch die 24-Monats-Garantie." },
        { q: "Eine Taste funktioniert nicht — lässt sich das per Software beheben?", a: "Falls es ein Mapping-Problem ist (nach dem Nachlöten) — ja, wir haben ein keymap_scan-Tool, das die Tasten neu zuordnet. Melde dich über das Formular, wir senden dir die Datei." },
        { q: "Wie aktualisiere ich die Firmware?", a: "Einstellungen → Updates → OK. Der Rechner prüft den Server, fragt um Bestätigung, lädt herunter + flasht + startet neu. Der ganze Vorgang dauert ~1 Minute mit WLAN." },
        { q: "Ich habe mein Konto-Passwort vergessen", a: "Gehe zu kalkmate.pl/auth/forgot-password — wir senden einen Reset-Link an deine E-Mail (60 Minuten gültig)." },
        { q: "Kann ich den Rechner zurückgeben?", a: "Ja, innerhalb von 14 Tagen nach Lieferung ohne Angabe von Gründen (DSGVO + Verbraucherrecht). Schreib einfach eine E-Mail an kontakt@kalkmate.pl mit deiner Bestellnummer." },
      ],
    },
    s9: {
      eyebrow: "09 · Changelog", title: "Firmware-Verlauf.", accent: "Verlauf",
      intro: "Alle veröffentlichten Versionen. Update über Einstellungen → Updates.",
    },
    s10: {
      eyebrow: "10 · Kontakt", title: "Schreib uns.", accent: "uns",
      intro: "Ich antworte innerhalb von 24h (meist schneller). Du kannst auch direkt an kontakt@kalkmate.pl schreiben.",
      sentTitle: "/ GESENDET",
      sentBody: "Danke für deine Nachricht. Ich melde mich so schnell wie möglich an die angegebene E-Mail-Adresse.",
      sentAgain: "Weitere senden →",
      labelName: "Name", labelEmail: "E-Mail", labelSubject: "Betreff", labelSubjectOptional: "optional", labelMessage: "Nachricht",
      placeholderName: "Max Mustermann", placeholderEmail: "deine@email.de", placeholderSubject: "z. B. WLAN-Problem", placeholderMessage: "Beschreibe das Problem oder stelle deine Frage...",
      errorLabel: "/ FEHLER", sending: "Wird gesendet...", send: "Nachricht senden",
    },
    footerTagline: "KI-Taschenrechner",
    footerTerms: "AGB",
    footerPrivacy: "Datenschutzerklärung",
    footerCe: "CE-Konformitätserklärung",
  },
};

// ============================================================
// richText — lekki markup: **bold** i `code`, bez Markdown-parsera.
// ============================================================
function richText(s: string): React.ReactNode {
  const parts = s.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**")) {
      return <strong key={i} className="text-[#F2EDE3]">{p.slice(2, -2)}</strong>;
    }
    if (p.startsWith("`") && p.endsWith("`")) {
      return <code key={i} className="km-mono-eyebrow text-[#D8FF3D]">{p.slice(1, -1)}</code>;
    }
    return <span key={i}>{p}</span>;
  });
}

function richParagraphs(s: string): React.ReactNode {
  const paras = s.split("\n\n");
  return paras.map((p, i) => (
    <span key={i}>
      {i > 0 && <><br /><br /></>}
      {richText(p)}
    </span>
  ));
}

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

const inputClass =
  "w-full bg-transparent border border-[rgba(242,237,227,0.18)] text-[#F2EDE3] placeholder-[#F2EDE3]/30 px-4 py-3.5 focus:outline-none focus:border-[#D8FF3D] transition-colors km-mono-eyebrow text-[13px]";

export default function PomocContent({ lang }: { lang: Locale }) {
  const t = DICT[lang];
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const homeHref = localeHome(lang);

  return (
    <div className="min-h-screen bg-[#0B0B0B] text-[#F2EDE3]">
      {/* Header */}
      <header className="border-b border-[rgba(242,237,227,0.10)] sticky top-0 bg-[#0B0B0B]/95 backdrop-blur-sm z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <Link href={homeHref} className="km-display text-2xl shrink-0">
            Kalk<span className="italic text-[#D8FF3D]">Mate</span>
          </Link>
          <div className="flex items-center gap-4 md:gap-6">
            <Link href={homeHref} className="hidden sm:inline km-mono-eyebrow text-[#F2EDE3]/55 hover:text-[#D8FF3D] transition-colors">
              {t.navHome}
            </Link>
            <Link href="/panel" className="km-mono-eyebrow text-[#D8FF3D]">{t.navPanel}</Link>
            <LanguageSwitcher current={lang} path="/pomoc" />
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="border-b border-[rgba(242,237,227,0.10)] relative overflow-hidden">
        <div className="absolute -top-32 -left-32 w-[520px] h-[520px] rounded-full bg-[#D8FF3D] opacity-[0.06] blur-[140px] pointer-events-none" />
        <div className="max-w-6xl mx-auto px-6 py-16 lg:py-24 relative">
          <p className="km-mono-eyebrow text-[#D8FF3D]">{t.heroEyebrow}</p>
          <h1 className="km-display text-[clamp(48px,7vw,96px)] mt-4 leading-[0.95]">
            {t.heroTitleLine1}<br />
            <span className="italic text-[#D8FF3D]">{t.heroTitleAccent}</span>.
          </h1>
          <p className="mt-6 text-[17px] leading-[1.6] text-[#F2EDE3]/65 max-w-2xl">
            {t.heroDesc(serverVersion)}
          </p>
        </div>
      </section>

      {/* Layout: nav + content */}
      <div className="max-w-6xl mx-auto px-6 py-12 lg:py-16 grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-12">
        {/* Sidebar nav */}
        <nav className="lg:sticky lg:top-24 self-start space-y-1">
          {t.sections.map((s) => (
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
          <Section id="start" eyebrow={t.s1.eyebrow} title={t.s1.title} accent={t.s1.accent}>
            {t.s1.steps.map((s, i) => (
              <Step key={i} n={i + 1} title={s.title}>{richParagraphs(s.body)}</Step>
            ))}
            <VideoPlayer src="/instrukacja-kalkmate-bez-napisow.mp4" label={t.s1.videoLabel} />
          </Section>

          {/* 02 Klawiatura */}
          <Section id="klawiatura" eyebrow={t.s2.eyebrow} title={t.s2.title} accent={t.s2.accent}>
            <p className="text-[15px] leading-[1.65] text-[#F2EDE3]/65 mb-6">{richText(t.s2.intro)}</p>

            <KeyboardMap legend={t.s2.legend} />

            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4 text-[14px]">
              {t.s2.keyRows.map((k, i) => (
                <KeyRow key={i} keyLabel={k.key} desc={k.desc} accent={k.accent} />
              ))}
            </div>

            <Note>{richText(t.s2.note)}</Note>

            <AutoplayVideo src="/pokaz-klawiszy.mp4" label={t.s2.videoLabel} />
          </Section>

          {/* 03 AI */}
          <Section id="ai" eyebrow={t.s3.eyebrow} title={t.s3.title} accent={t.s3.accent}>
            <p className="text-[15px] leading-[1.65] text-[#F2EDE3]/65 mb-6">{richText(t.s3.intro)}</p>
            {t.s3.steps.map((s, i) => (
              <Step key={i} n={i + 1} title={s.title}>
                {richParagraphs(s.body)}
                {s.list && (
                  <ul className="mt-2 ml-4 list-disc text-[#F2EDE3]/65 space-y-1">
                    {s.list.map((li, j) => <li key={j}>{richText(li)}</li>)}
                  </ul>
                )}
              </Step>
            ))}
          </Section>

          {/* 04 Notatki */}
          <Section id="notatki" eyebrow={t.s4.eyebrow} title={t.s4.title} accent={t.s4.accent}>
            <p className="text-[15px] leading-[1.65] text-[#F2EDE3]/65 mb-6">{richText(t.s4.intro)}</p>
            {t.s4.steps.map((s, i) => (
              <Step key={i} n={i + 1} title={s.title}>{richParagraphs(s.body)}</Step>
            ))}
          </Section>

          {/* 05 Bateria */}
          <Section id="bateria" eyebrow={t.s5.eyebrow} title={t.s5.title} accent={t.s5.accent}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 text-[14px]">
              {t.s5.stats.map((s, i) => (
                <Stat key={i} val={s.val} unit={s.unit} label={s.label} />
              ))}
            </div>

            <Note>{richText(t.s5.note)}</Note>

            <p className="text-[15px] leading-[1.65] text-[#F2EDE3]/65 mt-6">{richText(t.s5.body)}</p>
          </Section>

          {/* 06 OTA */}
          <Section id="ota" eyebrow={t.s6.eyebrow} title={t.s6.title} accent={t.s6.accent}>
            <Step n={1} title={t.s6.step1Title}>{richText(t.s6.step1(serverVersion))}</Step>
            <Step n={2} title={t.s6.step2Title}>{richText(t.s6.step2)}</Step>
            <Note>{richText(t.s6.note)}</Note>

            <div className="mt-8">
              <p className="km-mono-eyebrow text-[#F2EDE3]/55 mb-3">{t.s6.versionLabel}</p>
              <p className="km-display text-3xl text-[#D8FF3D]">v{serverVersion}</p>
              <p className="km-mono-eyebrow text-[#F2EDE3]/40 mt-1">{t.s6.versionHint}</p>
            </div>
          </Section>

          {/* 07 Problemy */}
          <Section id="problemy" eyebrow={t.s7.eyebrow} title={t.s7.title} accent={t.s7.accent}>
            {t.s7.problems.map((p, i) => (
              <Problem key={i} issue={p.issue} fix={p.fix} />
            ))}
          </Section>

          {/* 08 FAQ */}
          <Section id="faq" eyebrow={t.s8.eyebrow} title={t.s8.title} accent={t.s8.accent}>
            <div className="border border-[rgba(242,237,227,0.18)] divide-y divide-[rgba(242,237,227,0.10)]">
              {t.s8.faqs.map((f, i) => (
                <div key={i}>
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
          <Section id="changelog" eyebrow={t.s9.eyebrow} title={t.s9.title} accent={t.s9.accent}>
            <p className="text-[14.5px] text-[#F2EDE3]/55 mb-6">{t.s9.intro}</p>
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
          <Section id="kontakt" eyebrow={t.s10.eyebrow} title={t.s10.title} accent={t.s10.accent}>
            <p className="text-[15px] leading-[1.65] text-[#F2EDE3]/65 mb-6">
              {t.s10.intro.split("kontakt@kalkmate.pl")[0]}
              <a href="mailto:kontakt@kalkmate.pl" className="text-[#D8FF3D] hover:underline">kontakt@kalkmate.pl</a>
              {t.s10.intro.split("kontakt@kalkmate.pl")[1]}
            </p>

            {sent ? (
              <div className="border border-[#D8FF3D]/40 bg-[#D8FF3D]/[0.05] p-4">
                <p className="km-mono-eyebrow text-[#D8FF3D]">{t.s10.sentTitle}</p>
                <p className="text-sm text-[#F2EDE3]/80 mt-2">{t.s10.sentBody}</p>
                <button
                  onClick={() => setSent(false)}
                  className="mt-4 km-mono-eyebrow text-[#D8FF3D] hover:text-[#F2EDE3] transition-colors"
                >
                  {t.s10.sentAgain}
                </button>
              </div>
            ) : (
              <form onSubmit={submitContact} className="space-y-4 max-w-2xl">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="km-mono-eyebrow text-[#F2EDE3]/55 block mb-2">{t.s10.labelName}</label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder={t.s10.placeholderName}
                      required
                      maxLength={100}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="km-mono-eyebrow text-[#F2EDE3]/55 block mb-2">{t.s10.labelEmail}</label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      placeholder={t.s10.placeholderEmail}
                      required
                      maxLength={150}
                      className={inputClass}
                    />
                  </div>
                </div>
                <div>
                  <label className="km-mono-eyebrow text-[#F2EDE3]/55 block mb-2">
                    {t.s10.labelSubject} <span className="text-[#F2EDE3]/30">· {t.s10.labelSubjectOptional}</span>
                  </label>
                  <input
                    type="text"
                    value={form.subject}
                    onChange={(e) => setForm({ ...form, subject: e.target.value })}
                    placeholder={t.s10.placeholderSubject}
                    maxLength={200}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="km-mono-eyebrow text-[#F2EDE3]/55 block mb-2">{t.s10.labelMessage}</label>
                  <textarea
                    value={form.message}
                    onChange={(e) => setForm({ ...form, message: e.target.value })}
                    placeholder={t.s10.placeholderMessage}
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
                    <p className="km-mono-eyebrow text-[#FF4D2E]">{t.s10.errorLabel}</p>
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
                  <span>{submitting ? t.s10.sending : t.s10.send}</span>
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
            <Link href={homeHref} className="km-display text-2xl">
              Kalk<span className="italic text-[#D8FF3D]">Mate</span>
            </Link>
            <p className="km-mono-eyebrow text-[#F2EDE3]/40 mt-2">{t.footerTagline}</p>
          </div>
          <div className="km-mono-eyebrow text-[#F2EDE3]/55 space-y-1">
            <Link href="/regulamin" className="block hover:text-[#D8FF3D] transition-colors">{t.footerTerms}</Link>
            <Link href="/polityka-prywatnosci" className="block hover:text-[#D8FF3D] transition-colors">{t.footerPrivacy}</Link>
            <a href="/docs/ce-declaration.pdf" target="_blank" rel="noopener noreferrer" className="block hover:text-[#D8FF3D] transition-colors">{t.footerCe}</a>
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

function VideoPlayer({ src, label }: { src: string; label: string }) {
  return (
    <div className="mt-6 border border-[rgba(242,237,227,0.18)] bg-[#0B0B0B] overflow-hidden">
      <p className="km-mono-eyebrow text-[#F2EDE3]/55 px-4 pt-3 pb-2">/ {label}</p>
      <video
        controls
        playsInline
        preload="metadata"
        className="w-full block"
        style={{ maxHeight: "560px" }}
      >
        <source src={src} type="video/mp4" />
      </video>
    </div>
  );
}

function AutoplayVideo({ src, label }: { src: string; label: string }) {
  return (
    <div className="mt-6 border border-[rgba(242,237,227,0.18)] bg-[#0B0B0B] overflow-hidden">
      <p className="km-mono-eyebrow text-[#F2EDE3]/55 px-4 pt-3 pb-2">/ {label}</p>
      <video
        autoPlay
        loop
        muted
        playsInline
        className="w-full block"
        style={{ maxHeight: "480px" }}
      >
        <source src={src} type="video/mp4" />
      </video>
    </div>
  );
}

function KeyboardMap({ legend }: { legend: { nav: string; panic: string; standard: string } }) {
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
        <span className="km-mono-eyebrow text-[#D8FF3D]">■ {legend.nav}</span>
        <span className="km-mono-eyebrow text-[#FF4D2E]">■ {legend.panic}</span>
        <span className="km-mono-eyebrow text-[#F2EDE3]/55">■ {legend.standard}</span>
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
