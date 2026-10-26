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
    errSend: string; errNetwork: string;
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
    heroEyebrow: "[ pomoc ] · v3.0",
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
        { title: "Naładuj", body: "Podłącz dołączony kabel USB-C do kalkulatora i ładowarki ≥5V/1A. Pełne ładowanie ~2h. LED na płytce świeci podczas ładowania." },
        { title: "Włącz", body: "Przesuń przełącznik suwakowy na boku w pozycję ON. Po ~2s zobaczysz ekran powitalny KalkMate, a następnie **ekran kalkulatora** (cyfrowy wyświetlacz)." },
        { title: "Wejdź do menu AI", body: "Na klawiaturze kalkulatora wpisz **kod odblokowujący** (domyślnie `1111`) — same cyfry, bez operatorów między nimi. Ekran na chwilę pokaże „AI\" i otworzy menu główne. Dopiero teraz dostępne są Ustawienia i inne funkcje." },
        { title: "Skonfiguruj WiFi", body: "Ustawienia → WiFi i konto → Sieć WiFi → wybierz sieć z listy → wpisz hasło (klawiatura ekranowa). To wymagane do działania AI, sync notatek i OTA." },
        { title: "Sparuj konto", body: "Załóż konto na kalkmate.pl (potwierdź email). Na kalkulatorze: Ustawienia → WiFi i konto → Device ID + QR — zarejestruje się na serwerze i wyświetli QR do skanowania. W panelu kalkmate.pl potwierdź sparowanie. Bez tego — kalkulator działa w trybie offline." },
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
        { title: "Tryb rozwiązania", body: "W Ustawienia → Rozwiązywanie → Tryb rozwiązań wybierz:", list: ["**Szczegółowy** — krok po kroku z wyjaśnieniami", "**Obliczenia** — same wzory + przejścia", "**Wynik** — sama odpowiedź końcowa"] },
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
      note: "Najwięcej prądu zżera **OLED przy 12V** (przetwornica MT3608). Skróć autosleep do 1–2 minut żeby wydłużyć czas pracy 2–3×. Ustawienia → Ekran → Usypianie.",
      body: "**Ładowanie**: USB-C (PD nie wymagany, każdy zasilacz ≥5V/1A). LED na płytce świeci podczas ładowania, gaśnie przy 100%. Bateria jest chroniona przed przeładowaniem (MCP73831 + DW01A).",
      stats: [
        { val: "1500", unit: "mAh", label: "Pojemność (LiPo)" },
        { val: "~2", unit: "h", label: "Pełne ładowanie" },
        { val: "2–3", unit: "dni", label: "Typowe użycie" },
        { val: "5–7", unit: "dni", label: "Stand-by" },
      ],
    },
    s6: {
      eyebrow: "06 · Aktualizacje", title: "OTA — aktualizacje firmware.", accent: "aktualizacje",
      step1Title: "Sprawdź dostępność",
      step1: (v) => `Ustawienia → System → Aktualizacja → OK. Kalkulator pyta serwer, czy jest nowsza wersja niż twoja aktualna (widoczna jako \`v${v}\` itp.).`,
      step2Title: "Zainstaluj",
      step2: "Jeśli jest nowa — pokazuje notes do zmian + przycisk Zainstaluj. Pobiera (~1 MB), flashuje partycję OTA, restartuje. ~1 minuta. Nie odłączaj zasilania podczas update'u.",
      note: "Aktualizacje są **darmowe** i dobrowolne. Stary firmware będzie nadal działał, ale nowe feature'y (np. lepszy LaTeX) wymagają update'u.",
      versionLabel: "/ AKTUALNA WERSJA SERWERA:",
      versionHint: "Sprawdź swoją wersję w Ustawienia → System → Aktualizacja (lub Ustawienia → Informacje → O urządzeniu)",
    },
    s7: {
      eyebrow: "07 · Problemy", title: "Rozwiązywanie problemów.", accent: "problemów",
      problems: [
        { issue: "Ekran się nie włącza / czarny", fix: "1) Sprawdź switch (powinien być w pozycji ON). 2) Naładuj 30+ minut — bateria może być zerowa. 3) Jeśli LED ładowania nie świeci po podłączeniu USB-C — uszkodzony kabel/port." },
        { issue: "WiFi nie znajduje sieci / pusta lista", fix: "Ustawienia → WiFi i konto → Sieć WiFi → Skanuj. Jeśli pusto — w v0.6.4 dodaliśmy auto-reset radia. Spróbuj jeszcze raz po 5 sekundach. Niektóre sieci 5GHz nie są wspierane (ESP32 = 2.4GHz only)." },
        { issue: "AI Chat: 'AI error 400' lub timeout", fix: "1) Sprawdź WiFi (Ustawienia → WiFi i konto → Status konta — pokaże 'Podłączone'). 2) Konto musi mieć tokeny AI — saldo sprawdzisz i doładujesz w panelu, w zakładce AI. 3) Spróbuj krótszego zadania — limit ~2000 znaków." },
        { issue: "Niektóre klawisze nie reagują", fix: "Ustawienia → Diagnostyka → Test klawiatury. Jeśli klawisz świeci się gdy wciskasz — działa OK (problem w innym miejscu). Jeśli nie świeci — fizyczny problem (zimna lutka, FFC). Pisz przez formularz." },
        { issue: "Notatki/sprawdziany nie syncują", fix: "1) WiFi musi działać. 2) Konto musi być sparowane (Ustawienia → WiFi i konto → Status konta = 'Podłączone'). 3) Na kalkmate.pl/panel sprawdź czy są na koncie. 4) Jeśli za dużo (>50 sprawdzianów lub łącznie >160 KB) — kalkulator nie pobierze wszystkich." },
        { issue: "Boost MT3608 buczy / ekran ma paski", fix: "To problem sprzętowy z kondensatorami ceramicznymi (piezoelektrycznymi). Skontaktuj się przez formularz — wymienimy płytkę w gwarancji." },
      ],
    },
    s8: {
      eyebrow: "08 · FAQ", title: "Często zadawane pytania.", accent: "pytania",
      faqs: [
        { q: "Jak włączyć / wyłączyć kalkulator?", a: "Przesuń przełącznik suwakowy na boku. Wyłączenie nie kasuje notatek ani historii — wszystko jest zapisane w pamięci wewnętrznej." },
        { q: "Jak długo trzyma bateria?", a: "Mieszane użycie (kilka godzin AI + reszta sleep): ~2–3 dni. Stand-by: 5–7 dni. Pełne ładowanie: ~2 godziny przez USB-C." },
        { q: "Dlaczego AI Chat wymaga WiFi?", a: "Same odpowiedzi liczy serwer (model Gemini). Bez WiFi działa tylko kalkulator, notatki, sprawdziany. Konfiguracja: Ustawienia → WiFi i konto → Sieć WiFi." },
        { q: "Co to jest klawisz Panic?", a: "Klawisz (domyślnie MU) który NATYCHMIAST cofa do trybu kalkulatora z dowolnego ekranu. Przydaje się gdy ktoś patrzy. Możesz go zmienić w Ustawienia → Bezpieczeństwo → Klawisz panic." },
        { q: "Jak dodaję notatki / sprawdziany?", a: "Wyłącznie przez panel klienta na kalkmate.pl/panel. Kalkulator synchronizuje je przez WiFi (Notatki → Sync). Na urządzeniu tylko czytasz, nie edytujesz." },
        { q: 'Co robi "Kod AI"?', a: "Czterocyfrowy kod (domyślnie 1111) który wpisujesz w trybie kalkulatora żeby odblokować menu AI. Bez tego kalkulator wygląda jak zwykła Esperanza T8809-2." },
        { q: "Jak sparuję kalkulator z kontem?", a: "1) Załóż konto na kalkmate.pl 2) Aktywuj kod z pudełka w zakładce AI — doda 2 mln tokenów (jeśli kupowałeś online, kod jest przypisany automatycznie). 3) Na kalkulatorze: Ustawienia → WiFi i konto → Device ID + QR — zarejestruje się na serwerze. 4) W panelu Kalkulator wpisz Device ID + Kod AI." },
        { q: "Ekran miga / pokazuje białe paski — co robić?", a: "Najczęściej buczy/niestabilna jest przetwornica 12V (MT3608). Skontaktuj się przez formularz — odeślemy ci nową płytkę. Reklamacja w gwarancji 24mc." },
        { q: "Klawisz nie działa — można to naprawić softem?", a: "Jeśli to problem z mapowaniem (po lutowaniu) — tak, mamy narzędzie keymap_scan które przemapuje klawisze. Pisz przez formularz, wyślemy plik." },
        { q: "Jak zaktualizować firmware?", a: "Ustawienia → System → Aktualizacja → OK. Kalkulator sprawdza serwer, pyta o zgodę, pobiera + flashuje + restartuje. Cały proces ~1 minuta z WiFi." },
        { q: "Zapomniałem hasła do konta", a: "Wejdź kalkmate.pl/auth/forgot-password — wyślemy link resetujący na podany email (ważny 60 minut)." },
        { q: "Mogę zwrócić kalkulator?", a: "Tak, 14 dni od dostawy bez podania przyczyny (RODO + ustawa o prawach konsumenta). Wystarczy email na kontakt@kalkmate.pl ze swoim numerem zamówienia." },
      ],
    },
    s9: {
      eyebrow: "09 · Changelog", title: "Historia firmware.", accent: "firmware",
      intro: "Wszystkie wydane wersje. Update przez Ustawienia → System → Aktualizacja.",
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
      errSend: "Nie udało się wysłać", errNetwork: "Błąd sieci",
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
    heroEyebrow: "[ help ] · v3.0",
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
        { title: "Charge it", body: "Connect the included USB-C cable to the calculator and a ≥5V/1A charger. A full charge takes ~2h. The LED on the board lights up while charging." },
        { title: "Turn it on", body: "Slide the switch on the side to ON. After ~2s you'll see the KalkMate splash screen, then the **calculator screen** (digital display)." },
        { title: "Open the AI menu", body: "On the calculator keypad, type the **unlock code** (default `1111`) — digits only, no operators in between. The screen briefly shows „AI\" and opens the main menu. Only now are Settings and other features available." },
        { title: "Set up WiFi", body: "Settings → WiFi & account → WiFi network → pick a network from the list → enter the password (on-screen keyboard). Required for AI, note sync and OTA updates." },
        { title: "Pair your account", body: "Create an account at kalkmate.pl (confirm your email). On the calculator: Settings → WiFi & account → Device ID + QR — it registers with the server and shows a QR code to scan. Confirm the pairing in the kalkmate.pl panel. Without this, the calculator runs in offline mode." },
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
        { title: "Solution detail", body: "In Settings → Problem solving → Solution mode choose:", list: ["**Detailed** — step by step with explanations", "**Calculations** — just the formulas + steps", "**Result** — only the final answer"] },
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
      note: "The **OLED at 12V** (MT3608 boost converter) draws the most power. Shorten auto-sleep to 1–2 minutes for 2–3× more runtime. Settings → Display → Auto sleep.",
      body: "**Charging**: USB-C (PD not required, any ≥5V/1A charger works). The LED on the board lights up while charging and turns off at 100%. The battery is protected against overcharging (MCP73831 + DW01A).",
      stats: [
        { val: "1500", unit: "mAh", label: "Capacity (LiPo)" },
        { val: "~2", unit: "h", label: "Full charge" },
        { val: "2–3", unit: "days", label: "Typical use" },
        { val: "5–7", unit: "days", label: "Standby" },
      ],
    },
    s6: {
      eyebrow: "06 · Updates", title: "OTA — firmware updates.", accent: "updates",
      step1Title: "Check for updates",
      step1: (v) => `Settings → System → Software update → OK. The calculator asks the server whether there's a newer version than yours (shown as \`v${v}\` etc.).`,
      step2Title: "Install",
      step2: "If there's a new one — it shows the changelog + an Install button. Downloads (~1 MB), flashes the OTA partition, restarts. ~1 minute. Don't unplug power during the update.",
      note: "Updates are **free** and optional. Old firmware keeps working, but new features (e.g. better LaTeX) require the update.",
      versionLabel: "/ CURRENT SERVER VERSION:",
      versionHint: "Check your version in Settings → System → Software update (or Settings → Information → About device)",
    },
    s7: {
      eyebrow: "07 · Issues", title: "Troubleshooting common issues.", accent: "issues",
      problems: [
        { issue: "Screen won't turn on / stays black", fix: "1) Check the switch (should be in the ON position). 2) Charge for 30+ minutes — the battery may be fully drained. 3) If the charging LED doesn't light up when you plug in USB-C — the cable/port is damaged." },
        { issue: "WiFi can't find networks / empty list", fix: "Settings → WiFi & account → WiFi network → Scan. If it's empty — since v0.6.4 we added an automatic radio reset. Try again after 5 seconds. Some 5GHz networks aren't supported (ESP32 = 2.4GHz only)." },
        { issue: "AI Chat: 'AI error 400' or timeout", fix: "1) Check WiFi (Settings → WiFi & account → Account status — should show 'Connected'). 2) Your account needs AI tokens — check and top up your balance in the panel, under the AI tab. 3) Try a shorter problem — limit is ~2000 characters." },
        { issue: "Some keys don't respond", fix: "Settings → Diagnostics → Keyboard test. If the key lights up when pressed — it's working fine (the issue is elsewhere). If it doesn't light up — it's a physical problem (cold solder joint, FFC cable). Contact us through the form." },
        { issue: "Notes/tests won't sync", fix: "1) WiFi must be working. 2) Your account must be paired (Settings → WiFi & account → Account status = 'Connected'). 3) Check kalkmate.pl/panel to make sure they're on your account. 4) If there's too much data (>50 tests or >160 KB total) — the calculator won't download everything." },
        { issue: "MT3608 boost converter buzzes / screen has stripes", fix: "This is a hardware issue with the ceramic (piezoelectric) capacitors. Contact us through the form — we'll replace the board under warranty." },
      ],
    },
    s8: {
      eyebrow: "08 · FAQ", title: "Frequently asked questions.", accent: "questions",
      faqs: [
        { q: "How do I turn the calculator on / off?", a: "Slide the switch on the side. Turning it off doesn't erase notes or history — everything is saved in internal memory." },
        { q: "How long does the battery last?", a: "Mixed use (a few hours of AI + the rest in sleep): ~2–3 days. Standby: 5–7 days. Full charge: ~2 hours via USB-C." },
        { q: "Why does AI Chat need WiFi?", a: "The answers themselves are computed by the server (Gemini model). Without WiFi only the calculator, notes and tests work. Setup: Settings → WiFi & account → WiFi network." },
        { q: "What is the Panic key?", a: "A key (MU by default) that IMMEDIATELY switches back to calculator mode from any screen. Handy when someone's looking. You can change it in Settings → Security → Panic key." },
        { q: "How do I add notes / tests?", a: "Only through the customer panel at kalkmate.pl/panel. The calculator syncs them over WiFi (Notes → Sync). On the device you can only read them, not edit." },
        { q: 'What does the "AI code" do?', a: "A four-digit code (default 1111) you type in calculator mode to unlock the AI menu. Without it, the calculator looks like a plain Esperanza T8809-2." },
        { q: "How do I pair the calculator with my account?", a: "1) Create an account at kalkmate.pl. 2) Activate the code from the box under the AI tab — it adds 2M tokens (auto-assigned if you bought online). 3) On the calculator: Settings → WiFi & account → Device ID + QR — it registers with the server. 4) In the panel, under Calculator, enter the Device ID + AI code." },
        { q: "The screen flickers / shows white stripes — what do I do?", a: "Usually it's the 12V boost converter (MT3608) buzzing/unstable. Contact us through the form — we'll send you a new board. Covered under the 24-month warranty." },
        { q: "A key doesn't work — can this be fixed with software?", a: "If it's a mapping issue (after resoldering) — yes, we have a keymap_scan tool that remaps the keys. Reach out through the form and we'll send you the file." },
        { q: "How do I update the firmware?", a: "Settings → System → Software update → OK. The calculator checks the server, asks for confirmation, downloads + flashes + restarts. The whole process takes ~1 minute with WiFi." },
        { q: "I forgot my account password", a: "Go to kalkmate.pl/auth/forgot-password — we'll send a reset link to your email (valid for 60 minutes)." },
        { q: "Can I return the calculator?", a: "Yes, within 14 days of delivery, no reason needed (GDPR + consumer rights law). Just email kontakt@kalkmate.pl with your order number." },
      ],
    },
    s9: {
      eyebrow: "09 · Changelog", title: "Firmware history.", accent: "history",
      intro: "Every released version. Update via Settings → System → Software update.",
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
      errSend: "Couldn't send the message", errNetwork: "Network error",
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
    heroEyebrow: "[ hilfe ] · v3.0",
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
        { title: "Aufladen", body: "Verbinde das mitgelieferte USB-C-Kabel mit dem Rechner und einem Ladegerät mit ≥5V/1A. Volle Ladung dauert ~2h. Die LED auf der Platine leuchtet während des Ladens." },
        { title: "Einschalten", body: "Schiebe den Schalter an der Seite auf ON. Nach ~2s siehst du den KalkMate-Startbildschirm, danach den **Taschenrechner-Bildschirm** (Digitalanzeige)." },
        { title: "KI-Menü öffnen", body: "Gib auf der Tastatur den **Entsperrcode** ein (Standard `1111`) — nur Ziffern, ohne Rechenzeichen dazwischen. Der Bildschirm zeigt kurz „AI\" und öffnet das Hauptmenü. Erst jetzt sind Einstellungen und weitere Funktionen verfügbar." },
        { title: "WLAN einrichten", body: "Einstellungen → WLAN & Konto → WLAN-Netz → Netzwerk aus der Liste wählen → Passwort eingeben (Bildschirmtastatur). Erforderlich für KI, Notizen-Sync und OTA-Updates." },
        { title: "Konto verknüpfen", body: "Erstelle ein Konto auf kalkmate.pl (E-Mail bestätigen). Auf dem Rechner: Einstellungen → WLAN & Konto → Geräte-ID + QR — registriert sich beim Server und zeigt einen QR-Code zum Scannen. Bestätige die Verknüpfung im kalkmate.pl-Panel. Ohne das läuft der Rechner im Offline-Modus." },
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
        { title: "Lösungsdetail", body: "Unter Einstellungen → Aufgaben lösen → Lösungsmodus wählst du:", list: ["**Ausführlich** — Schritt für Schritt mit Erklärungen", "**Berechnungen** — nur Formeln + Rechenschritte", "**Ergebnis** — nur die Endantwort"] },
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
      note: "Am meisten Strom zieht das **OLED bei 12V** (MT3608-Boost-Wandler). Verkürze den Auto-Sleep auf 1–2 Minuten für 2–3× mehr Laufzeit. Einstellungen → Anzeige → Auto-Ruhe.",
      body: "**Laden**: USB-C (PD nicht erforderlich, jedes Ladegerät ≥5V/1A funktioniert). Die LED auf der Platine leuchtet beim Laden und erlischt bei 100%. Der Akku ist vor Überladung geschützt (MCP73831 + DW01A).",
      stats: [
        { val: "1500", unit: "mAh", label: "Kapazität (LiPo)" },
        { val: "~2", unit: "h", label: "Volle Ladung" },
        { val: "2–3", unit: "Tage", label: "Typische Nutzung" },
        { val: "5–7", unit: "Tage", label: "Standby" },
      ],
    },
    s6: {
      eyebrow: "06 · Updates", title: "OTA — Firmware-Updates.", accent: "Updates",
      step1Title: "Verfügbarkeit prüfen",
      step1: (v) => `Einstellungen → System → Software-Update → OK. Der Rechner fragt den Server, ob es eine neuere Version als deine aktuelle gibt (angezeigt als \`v${v}\` usw.).`,
      step2Title: "Installieren",
      step2: "Falls es eine neue Version gibt — werden die Änderungen angezeigt + ein Installieren-Button. Lädt (~1 MB) herunter, flasht die OTA-Partition, startet neu. ~1 Minute. Trenne während des Updates nicht die Stromversorgung.",
      note: "Updates sind **kostenlos** und freiwillig. Alte Firmware funktioniert weiterhin, aber neue Funktionen (z. B. besseres LaTeX) erfordern das Update.",
      versionLabel: "/ AKTUELLE SERVER-VERSION:",
      versionHint: "Prüfe deine Version unter Einstellungen → System → Software-Update (oder Einstellungen → Informationen → Geräteinfo)",
    },
    s7: {
      eyebrow: "07 · Probleme", title: "Häufige Probleme lösen.", accent: "Probleme",
      problems: [
        { issue: "Bildschirm geht nicht an / bleibt schwarz", fix: "1) Schalter prüfen (sollte auf ON stehen). 2) 30+ Minuten laden — der Akku könnte leer sein. 3) Leuchtet die Lade-LED beim Anschließen von USB-C nicht — Kabel/Anschluss defekt." },
        { issue: "WLAN findet keine Netzwerke / leere Liste", fix: "Einstellungen → WLAN & Konto → WLAN-Netz → Scannen. Bleibt es leer — seit v0.6.4 gibt es einen automatischen Radio-Reset. Nach 5 Sekunden erneut versuchen. Manche 5-GHz-Netzwerke werden nicht unterstützt (ESP32 = nur 2,4 GHz)." },
        { issue: "KI-Chat: „AI error 400\" oder Timeout", fix: "1) WLAN prüfen (Einstellungen → WLAN & Konto → Kontostatus — sollte „Verbunden\" zeigen). 2) Das Konto braucht KI-Tokens — Guthaben prüfen und aufladen im Panel, Tab AI. 3) Kürzere Aufgabe versuchen — Limit ~2000 Zeichen." },
        { issue: "Manche Tasten reagieren nicht", fix: "Einstellungen → Diagnose → Tastaturtest. Leuchtet die Taste beim Drücken — funktioniert sie einwandfrei (Problem liegt anderswo). Leuchtet sie nicht — physisches Problem (kalte Lötstelle, FFC-Kabel). Melde dich über das Formular." },
        { issue: "Notizen/Tests synchronisieren nicht", fix: "1) WLAN muss funktionieren. 2) Das Konto muss verknüpft sein (Einstellungen → WLAN & Konto → Kontostatus = „Verbunden\"). 3) Prüfe auf kalkmate.pl/panel, ob sie im Konto vorhanden sind. 4) Bei zu vielen Daten (>50 Tests oder insgesamt >160 KB) lädt der Rechner nicht alles herunter." },
        { issue: "MT3608-Boost-Wandler summt / Bildschirm hat Streifen", fix: "Das ist ein Hardware-Problem mit den keramischen (piezoelektrischen) Kondensatoren. Melde dich über das Formular — wir tauschen die Platine im Rahmen der Garantie aus." },
      ],
    },
    s8: {
      eyebrow: "08 · FAQ", title: "Häufig gestellte Fragen.", accent: "Fragen",
      faqs: [
        { q: "Wie schalte ich den Rechner ein / aus?", a: "Schiebe den Schalter an der Seite. Ausschalten löscht keine Notizen oder den Verlauf — alles bleibt im internen Speicher erhalten." },
        { q: "Wie lange hält der Akku?", a: "Gemischte Nutzung (einige Stunden KI + Rest im Sleep): ~2–3 Tage. Standby: 5–7 Tage. Volle Ladung: ~2 Stunden über USB-C." },
        { q: "Warum braucht der KI-Chat WLAN?", a: "Die Antworten selbst berechnet der Server (Gemini-Modell). Ohne WLAN funktionieren nur Taschenrechner, Notizen und Tests. Einrichtung: Einstellungen → WLAN & Konto → WLAN-Netz." },
        { q: "Was ist die Panic-Taste?", a: "Eine Taste (standardmäßig MU), die SOFORT von jedem Bildschirm zurück in den Taschenrechner-Modus wechselt. Praktisch, wenn jemand zuschaut. Änderbar unter Einstellungen → Sicherheit → Panik-Taste." },
        { q: "Wie füge ich Notizen / Tests hinzu?", a: "Nur über das Kundenpanel auf kalkmate.pl/panel. Der Rechner synchronisiert sie über WLAN (Notizen → Sync). Auf dem Gerät kannst du sie nur lesen, nicht bearbeiten." },
        { q: 'Was macht der „KI-Code"?', a: "Ein vierstelliger Code (Standard 1111), den du im Taschenrechner-Modus eingibst, um das KI-Menü freizuschalten. Ohne ihn sieht der Rechner aus wie ein gewöhnlicher Esperanza T8809-2." },
        { q: "Wie verknüpfe ich den Rechner mit meinem Konto?", a: "1) Erstelle ein Konto auf kalkmate.pl. 2) Aktiviere den Code aus der Verpackung im Tab AI — er fügt 2 Mio. Tokens hinzu (bei Online-Kauf automatisch zugewiesen). 3) Auf dem Rechner: Einstellungen → WLAN & Konto → Geräte-ID + QR — registriert sich beim Server. 4) Gib im Panel unter Rechner die Geräte-ID + den KI-Code ein." },
        { q: "Der Bildschirm flackert / zeigt weiße Streifen — was tun?", a: "Meist summt/instabil der 12V-Boost-Wandler (MT3608). Melde dich über das Formular — wir senden dir eine neue Platine. Abgedeckt durch die 24-Monats-Garantie." },
        { q: "Eine Taste funktioniert nicht — lässt sich das per Software beheben?", a: "Falls es ein Mapping-Problem ist (nach dem Nachlöten) — ja, wir haben ein keymap_scan-Tool, das die Tasten neu zuordnet. Melde dich über das Formular, wir senden dir die Datei." },
        { q: "Wie aktualisiere ich die Firmware?", a: "Einstellungen → System → Software-Update → OK. Der Rechner prüft den Server, fragt um Bestätigung, lädt herunter + flasht + startet neu. Der ganze Vorgang dauert ~1 Minute mit WLAN." },
        { q: "Ich habe mein Konto-Passwort vergessen", a: "Gehe zu kalkmate.pl/auth/forgot-password — wir senden einen Reset-Link an deine E-Mail (60 Minuten gültig)." },
        { q: "Kann ich den Rechner zurückgeben?", a: "Ja, innerhalb von 14 Tagen nach Lieferung ohne Angabe von Gründen (DSGVO + Verbraucherrecht). Schreib einfach eine E-Mail an kontakt@kalkmate.pl mit deiner Bestellnummer." },
      ],
    },
    s9: {
      eyebrow: "09 · Changelog", title: "Firmware-Verlauf.", accent: "Verlauf",
      intro: "Alle veröffentlichten Versionen. Update über Einstellungen → System → Software-Update.",
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
      errSend: "Nachricht konnte nicht gesendet werden", errNetwork: "Netzwerkfehler",
    },
    footerTagline: "KI-Taschenrechner",
    footerTerms: "AGB",
    footerPrivacy: "Datenschutzerklärung",
    footerCe: "CE-Konformitätserklärung",
  },

  // Kalkulator nie ma czeskiego UI (PL/EN/DE) — nazwy menu podajemy po
  // angielsku (tak jak je widzi czeski uzytkownik z jezykiem EN na urzadzeniu).
  cs: {
    metaTitle: "Nápověda a návod k obsluze — KalkMate",
    metaDesc:
      "Návod k obsluze kalkulačky KalkMate: první spuštění, nastavení WiFi, režim AI, řešení problémů a historie firmwaru.",
    navHome: "← Domů",
    navPanel: "Panel",
    heroEyebrow: "[ nápověda ] · v3.0",
    heroTitleLine1: "Nápověda &",
    heroTitleAccent: "dokumentace",
    heroDesc: (v) =>
      `Vše, co potřebuješ na začátek: návod, videa, FAQ a kontakt na nás. Obsah aktualizován pro firmware v${v}.`,
    sections: [
      { id: "start", label: "01 · První spuštění" },
      { id: "klawiatura", label: "02 · Ovládání klávesnicí" },
      { id: "ai", label: "03 · Režim AI" },
      { id: "notatki", label: "04 · Poznámky a testy" },
      { id: "bateria", label: "05 · Baterie a nabíjení" },
      { id: "ota", label: "06 · Aktualizace (OTA)" },
      { id: "problemy", label: "07 · Řešení problémů" },
      { id: "faq", label: "08 · FAQ" },
      { id: "changelog", label: "09 · Changelog firmwaru" },
      { id: "kontakt", label: "10 · Kontakt" },
    ],
    s1: {
      eyebrow: "01 · Start", title: "První spuštění.", accent: "spuštění",
      videoLabel: "Video: první spuštění",
      steps: [
        { title: "Nabij ji", body: "Připoj přiložený kabel USB-C ke kalkulačce a k nabíječce ≥5V/1A. Plné nabití trvá ~2 h. LED na desce během nabíjení svítí." },
        { title: "Zapni ji", body: "Posuň přepínač na boku do polohy ON. Asi po 2 s uvidíš úvodní obrazovku KalkMate a potom **obrazovku kalkulačky** (digitální displej)." },
        { title: "Otevři menu AI", body: "Na klávesnici kalkulačky zadej **odemykací kód** (výchozí `1111`) — jen číslice, bez operátorů mezi nimi. Displej na chvíli ukáže „AI\" a otevře hlavní menu. Teprve teď jsou dostupná Nastaveni a další funkce." },
        { title: "Nastav WiFi", body: "Nastaveni → WiFi a ucet → Sit WiFi → vyber síť ze seznamu → zadej heslo (klávesnice na displeji). Nutné pro AI, synchronizaci poznámek a OTA aktualizace." },
        { title: "Spáruj účet", body: "Založ si účet na kalkmate.pl (potvrď e-mail). Na kalkulačce: Nastaveni → WiFi a ucet → ID zarizeni + QR — zaregistruje se na serveru a zobrazí QR kód ke skenování. Spárování potvrď v panelu kalkmate.pl. Bez toho kalkulačka běží v offline režimu." },
      ],
    },
    s2: {
      eyebrow: "02 · Klávesnice", title: "Ovládání klávesami.", accent: "klávesami",
      intro: "Klávesnice má 27 kláves v rozložení 5×6. V menu a nastavení se pohybuješ **numerickou klávesnicí**:",
      note: "V **režimu kalkulačky** fungují číslice a operátory normálně (5 = pětka, 4 = čtyřka atd.). Jako navigace slouží numerická klávesnice jen v menu a nastavení.",
      videoLabel: "Ovládání AI klávesnice na displeji",
      legend: { nav: "NAVIGACE", panic: "PANIC", standard: "STANDARD" },
      keyRows: [
        { key: "8", desc: "Nahoru" },
        { key: "2", desc: "Dolů" },
        { key: "4", desc: "Doleva" },
        { key: "6", desc: "Doprava" },
        { key: "5", desc: "OK / Potvrdit", accent: true },
        { key: "C/CE", desc: "Zpět / Zrušit" },
        { key: "MU", desc: "PANIC — okamžitý návrat do kalkulačky", accent: true },
        { key: "▶", desc: "V režimu kalkulačky: backspace" },
      ],
    },
    s3: {
      eyebrow: "03 · Režim AI", title: "Řešení úloh.", accent: "úloh",
      intro: "KalkMate pošle tvou úlohu AI (model Gemini přes náš server) a vrátí řešení krok za krokem. Funguje pro **matematiku, fyziku, chemii a biologii**.",
      steps: [
        { title: "Zadej AI kód", body: "V režimu kalkulačky zadej 4 číslice (výchozí `1111`) bez jakékoli operace mezi nimi. Otevře se menu AI." },
        { title: "Vyber režim", body: "**[1] Foto kamerou** — namiř kameru na úlohu. Živý náhled na displeji (ukazatel ostrosti vpravo), stiskni `5 (OK)` a fotka se pošle AI.\n\n**[2] Zadat text** — QWERTY klávesnice na displeji: 8/4/6/2 = navigace, 5 = vybrat znak, potvrď tlačítkem OK (max. 2000 znaků).\n\n**[3] Historie** — procházej předchozí řešení (offline). Tlačítko → (doprava) otevře otázku k úpravě a novému odeslání AI." },
        { title: "Podrobnost řešení", body: "V Nastaveni → Reseni uloh → Rezim reseni zvol:", list: ["**Podrobny** — krok za krokem s vysvětlením", "**Jen vypocet** — jen vzorce + kroky", "**Vysledek** — pouze konečná odpověď"] },
        { title: "Čtení odpovědi", body: "Šipkami 8 / 2 (nahoru/dolů) posouváš dlouhé odpovědi. C/CE vrací do menu. Každá odpověď se automaticky uloží do historie." },
      ],
    },
    s4: {
      eyebrow: "04 · Paměť", title: "Poznámky a testy.", accent: "testy",
      intro: "KalkMate uloží až **50 poznámek (60 KB)** a **50 testů (160 KB)** offline — přečteš si je i bez WiFi. Upravuješ je na kalkmate.pl/panel.",
      steps: [
        { title: "Přidej je na webu", body: "Jdi na kalkmate.pl/panel → záložka Poznámky / Testy → přidej obsah (až 4000 znaků u poznámky, 30 000 u testu). Podporuje LaTeX i markdown." },
        { title: "Synchronizace do kalkulačky", body: "Na kalkulačce: Poznamky → klikni na šipku dolů (v = sync). Vyžaduje WiFi. Stáhne vše z tvého účtu." },
        { title: "Čti offline", body: "Po synchronizaci jsou uložené ve flash paměti kalkulačky — čteš je kdekoli. LaTeX se na OLED displeji automaticky převádí na ASCII (∞ jako bitmapa, zlomky jako `(a)/(b)` atd.)." },
      ],
    },
    s5: {
      eyebrow: "05 · Baterie", title: "Nabíjení a baterie.", accent: "Nabíjení",
      note: "Nejvíc energie spotřebuje **OLED na 12V** (měnič MT3608). Zkrať automatický spánek na 1–2 minuty a výdrž se prodlouží 2–3×. Nastaveni → Displej → Uspani.",
      body: "**Nabíjení**: USB-C (PD není potřeba, stačí libovolná nabíječka ≥5V/1A). LED na desce při nabíjení svítí a při 100 % zhasne. Baterie je chráněna proti přebití (MCP73831 + DW01A).",
      stats: [
        { val: "1500", unit: "mAh", label: "Kapacita (LiPo)" },
        { val: "~2", unit: "h", label: "Plné nabití" },
        { val: "2–3", unit: "dny", label: "Běžné použití" },
        { val: "5–7", unit: "dní", label: "Pohotovostní režim" },
      ],
    },
    s6: {
      eyebrow: "06 · Aktualizace", title: "OTA — aktualizace firmwaru.", accent: "aktualizace",
      step1Title: "Zkontroluj dostupnost",
      step1: (v) => `Nastaveni → System → Aktualizace → OK. Kalkulačka se zeptá serveru, jestli existuje novější verze než tvoje aktuální (zobrazená jako \`v${v}\` apod.).`,
      step2Title: "Nainstaluj",
      step2: "Pokud je nová — ukáže seznam změn + tlačítko `OK = instalovat`. Stáhne (~1 MB), nahraje do OTA oddílu a restartuje. Trvá ~1 minutu. Během aktualizace neodpojuj napájení.",
      note: "Aktualizace jsou **zdarma** a dobrovolné. Starý firmware bude dál fungovat, ale nové funkce (např. lepší LaTeX) aktualizaci vyžadují.",
      versionLabel: "/ AKTUÁLNÍ VERZE NA SERVERU:",
      versionHint: "Svou verzi zjistíš v Nastaveni → System → Aktualizace (nebo Nastaveni → Informace → O zarizeni).",
    },
    s7: {
      eyebrow: "07 · Problémy", title: "Řešení běžných problémů.", accent: "problémů",
      problems: [
        { issue: "Displej se nezapne / zůstává černý", fix: "1) Zkontroluj přepínač (má být v poloze ON). 2) Nabíjej 30+ minut — baterie může být úplně vybitá. 3) Pokud LED nabíjení po připojení USB-C nesvítí — je poškozený kabel/port." },
        { issue: "WiFi nenachází sítě / prázdný seznam", fix: "Nastaveni → WiFi a ucet → Sit WiFi → OK Hledat. Pokud je prázdný — od v0.6.4 jsme přidali automatický reset rádia. Zkus to znovu po 5 sekundách. Sítě 5 GHz nejsou podporovány (ESP32 = jen 2,4 GHz)." },
        { issue: "AI Chat: 'AI error 400' nebo timeout", fix: "1) Zkontroluj WiFi (Nastaveni → WiFi a ucet → Stav uctu — má ukazovat 'Stav: PROPOJENO'). 2) Účet musí mít AI tokeny — zůstatek zkontroluješ a dobiješ v panelu, v záložce AI. 3) Zkus kratší úlohu — limit je ~2000 znaků." },
        { issue: "Některé klávesy nereagují", fix: "Nastaveni → Diagnostika → Test klavesnice. Pokud se klávesa při stisku rozsvítí — funguje (problém je jinde). Pokud ne — jde o fyzickou závadu (studený spoj, kabel FFC). Napiš nám přes formulář." },
        { issue: "Poznámky/testy se nesynchronizují", fix: "1) WiFi musí fungovat. 2) Účet musí být spárovaný (Nastaveni → WiFi a ucet → Stav uctu = 'Stav: PROPOJENO'). 3) Na kalkmate.pl/panel zkontroluj, že je máš v účtu. 4) Pokud je dat moc (>50 testů nebo celkem >160 KB) — kalkulačka nestáhne vše." },
        { issue: "Měnič MT3608 bzučí / displej má pruhy", fix: "Jde o hardwarový problém s keramickými (piezoelektrickými) kondenzátory. Ozvi se přes formulář — v rámci záruky desku vyměníme." },
      ],
    },
    s8: {
      eyebrow: "08 · FAQ", title: "Časté dotazy.", accent: "dotazy",
      faqs: [
        { q: "Jak kalkulačku zapnout / vypnout?", a: "Posuň přepínač na boku. Vypnutí nesmaže poznámky ani historii — vše je uložené ve vnitřní paměti." },
        { q: "Jak dlouho vydrží baterie?", a: "Smíšené použití (pár hodin AI + zbytek ve spánku): ~2–3 dny. Pohotovostní režim: 5–7 dní. Plné nabití: ~2 hodiny přes USB-C." },
        { q: "Proč AI Chat potřebuje WiFi?", a: "Samotné odpovědi počítá server (model Gemini). Bez WiFi funguje jen kalkulačka, poznámky a testy. Nastavení: Nastaveni → WiFi a ucet → Sit WiFi." },
        { q: "Co je klávesa Panic?", a: "Klávesa (výchozí MU), která z libovolné obrazovky OKAMŽITĚ přepne zpět do režimu kalkulačky. Hodí se, když se někdo dívá. Změníš ji v Nastaveni → Zabezpeceni → Panik klavesa." },
        { q: "Jak přidám poznámky / testy?", a: "Pouze přes zákaznický panel na kalkmate.pl/panel. Kalkulačka je synchronizuje přes WiFi (Poznamky → v = sync). Na zařízení je jen čteš, neupravuješ." },
        { q: "K čemu je „AI kód\"?", a: "Čtyřmístný kód (výchozí 1111), který zadáš v režimu kalkulačky a odemkneš tím menu AI. Bez něj kalkulačka vypadá jako obyčejná Esperanza T8809-2." },
        { q: "Jak spáruji kalkulačku s účtem?", a: "1) Založ si účet na kalkmate.pl. 2) V záložce AI aktivuj kód z krabičky — přidá 2 mil. tokenů (při nákupu online je přiřazen automaticky). 3) Na kalkulačce: Nastaveni → WiFi a ucet → ID zarizeni + QR — zaregistruje se na serveru. 4) V panelu v sekci Kalkulačka zadej Device ID + AI kód." },
        { q: "Displej bliká / ukazuje bílé pruhy — co dělat?", a: "Nejčastěji bzučí/je nestabilní 12V měnič (MT3608). Ozvi se přes formulář — pošleme ti novou desku. Kryje to záruka 24 měsíců." },
        { q: "Klávesa nefunguje — dá se to opravit softwarem?", a: "Pokud jde o problém s mapováním (po přepájení) — ano, máme nástroj keymap_scan, který klávesy přemapuje. Napiš přes formulář a pošleme ti soubor." },
        { q: "Jak aktualizovat firmware?", a: "Nastaveni → System → Aktualizace → OK. Kalkulačka zkontroluje server, zeptá se na souhlas, stáhne + nahraje + restartuje. Celý proces trvá s WiFi ~1 minutu." },
        { q: "Zapomněl(a) jsem heslo k účtu", a: "Jdi na kalkmate.pl/auth/forgot-password — pošleme ti odkaz pro obnovení hesla na zadaný e-mail (platí 60 minut)." },
        { q: "Můžu kalkulačku vrátit?", a: "Ano, do 14 dnů od doručení bez udání důvodu (podle spotřebitelského práva EU). Stačí e-mail na kontakt@kalkmate.pl s číslem objednávky. Výjimkou jsou kusy personalizované na tvé přání (vlastní AI kód + jméno na štítku)." },
      ],
    },
    s9: {
      eyebrow: "09 · Changelog", title: "Historie firmwaru.", accent: "firmwaru",
      intro: "Všechny vydané verze. Aktualizace přes Nastaveni → System → Aktualizace.",
    },
    s10: {
      eyebrow: "10 · Kontakt", title: "Napiš nám.", accent: "nám",
      intro: "Odpovídám do 24 hodin (obvykle rychleji). Můžeš psát i přímo na kontakt@kalkmate.pl — klidně anglicky.",
      sentTitle: "/ ODESLÁNO",
      sentBody: "Díky za zprávu. Ozvu se co nejdřív na zadaný e-mail.",
      sentAgain: "Poslat další →",
      labelName: "Jméno", labelEmail: "E-mail", labelSubject: "Předmět", labelSubjectOptional: "nepovinné", labelMessage: "Zpráva",
      placeholderName: "Jan Novák", placeholderEmail: "tvuj@email.cz", placeholderSubject: "např. Problém s WiFi", placeholderMessage: "Popiš problém nebo polož otázku...",
      errorLabel: "/ CHYBA", sending: "Odesílám...", send: "Odeslat zprávu",
      errSend: "Zprávu se nepodařilo odeslat", errNetwork: "Chyba sítě",
    },
    footerTagline: "Kalkulačka s AI",
    footerTerms: "Obchodní podmínky",
    footerPrivacy: "Zásady ochrany osobních údajů",
    footerCe: "EU prohlášení o shodě (CE)",
  },

  sk: {
    metaTitle: "Pomoc a návod na obsluhu — KalkMate",
    metaDesc:
      "Návod na obsluhu kalkulačky KalkMate: prvé spustenie, nastavenie WiFi, režim AI, riešenie problémov a história firmvéru.",
    navHome: "← Domov",
    navPanel: "Panel",
    heroEyebrow: "[ pomoc ] · v3.0",
    heroTitleLine1: "Pomoc &",
    heroTitleAccent: "dokumentácia",
    heroDesc: (v) =>
      `Všetko, čo potrebuješ na začiatok: návod, videá, FAQ a kontakt na nás. Obsah aktualizovaný pre firmvér v${v}.`,
    sections: [
      { id: "start", label: "01 · Prvé spustenie" },
      { id: "klawiatura", label: "02 · Ovládanie klávesnicou" },
      { id: "ai", label: "03 · Režim AI" },
      { id: "notatki", label: "04 · Poznámky a testy" },
      { id: "bateria", label: "05 · Batéria a nabíjanie" },
      { id: "ota", label: "06 · Aktualizácie (OTA)" },
      { id: "problemy", label: "07 · Riešenie problémov" },
      { id: "faq", label: "08 · FAQ" },
      { id: "changelog", label: "09 · Changelog firmvéru" },
      { id: "kontakt", label: "10 · Kontakt" },
    ],
    s1: {
      eyebrow: "01 · Štart", title: "Prvé spustenie.", accent: "spustenie",
      videoLabel: "Video: prvé spustenie",
      steps: [
        { title: "Nabi ju", body: "Pripoj priložený kábel USB-C ku kalkulačke a k nabíjačke ≥5V/1A. Úplné nabitie trvá ~2 h. LED na doske počas nabíjania svieti." },
        { title: "Zapni ju", body: "Posuň prepínač na boku do polohy ON. Asi po 2 s uvidíš úvodnú obrazovku KalkMate a potom **obrazovku kalkulačky** (digitálny displej)." },
        { title: "Otvor menu AI", body: "Na klávesnici kalkulačky zadaj **odomykací kód** (predvolený `1111`) — len číslice, bez operátorov medzi nimi. Displej na chvíľu ukáže „AI\" a otvorí hlavné menu. Až teraz sú dostupné Nastavenia a ďalšie funkcie." },
        { title: "Nastav WiFi", body: "Nastavenia → WiFi a ucet → Siet WiFi → vyber sieť zo zoznamu → zadaj heslo (klávesnica na displeji). Potrebné pre AI, synchronizáciu poznámok a OTA aktualizácie." },
        { title: "Spáruj účet", body: "Založ si účet na kalkmate.pl (potvrď e-mail). Na kalkulačke: Nastavenia → WiFi a ucet → ID zariad. + QR — zaregistruje sa na serveri a zobrazí QR kód na naskenovanie. Spárovanie potvrď v paneli kalkmate.pl. Bez toho kalkulačka beží v offline režime." },
      ],
    },
    s2: {
      eyebrow: "02 · Klávesnica", title: "Ovládanie klávesmi.", accent: "klávesmi",
      intro: "Klávesnica má 27 klávesov v rozložení 5×6. V menu a nastaveniach sa pohybuješ **numerickou klávesnicou**:",
      note: "V **režime kalkulačky** fungujú číslice a operátory normálne (5 = päť, 4 = štyri atď.). Ako navigácia slúži numerická klávesnica len v menu a nastaveniach.",
      videoLabel: "Ovládanie AI klávesnice na displeji",
      legend: { nav: "NAVIGÁCIA", panic: "PANIC", standard: "ŠTANDARD" },
      keyRows: [
        { key: "8", desc: "Hore" },
        { key: "2", desc: "Dole" },
        { key: "4", desc: "Doľava" },
        { key: "6", desc: "Doprava" },
        { key: "5", desc: "OK / Potvrdiť", accent: true },
        { key: "C/CE", desc: "Späť / Zrušiť" },
        { key: "MU", desc: "PANIC — okamžitý návrat do kalkulačky", accent: true },
        { key: "▶", desc: "V režime kalkulačky: backspace" },
      ],
    },
    s3: {
      eyebrow: "03 · Režim AI", title: "Riešenie úloh.", accent: "úloh",
      intro: "KalkMate pošle tvoju úlohu AI (model Gemini cez náš server) a vráti riešenie krok za krokom. Funguje pre **matematiku, fyziku, chémiu a biológiu**.",
      steps: [
        { title: "Zadaj AI kód", body: "V režime kalkulačky zadaj 4 číslice (predvolený `1111`) bez akejkoľvek operácie medzi nimi. Otvorí sa menu AI." },
        { title: "Vyber režim", body: "**[1] Foto kamerou** — namier kameru na úlohu. Živý náhľad na displeji (ukazovateľ ostrosti vpravo), stlač `5 (OK)` a fotka sa pošle AI.\n\n**[2] Zadat text** — QWERTY klávesnica na displeji: 8/4/6/2 = navigácia, 5 = vybrať znak, potvrď tlačidlom OK (max. 2000 znakov).\n\n**[3] Historia** — prezeraj predchádzajúce riešenia (offline). Tlačidlo → (doprava) otvorí otázku na úpravu a nové odoslanie AI." },
        { title: "Podrobnosť riešenia", body: "V Nastavenia → Riesenie uloh → Rezim riesenia zvoľ:", list: ["**Podrobny** — krok za krokom s vysvetlením", "**Len vypocet** — len vzorce + kroky", "**Vysledok** — iba konečná odpoveď"] },
        { title: "Čítanie odpovede", body: "Šípkami 8 / 2 (hore/dole) posúvaš dlhé odpovede. C/CE vracia do menu. Každá odpoveď sa automaticky uloží do histórie." },
      ],
    },
    s4: {
      eyebrow: "04 · Pamäť", title: "Poznámky a testy.", accent: "testy",
      intro: "KalkMate uloží až **50 poznámok (60 KB)** a **50 testov (160 KB)** offline — prečítaš si ich aj bez WiFi. Upravuješ ich na kalkmate.pl/panel.",
      steps: [
        { title: "Pridaj ich na webe", body: "Choď na kalkmate.pl/panel → záložka Poznámky / Testy → pridaj obsah (až 4000 znakov pri poznámke, 30 000 pri teste). Podporuje LaTeX aj markdown." },
        { title: "Synchronizácia do kalkulačky", body: "Na kalkulačke: Poznamky → klikni na šípku dole (v = sync). Vyžaduje WiFi. Stiahne všetko z tvojho účtu." },
        { title: "Čítaj offline", body: "Po synchronizácii sú uložené vo flash pamäti kalkulačky — čítaš ich kdekoľvek. LaTeX sa na OLED displeji automaticky prevádza na ASCII (∞ ako bitmapa, zlomky ako `(a)/(b)` atď.)." },
      ],
    },
    s5: {
      eyebrow: "05 · Batéria", title: "Nabíjanie a batéria.", accent: "Nabíjanie",
      note: "Najviac energie spotrebuje **OLED na 12V** (menič MT3608). Skráť automatický spánok na 1–2 minúty a výdrž sa predĺži 2–3×. Nastavenia → Displej → Uspanie.",
      body: "**Nabíjanie**: USB-C (PD nie je potrebné, stačí ľubovoľná nabíjačka ≥5V/1A). LED na doske pri nabíjaní svieti a pri 100 % zhasne. Batéria je chránená proti prebitiu (MCP73831 + DW01A).",
      stats: [
        { val: "1500", unit: "mAh", label: "Kapacita (LiPo)" },
        { val: "~2", unit: "h", label: "Úplné nabitie" },
        { val: "2–3", unit: "dni", label: "Bežné používanie" },
        { val: "5–7", unit: "dní", label: "Pohotovostný režim" },
      ],
    },
    s6: {
      eyebrow: "06 · Aktualizácie", title: "OTA — aktualizácie firmvéru.", accent: "aktualizácie",
      step1Title: "Skontroluj dostupnosť",
      step1: (v) => `Nastavenia → System → Aktualizacia → OK. Kalkulačka sa opýta servera, či existuje novšia verzia ako tvoja aktuálna (zobrazená ako \`v${v}\` a pod.).`,
      step2Title: "Nainštaluj",
      step2: "Ak je nová — ukáže zoznam zmien + tlačidlo `OK = instalovat`. Stiahne (~1 MB), nahrá do OTA oddielu a reštartuje. Trvá ~1 minútu. Počas aktualizácie neodpájaj napájanie.",
      note: "Aktualizácie sú **zadarmo** a dobrovoľné. Starý firmvér bude ďalej fungovať, ale nové funkcie (napr. lepší LaTeX) aktualizáciu vyžadujú.",
      versionLabel: "/ AKTUÁLNA VERZIA NA SERVERI:",
      versionHint: "Svoju verziu zistíš v Nastavenia → System → Aktualizacia (alebo Nastavenia → Informacie → O zariadeni).",
    },
    s7: {
      eyebrow: "07 · Problémy", title: "Riešenie bežných problémov.", accent: "problémov",
      problems: [
        { issue: "Displej sa nezapne / zostáva čierny", fix: "1) Skontroluj prepínač (má byť v polohe ON). 2) Nabíjaj 30+ minút — batéria môže byť úplne vybitá. 3) Ak LED nabíjania po pripojení USB-C nesvieti — je poškodený kábel/port." },
        { issue: "WiFi nenachádza siete / prázdny zoznam", fix: "Nastavenia → WiFi a ucet → Siet WiFi → OK Hladat. Ak je prázdny — od v0.6.4 sme pridali automatický reset rádia. Skús to znova po 5 sekundách. Siete 5 GHz nie sú podporované (ESP32 = len 2,4 GHz)." },
        { issue: "AI Chat: 'AI error 400' alebo timeout", fix: "1) Skontroluj WiFi (Nastavenia → WiFi a ucet → Stav uctu — má ukazovať 'Stav: PREPOJENE'). 2) Účet musí mať AI tokeny — zostatok skontroluješ a dobiješ v paneli, v záložke AI. 3) Skús kratšiu úlohu — limit je ~2000 znakov." },
        { issue: "Niektoré klávesy nereagujú", fix: "Nastavenia → Diagnostika → Test klavesnice. Ak sa kláves pri stlačení rozsvieti — funguje (problém je inde). Ak nie — ide o fyzickú chybu (studený spoj, kábel FFC). Napíš nám cez formulár." },
        { issue: "Poznámky/testy sa nesynchronizujú", fix: "1) WiFi musí fungovať. 2) Účet musí byť spárovaný (Nastavenia → WiFi a ucet → Stav uctu = 'Stav: PREPOJENE'). 3) Na kalkmate.pl/panel skontroluj, či ich máš v účte. 4) Ak je dát priveľa (>50 testov alebo spolu >160 KB) — kalkulačka nestiahne všetko." },
        { issue: "Menič MT3608 bzučí / displej má pruhy", fix: "Ide o hardvérový problém s keramickými (piezoelektrickými) kondenzátormi. Ozvi sa cez formulár — v rámci záruky dosku vymeníme." },
      ],
    },
    s8: {
      eyebrow: "08 · FAQ", title: "Časté otázky.", accent: "otázky",
      faqs: [
        { q: "Ako kalkulačku zapnúť / vypnúť?", a: "Posuň prepínač na boku. Vypnutie nezmaže poznámky ani históriu — všetko je uložené vo vnútornej pamäti." },
        { q: "Ako dlho vydrží batéria?", a: "Zmiešané používanie (pár hodín AI + zvyšok v spánku): ~2–3 dni. Pohotovostný režim: 5–7 dní. Úplné nabitie: ~2 hodiny cez USB-C." },
        { q: "Prečo AI Chat potrebuje WiFi?", a: "Samotné odpovede počíta server (model Gemini). Bez WiFi funguje len kalkulačka, poznámky a testy. Nastavenie: Nastavenia → WiFi a ucet → Siet WiFi." },
        { q: "Čo je kláves Panic?", a: "Kláves (predvolene MU), ktorý z ľubovoľnej obrazovky OKAMŽITE prepne späť do režimu kalkulačky. Hodí sa, keď sa niekto pozerá. Zmeníš ho v Nastavenia → Zabezpecenie → Panic klaves." },
        { q: "Ako pridám poznámky / testy?", a: "Iba cez zákaznícky panel na kalkmate.pl/panel. Kalkulačka ich synchronizuje cez WiFi (Poznamky → v = sync). Na zariadení ich len čítaš, neupravuješ." },
        { q: "Na čo je „AI kód\"?", a: "Štvormiestny kód (predvolený 1111), ktorý zadáš v režime kalkulačky a odomkneš tým menu AI. Bez neho kalkulačka vyzerá ako obyčajná Esperanza T8809-2." },
        { q: "Ako spárujem kalkulačku s účtom?", a: "1) Založ si účet na kalkmate.pl. 2) V záložke AI aktivuj kód z krabičky — pridá 2 mil. tokenov (pri nákupe online je priradený automaticky). 3) Na kalkulačke: Nastavenia → WiFi a ucet → ID zariad. + QR — zaregistruje sa na serveri. 4) V paneli v sekcii Kalkulačka zadaj Device ID + AI kód." },
        { q: "Displej bliká / ukazuje biele pruhy — čo robiť?", a: "Najčastejšie bzučí/je nestabilný 12V menič (MT3608). Ozvi sa cez formulár — pošleme ti novú dosku. Kryje to záruka 24 mesiacov." },
        { q: "Kláves nefunguje — dá sa to opraviť softvérom?", a: "Ak ide o problém s mapovaním (po prespájkovaní) — áno, máme nástroj keymap_scan, ktorý klávesy premapuje. Napíš cez formulár a pošleme ti súbor." },
        { q: "Ako aktualizovať firmvér?", a: "Nastavenia → System → Aktualizacia → OK. Kalkulačka skontroluje server, opýta sa na súhlas, stiahne + nahrá + reštartuje. Celý proces trvá s WiFi ~1 minútu." },
        { q: "Zabudol(a) som heslo k účtu", a: "Choď na kalkmate.pl/auth/forgot-password — pošleme ti odkaz na obnovenie hesla na zadaný e-mail (platí 60 minút)." },
        { q: "Môžem kalkulačku vrátiť?", a: "Áno, do 14 dní od doručenia bez udania dôvodu (podľa spotrebiteľského práva EÚ). Stačí e-mail na kontakt@kalkmate.pl s číslom objednávky. Výnimkou sú kusy personalizované na tvoje želanie (vlastný AI kód + meno na štítku)." },
      ],
    },
    s9: {
      eyebrow: "09 · Changelog", title: "História firmvéru.", accent: "firmvéru",
      intro: "Všetky vydané verzie. Aktualizácia cez Nastavenia → System → Aktualizacia.",
    },
    s10: {
      eyebrow: "10 · Kontakt", title: "Napíš nám.", accent: "nám",
      intro: "Odpovedám do 24 hodín (zvyčajne rýchlejšie). Môžeš písať aj priamo na kontakt@kalkmate.pl — pokojne aj po anglicky.",
      sentTitle: "/ ODOSLANÉ",
      sentBody: "Vďaka za správu. Ozvem sa čo najskôr na zadaný e-mail.",
      sentAgain: "Poslať ďalšiu →",
      labelName: "Meno", labelEmail: "E-mail", labelSubject: "Predmet", labelSubjectOptional: "nepovinné", labelMessage: "Správa",
      placeholderName: "Ján Novák", placeholderEmail: "tvoj@email.sk", placeholderSubject: "napr. Problém s WiFi", placeholderMessage: "Popíš problém alebo polož otázku...",
      errorLabel: "/ CHYBA", sending: "Odosielam...", send: "Odoslať správu",
      errSend: "Správu sa nepodarilo odoslať", errNetwork: "Chyba siete",
    },
    footerTagline: "Kalkulačka s AI",
    footerTerms: "Obchodné podmienky",
    footerPrivacy: "Zásady ochrany osobných údajov",
    footerCe: "EÚ vyhlásenie o zhode (CE)",
  },

  lt: {
    metaTitle: "Pagalba ir naudojimo instrukcija — KalkMate",
    metaDesc:
      "KalkMate skaičiuotuvo naudojimo instrukcija: pirmasis paleidimas, WiFi nustatymas, DI režimas, problemų sprendimas ir programinės įrangos istorija.",
    navHome: "← Pradžia",
    navPanel: "Panel",
    heroEyebrow: "[ pagalba ] · v3.0",
    heroTitleLine1: "Pagalba &",
    heroTitleAccent: "dokumentacija",
    heroDesc: (v) =>
      `Viskas, ko reikia pradžiai: instrukcija, vaizdo įrašai, DUK ir kontaktai. Turinys atnaujintas programinei įrangai v${v}.`,
    sections: [
      { id: "start", label: "01 · Pirmasis paleidimas" },
      { id: "klawiatura", label: "02 · Valdymas klaviatūra" },
      { id: "ai", label: "03 · DI režimas" },
      { id: "notatki", label: "04 · Užrašai ir testai" },
      { id: "bateria", label: "05 · Baterija ir įkrovimas" },
      { id: "ota", label: "06 · Atnaujinimai (OTA)" },
      { id: "problemy", label: "07 · Problemų sprendimas" },
      { id: "faq", label: "08 · DUK" },
      { id: "changelog", label: "09 · Programinės įrangos pakeitimai" },
      { id: "kontakt", label: "10 · Kontaktai" },
    ],
    s1: {
      eyebrow: "01 · Pradžia", title: "Pirmasis paleidimas.", accent: "paleidimas",
      videoLabel: "Vaizdo įrašas: pirmasis paleidimas",
      steps: [
        { title: "Įkraukite", body: "Prijunkite pridėtą USB-C laidą prie skaičiuotuvo ir ≥5V/1A įkroviklio. Visiškas įkrovimas trunka ~2 val. Įkraunant šviečia plokštės šviesos diodas." },
        { title: "Įjunkite", body: "Pastumkite šoninį jungiklį į padėtį ON. Po ~2 s pamatysite KalkMate pradžios ekraną, o tada **skaičiuotuvo ekraną** (skaitmeninį ekraną)." },
        { title: "Atidarykite DI meniu", body: "Skaičiuotuvo klaviatūra įveskite **atrakinimo kodą** (numatytasis `1111`) — tik skaitmenis, be veiksmų ženklų tarp jų. Ekrane trumpam pasirodys „AI\" ir atsidarys pagrindinis meniu. Tik dabar pasiekiami Nustatymai ir kitos funkcijos." },
        { title: "Nustatykite WiFi", body: "Nustatymai → WiFi ir paskyra → WiFi tinklas → pasirinkite tinklą iš sąrašo → įveskite slaptažodį (ekraninė klaviatūra). Reikalinga DI, užrašų sinchronizacijai ir OTA atnaujinimams." },
        { title: "Susiekite paskyrą", body: "Susikurkite paskyrą kalkmate.pl (patvirtinkite el. paštą). Skaičiuotuve: Nustatymai → WiFi ir paskyra → Irenginio ID + QR — jis užsiregistruos serveryje ir parodys QR kodą nuskaitymui. Susiejimą patvirtinkite kalkmate.pl panelėje. Be to skaičiuotuvas veikia neprisijungus." },
      ],
    },
    s2: {
      eyebrow: "02 · Klaviatūra", title: "Valdymas klavišais.", accent: "klavišais",
      intro: "Klaviatūra turi 27 klavišus, išdėstytus 5×6. Meniu ir nustatymuose judate **skaičių klaviatūra**:",
      note: "**Skaičiuotuvo režime** skaitmenų ir veiksmų klavišai veikia įprastai (5 = penki, 4 = keturi ir t. t.). Skaičių klaviatūra kaip navigacija veikia tik meniu ir nustatymuose.",
      videoLabel: "DI ekraninės klaviatūros valdymas",
      legend: { nav: "NAVIGACIJA", panic: "PANIC", standard: "STANDARTINIAI" },
      keyRows: [
        { key: "8", desc: "Aukštyn" },
        { key: "2", desc: "Žemyn" },
        { key: "4", desc: "Kairėn" },
        { key: "6", desc: "Dešinėn" },
        { key: "5", desc: "OK / Patvirtinti", accent: true },
        { key: "C/CE", desc: "Atgal / Atšaukti" },
        { key: "MU", desc: "PANIC — akimirksniu grįžta į skaičiuotuvo režimą", accent: true },
        { key: "▶", desc: "Skaičiuotuvo režime: trynimas (backspace)" },
      ],
    },
    s3: {
      eyebrow: "03 · DI režimas", title: "Uždavinių sprendimas.", accent: "sprendimas",
      intro: "KalkMate nusiunčia jūsų uždavinį DI (Gemini modeliui per mūsų serverį) ir grąžina sprendimą žingsnis po žingsnio. Veikia **matematikai, fizikai, chemijai ir biologijai**.",
      steps: [
        { title: "Įveskite DI kodą", body: "Skaičiuotuvo režime įveskite 4 skaitmenis (numatytasis `1111`) be jokio veiksmo tarp jų. Atsidarys DI meniu." },
        { title: "Pasirinkite režimą", body: "**[1] Kameros foto** — nukreipkite kamerą į uždavinį. Tiesioginė peržiūra ekrane (ryškumo indikatorius dešinėje), paspauskite `5 (OK)`, kad nufotografuotumėte ir nusiųstumėte DI.\n\n**[2] Ivesti teksta** — ekraninė QWERTY klaviatūra: 8/4/6/2 = navigacija, 5 = pasirinkti simbolį, patvirtinkite mygtuku OK (daugiausia 2000 simbolių).\n\n**[3] Istorija** — peržiūrėkite ankstesnius sprendimus (neprisijungus). Mygtukas → (dešinėn) atidaro klausimą redaguoti ir iš naujo nusiųsti DI." },
        { title: "Sprendimo išsamumas", body: "Nustatymai → Sprendimas → Sprend. rezimas pasirinkite:", list: ["**Detalus** — žingsnis po žingsnio su paaiškinimais", "**Tik skaic.** — tik formulės ir žingsniai", "**Rezultatas** — tik galutinis atsakymas"] },
        { title: "Atsakymo skaitymas", body: "Klavišais 8 / 2 (aukštyn/žemyn) slenkate ilgus atsakymus. C/CE grąžina į meniu. Kiekvienas atsakymas automatiškai išsaugomas istorijoje." },
      ],
    },
    s4: {
      eyebrow: "04 · Atmintis", title: "Užrašai ir testai.", accent: "testai",
      intro: "KalkMate saugo iki **50 užrašų (60 KB)** ir **50 testų (160 KB)** neprisijungus — galite juos skaityti net be WiFi. Redaguojate kalkmate.pl/panel.",
      steps: [
        { title: "Pridėkite svetainėje", body: "Eikite į kalkmate.pl/panel → skirtukas Užrašai / Testai → pridėkite turinį (iki 4000 simbolių užrašui, 30 000 testui). Palaikomi LaTeX ir markdown." },
        { title: "Sinchronizacija su skaičiuotuvu", body: "Skaičiuotuve: Pastabos → spustelėkite rodyklę žemyn (v = sync). Reikia WiFi. Atsisiunčia viską iš jūsų paskyros." },
        { title: "Skaitykite neprisijungę", body: "Po sinchronizacijos jie saugomi skaičiuotuvo flash atmintyje — skaitykite bet kur. LaTeX OLED ekrane automatiškai paverčiamas ASCII (∞ kaip bitmap, trupmenos kaip `(a)/(b)` ir t. t.)." },
      ],
    },
    s5: {
      eyebrow: "05 · Baterija", title: "Įkrovimas ir baterija.", accent: "Įkrovimas",
      note: "Daugiausia energijos naudoja **OLED esant 12V** (MT3608 įtampos keitiklis). Sutrumpinkite automatinį miego režimą iki 1–2 minučių ir veikimo laikas pailgės 2–3 kartus. Nustatymai → Ekranas → Uzmigdymas.",
      body: "**Įkrovimas**: USB-C (PD nereikia, tinka bet koks ≥5V/1A įkroviklis). Plokštės šviesos diodas šviečia įkraunant ir užgęsta pasiekus 100 %. Baterija apsaugota nuo perkrovimo (MCP73831 + DW01A).",
      stats: [
        { val: "1500", unit: "mAh", label: "Talpa (LiPo)" },
        { val: "~2", unit: "val.", label: "Visiškas įkrovimas" },
        { val: "2–3", unit: "d.", label: "Įprastas naudojimas" },
        { val: "5–7", unit: "d.", label: "Budėjimo režimas" },
      ],
    },
    s6: {
      eyebrow: "06 · Atnaujinimai", title: "OTA — programinės įrangos atnaujinimai.", accent: "atnaujinimai",
      step1Title: "Patikrinkite, ar yra naujinių",
      step1: (v) => `Nustatymai → Sistema → Atnaujinimas → OK. Skaičiuotuvas paklausia serverio, ar yra naujesnė versija nei jūsų dabartinė (rodoma kaip \`v${v}\` ir pan.).`,
      step2Title: "Įdiekite",
      step2: "Jei yra nauja — parodo pakeitimų sąrašą + mygtuką `OK = idiegti`. Atsisiunčia (~1 MB), įrašo į OTA skaidinį ir paleidžia iš naujo. ~1 minutė. Atnaujinimo metu neatjunkite maitinimo.",
      note: "Atnaujinimai yra **nemokami** ir savanoriški. Senoji programinė įranga ir toliau veiks, tačiau naujoms funkcijoms (pvz., geresniam LaTeX) reikia atnaujinimo.",
      versionLabel: "/ DABARTINĖ SERVERIO VERSIJA:",
      versionHint: "Savo versiją rasite Nustatymai → Sistema → Atnaujinimas (arba Nustatymai → Informacija → Apie irengini).",
    },
    s7: {
      eyebrow: "07 · Problemos", title: "Dažnų problemų sprendimas.", accent: "problemų",
      problems: [
        { issue: "Ekranas neįsijungia / lieka juodas", fix: "1) Patikrinkite jungiklį (turi būti padėtyje ON). 2) Kraukite 30+ minučių — baterija gali būti visiškai išsikrovusi. 3) Jei prijungus USB-C įkrovimo diodas nešviečia — pažeistas laidas/lizdas." },
        { issue: "WiFi neranda tinklų / tuščias sąrašas", fix: "Nustatymai → WiFi ir paskyra → WiFi tinklas → OK Ieskoti. Jei tuščia — nuo v0.6.4 pridėjome automatinį radijo modulio atstatymą. Bandykite dar kartą po 5 sekundžių. 5 GHz tinklai nepalaikomi (ESP32 = tik 2,4 GHz)." },
        { issue: "AI Chat: 'AI error 400' arba skirtasis laikas baigėsi", fix: "1) Patikrinkite WiFi (Nustatymai → WiFi ir paskyra → Paskyros busena — turi rodyti 'Busena: SUSIETAS'). 2) Paskyroje turi būti DI žetonų — likutį patikrinsite ir papildysite panelėje, skirtuke AI. 3) Pabandykite trumpesnį uždavinį — riba ~2000 simbolių." },
        { issue: "Kai kurie klavišai nereaguoja", fix: "Nustatymai → Diagnostika → Klaviat. testas. Jei paspaustas klavišas užsidega — jis veikia (problema kitur). Jei ne — fizinis gedimas (šaltas litavimas, FFC laidas). Parašykite mums per formą." },
        { issue: "Užrašai/testai nesisinchronizuoja", fix: "1) WiFi turi veikti. 2) Paskyra turi būti susieta (Nustatymai → WiFi ir paskyra → Paskyros busena = 'Busena: SUSIETAS'). 3) Patikrinkite kalkmate.pl/panel, ar jie yra paskyroje. 4) Jei duomenų per daug (>50 testų arba iš viso >160 KB) — skaičiuotuvas visko neatsisiųs." },
        { issue: "MT3608 keitiklis zvimbia / ekrane juostos", fix: "Tai aparatinė problema su keraminiais (pjezoelektriniais) kondensatoriais. Susisiekite per formą — pakeisime plokštę pagal garantiją." },
      ],
    },
    s8: {
      eyebrow: "08 · DUK", title: "Dažnai užduodami klausimai.", accent: "klausimai",
      faqs: [
        { q: "Kaip įjungti / išjungti skaičiuotuvą?", a: "Pastumkite šoninį jungiklį. Išjungus užrašai ir istorija neištrinami — viskas saugoma vidinėje atmintyje." },
        { q: "Kiek laiko veikia baterija?", a: "Mišrus naudojimas (kelios valandos DI + likęs laikas miego režime): ~2–3 dienos. Budėjimo režimas: 5–7 dienos. Visiškas įkrovimas: ~2 valandos per USB-C." },
        { q: "Kodėl AI Chat reikia WiFi?", a: "Pačius atsakymus apskaičiuoja serveris (Gemini modelis). Be WiFi veikia tik skaičiuotuvas, užrašai ir testai. Nustatymas: Nustatymai → WiFi ir paskyra → WiFi tinklas." },
        { q: "Kas yra Panic klavišas?", a: "Klavišas (numatytasis MU), kuris IŠ KARTO iš bet kurio ekrano grąžina į skaičiuotuvo režimą. Praverčia, kai kas nors žiūri. Jį pakeisite Nustatymai → Sauga → Panikos klav." },
        { q: "Kaip pridėti užrašų / testų?", a: "Tik per kliento panelę kalkmate.pl/panel. Skaičiuotuvas juos sinchronizuoja per WiFi (Pastabos → v = sync). Įrenginyje juos tik skaitote, neredaguojate." },
        { q: "Ką daro „DI kodas\"?", a: "Keturženklis kodas (numatytasis 1111), kurį įvedate skaičiuotuvo režime, kad atrakintumėte DI meniu. Be jo skaičiuotuvas atrodo kaip paprastas Esperanza T8809-2." },
        { q: "Kaip susieti skaičiuotuvą su paskyra?", a: "1) Susikurkite paskyrą kalkmate.pl. 2) Skirtuke AI aktyvuokite kodą iš dėžutės — jis prideda 2 mln. žetonų (perkant internetu priskiriamas automatiškai). 3) Skaičiuotuve: Nustatymai → WiFi ir paskyra → Irenginio ID + QR — užsiregistruoja serveryje. 4) Panelės skiltyje Skaičiuotuvas įveskite Device ID + DI kodą." },
        { q: "Ekranas mirga / rodo baltas juostas — ką daryti?", a: "Dažniausiai zvimbia/nestabilus 12V keitiklis (MT3608). Susisiekite per formą — atsiųsime naują plokštę. Taikoma 24 mėnesių garantija." },
        { q: "Neveikia klavišas — ar galima tai pataisyti programiškai?", a: "Jei tai priskyrimo problema (po perlitavimo) — taip, turime įrankį keymap_scan, kuris iš naujo priskiria klavišus. Parašykite per formą, atsiųsime failą." },
        { q: "Kaip atnaujinti programinę įrangą?", a: "Nustatymai → Sistema → Atnaujinimas → OK. Skaičiuotuvas patikrina serverį, paprašo sutikimo, atsisiunčia + įrašo + paleidžia iš naujo. Visas procesas su WiFi trunka ~1 minutę." },
        { q: "Pamiršau paskyros slaptažodį", a: "Eikite į kalkmate.pl/auth/forgot-password — atsiųsime slaptažodžio atkūrimo nuorodą nurodytu el. paštu (galioja 60 minučių)." },
        { q: "Ar galiu grąžinti skaičiuotuvą?", a: "Taip, per 14 dienų nuo pristatymo be priežasties nurodymo (pagal ES vartotojų teisę). Pakanka el. laiško adresu kontakt@kalkmate.pl su užsakymo numeriu. Išimtis — jūsų pageidavimu personalizuoti egzemplioriai (savas DI kodas + vardas etiketėje)." },
      ],
    },
    s9: {
      eyebrow: "09 · Changelog", title: "Programinės įrangos istorija.", accent: "istorija",
      intro: "Visos išleistos versijos. Atnaujinimas per Nustatymai → Sistema → Atnaujinimas.",
    },
    s10: {
      eyebrow: "10 · Kontaktai", title: "Parašykite mums.", accent: "mums",
      intro: "Atsakau per 24 val. (dažniausiai greičiau). Taip pat galite rašyti tiesiai kontakt@kalkmate.pl — galima ir angliškai.",
      sentTitle: "/ IŠSIŲSTA",
      sentBody: "Ačiū už žinutę. Atsakysiu kuo greičiau nurodytu el. paštu.",
      sentAgain: "Siųsti dar vieną →",
      labelName: "Vardas", labelEmail: "El. paštas", labelSubject: "Tema", labelSubjectOptional: "neprivaloma", labelMessage: "Žinutė",
      placeholderName: "Jonas Jonaitis", placeholderEmail: "jusu@pastas.lt", placeholderSubject: "pvz. WiFi problema", placeholderMessage: "Aprašykite problemą arba užduokite klausimą...",
      errorLabel: "/ KLAIDA", sending: "Siunčiama...", send: "Siųsti žinutę",
      errSend: "Nepavyko išsiųsti žinutės", errNetwork: "Tinklo klaida",
    },
    footerTagline: "Skaičiuotuvas su DI",
    footerTerms: "Taisyklės",
    footerPrivacy: "Privatumo politika",
    footerCe: "ES atitikties deklaracija (CE)",
  },

  be: {
    metaTitle: "Дапамога і інструкцыя — KalkMate",
    metaDesc:
      "Інструкцыя да калькулятара KalkMate: першы запуск, налада WiFi, рэжым AI, вырашэнне праблем і гісторыя прашыўкі.",
    navHome: "← Галоўная",
    navPanel: "Панэль",
    heroEyebrow: "[ дапамога ] · v3.0",
    heroTitleLine1: "Дапамога &",
    heroTitleAccent: "дакументацыя",
    heroDesc: (v) =>
      `Усё, што трэба для пачатку: інструкцыя, відэа, FAQ і кантакт з намі. Матэрыялы абноўлены для прашыўкі v${v}.`,
    sections: [
      { id: "start", label: "01 · Першы запуск" },
      { id: "klawiatura", label: "02 · Навігацыя клавіятурай" },
      { id: "ai", label: "03 · Рэжым AI" },
      { id: "notatki", label: "04 · Нататкі і тэсты" },
      { id: "bateria", label: "05 · Батарэя і зарадка" },
      { id: "ota", label: "06 · Абнаўленні (OTA)" },
      { id: "problemy", label: "07 · Вырашэнне праблем" },
      { id: "faq", label: "08 · FAQ" },
      { id: "changelog", label: "09 · Changelog прашыўкі" },
      { id: "kontakt", label: "10 · Кантакт" },
    ],
    s1: {
      eyebrow: "01 · Старт", title: "Першы запуск.", accent: "запуск",
      videoLabel: "Відэа: першы запуск",
      steps: [
        { title: "Зарадзіце", body: "Падключыце кабель USB-C з камплекта да калькулятара і зараднай прылады ≥5V/1A. Поўная зарадка займае ~2 г. Падчас зарадкі свеціцца святлодыёд на плаце." },
        { title: "Уключыце", body: "Перавядзіце перамыкач збоку ў становішча ON. Праз ~2 с вы ўбачыце экран прывітання KalkMate, а потым **экран калькулятара** (лічбавы дысплэй)." },
        { title: "Адкрыйце меню AI", body: "На клавіятуры калькулятара ўвядзіце **код разблакіроўкі** (па змаўчанні `1111`) — толькі лічбы, без аперацый паміж імі. Экран на імгненне пакажа „AI\" і адкрые галоўнае меню. Толькі цяпер даступныя Nalady і іншыя функцыі." },
        { title: "Наладзьце WiFi", body: "Nalady → WiFi i akaunt → Sietka WiFi → выберыце сетку са спіса → увядзіце пароль (экранная клавіятура). Патрэбна для AI, сінхранізацыі нататак і OTA-абнаўленняў." },
        { title: "Звяжыце ўліковы запіс", body: "Стварыце ўліковы запіс на kalkmate.pl (пацвердзіце email). На калькулятары: Nalady → WiFi i akaunt → ID prylady + QR — ён зарэгіструецца на серверы і пакажа QR-код для сканавання. Пацвердзіце прывязку ў панэлі kalkmate.pl. Без гэтага калькулятар працуе ў афлайн-рэжыме." },
      ],
    },
    s2: {
      eyebrow: "02 · Клавіятура", title: "Навігацыя клавішамі.", accent: "клавішамі",
      intro: "Клавіятура мае 27 клавіш у раскладцы 5×6. У меню і наладах вы перамяшчаецеся **лічбавым блокам**:",
      note: "У **рэжыме калькулятара** клавішы лічбаў і аперацый працуюць звычайна (5 = пяць, 4 = чатыры і г. д.). Лічбавы блок служыць навігацыяй толькі ў меню і наладах.",
      videoLabel: "Навігацыя па экраннай клавіятуры AI",
      legend: { nav: "НАВІГАЦЫЯ", panic: "PANIC", standard: "СТАНДАРТ" },
      keyRows: [
        { key: "8", desc: "Уверх" },
        { key: "2", desc: "Уніз" },
        { key: "4", desc: "Улева" },
        { key: "6", desc: "Управа" },
        { key: "5", desc: "OK / Пацвердзіць", accent: true },
        { key: "C/CE", desc: "Назад / Адмена" },
        { key: "MU", desc: "PANIC — імгненнае вяртанне ў калькулятар", accent: true },
        { key: "▶", desc: "У рэжыме калькулятара: backspace" },
      ],
    },
    s3: {
      eyebrow: "03 · Рэжым AI", title: "Рашэнне задач.", accent: "задач",
      intro: "KalkMate адпраўляе вашу задачу AI (мадэль Gemini праз наш сервер) і вяртае рашэнне крок за крокам. Працуе для **матэматыкі, фізікі, хіміі і біялогіі**.",
      steps: [
        { title: "Увядзіце код AI", body: "У рэжыме калькулятара ўвядзіце 4 лічбы (па змаўчанні `1111`) без аніякіх аперацый паміж імі. Адкрыецца меню AI." },
        { title: "Выберыце рэжым", body: "**[1] Fota kameraj** — накіруйце камеру на задачу. Жывы прагляд на экране (індыкатар рэзкасці справа), націсніце `5 (OK)`, каб зрабіць фота і адправіць яго AI.\n\n**[2] Uviesci tekst** — экранная клавіятура QWERTY: 8/4/6/2 = навігацыя, 5 = выбраць знак, пацвердзіце кнопкай OK (макс. 2000 знакаў).\n\n**[3] Historyja** — праглядайце папярэднія рашэнні (афлайн). Кнопка → (управа) адкрывае пытанне для рэдагавання і паўторнай адпраўкі AI." },
        { title: "Падрабязнасць рашэння", body: "У Nalady → Rasennie zadac → Rezym rasennia выберыце:", list: ["**Padrabiazny** — крок за крокам з тлумачэннямі", "**Razlik** — толькі формулы + пераходы", "**Vynik** — толькі канчатковы адказ"] },
        { title: "Чытанне адказу", body: "Клавішамі 8 / 2 (уверх/уніз) пракручваеце доўгія адказы. C/CE вяртае ў меню. Кожны адказ аўтаматычна захоўваецца ў гісторыі." },
      ],
    },
    s4: {
      eyebrow: "04 · Памяць", title: "Нататкі і тэсты.", accent: "тэсты",
      intro: "KalkMate захоўвае да **50 нататак (60 KB)** і **50 тэстаў (160 KB)** афлайн — чытайце іх нават без WiFi. Рэдагуюцца яны на kalkmate.pl/panel.",
      steps: [
        { title: "Дадайце на сайце", body: "Перайдзіце на kalkmate.pl/panel → укладка Нататкі / Тэсты → дадайце змест (да 4000 знакаў для нататкі, 30 000 для тэсту). Падтрымліваюцца LaTeX і markdown." },
        { title: "Сінхранізацыя з калькулятарам", body: "На калькулятары: Natatki → націсніце стрэлку ўніз (v = sync). Патрабуецца WiFi. Спампоўвае ўсё з вашага ўліковага запісу." },
        { title: "Чытайце афлайн", body: "Пасля сінхранізацыі яны захоўваюцца ў flash-памяці калькулятара — чытайце дзе заўгодна. LaTeX на OLED-экране аўтаматычна пераўтвараецца ў ASCII (∞ як bitmap, дробы як `(a)/(b)` і г. д.)." },
      ],
    },
    s5: {
      eyebrow: "05 · Батарэя", title: "Зарадка і батарэя.", accent: "Зарадка",
      note: "Найбольш энергіі спажывае **OLED пры 12V** (пераўтваральнік MT3608). Скараціце аўтаматычны сон да 1–2 хвілін, і час працы павялічыцца ў 2–3 разы. Nalady → Ekran → Usyplennie.",
      body: "**Зарадка**: USB-C (PD не патрабуецца, падыдзе любая зарадная прылада ≥5V/1A). Святлодыёд на плаце свеціцца падчас зарадкі і гасне пры 100 %. Батарэя абаронена ад перазарадкі (MCP73831 + DW01A).",
      stats: [
        { val: "1500", unit: "mAh", label: "Ёмістасць (LiPo)" },
        { val: "~2", unit: "г", label: "Поўная зарадка" },
        { val: "2–3", unit: "дні", label: "Звычайнае выкарыстанне" },
        { val: "5–7", unit: "дзён", label: "Рэжым чакання" },
      ],
    },
    s6: {
      eyebrow: "06 · Абнаўленні", title: "OTA — абнаўленні прашыўкі.", accent: "абнаўленні",
      step1Title: "Праверце наяўнасць",
      step1: (v) => `Nalady → Sistema → Abnaulennie → OK. Калькулятар пытаецца ў сервера, ці ёсць версія навейшая за вашу бягучую (паказваецца як \`v${v}\` і г. д.).`,
      step2Title: "Усталюйце",
      step2: "Калі ёсць новая — паказвае спіс змен + кнопку `OK = ustalavac`. Спампоўвае (~1 MB), запісвае ў OTA-раздзел і перазапускаецца. ~1 хвіліна. Не адключайце сілкаванне падчас абнаўлення.",
      note: "Абнаўленні **бясплатныя** і добраахвотныя. Старая прашыўка будзе працаваць і далей, але новыя функцыі (напр. лепшы LaTeX) патрабуюць абнаўлення.",
      versionLabel: "/ БЯГУЧАЯ ВЕРСІЯ НА СЕРВЕРЫ:",
      versionHint: "Сваю версію праверце ў Nalady → Sistema → Abnaulennie (або Nalady → Infarmacyja → Pra prylada).",
    },
    s7: {
      eyebrow: "07 · Праблемы", title: "Вырашэнне частых праблем.", accent: "праблем",
      problems: [
        { issue: "Экран не ўключаецца / застаецца чорным", fix: "1) Праверце перамыкач (павінен быць у становішчы ON). 2) Зараджайце 30+ хвілін — батарэя можа быць цалкам разраджаная. 3) Калі святлодыёд зарадкі не свеціцца пасля падключэння USB-C — пашкоджаны кабель/раздым." },
        { issue: "WiFi не знаходзіць сеткі / пусты спіс", fix: "Nalady → WiFi i akaunt → Sietka WiFi → OK Posuk. Калі пуста — з v0.6.4 мы дадалі аўтаматычнае скіданне радыёмодуля. Паспрабуйце яшчэ раз праз 5 секунд. Сеткі 5 GHz не падтрымліваюцца (ESP32 = толькі 2,4 GHz)." },
        { issue: "AI Chat: 'AI error 400' або тайм-аўт", fix: "1) Праверце WiFi (Nalady → WiFi i akaunt → Stan akaunta — павінна быць 'Stan: PRYVIAZANA'). 2) На ўліковым запісе павінны быць AI-токены — баланс праверыце і папоўніце ў панэлі, ва ўкладцы AI. 3) Паспрабуйце карацейшую задачу — ліміт ~2000 знакаў." },
        { issue: "Некаторыя клавішы не рэагуюць", fix: "Nalady → Diahnostyka → Test klavis. Калі клавіша пры націсканні падсвечваецца — яна працуе (праблема ў іншым месцы). Калі не — фізічная непаладка (халодная пайка, кабель FFC). Напішыце нам праз форму." },
        { issue: "Нататкі/тэсты не сінхранізуюцца", fix: "1) WiFi павінен працаваць. 2) Уліковы запіс павінен быць прывязаны (Nalady → WiFi i akaunt → Stan akaunta = 'Stan: PRYVIAZANA'). 3) Праверце на kalkmate.pl/panel, ці ёсць яны ва ўліковым запісе. 4) Калі даных зашмат (>50 тэстаў або разам >160 KB) — калькулятар спампуе не ўсё." },
        { issue: "Пераўтваральнік MT3608 гудзе / на экране палосы", fix: "Гэта апаратная праблема з керамічнымі (п'езаэлектрычнымі) кандэнсатарамі. Звяжыцеся з намі праз форму — заменім плату па гарантыі." },
      ],
    },
    s8: {
      eyebrow: "08 · FAQ", title: "Частыя пытанні.", accent: "пытанні",
      faqs: [
        { q: "Як уключыць / выключыць калькулятар?", a: "Перавядзіце перамыкач збоку. Выключэнне не сцірае нататкі і гісторыю — усё захоўваецца ва ўнутранай памяці." },
        { q: "Колькі трымае батарэя?", a: "Змешанае выкарыстанне (некалькі гадзін AI + астатні час у сне): ~2–3 дні. Рэжым чакання: 5–7 дзён. Поўная зарадка: ~2 гадзіны праз USB-C." },
        { q: "Навошта AI Chat патрэбны WiFi?", a: "Самі адказы вылічвае сервер (мадэль Gemini). Без WiFi працуюць толькі калькулятар, нататкі і тэсты. Налада: Nalady → WiFi i akaunt → Sietka WiFi." },
        { q: "Што такое клавіша Panic?", a: "Клавіша (па змаўчанні MU), якая НЕАДКЛАДНА вяртае ў рэжым калькулятара з любога экрана. Карысна, калі нехта глядзіць. Змяніць яе можна ў Nalady → Biaspieka → Klavisa panik." },
        { q: "Як дадаць нататкі / тэсты?", a: "Толькі праз панэль кліента на kalkmate.pl/panel. Калькулятар сінхранізуе іх праз WiFi (Natatki → v = sync). На прыладзе іх можна толькі чытаць, не рэдагаваць." },
        { q: "Для чаго „код AI\"?", a: "Чатырохзначны код (па змаўчанні 1111), які вы ўводзіце ў рэжыме калькулятара, каб разблакіраваць меню AI. Без яго калькулятар выглядае як звычайны Esperanza T8809-2." },
        { q: "Як звязаць калькулятар з уліковым запісам?", a: "1) Стварыце ўліковы запіс на kalkmate.pl. 2) Ва ўкладцы AI актывуйце код са скрынкі — ён дадае 2 млн токенаў (пры пакупцы анлайн прызначаецца аўтаматычна). 3) На калькулятары: Nalady → WiFi i akaunt → ID prylady + QR — ён зарэгіструецца на серверы. 4) У панэлі ў раздзеле Калькулятар увядзіце Device ID + код AI." },
        { q: "Экран мігае / паказвае белыя палосы — што рабіць?", a: "Часцей за ўсё гудзе/нестабільна працуе пераўтваральнік 12V (MT3608). Звяжыцеся праз форму — мы дашлём новую плату. Пакрываецца гарантыяй 24 месяцы." },
        { q: "Клавіша не працуе — ці можна выправіць праграмна?", a: "Калі гэта праблема прывязкі клавіш (пасля перапайкі) — так, у нас ёсць інструмент keymap_scan, які пераназначае клавішы. Напішыце праз форму, і мы дашлём файл." },
        { q: "Як абнавіць прашыўку?", a: "Nalady → Sistema → Abnaulennie → OK. Калькулятар правярае сервер, пытаецца згоды, спампоўвае + запісвае + перазапускаецца. Увесь працэс з WiFi займае ~1 хвіліну." },
        { q: "Я забыў(-ла) пароль ад уліковага запісу", a: "Перайдзіце на kalkmate.pl/auth/forgot-password — мы дашлём спасылку для скідання пароля на ўказаны email (дзейнічае 60 хвілін)." },
        { q: "Ці можна вярнуць калькулятар?", a: "Так, на працягу 14 дзён ад дастаўкі без указання прычыны (паводле права ЕС аб абароне спажыўцоў). Дастаткова напісаць на kontakt@kalkmate.pl з нумарам замовы. Выключэнне — экзэмпляры, персаналізаваныя па вашым жаданні (уласны код AI + імя на этыкетцы)." },
      ],
    },
    s9: {
      eyebrow: "09 · Changelog", title: "Гісторыя прашыўкі.", accent: "прашыўкі",
      intro: "Усе выпушчаныя версіі. Абнаўленне праз Nalady → Sistema → Abnaulennie.",
    },
    s10: {
      eyebrow: "10 · Кантакт", title: "Напішыце нам.", accent: "нам",
      intro: "Адказваю на працягу 24 г (звычайна хутчэй). Можна таксама пісаць наўпрост на kontakt@kalkmate.pl — у тым ліку па-англійску.",
      sentTitle: "/ АДПРАЎЛЕНА",
      sentBody: "Дзякуй за паведамленне. Адкажу як мага хутчэй на ўказаны email.",
      sentAgain: "Адправіць яшчэ →",
      labelName: "Імя", labelEmail: "Email", labelSubject: "Тэма", labelSubjectOptional: "неабавязкова", labelMessage: "Паведамленне",
      placeholderName: "Алесь Іваноўскі", placeholderEmail: "vash@email.com", placeholderSubject: "напр. Праблема з WiFi", placeholderMessage: "Апішыце праблему або задайце пытанне...",
      errorLabel: "/ ПАМЫЛКА", sending: "Адпраўка...", send: "Адправіць паведамленне",
      errSend: "Не ўдалося адправіць паведамленне", errNetwork: "Памылка сеткі",
    },
    footerTagline: "Калькулятар з AI",
    footerTerms: "Правілы",
    footerPrivacy: "Палітыка прыватнасці",
    footerCe: "Дэкларацыя адпаведнасці ЕС (CE)",
  },

  es: {
    metaTitle: "Ayuda y manual de usuario — KalkMate",
    metaDesc:
      "Manual de usuario de la calculadora KalkMate: primera puesta en marcha, configuración WiFi, modo IA, solución de problemas e historial de firmware.",
    navHome: "← Inicio",
    navPanel: "Panel",
    heroEyebrow: "[ ayuda ] · v3.0",
    heroTitleLine1: "Ayuda &",
    heroTitleAccent: "documentación",
    heroDesc: (v) =>
      `Todo lo que necesitas para empezar: manual, vídeos, preguntas frecuentes y contacto. Contenido actualizado para el firmware v${v}.`,
    sections: [
      { id: "start", label: "01 · Primera puesta en marcha" },
      { id: "klawiatura", label: "02 · Navegación con el teclado" },
      { id: "ai", label: "03 · Modo IA" },
      { id: "notatki", label: "04 · Notas y exámenes" },
      { id: "bateria", label: "05 · Batería y carga" },
      { id: "ota", label: "06 · Actualizaciones (OTA)" },
      { id: "problemy", label: "07 · Solución de problemas" },
      { id: "faq", label: "08 · Preguntas frecuentes" },
      { id: "changelog", label: "09 · Changelog del firmware" },
      { id: "kontakt", label: "10 · Contacto" },
    ],
    s1: {
      eyebrow: "01 · Inicio", title: "Primera puesta en marcha.", accent: "puesta en marcha",
      videoLabel: "Vídeo: primera puesta en marcha",
      steps: [
        { title: "Cárgala", body: "Conecta el cable USB-C incluido a la calculadora y a un cargador de ≥5V/1A. La carga completa tarda ~2 h. El LED de la placa se enciende mientras carga." },
        { title: "Enciéndela", body: "Desliza el interruptor lateral a ON. Tras ~2 s verás la pantalla de bienvenida de KalkMate y después la **pantalla de calculadora** (display digital)." },
        { title: "Abre el menú de IA", body: "En el teclado de la calculadora escribe el **código de desbloqueo** (por defecto `1111`) — solo dígitos, sin operadores entre ellos. La pantalla mostrará brevemente „AI\" y abrirá el menú principal. Solo entonces están disponibles Ajustes y las demás funciones." },
        { title: "Configura el WiFi", body: "Ajustes → WiFi y cuenta → Red WiFi → elige una red de la lista → introduce la contraseña (teclado en pantalla). Necesario para la IA, la sincronización de notas y las actualizaciones OTA." },
        { title: "Vincula tu cuenta", body: "Crea una cuenta en kalkmate.pl (confirma tu email). En la calculadora: Ajustes → WiFi y cuenta → ID equipo + QR — se registrará en el servidor y mostrará un código QR para escanear. Confirma la vinculación en el panel de kalkmate.pl. Sin esto, la calculadora funciona en modo offline." },
      ],
    },
    s2: {
      eyebrow: "02 · Teclado", title: "Navegación con las teclas.", accent: "teclas",
      intro: "El teclado tiene 27 teclas en una disposición de 5×6. En los menús y ajustes te mueves con el **teclado numérico**:",
      note: "En **modo calculadora** las teclas de dígitos y operadores funcionan con normalidad (5 = cinco, 4 = cuatro, etc.). El teclado numérico solo sirve de navegación en menús y ajustes.",
      videoLabel: "Navegación por el teclado en pantalla de la IA",
      legend: { nav: "NAVEGACIÓN", panic: "PANIC", standard: "ESTÁNDAR" },
      keyRows: [
        { key: "8", desc: "Arriba" },
        { key: "2", desc: "Abajo" },
        { key: "4", desc: "Izquierda" },
        { key: "6", desc: "Derecha" },
        { key: "5", desc: "OK / Confirmar", accent: true },
        { key: "C/CE", desc: "Atrás / Cancelar" },
        { key: "MU", desc: "PANIC — vuelve al instante al modo calculadora", accent: true },
        { key: "▶", desc: "En modo calculadora: borrar (backspace)" },
      ],
    },
    s3: {
      eyebrow: "03 · Modo IA", title: "Resolver ejercicios.", accent: "ejercicios",
      intro: "KalkMate envía tu ejercicio a la IA (modelo Gemini a través de nuestro servidor) y devuelve la solución paso a paso. Funciona para **matemáticas, física, química y biología**.",
      steps: [
        { title: "Introduce el código de IA", body: "En modo calculadora escribe los 4 dígitos (por defecto `1111`) sin ninguna operación entre ellos. Se abrirá el menú de IA." },
        { title: "Elige un modo", body: "**[1] Foto camara** — apunta la cámara al ejercicio. Vista previa en directo en la pantalla (indicador de enfoque a la derecha), pulsa `5 (OK)` para hacer la foto y enviarla a la IA.\n\n**[2] Escribir texto** — teclado QWERTY en pantalla: 8/4/6/2 = navegar, 5 = elegir carácter, confirma con el botón OK (máx. 2000 caracteres).\n\n**[3] Historial** — consulta soluciones anteriores (offline). El botón → (derecha) abre la pregunta para editarla y reenviarla a la IA." },
        { title: "Nivel de detalle", body: "En Ajustes → Resolver → Modo solucion elige:", list: ["**Detallado** — paso a paso con explicaciones", "**Solo calc.** — solo fórmulas + pasos", "**Resultado** — solo la respuesta final"] },
        { title: "Leer la respuesta", body: "Con 8 / 2 (arriba/abajo) te desplazas por las respuestas largas. C/CE vuelve al menú. Cada respuesta se guarda automáticamente en el historial." },
      ],
    },
    s4: {
      eyebrow: "04 · Memoria", title: "Notas y exámenes.", accent: "exámenes",
      intro: "KalkMate guarda hasta **50 notas (60 KB)** y **50 exámenes (160 KB)** offline — puedes leerlos incluso sin WiFi. Se editan en kalkmate.pl/panel.",
      steps: [
        { title: "Añádelos en la web", body: "Entra en kalkmate.pl/panel → pestaña Notas / Exámenes → añade el contenido (hasta 4000 caracteres por nota, 30 000 por examen). Admite LaTeX y markdown." },
        { title: "Sincroniza con la calculadora", body: "En la calculadora: Notas → pulsa la flecha abajo (v = sync). Requiere WiFi. Descarga todo lo de tu cuenta." },
        { title: "Lee sin conexión", body: "Tras sincronizar, quedan en la memoria flash de la calculadora — léelos donde quieras. El LaTeX se convierte automáticamente a ASCII en la pantalla OLED (∞ como bitmap, fracciones como `(a)/(b)`, etc.)." },
      ],
    },
    s5: {
      eyebrow: "05 · Batería", title: "Carga y batería.", accent: "Carga",
      note: "Lo que más consume es el **OLED a 12V** (convertidor elevador MT3608). Reduce el apagado automático a 1–2 minutos para multiplicar la autonomía por 2–3. Ajustes → Pantalla → Reposo auto.",
      body: "**Carga**: USB-C (no requiere PD, sirve cualquier cargador de ≥5V/1A). El LED de la placa se enciende durante la carga y se apaga al 100 %. La batería está protegida contra sobrecarga (MCP73831 + DW01A).",
      stats: [
        { val: "1500", unit: "mAh", label: "Capacidad (LiPo)" },
        { val: "~2", unit: "h", label: "Carga completa" },
        { val: "2–3", unit: "días", label: "Uso típico" },
        { val: "5–7", unit: "días", label: "En reposo" },
      ],
    },
    s6: {
      eyebrow: "06 · Actualizaciones", title: "OTA — actualizaciones de firmware.", accent: "actualizaciones",
      step1Title: "Comprueba si hay novedades",
      step1: (v) => `Ajustes → Sistema → Actualizacion → OK. La calculadora pregunta al servidor si hay una versión más reciente que la tuya (mostrada como \`v${v}\`, etc.).`,
      step2Title: "Instala",
      step2: "Si hay una nueva, muestra la lista de cambios + el botón `OK = instalar`. Descarga (~1 MB), graba la partición OTA y se reinicia. ~1 minuto. No desconectes la alimentación durante la actualización.",
      note: "Las actualizaciones son **gratuitas** y opcionales. El firmware antiguo seguirá funcionando, pero las nuevas funciones (p. ej. mejor LaTeX) requieren actualizar.",
      versionLabel: "/ VERSIÓN ACTUAL DEL SERVIDOR:",
      versionHint: "Consulta tu versión en Ajustes → Sistema → Actualizacion (o Ajustes → Informacion → Info equipo).",
    },
    s7: {
      eyebrow: "07 · Problemas", title: "Solución de problemas habituales.", accent: "problemas",
      problems: [
        { issue: "La pantalla no se enciende / sigue en negro", fix: "1) Revisa el interruptor (debe estar en ON). 2) Carga 30+ minutos — la batería puede estar totalmente descargada. 3) Si el LED de carga no se enciende al conectar el USB-C — el cable o el puerto están dañados." },
        { issue: "El WiFi no encuentra redes / lista vacía", fix: "Ajustes → WiFi y cuenta → Red WiFi → OK Buscar. Si sigue vacía — desde la v0.6.4 hay un reinicio automático de la radio. Vuelve a intentarlo tras 5 segundos. Las redes de 5 GHz no son compatibles (ESP32 = solo 2,4 GHz)." },
        { issue: "AI Chat: 'AI error 400' o tiempo de espera agotado", fix: "1) Revisa el WiFi (Ajustes → WiFi y cuenta → Estado de cuenta — debe mostrar 'Estado: VINCULADO'). 2) La cuenta necesita tokens de IA — consulta y recarga el saldo en el panel, en la pestaña AI. 3) Prueba con un ejercicio más corto — el límite es de ~2000 caracteres." },
        { issue: "Algunas teclas no responden", fix: "Ajustes → Diagnostico → Prueba teclado. Si la tecla se ilumina al pulsarla — funciona (el problema está en otro sitio). Si no — es un fallo físico (soldadura fría, cable FFC). Escríbenos mediante el formulario." },
        { issue: "Las notas/exámenes no se sincronizan", fix: "1) El WiFi debe funcionar. 2) La cuenta debe estar vinculada (Ajustes → WiFi y cuenta → Estado de cuenta = 'Estado: VINCULADO'). 3) Comprueba en kalkmate.pl/panel que estén en tu cuenta. 4) Si hay demasiados datos (>50 exámenes o >160 KB en total) — la calculadora no descargará todo." },
        { issue: "El convertidor MT3608 zumba / la pantalla tiene franjas", fix: "Es un problema de hardware con los condensadores cerámicos (piezoeléctricos). Contáctanos mediante el formulario — cambiaremos la placa en garantía." },
      ],
    },
    s8: {
      eyebrow: "08 · FAQ", title: "Preguntas frecuentes.", accent: "frecuentes",
      faqs: [
        { q: "¿Cómo enciendo / apago la calculadora?", a: "Desliza el interruptor lateral. Apagarla no borra las notas ni el historial — todo se guarda en la memoria interna." },
        { q: "¿Cuánto dura la batería?", a: "Uso mixto (unas horas de IA + el resto en reposo): ~2–3 días. En reposo: 5–7 días. Carga completa: ~2 horas por USB-C." },
        { q: "¿Por qué AI Chat necesita WiFi?", a: "Las respuestas las calcula el servidor (modelo Gemini). Sin WiFi solo funcionan la calculadora, las notas y los exámenes. Configuración: Ajustes → WiFi y cuenta → Red WiFi." },
        { q: "¿Qué es la tecla Panic?", a: "Una tecla (MU por defecto) que vuelve AL INSTANTE al modo calculadora desde cualquier pantalla. Útil cuando alguien está mirando. Puedes cambiarla en Ajustes → Seguridad → Tecla panico." },
        { q: "¿Cómo añado notas / exámenes?", a: "Solo a través del panel de cliente en kalkmate.pl/panel. La calculadora los sincroniza por WiFi (Notas → v = sync). En el dispositivo solo se leen, no se editan." },
        { q: "¿Para qué sirve el „código de IA\"?", a: "Un código de cuatro dígitos (por defecto 1111) que escribes en modo calculadora para desbloquear el menú de IA. Sin él, la calculadora parece una Esperanza T8809-2 normal." },
        { q: "¿Cómo vinculo la calculadora con mi cuenta?", a: "1) Crea una cuenta en kalkmate.pl. 2) Activa el código de la caja en la pestaña AI — añade 2 millones de tokens (si compraste online, se asigna automáticamente). 3) En la calculadora: Ajustes → WiFi y cuenta → ID equipo + QR — se registra en el servidor. 4) En el panel, en la sección Calculadora, introduce el Device ID + el código de IA." },
        { q: "La pantalla parpadea / muestra franjas blancas — ¿qué hago?", a: "Normalmente es el convertidor de 12V (MT3608) que zumba o es inestable. Contáctanos mediante el formulario — te enviaremos una placa nueva. Cubierto por la garantía de 24 meses." },
        { q: "Una tecla no funciona — ¿se puede arreglar por software?", a: "Si es un problema de asignación (tras resoldar) — sí, tenemos la herramienta keymap_scan, que reasigna las teclas. Escríbenos mediante el formulario y te enviaremos el archivo." },
        { q: "¿Cómo actualizo el firmware?", a: "Ajustes → Sistema → Actualizacion → OK. La calculadora consulta el servidor, pide confirmación, descarga + graba + reinicia. Todo el proceso dura ~1 minuto con WiFi." },
        { q: "He olvidado la contraseña de mi cuenta", a: "Entra en kalkmate.pl/auth/forgot-password — te enviaremos un enlace para restablecerla a tu email (válido 60 minutos)." },
        { q: "¿Puedo devolver la calculadora?", a: "Sí, en un plazo de 14 días desde la entrega sin necesidad de justificación (según la normativa de consumo de la UE). Basta con escribir a kontakt@kalkmate.pl con tu número de pedido. Quedan excluidas las unidades personalizadas a petición tuya (código de IA propio + nombre en la etiqueta)." },
      ],
    },
    s9: {
      eyebrow: "09 · Changelog", title: "Historial del firmware.", accent: "firmware",
      intro: "Todas las versiones publicadas. Actualiza en Ajustes → Sistema → Actualizacion.",
    },
    s10: {
      eyebrow: "10 · Contacto", title: "Escríbenos.", accent: "Escríbenos",
      intro: "Respondo en menos de 24 h (normalmente antes). También puedes escribir directamente a kontakt@kalkmate.pl — en inglés si lo prefieres.",
      sentTitle: "/ ENVIADO",
      sentBody: "Gracias por tu mensaje. Te responderé lo antes posible al email indicado.",
      sentAgain: "Enviar otro →",
      labelName: "Nombre", labelEmail: "Email", labelSubject: "Asunto", labelSubjectOptional: "opcional", labelMessage: "Mensaje",
      placeholderName: "Lucía García", placeholderEmail: "tu@email.es", placeholderSubject: "p. ej. Problema con el WiFi", placeholderMessage: "Describe el problema o haz tu pregunta...",
      errorLabel: "/ ERROR", sending: "Enviando...", send: "Enviar mensaje",
      errSend: "No se ha podido enviar el mensaje", errNetwork: "Error de red",
    },
    footerTagline: "Calculadora con IA",
    footerTerms: "Condiciones generales",
    footerPrivacy: "Política de privacidad",
    footerCe: "Declaración UE de conformidad (CE)",
  },

  pt: {
    metaTitle: "Ajuda e manual de utilização — KalkMate",
    metaDesc:
      "Manual de utilização da calculadora KalkMate: primeira configuração, WiFi, modo IA, resolução de problemas e histórico de firmware.",
    navHome: "← Início",
    navPanel: "Painel",
    heroEyebrow: "[ ajuda ] · v3.0",
    heroTitleLine1: "Ajuda &",
    heroTitleAccent: "documentação",
    heroDesc: (v) =>
      `Tudo o que precisa para começar: manual, vídeos, perguntas frequentes e contacto. Conteúdo atualizado para o firmware v${v}.`,
    sections: [
      { id: "start", label: "01 · Primeira configuração" },
      { id: "klawiatura", label: "02 · Navegação pelo teclado" },
      { id: "ai", label: "03 · Modo IA" },
      { id: "notatki", label: "04 · Notas e testes" },
      { id: "bateria", label: "05 · Bateria e carregamento" },
      { id: "ota", label: "06 · Atualizações (OTA)" },
      { id: "problemy", label: "07 · Resolução de problemas" },
      { id: "faq", label: "08 · Perguntas frequentes" },
      { id: "changelog", label: "09 · Changelog do firmware" },
      { id: "kontakt", label: "10 · Contacto" },
    ],
    s1: {
      eyebrow: "01 · Início", title: "Primeira configuração.", accent: "configuração",
      videoLabel: "Vídeo: primeira configuração",
      steps: [
        { title: "Carregue", body: "Ligue o cabo USB-C incluído à calculadora e a um carregador de ≥5V/1A. O carregamento completo demora ~2 h. O LED da placa acende durante o carregamento." },
        { title: "Ligue", body: "Deslize o interruptor lateral para ON. Após ~2 s verá o ecrã de boas-vindas KalkMate e depois o **ecrã da calculadora** (visor digital)." },
        { title: "Abra o menu de IA", body: "No teclado da calculadora, escreva o **código de desbloqueio** (predefinido `1111`) — apenas dígitos, sem operadores entre eles. O ecrã mostra brevemente „AI\" e abre o menu principal. Só então ficam disponíveis Definicoes e as restantes funções." },
        { title: "Configure o WiFi", body: "Definicoes → WiFi e conta → Rede WiFi → escolha uma rede da lista → introduza a palavra-passe (teclado no ecrã). Necessário para a IA, a sincronização de notas e as atualizações OTA." },
        { title: "Associe a sua conta", body: "Crie uma conta em kalkmate.pl (confirme o email). Na calculadora: Definicoes → WiFi e conta → ID aparelho + QR — regista-se no servidor e mostra um código QR para digitalizar. Confirme a associação no painel kalkmate.pl. Sem isto, a calculadora funciona em modo offline." },
      ],
    },
    s2: {
      eyebrow: "02 · Teclado", title: "Navegação com as teclas.", accent: "teclas",
      intro: "O teclado tem 27 teclas numa disposição 5×6. Nos menus e definições navega com o **teclado numérico**:",
      note: "No **modo calculadora** as teclas de dígitos e operadores funcionam normalmente (5 = cinco, 4 = quatro, etc.). O teclado numérico só funciona como navegação nos menus e definições.",
      videoLabel: "Navegação no teclado de ecrã da IA",
      legend: { nav: "NAVEGAÇÃO", panic: "PANIC", standard: "PADRÃO" },
      keyRows: [
        { key: "8", desc: "Cima" },
        { key: "2", desc: "Baixo" },
        { key: "4", desc: "Esquerda" },
        { key: "6", desc: "Direita" },
        { key: "5", desc: "OK / Confirmar", accent: true },
        { key: "C/CE", desc: "Voltar / Cancelar" },
        { key: "MU", desc: "PANIC — regressa de imediato ao modo calculadora", accent: true },
        { key: "▶", desc: "No modo calculadora: apagar (backspace)" },
      ],
    },
    s3: {
      eyebrow: "03 · Modo IA", title: "Resolver exercícios.", accent: "exercícios",
      intro: "O KalkMate envia o seu exercício para a IA (modelo Gemini através do nosso servidor) e devolve a resolução passo a passo. Funciona para **matemática, física, química e biologia**.",
      steps: [
        { title: "Introduza o código de IA", body: "No modo calculadora, escreva os 4 dígitos (predefinido `1111`) sem nenhuma operação entre eles. Abre-se o menu de IA." },
        { title: "Escolha um modo", body: "**[1] Foto camara** — aponte a câmara ao exercício. Pré-visualização em direto no ecrã (indicador de focagem à direita), prima `5 (OK)` para tirar a foto e enviá-la para a IA.\n\n**[2] Escrever texto** — teclado QWERTY no ecrã: 8/4/6/2 = navegar, 5 = escolher carácter, confirme com o botão OK (máx. 2000 caracteres).\n\n**[3] Historico** — consulte resoluções anteriores (offline). O botão → (direita) abre a pergunta para editar e reenviar para a IA." },
        { title: "Nível de detalhe", body: "Em Definicoes → Resolucao → Modo resolucao escolha:", list: ["**Detalhado** — passo a passo com explicações", "**So calculo** — só fórmulas + passos", "**Resultado** — só a resposta final"] },
        { title: "Ler a resposta", body: "Com 8 / 2 (cima/baixo) percorre respostas longas. C/CE volta ao menu. Cada resposta é guardada automaticamente no histórico." },
      ],
    },
    s4: {
      eyebrow: "04 · Memória", title: "Notas e testes.", accent: "testes",
      intro: "O KalkMate guarda até **50 notas (60 KB)** e **50 testes (160 KB)** offline — pode lê-los mesmo sem WiFi. Edita-os em kalkmate.pl/panel.",
      steps: [
        { title: "Adicione no site", body: "Aceda a kalkmate.pl/panel → separador Notas / Testes → adicione o conteúdo (até 4000 caracteres por nota, 30 000 por teste). Suporta LaTeX e markdown." },
        { title: "Sincronize com a calculadora", body: "Na calculadora: Notas → clique na seta para baixo (v = sync). Requer WiFi. Transfere tudo da sua conta." },
        { title: "Leia offline", body: "Depois de sincronizados, ficam na memória flash da calculadora — leia-os em qualquer lugar. O LaTeX é convertido automaticamente em ASCII no ecrã OLED (∞ como bitmap, frações como `(a)/(b)`, etc.)." },
      ],
    },
    s5: {
      eyebrow: "05 · Bateria", title: "Carregamento e bateria.", accent: "Carregamento",
      note: "O que mais consome é o **OLED a 12V** (conversor elevador MT3608). Reduza a suspensão automática para 1–2 minutos e a autonomia aumenta 2–3×. Definicoes → Ecra → Suspensao.",
      body: "**Carregamento**: USB-C (não requer PD, serve qualquer carregador de ≥5V/1A). O LED da placa acende durante o carregamento e apaga aos 100 %. A bateria está protegida contra sobrecarga (MCP73831 + DW01A).",
      stats: [
        { val: "1500", unit: "mAh", label: "Capacidade (LiPo)" },
        { val: "~2", unit: "h", label: "Carregamento completo" },
        { val: "2–3", unit: "dias", label: "Utilização típica" },
        { val: "5–7", unit: "dias", label: "Em espera" },
      ],
    },
    s6: {
      eyebrow: "06 · Atualizações", title: "OTA — atualizações de firmware.", accent: "atualizações",
      step1Title: "Verifique se há atualizações",
      step1: (v) => `Definicoes → Sistema → Atualizacao → OK. A calculadora pergunta ao servidor se existe uma versão mais recente do que a sua (mostrada como \`v${v}\`, etc.).`,
      step2Title: "Instale",
      step2: "Se houver uma nova — mostra a lista de alterações + o botão `OK = instalar`. Transfere (~1 MB), grava a partição OTA e reinicia. ~1 minuto. Não desligue a alimentação durante a atualização.",
      note: "As atualizações são **gratuitas** e opcionais. O firmware antigo continua a funcionar, mas as novas funções (p. ex. melhor LaTeX) exigem a atualização.",
      versionLabel: "/ VERSÃO ATUAL NO SERVIDOR:",
      versionHint: "Veja a sua versão em Definicoes → Sistema → Atualizacao (ou Definicoes → Informacao → Sobre aparelho).",
    },
    s7: {
      eyebrow: "07 · Problemas", title: "Resolução de problemas comuns.", accent: "problemas",
      problems: [
        { issue: "O ecrã não liga / fica preto", fix: "1) Verifique o interruptor (deve estar em ON). 2) Carregue 30+ minutos — a bateria pode estar totalmente descarregada. 3) Se o LED de carregamento não acender ao ligar o USB-C — o cabo/porta está danificado." },
        { issue: "O WiFi não encontra redes / lista vazia", fix: "Definicoes → WiFi e conta → Rede WiFi → OK Procurar. Se continuar vazia — desde a v0.6.4 existe um reinício automático do rádio. Tente novamente após 5 segundos. As redes de 5 GHz não são suportadas (ESP32 = apenas 2,4 GHz)." },
        { issue: "AI Chat: 'AI error 400' ou tempo esgotado", fix: "1) Verifique o WiFi (Definicoes → WiFi e conta → Estado da conta — deve mostrar 'Estado: ASSOCIADO'). 2) A conta precisa de tokens de IA — consulte e carregue o saldo no painel, no separador AI. 3) Experimente um exercício mais curto — o limite é ~2000 caracteres." },
        { issue: "Algumas teclas não respondem", fix: "Definicoes → Diagnostico → Teste teclado. Se a tecla acender quando a prime — funciona (o problema está noutro lado). Se não acender — é uma avaria física (soldadura fria, cabo FFC). Contacte-nos através do formulário." },
        { issue: "As notas/testes não sincronizam", fix: "1) O WiFi tem de funcionar. 2) A conta tem de estar associada (Definicoes → WiFi e conta → Estado da conta = 'Estado: ASSOCIADO'). 3) Verifique em kalkmate.pl/panel se estão na sua conta. 4) Se houver dados a mais (>50 testes ou >160 KB no total) — a calculadora não transfere tudo." },
        { issue: "O conversor MT3608 zumbe / o ecrã tem riscas", fix: "É um problema de hardware com os condensadores cerâmicos (piezoelétricos). Contacte-nos através do formulário — substituímos a placa ao abrigo da garantia." },
      ],
    },
    s8: {
      eyebrow: "08 · FAQ", title: "Perguntas frequentes.", accent: "frequentes",
      faqs: [
        { q: "Como ligo / desligo a calculadora?", a: "Deslize o interruptor lateral. Desligar não apaga as notas nem o histórico — tudo fica guardado na memória interna." },
        { q: "Quanto tempo dura a bateria?", a: "Utilização mista (algumas horas de IA + o resto em suspensão): ~2–3 dias. Em espera: 5–7 dias. Carregamento completo: ~2 horas por USB-C." },
        { q: "Porque é que o AI Chat precisa de WiFi?", a: "As respostas são calculadas pelo servidor (modelo Gemini). Sem WiFi só funcionam a calculadora, as notas e os testes. Configuração: Definicoes → WiFi e conta → Rede WiFi." },
        { q: "O que é a tecla Panic?", a: "Uma tecla (MU por predefinição) que regressa DE IMEDIATO ao modo calculadora a partir de qualquer ecrã. Útil quando alguém está a ver. Pode alterá-la em Definicoes → Seguranca → Tecla panico." },
        { q: "Como adiciono notas / testes?", a: "Apenas através do painel de cliente em kalkmate.pl/panel. A calculadora sincroniza-os por WiFi (Notas → v = sync). No dispositivo só os lê, não os edita." },
        { q: "Para que serve o „código de IA\"?", a: "Um código de quatro dígitos (predefinido 1111) que escreve no modo calculadora para desbloquear o menu de IA. Sem ele, a calculadora parece uma Esperanza T8809-2 comum." },
        { q: "Como associo a calculadora à minha conta?", a: "1) Crie uma conta em kalkmate.pl. 2) Ative o código da caixa no separador AI — adiciona 2 milhões de tokens (em compras online é atribuído automaticamente). 3) Na calculadora: Definicoes → WiFi e conta → ID aparelho + QR — regista-se no servidor. 4) No painel, na secção Calculadora, introduza o Device ID + o código de IA." },
        { q: "O ecrã pisca / mostra riscas brancas — o que faço?", a: "Normalmente é o conversor de 12V (MT3608) a zumbir/instável. Contacte-nos através do formulário — enviamos-lhe uma placa nova. Coberto pela garantia de 24 meses." },
        { q: "Uma tecla não funciona — dá para resolver por software?", a: "Se for um problema de mapeamento (após ressoldar) — sim, temos a ferramenta keymap_scan, que remapeia as teclas. Escreva-nos através do formulário e enviamos o ficheiro." },
        { q: "Como atualizo o firmware?", a: "Definicoes → Sistema → Atualizacao → OK. A calculadora consulta o servidor, pede confirmação, transfere + grava + reinicia. Todo o processo demora ~1 minuto com WiFi." },
        { q: "Esqueci-me da palavra-passe da conta", a: "Aceda a kalkmate.pl/auth/forgot-password — enviamos uma ligação de reposição para o seu email (válida durante 60 minutos)." },
        { q: "Posso devolver a calculadora?", a: "Sim, no prazo de 14 dias após a entrega, sem indicar o motivo (nos termos do direito do consumidor da UE). Basta enviar um email para kontakt@kalkmate.pl com o número da encomenda. Excetuam-se as unidades personalizadas a seu pedido (código de IA próprio + nome na etiqueta)." },
      ],
    },
    s9: {
      eyebrow: "09 · Changelog", title: "Histórico do firmware.", accent: "firmware",
      intro: "Todas as versões publicadas. Atualize em Definicoes → Sistema → Atualizacao.",
    },
    s10: {
      eyebrow: "10 · Contacto", title: "Escreva-nos.", accent: "Escreva-nos",
      intro: "Respondo em 24 h (normalmente mais depressa). Também pode escrever diretamente para kontakt@kalkmate.pl — em inglês, se preferir.",
      sentTitle: "/ ENVIADO",
      sentBody: "Obrigado pela sua mensagem. Respondo o mais depressa possível para o email indicado.",
      sentAgain: "Enviar outra →",
      labelName: "Nome", labelEmail: "Email", labelSubject: "Assunto", labelSubjectOptional: "opcional", labelMessage: "Mensagem",
      placeholderName: "Inês Silva", placeholderEmail: "o.seu@email.pt", placeholderSubject: "p. ex. Problema com o WiFi", placeholderMessage: "Descreva o problema ou faça a sua pergunta...",
      errorLabel: "/ ERRO", sending: "A enviar...", send: "Enviar mensagem",
      errSend: "Não foi possível enviar a mensagem", errNetwork: "Erro de rede",
    },
    footerTagline: "Calculadora com IA",
    footerTerms: "Termos e Condições",
    footerPrivacy: "Política de Privacidade",
    footerCe: "Declaração UE de conformidade (CE)",
  },

  fr: {
    metaTitle: "Aide et mode d'emploi — KalkMate",
    metaDesc:
      "Mode d'emploi de la calculatrice KalkMate : première mise en route, configuration WiFi, mode IA, dépannage et historique du firmware.",
    navHome: "← Accueil",
    navPanel: "Espace client",
    heroEyebrow: "[ aide ] · v3.0",
    heroTitleLine1: "Aide &",
    heroTitleAccent: "documentation",
    heroDesc: (v) =>
      `Tout ce qu'il vous faut pour démarrer : mode d'emploi, vidéos, FAQ et contact. Contenu mis à jour pour le firmware v${v}.`,
    sections: [
      { id: "start", label: "01 · Première mise en route" },
      { id: "klawiatura", label: "02 · Navigation au clavier" },
      { id: "ai", label: "03 · Mode IA" },
      { id: "notatki", label: "04 · Notes et contrôles" },
      { id: "bateria", label: "05 · Batterie et recharge" },
      { id: "ota", label: "06 · Mises à jour (OTA)" },
      { id: "problemy", label: "07 · Dépannage" },
      { id: "faq", label: "08 · FAQ" },
      { id: "changelog", label: "09 · Changelog du firmware" },
      { id: "kontakt", label: "10 · Contact" },
    ],
    s1: {
      eyebrow: "01 · Démarrage", title: "Première mise en route.", accent: "mise en route",
      videoLabel: "Vidéo : première mise en route",
      steps: [
        { title: "Rechargez-la", body: "Branchez le câble USB-C fourni sur la calculatrice et sur un chargeur ≥5V/1A. Une recharge complète prend ~2 h. La LED de la carte s'allume pendant la charge." },
        { title: "Allumez-la", body: "Faites glisser l'interrupteur latéral sur ON. Après ~2 s, vous verrez l'écran d'accueil KalkMate, puis l'**écran de la calculatrice** (affichage numérique)." },
        { title: "Ouvrez le menu IA", body: "Sur le clavier de la calculatrice, tapez le **code de déverrouillage** (par défaut `1111`) — uniquement des chiffres, sans opérateur entre eux. L'écran affiche brièvement „AI\" puis ouvre le menu principal. C'est seulement maintenant que Parametres et les autres fonctions sont disponibles." },
        { title: "Configurez le WiFi", body: "Parametres → WiFi et compte → Reseau WiFi → choisissez un réseau dans la liste → saisissez le mot de passe (clavier à l'écran). Nécessaire pour l'IA, la synchronisation des notes et les mises à jour OTA." },
        { title: "Associez votre compte", body: "Créez un compte sur kalkmate.pl (confirmez votre e-mail). Sur la calculatrice : Parametres → WiFi et compte → ID appareil + QR — elle s'enregistre sur le serveur et affiche un QR code à scanner. Confirmez l'association dans l'espace client kalkmate.pl. Sans cela, la calculatrice fonctionne hors ligne." },
      ],
    },
    s2: {
      eyebrow: "02 · Clavier", title: "Navigation avec les touches.", accent: "touches",
      intro: "Le clavier compte 27 touches disposées en 5×6. Dans les menus et réglages, vous naviguez avec le **pavé numérique** :",
      note: "En **mode calculatrice**, les touches de chiffres et d'opérateurs fonctionnent normalement (5 = cinq, 4 = quatre, etc.). Le pavé numérique ne sert à la navigation que dans les menus et réglages.",
      videoLabel: "Navigation sur le clavier à l'écran de l'IA",
      legend: { nav: "NAVIGATION", panic: "PANIC", standard: "STANDARD" },
      keyRows: [
        { key: "8", desc: "Haut" },
        { key: "2", desc: "Bas" },
        { key: "4", desc: "Gauche" },
        { key: "6", desc: "Droite" },
        { key: "5", desc: "OK / Valider", accent: true },
        { key: "C/CE", desc: "Retour / Annuler" },
        { key: "MU", desc: "PANIC — retour immédiat au mode calculatrice", accent: true },
        { key: "▶", desc: "En mode calculatrice : effacement (backspace)" },
      ],
    },
    s3: {
      eyebrow: "03 · Mode IA", title: "Résoudre des exercices.", accent: "exercices",
      intro: "KalkMate envoie votre exercice à l'IA (modèle Gemini via notre serveur) et renvoie la solution étape par étape. Fonctionne pour les **maths, la physique, la chimie et la biologie**.",
      steps: [
        { title: "Saisissez le code IA", body: "En mode calculatrice, tapez les 4 chiffres (par défaut `1111`) sans aucune opération entre eux. Le menu IA s'ouvre." },
        { title: "Choisissez un mode", body: "**[1] Photo camera** — dirigez la caméra vers l'exercice. Aperçu en direct à l'écran (indicateur de netteté à droite), appuyez sur `5 (OK)` pour prendre la photo et l'envoyer à l'IA.\n\n**[2] Saisir texte** — clavier QWERTY à l'écran : 8/4/6/2 = naviguer, 5 = choisir un caractère, validez avec le bouton OK (2000 caractères max.).\n\n**[3] Histor.** — parcourez les solutions précédentes (hors ligne). Le bouton → (droite) ouvre la question pour la modifier et la renvoyer à l'IA." },
        { title: "Niveau de détail", body: "Dans Parametres → Resolution → Mode solution, choisissez :", list: ["**Detaille** — étape par étape avec explications", "**Calculs** — uniquement les formules + étapes", "**Resultat** — uniquement la réponse finale"] },
        { title: "Lire la réponse", body: "Avec 8 / 2 (haut/bas), vous faites défiler les longues réponses. C/CE revient au menu. Chaque réponse est enregistrée automatiquement dans l'historique." },
      ],
    },
    s4: {
      eyebrow: "04 · Mémoire", title: "Notes et contrôles.", accent: "contrôles",
      intro: "KalkMate stocke jusqu'à **50 notes (60 Ko)** et **50 contrôles (160 Ko)** hors ligne — lisibles même sans WiFi. Vous les modifiez sur kalkmate.pl/panel.",
      steps: [
        { title: "Ajoutez-les sur le site", body: "Allez sur kalkmate.pl/panel → onglet Notes / Contrôles → ajoutez le contenu (jusqu'à 4000 caractères par note, 30 000 par contrôle). LaTeX et markdown pris en charge." },
        { title: "Synchronisez la calculatrice", body: "Sur la calculatrice : Notes → cliquez sur la flèche vers le bas (v = sync). WiFi requis. Télécharge tout depuis votre compte." },
        { title: "Lisez hors ligne", body: "Après synchronisation, ils sont stockés dans la mémoire flash de la calculatrice — lisez-les partout. Le LaTeX est converti automatiquement en ASCII sur l'écran OLED (∞ en bitmap, fractions sous la forme `(a)/(b)`, etc.)." },
      ],
    },
    s5: {
      eyebrow: "05 · Batterie", title: "Recharge et batterie.", accent: "Recharge",
      note: "C'est l'**OLED en 12V** (convertisseur élévateur MT3608) qui consomme le plus. Réduisez la mise en veille automatique à 1–2 minutes pour multiplier l'autonomie par 2–3. Parametres → Affichage → Veille auto.",
      body: "**Recharge** : USB-C (PD non requis, n'importe quel chargeur ≥5V/1A convient). La LED de la carte s'allume pendant la charge et s'éteint à 100 %. La batterie est protégée contre la surcharge (MCP73831 + DW01A).",
      stats: [
        { val: "1500", unit: "mAh", label: "Capacité (LiPo)" },
        { val: "~2", unit: "h", label: "Recharge complète" },
        { val: "2–3", unit: "jours", label: "Usage typique" },
        { val: "5–7", unit: "jours", label: "Veille" },
      ],
    },
    s6: {
      eyebrow: "06 · Mises à jour", title: "OTA — mises à jour du firmware.", accent: "mises à jour",
      step1Title: "Vérifiez la disponibilité",
      step1: (v) => `Parametres → Systeme → Mise a jour → OK. La calculatrice demande au serveur s'il existe une version plus récente que la vôtre (affichée sous la forme \`v${v}\`, etc.).`,
      step2Title: "Installez",
      step2: "S'il y en a une nouvelle, elle affiche la liste des changements + un bouton `OK = installer`. Elle télécharge (~1 Mo), flashe la partition OTA et redémarre. ~1 minute. Ne coupez pas l'alimentation pendant la mise à jour.",
      note: "Les mises à jour sont **gratuites** et facultatives. L'ancien firmware continue de fonctionner, mais les nouvelles fonctions (p. ex. un meilleur LaTeX) nécessitent la mise à jour.",
      versionLabel: "/ VERSION ACTUELLE DU SERVEUR :",
      versionHint: "Vérifiez votre version dans Parametres → Systeme → Mise a jour (ou Parametres → Informations → Infos appareil).",
    },
    s7: {
      eyebrow: "07 · Problèmes", title: "Résoudre les problèmes courants.", accent: "problèmes",
      problems: [
        { issue: "L'écran ne s'allume pas / reste noir", fix: "1) Vérifiez l'interrupteur (il doit être sur ON). 2) Rechargez 30+ minutes — la batterie est peut-être complètement vide. 3) Si la LED de charge ne s'allume pas en branchant l'USB-C — le câble/port est endommagé." },
        { issue: "Le WiFi ne trouve aucun réseau / liste vide", fix: "Parametres → WiFi et compte → Reseau WiFi → OK Scanner. Si elle reste vide — depuis la v0.6.4, la radio est réinitialisée automatiquement. Réessayez après 5 secondes. Les réseaux 5 GHz ne sont pas pris en charge (ESP32 = 2,4 GHz uniquement)." },
        { issue: "AI Chat : 'AI error 400' ou délai dépassé", fix: "1) Vérifiez le WiFi (Parametres → WiFi et compte → Etat du compte — doit afficher 'Statut: LIE'). 2) Le compte doit disposer de tokens IA — consultez et rechargez le solde dans l'espace client, onglet AI. 3) Essayez un exercice plus court — limite d'environ 2000 caractères." },
        { issue: "Certaines touches ne répondent pas", fix: "Parametres → Diagnostic → Test clavier. Si la touche s'allume quand vous appuyez — elle fonctionne (le problème est ailleurs). Sinon — c'est un défaut physique (soudure froide, câble FFC). Écrivez-nous via le formulaire." },
        { issue: "Les notes/contrôles ne se synchronisent pas", fix: "1) Le WiFi doit fonctionner. 2) Le compte doit être associé (Parametres → WiFi et compte → Etat du compte = 'Statut: LIE'). 3) Vérifiez sur kalkmate.pl/panel qu'ils sont bien sur votre compte. 4) S'il y a trop de données (>50 contrôles ou >160 Ko au total) — la calculatrice ne téléchargera pas tout." },
        { issue: "Le convertisseur MT3608 bourdonne / l'écran présente des bandes", fix: "Il s'agit d'un problème matériel lié aux condensateurs céramiques (piézoélectriques). Contactez-nous via le formulaire — nous remplacerons la carte sous garantie." },
      ],
    },
    s8: {
      eyebrow: "08 · FAQ", title: "Questions fréquentes.", accent: "fréquentes",
      faqs: [
        { q: "Comment allumer / éteindre la calculatrice ?", a: "Faites glisser l'interrupteur latéral. L'extinction n'efface ni les notes ni l'historique — tout est enregistré dans la mémoire interne." },
        { q: "Quelle est l'autonomie de la batterie ?", a: "Usage mixte (quelques heures d'IA + le reste en veille) : ~2–3 jours. Veille : 5–7 jours. Recharge complète : ~2 heures en USB-C." },
        { q: "Pourquoi AI Chat a-t-il besoin du WiFi ?", a: "Les réponses sont calculées par le serveur (modèle Gemini). Sans WiFi, seuls la calculatrice, les notes et les contrôles fonctionnent. Configuration : Parametres → WiFi et compte → Reseau WiFi." },
        { q: "Qu'est-ce que la touche Panic ?", a: "Une touche (MU par défaut) qui revient IMMÉDIATEMENT au mode calculatrice depuis n'importe quel écran. Pratique quand quelqu'un regarde. Vous pouvez la changer dans Parametres → Securite → Touche panic." },
        { q: "Comment ajouter des notes / contrôles ?", a: "Uniquement via l'espace client sur kalkmate.pl/panel. La calculatrice les synchronise en WiFi (Notes → v = sync). Sur l'appareil, vous pouvez seulement les lire, pas les modifier." },
        { q: "À quoi sert le „code IA\" ?", a: "Un code à quatre chiffres (par défaut 1111) que vous tapez en mode calculatrice pour déverrouiller le menu IA. Sans lui, la calculatrice ressemble à une Esperanza T8809-2 ordinaire." },
        { q: "Comment associer la calculatrice à mon compte ?", a: "1) Créez un compte sur kalkmate.pl. 2) Activez le code de la boîte dans l'onglet AI — il ajoute 2 millions de tokens (attribué automatiquement en cas d'achat en ligne). 3) Sur la calculatrice : Parametres → WiFi et compte → ID appareil + QR — elle s'enregistre sur le serveur. 4) Dans l'espace client, rubrique Calculatrice, saisissez le Device ID + le code IA." },
        { q: "L'écran clignote / affiche des bandes blanches — que faire ?", a: "Le plus souvent, c'est le convertisseur 12V (MT3608) qui bourdonne ou est instable. Contactez-nous via le formulaire — nous vous enverrons une nouvelle carte. Couvert par la garantie de 24 mois." },
        { q: "Une touche ne fonctionne pas — peut-on corriger cela par logiciel ?", a: "S'il s'agit d'un problème d'affectation (après ressoudure) — oui, nous avons l'outil keymap_scan qui réaffecte les touches. Écrivez-nous via le formulaire, nous vous enverrons le fichier." },
        { q: "Comment mettre à jour le firmware ?", a: "Parametres → Systeme → Mise a jour → OK. La calculatrice interroge le serveur, demande confirmation, télécharge + flashe + redémarre. L'ensemble prend ~1 minute avec le WiFi." },
        { q: "J'ai oublié le mot de passe de mon compte", a: "Rendez-vous sur kalkmate.pl/auth/forgot-password — nous enverrons un lien de réinitialisation à votre e-mail (valable 60 minutes)." },
        { q: "Puis-je retourner la calculatrice ?", a: "Oui, dans les 14 jours suivant la livraison, sans avoir à vous justifier (selon le droit de la consommation de l'UE). Il suffit d'écrire à kontakt@kalkmate.pl avec votre numéro de commande. Exception : les exemplaires personnalisés à votre demande (code IA personnel + prénom sur l'étiquette)." },
      ],
    },
    s9: {
      eyebrow: "09 · Changelog", title: "Historique du firmware.", accent: "firmware",
      intro: "Toutes les versions publiées. Mise à jour via Parametres → Systeme → Mise a jour.",
    },
    s10: {
      eyebrow: "10 · Contact", title: "Écrivez-nous.", accent: "Écrivez-nous",
      intro: "Je réponds sous 24 h (souvent plus vite). Vous pouvez aussi écrire directement à kontakt@kalkmate.pl — en anglais si vous préférez.",
      sentTitle: "/ ENVOYÉ",
      sentBody: "Merci pour votre message. Je vous répondrai au plus vite à l'adresse e-mail indiquée.",
      sentAgain: "Envoyer un autre message →",
      labelName: "Nom", labelEmail: "E-mail", labelSubject: "Objet", labelSubjectOptional: "facultatif", labelMessage: "Message",
      placeholderName: "Léa Martin", placeholderEmail: "votre@email.fr", placeholderSubject: "p. ex. Problème de WiFi", placeholderMessage: "Décrivez le problème ou posez votre question...",
      errorLabel: "/ ERREUR", sending: "Envoi en cours...", send: "Envoyer le message",
      errSend: "Impossible d'envoyer le message", errNetwork: "Erreur réseau",
    },
    footerTagline: "Calculatrice avec IA",
    footerTerms: "Conditions générales de vente",
    footerPrivacy: "Politique de confidentialité",
    footerCe: "Déclaration UE de conformité (CE)",
  },

  it: {
    metaTitle: "Assistenza e manuale d'uso — KalkMate",
    metaDesc:
      "Manuale d'uso della calcolatrice KalkMate: primo avvio, configurazione WiFi, modalità IA, risoluzione dei problemi e cronologia del firmware.",
    navHome: "← Home",
    navPanel: "Pannello",
    heroEyebrow: "[ assistenza ] · v3.0",
    heroTitleLine1: "Assistenza &",
    heroTitleAccent: "documentazione",
    heroDesc: (v) =>
      `Tutto ciò che ti serve per iniziare: manuale, video, FAQ e contatti. Contenuti aggiornati per il firmware v${v}.`,
    sections: [
      { id: "start", label: "01 · Primo avvio" },
      { id: "klawiatura", label: "02 · Navigazione con la tastiera" },
      { id: "ai", label: "03 · Modalità IA" },
      { id: "notatki", label: "04 · Note e verifiche" },
      { id: "bateria", label: "05 · Batteria e ricarica" },
      { id: "ota", label: "06 · Aggiornamenti (OTA)" },
      { id: "problemy", label: "07 · Risoluzione dei problemi" },
      { id: "faq", label: "08 · FAQ" },
      { id: "changelog", label: "09 · Changelog del firmware" },
      { id: "kontakt", label: "10 · Contatti" },
    ],
    s1: {
      eyebrow: "01 · Avvio", title: "Primo avvio.", accent: "avvio",
      videoLabel: "Video: primo avvio",
      steps: [
        { title: "Caricala", body: "Collega il cavo USB-C in dotazione alla calcolatrice e a un caricatore ≥5V/1A. La ricarica completa richiede ~2 h. Il LED sulla scheda si accende durante la ricarica." },
        { title: "Accendila", body: "Sposta l'interruttore laterale su ON. Dopo ~2 s vedrai la schermata di benvenuto KalkMate e poi la **schermata della calcolatrice** (display digitale)." },
        { title: "Apri il menu IA", body: "Sulla tastiera della calcolatrice digita il **codice di sblocco** (predefinito `1111`) — solo cifre, senza operatori in mezzo. Lo schermo mostra per un attimo „AI\" e apre il menu principale. Solo ora sono disponibili Impostazioni e le altre funzioni." },
        { title: "Configura il WiFi", body: "Impostazioni → WiFi e account → Rete WiFi → scegli una rete dall'elenco → inserisci la password (tastiera su schermo). Necessario per l'IA, la sincronizzazione delle note e gli aggiornamenti OTA." },
        { title: "Collega il tuo account", body: "Crea un account su kalkmate.pl (conferma l'email). Sulla calcolatrice: Impostazioni → WiFi e account → ID disposit. + QR — si registra sul server e mostra un codice QR da scansionare. Conferma il collegamento nel pannello kalkmate.pl. Senza questo passaggio la calcolatrice funziona in modalità offline." },
      ],
    },
    s2: {
      eyebrow: "02 · Tastiera", title: "Navigazione con i tasti.", accent: "tasti",
      intro: "La tastiera ha 27 tasti disposti in 5×6. Nei menu e nelle impostazioni ti muovi con il **tastierino numerico**:",
      note: "In **modalità calcolatrice** i tasti delle cifre e degli operatori funzionano normalmente (5 = cinque, 4 = quattro, ecc.). Il tastierino numerico funge da navigazione solo nei menu e nelle impostazioni.",
      videoLabel: "Navigazione nella tastiera su schermo dell'IA",
      legend: { nav: "NAVIGAZIONE", panic: "PANIC", standard: "STANDARD" },
      keyRows: [
        { key: "8", desc: "Su" },
        { key: "2", desc: "Giù" },
        { key: "4", desc: "Sinistra" },
        { key: "6", desc: "Destra" },
        { key: "5", desc: "OK / Conferma", accent: true },
        { key: "C/CE", desc: "Indietro / Annulla" },
        { key: "MU", desc: "PANIC — ritorno immediato alla modalità calcolatrice", accent: true },
        { key: "▶", desc: "In modalità calcolatrice: cancella (backspace)" },
      ],
    },
    s3: {
      eyebrow: "03 · Modalità IA", title: "Risolvere esercizi.", accent: "esercizi",
      intro: "KalkMate invia il tuo esercizio all'IA (modello Gemini tramite il nostro server) e restituisce la soluzione passo per passo. Funziona per **matematica, fisica, chimica e biologia**.",
      steps: [
        { title: "Inserisci il codice IA", body: "In modalità calcolatrice digita le 4 cifre (predefinito `1111`) senza alcuna operazione in mezzo. Si apre il menu IA." },
        { title: "Scegli una modalità", body: "**[1] Foto camera** — inquadra l'esercizio con la fotocamera. Anteprima dal vivo sullo schermo (indicatore di messa a fuoco a destra), premi `5 (OK)` per scattare la foto e inviarla all'IA.\n\n**[2] Scrivi testo** — tastiera QWERTY su schermo: 8/4/6/2 = navigazione, 5 = scegli carattere, conferma con il pulsante OK (max 2000 caratteri).\n\n**[3] Storico** — consulta le soluzioni precedenti (offline). Il pulsante → (destra) apre la domanda per modificarla e reinviarla all'IA." },
        { title: "Livello di dettaglio", body: "In Impostazioni → Risoluzione → Modo soluzione scegli:", list: ["**Dettagliato** — passo per passo con spiegazioni", "**Solo calc.** — solo formule + passaggi", "**Risultato** — solo la risposta finale"] },
        { title: "Leggere la risposta", body: "Con 8 / 2 (su/giù) scorri le risposte lunghe. C/CE torna al menu. Ogni risposta viene salvata automaticamente nella cronologia." },
      ],
    },
    s4: {
      eyebrow: "04 · Memoria", title: "Note e verifiche.", accent: "verifiche",
      intro: "KalkMate conserva fino a **50 note (60 KB)** e **50 verifiche (160 KB)** offline — le leggi anche senza WiFi. Le modifichi su kalkmate.pl/panel.",
      steps: [
        { title: "Aggiungile sul sito", body: "Vai su kalkmate.pl/panel → scheda Note / Verifiche → aggiungi il contenuto (fino a 4000 caratteri per nota, 30 000 per verifica). Supporta LaTeX e markdown." },
        { title: "Sincronizza con la calcolatrice", body: "Sulla calcolatrice: Note → clicca la freccia giù (v = sync). Richiede il WiFi. Scarica tutto dal tuo account." },
        { title: "Leggi offline", body: "Dopo la sincronizzazione sono salvate nella memoria flash della calcolatrice — leggile ovunque. Il LaTeX viene convertito automaticamente in ASCII sullo schermo OLED (∞ come bitmap, frazioni come `(a)/(b)`, ecc.)." },
      ],
    },
    s5: {
      eyebrow: "05 · Batteria", title: "Ricarica e batteria.", accent: "Ricarica",
      note: "A consumare di più è l'**OLED a 12V** (convertitore boost MT3608). Riduci lo spegnimento automatico a 1–2 minuti per un'autonomia 2–3 volte maggiore. Impostazioni → Schermo → Sospensione.",
      body: "**Ricarica**: USB-C (PD non necessario, va bene qualsiasi caricatore ≥5V/1A). Il LED sulla scheda si accende durante la ricarica e si spegne al 100%. La batteria è protetta dal sovraccarico (MCP73831 + DW01A).",
      stats: [
        { val: "1500", unit: "mAh", label: "Capacità (LiPo)" },
        { val: "~2", unit: "h", label: "Ricarica completa" },
        { val: "2–3", unit: "giorni", label: "Uso tipico" },
        { val: "5–7", unit: "giorni", label: "Standby" },
      ],
    },
    s6: {
      eyebrow: "06 · Aggiornamenti", title: "OTA — aggiornamenti del firmware.", accent: "aggiornamenti",
      step1Title: "Verifica la disponibilità",
      step1: (v) => `Impostazioni → Sistema → Aggiornamento → OK. La calcolatrice chiede al server se esiste una versione più recente della tua (mostrata come \`v${v}\`, ecc.).`,
      step2Title: "Installa",
      step2: "Se ce n'è una nuova, mostra l'elenco delle modifiche + il pulsante `OK = installa`. Scarica (~1 MB), scrive la partizione OTA e si riavvia. ~1 minuto. Non scollegare l'alimentazione durante l'aggiornamento.",
      note: "Gli aggiornamenti sono **gratuiti** e facoltativi. Il vecchio firmware continuerà a funzionare, ma le nuove funzioni (ad es. un LaTeX migliore) richiedono l'aggiornamento.",
      versionLabel: "/ VERSIONE ATTUALE SUL SERVER:",
      versionHint: "Controlla la tua versione in Impostazioni → Sistema → Aggiornamento (oppure Impostazioni → Informazioni → Info disposit.).",
    },
    s7: {
      eyebrow: "07 · Problemi", title: "Risoluzione dei problemi comuni.", accent: "problemi",
      problems: [
        { issue: "Lo schermo non si accende / resta nero", fix: "1) Controlla l'interruttore (deve essere su ON). 2) Ricarica per 30+ minuti — la batteria potrebbe essere completamente scarica. 3) Se il LED di ricarica non si accende collegando l'USB-C — il cavo/la porta è danneggiato." },
        { issue: "Il WiFi non trova reti / elenco vuoto", fix: "Impostazioni → WiFi e account → Rete WiFi → OK Cerca. Se resta vuoto — dalla v0.6.4 c'è un reset automatico della radio. Riprova dopo 5 secondi. Le reti a 5 GHz non sono supportate (ESP32 = solo 2,4 GHz)." },
        { issue: "AI Chat: 'AI error 400' o timeout", fix: "1) Controlla il WiFi (Impostazioni → WiFi e account → Stato account — deve mostrare 'Stato: COLLEGATO'). 2) L'account deve avere token IA — controlla e ricarica il saldo nel pannello, scheda AI. 3) Prova un esercizio più breve — il limite è di ~2000 caratteri." },
        { issue: "Alcuni tasti non rispondono", fix: "Impostazioni → Diagnostica → Test tastiera. Se il tasto si illumina quando lo premi — funziona (il problema è altrove). Se non si illumina — è un guasto fisico (saldatura fredda, cavo FFC). Scrivici tramite il modulo." },
        { issue: "Le note/verifiche non si sincronizzano", fix: "1) Il WiFi deve funzionare. 2) L'account deve essere collegato (Impostazioni → WiFi e account → Stato account = 'Stato: COLLEGATO'). 3) Controlla su kalkmate.pl/panel che siano presenti nell'account. 4) Se i dati sono troppi (>50 verifiche o >160 KB in totale) — la calcolatrice non scaricherà tutto." },
        { issue: "Il convertitore MT3608 ronza / lo schermo ha delle righe", fix: "È un problema hardware dei condensatori ceramici (piezoelettrici). Contattaci tramite il modulo — sostituiremo la scheda in garanzia." },
      ],
    },
    s8: {
      eyebrow: "08 · FAQ", title: "Domande frequenti.", accent: "frequenti",
      faqs: [
        { q: "Come accendo / spengo la calcolatrice?", a: "Sposta l'interruttore laterale. Lo spegnimento non cancella le note né la cronologia — tutto resta salvato nella memoria interna." },
        { q: "Quanto dura la batteria?", a: "Uso misto (qualche ora di IA + il resto in standby): ~2–3 giorni. Standby: 5–7 giorni. Ricarica completa: ~2 ore via USB-C." },
        { q: "Perché AI Chat ha bisogno del WiFi?", a: "Le risposte vengono calcolate dal server (modello Gemini). Senza WiFi funzionano solo calcolatrice, note e verifiche. Configurazione: Impostazioni → WiFi e account → Rete WiFi." },
        { q: "Cos'è il tasto Panic?", a: "Un tasto (MU per impostazione predefinita) che riporta IMMEDIATAMENTE alla modalità calcolatrice da qualsiasi schermata. Utile quando qualcuno guarda. Puoi cambiarlo in Impostazioni → Sicurezza → Tasto panico." },
        { q: "Come aggiungo note / verifiche?", a: "Solo tramite il pannello clienti su kalkmate.pl/panel. La calcolatrice le sincronizza via WiFi (Note → v = sync). Sul dispositivo puoi solo leggerle, non modificarle." },
        { q: "A cosa serve il „codice IA\"?", a: "Un codice a quattro cifre (predefinito 1111) che digiti in modalità calcolatrice per sbloccare il menu IA. Senza di esso, la calcolatrice sembra una normale Esperanza T8809-2." },
        { q: "Come collego la calcolatrice al mio account?", a: "1) Crea un account su kalkmate.pl. 2) Attiva il codice nella confezione nella scheda AI — aggiunge 2 milioni di token (con l'acquisto online viene assegnato automaticamente). 3) Sulla calcolatrice: Impostazioni → WiFi e account → ID disposit. + QR — si registra sul server. 4) Nel pannello, sezione Calcolatrice, inserisci il Device ID + il codice IA." },
        { q: "Lo schermo sfarfalla / mostra righe bianche — cosa faccio?", a: "Di solito è il convertitore a 12V (MT3608) che ronza o è instabile. Contattaci tramite il modulo — ti invieremo una scheda nuova. Coperto dalla garanzia di 24 mesi." },
        { q: "Un tasto non funziona — si può risolvere via software?", a: "Se è un problema di mappatura (dopo una risaldatura) — sì, abbiamo lo strumento keymap_scan che rimappa i tasti. Scrivici tramite il modulo e ti invieremo il file." },
        { q: "Come aggiorno il firmware?", a: "Impostazioni → Sistema → Aggiornamento → OK. La calcolatrice interroga il server, chiede conferma, scarica + scrive + si riavvia. L'intero processo richiede ~1 minuto con il WiFi." },
        { q: "Ho dimenticato la password dell'account", a: "Vai su kalkmate.pl/auth/forgot-password — invieremo un link per reimpostarla alla tua email (valido 60 minuti)." },
        { q: "Posso restituire la calcolatrice?", a: "Sì, entro 14 giorni dalla consegna senza indicarne il motivo (secondo la normativa UE a tutela dei consumatori). Basta un'email a kontakt@kalkmate.pl con il numero d'ordine. Fanno eccezione gli esemplari personalizzati su tua richiesta (codice IA personale + nome sull'etichetta)." },
      ],
    },
    s9: {
      eyebrow: "09 · Changelog", title: "Cronologia del firmware.", accent: "firmware",
      intro: "Tutte le versioni rilasciate. Aggiornamento tramite Impostazioni → Sistema → Aggiornamento.",
    },
    s10: {
      eyebrow: "10 · Contatti", title: "Scrivici.", accent: "Scrivici",
      intro: "Rispondo entro 24 ore (di solito prima). Puoi anche scrivere direttamente a kontakt@kalkmate.pl — anche in inglese.",
      sentTitle: "/ INVIATO",
      sentBody: "Grazie per il messaggio. Ti risponderò il prima possibile all'email indicata.",
      sentAgain: "Invia un altro →",
      labelName: "Nome", labelEmail: "Email", labelSubject: "Oggetto", labelSubjectOptional: "facoltativo", labelMessage: "Messaggio",
      placeholderName: "Giulia Rossi", placeholderEmail: "tua@email.it", placeholderSubject: "es. Problema con il WiFi", placeholderMessage: "Descrivi il problema o fai una domanda...",
      errorLabel: "/ ERRORE", sending: "Invio in corso...", send: "Invia messaggio",
      errSend: "Impossibile inviare il messaggio", errNetwork: "Errore di rete",
    },
    footerTagline: "Calcolatrice con IA",
    footerTerms: "Termini e condizioni",
    footerPrivacy: "Informativa sulla privacy",
    footerCe: "Dichiarazione UE di conformità (CE)",
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
      // Komunikat z serwera jest po polsku — poza / pokazujemy wlasny w jezyku strony.
      if (!j.ok) setError((lang === "pl" && j.error) || t.s10.errSend);
      else { setSent(true); setForm({ name: "", email: "", subject: "", message: "" }); }
    } catch {
      setError(t.s10.errNetwork);
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
