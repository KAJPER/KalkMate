"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { usePanelLang } from "@/lib/usePanelLang";
import PanelLangSwitcher from "@/components/PanelLangSwitcher";
import { type Locale } from "@/lib/i18n";

const DATE_LOCALE: Record<Locale, string> = {
  pl: "pl-PL",
  en: "en-GB",
  de: "de-DE",
};

const DICT: Record<
  Locale,
  {
    saveModeError: string;
    confirmDeleteNote: string;
    confirmDeleteTest: string;
    claimError: string;
    loading: string;
    title: string;
    backToPanel: string;
    claimHeading: string;
    claimDescPrefix: string;
    claimRulePrefix: string;
    claimRule: string;
    claimPlaceholder: string;
    saving: string;
    assign: string;
    deviceHeading: string;
    license: string;
    deviceId: string;
    firmware: string;
    requests: string;
    lastContact: string;
    aiMode: string;
    maturaTitle: string;
    maturaLabel: string;
    rawTitle: string;
    rawLabel: string;
    rawDesc: string;
    maturaDesc: string;
    notesHeading: (n: number) => string;
    notesSync: string;
    editNote: string;
    newNote: string;
    noteTitlePlaceholder: string;
    noteContentPlaceholder: string;
    charsCount: (n: number, max: number) => string;
    cancel: string;
    savingShort: string;
    saveChanges: string;
    add: string;
    noNotes: string;
    untitled: string;
    emptyNote: string;
    edit: string;
    delete: string;
    testsHeading: (n: number) => string;
    testsSync: string;
    editTest: string;
    newTest: string;
    testTitlePlaceholder: string;
    testContentPlaceholder: string;
    noTests: string;
    testCharsCount: (n: number) => string;
    historyHeading: (n: number) => string;
    noHistory: string;
    photo: string;
    taskLabel: string;
    solutionLabel: string;
  }
> = {
  pl: {
    saveModeError: "Nie udalo sie zapisac trybu",
    confirmDeleteNote: "Usunąć notatkę?",
    confirmDeleteTest: "Usunąć sprawdzian?",
    claimError: "Nie udało się zaclaimować licencji",
    loading: "Ładowanie…",
    title: "Mój kalkulator",
    backToPanel: "← Powrót do panelu",
    claimHeading: "Przypisz licencję kalkulatora",
    claimDescPrefix:
      "Wpisz kod licencji który masz w urządzeniu (Settings → Licencja). Po zapisaniu zobaczysz tutaj historię swoich rozwiązań z kalkulatora.",
    claimRulePrefix: "Zasada:",
    claimRule: "jedno konto = jedna licencja = jedno urządzenie.",
    claimPlaceholder: "Np. h33=q%%ok21682y%",
    saving: "Zapisuję…",
    assign: "Przypisz",
    deviceHeading: "Twoje urządzenie",
    license: "Licencja:",
    deviceId: "Device ID (MAC):",
    firmware: "Firmware:",
    requests: "Zapytań:",
    lastContact: "Ostatni kontakt:",
    aiMode: "Tryb AI:",
    maturaTitle:
      "Tryb egzaminacyjny (matematyka, fizyka, chemia, biologia)",
    maturaLabel: "Egzamin",
    rawTitle:
      "Tryb uniwersalny — dowolny przedmiot (elektronika, informatyka, języki...)",
    rawLabel: "Czysty AI",
    rawDesc:
      "Tryb uniwersalny — AI działa dla elektroniki, informatyki, języków i innych.",
    maturaDesc:
      "Tryb egzaminacyjny — AI odpowiada krok po kroku (matematyka/fizyka/chemia/biologia).",
    notesHeading: (n) => `Notatki offline (${n}/50)`,
    notesSync: "Synchronizowane do urządzenia przy WiFi",
    editNote: "Edytuj notatkę",
    newNote: "Nowa notatka",
    noteTitlePlaceholder: "Tytuł (max 60 znaków)",
    noteContentPlaceholder: "Treść (max 4000 znaków - wzory, definicje, formuły...)",
    charsCount: (n, max) => `${n}/${max} znaków`,
    cancel: "Anuluj",
    savingShort: "Zapisuję...",
    saveChanges: "Zapisz zmiany",
    add: "Dodaj",
    noNotes:
      "Brak notatek. Dodaj swoją pierwszą — będzie dostępna offline na kalkulatorze.",
    untitled: "(bez tytułu)",
    emptyNote: "(pusta)",
    edit: "Edytuj",
    delete: "Usuń",
    testsHeading: (n) => `Sprawdziany (${n}/50)`,
    testsSync: "Wklej rozwiązanie z markdown/LaTeX. Synchronizuje się do urządzenia.",
    editTest: "Edytuj sprawdzian",
    newTest: "Nowy sprawdzian",
    testTitlePlaceholder: "Tytuł (np. Matma 2026 - próbna 1)",
    testContentPlaceholder:
      "Wklej tutaj rozwiązanie (markdown, LaTeX, wzory $..$, **bold**, listy itd.)",
    noTests:
      "Brak sprawdzianów. Wklej pierwszy — będzie dostępny offline na kalkulatorze.",
    testCharsCount: (n) => `${n} znaków`,
    historyHeading: (n) => `Historia rozwiązań (${n})`,
    noHistory: "Żadnych zadań jeszcze nie rozwiązano. Zacznij od kalkulatora.",
    photo: "📷 Zdjęcie",
    taskLabel: "Zadanie:",
    solutionLabel: "Rozwiązanie:",
  },
  en: {
    saveModeError: "Failed to save mode",
    confirmDeleteNote: "Delete this note?",
    confirmDeleteTest: "Delete this test?",
    claimError: "Failed to claim license",
    loading: "Loading…",
    title: "My calculator",
    backToPanel: "← Back to panel",
    claimHeading: "Assign a calculator license",
    claimDescPrefix:
      "Enter the license code shown on your device (Settings → License). Once saved, you'll see your calculator solution history here.",
    claimRulePrefix: "Rule:",
    claimRule: "one account = one license = one device.",
    claimPlaceholder: "e.g. h33=q%%ok21682y%",
    saving: "Saving…",
    assign: "Assign",
    deviceHeading: "Your device",
    license: "License:",
    deviceId: "Device ID (MAC):",
    firmware: "Firmware:",
    requests: "Requests:",
    lastContact: "Last contact:",
    aiMode: "AI mode:",
    maturaTitle:
      "Exam mode (math, physics, chemistry, biology)",
    maturaLabel: "Exam",
    rawTitle:
      "Universal mode — any subject (electronics, computer science, languages...)",
    rawLabel: "Raw AI",
    rawDesc:
      "Universal mode — the AI works for electronics, computer science, languages and more.",
    maturaDesc:
      "Exam mode — the AI answers step by step (math/physics/chemistry/biology).",
    notesHeading: (n) => `Offline notes (${n}/50)`,
    notesSync: "Synced to the device over WiFi",
    editNote: "Edit note",
    newNote: "New note",
    noteTitlePlaceholder: "Title (max 60 characters)",
    noteContentPlaceholder:
      "Content (max 4000 characters - equations, definitions, formulas...)",
    charsCount: (n, max) => `${n}/${max} characters`,
    cancel: "Cancel",
    savingShort: "Saving...",
    saveChanges: "Save changes",
    add: "Add",
    noNotes:
      "No notes yet. Add your first one — it will be available offline on the calculator.",
    untitled: "(no title)",
    emptyNote: "(empty)",
    edit: "Edit",
    delete: "Delete",
    testsHeading: (n) => `Tests (${n}/50)`,
    testsSync: "Paste a solution in markdown/LaTeX. Syncs to the device.",
    editTest: "Edit test",
    newTest: "New test",
    testTitlePlaceholder: "Title (e.g. Math 2026 - mock 1)",
    testContentPlaceholder:
      "Paste your solution here (markdown, LaTeX, $..$ formulas, **bold**, lists, etc.)",
    noTests:
      "No tests yet. Paste your first one — it will be available offline on the calculator.",
    testCharsCount: (n) => `${n} characters`,
    historyHeading: (n) => `Solution history (${n})`,
    noHistory: "No tasks solved yet. Start with the calculator.",
    photo: "📷 Photo",
    taskLabel: "Task:",
    solutionLabel: "Solution:",
  },
  de: {
    saveModeError: "Modus konnte nicht gespeichert werden",
    confirmDeleteNote: "Notiz löschen?",
    confirmDeleteTest: "Test löschen?",
    claimError: "Lizenz konnte nicht zugewiesen werden",
    loading: "Lädt…",
    title: "Mein Rechner",
    backToPanel: "← Zurück zum Panel",
    claimHeading: "Rechnerlizenz zuweisen",
    claimDescPrefix:
      "Gib den Lizenzcode ein, der auf deinem Gerät angezeigt wird (Settings → Lizenz). Nach dem Speichern siehst du hier den Verlauf deiner Rechner-Lösungen.",
    claimRulePrefix: "Regel:",
    claimRule: "ein Konto = eine Lizenz = ein Gerät.",
    claimPlaceholder: "z. B. h33=q%%ok21682y%",
    saving: "Speichere…",
    assign: "Zuweisen",
    deviceHeading: "Dein Gerät",
    license: "Lizenz:",
    deviceId: "Device ID (MAC):",
    firmware: "Firmware:",
    requests: "Anfragen:",
    lastContact: "Letzter Kontakt:",
    aiMode: "KI-Modus:",
    maturaTitle:
      "Prüfungsmodus (Mathe, Physik, Chemie, Biologie)",
    maturaLabel: "Prüfung",
    rawTitle:
      "Universeller Modus — beliebiges Fach (Elektronik, Informatik, Sprachen...)",
    rawLabel: "Reine KI",
    rawDesc:
      "Universeller Modus — die KI funktioniert für Elektronik, Informatik, Sprachen und mehr.",
    maturaDesc:
      "Prüfungsmodus — die KI antwortet Schritt für Schritt (Mathe/Physik/Chemie/Biologie).",
    notesHeading: (n) => `Offline-Notizen (${n}/50)`,
    notesSync: "Über WiFi mit dem Gerät synchronisiert",
    editNote: "Notiz bearbeiten",
    newNote: "Neue Notiz",
    noteTitlePlaceholder: "Titel (max. 60 Zeichen)",
    noteContentPlaceholder:
      "Inhalt (max. 4000 Zeichen - Gleichungen, Definitionen, Formeln...)",
    charsCount: (n, max) => `${n}/${max} Zeichen`,
    cancel: "Abbrechen",
    savingShort: "Speichere...",
    saveChanges: "Änderungen speichern",
    add: "Hinzufügen",
    noNotes:
      "Noch keine Notizen. Füge deine erste hinzu — sie ist offline auf dem Rechner verfügbar.",
    untitled: "(ohne Titel)",
    emptyNote: "(leer)",
    edit: "Bearbeiten",
    delete: "Löschen",
    testsHeading: (n) => `Tests (${n}/50)`,
    testsSync: "Füge eine Lösung in Markdown/LaTeX ein. Wird mit dem Gerät synchronisiert.",
    editTest: "Test bearbeiten",
    newTest: "Neuer Test",
    testTitlePlaceholder: "Titel (z. B. Mathe 2026 - Probe 1)",
    testContentPlaceholder:
      "Füge hier deine Lösung ein (Markdown, LaTeX, $..$-Formeln, **fett**, Listen usw.)",
    noTests:
      "Noch keine Tests. Füge deinen ersten ein — er ist offline auf dem Rechner verfügbar.",
    testCharsCount: (n) => `${n} Zeichen`,
    historyHeading: (n) => `Lösungsverlauf (${n})`,
    noHistory: "Noch keine Aufgaben gelöst. Beginne mit dem Rechner.",
    photo: "📷 Foto",
    taskLabel: "Aufgabe:",
    solutionLabel: "Lösung:",
  },
};

interface ClaimInfo {
  ok: boolean;
  claimed: boolean;
  license?: { code: string; durationDays: number; activatedAt: string | null };
  device?: {
    deviceId: string;
    firstSeen: string;
    lastSeen: string;
    requestCount: number;
    firmwareVersion: string | null;
    promptMode: string | null;
  } | null;
}

interface SolveItem {
  id: string;
  deviceId: string;
  mode: string;
  question: string;
  answer: string;
  createdAt: string;
}

interface Note {
  id: string;
  title: string;
  content: string;
  position: number;
  updatedAt: string;
}

interface Test {
  id: string;
  title: string;
  content: string;
  position: number;
  updatedAt: string;
}

function fmt(s: string, lang: Locale) {
  return new Date(s).toLocaleString(DATE_LOCALE[lang], {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function KalkulatorPage() {
  const { status } = useSession();
  const router = useRouter();
  const { lang, setLang } = usePanelLang();
  const t = DICT[lang];

  const [info, setInfo] = useState<ClaimInfo | null>(null);
  const [items, setItems] = useState<SolveItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState("");
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [opened, setOpened] = useState<SolveItem | null>(null);
  const [savingMode, setSavingMode] = useState(false);

  const setPromptMode = async (mode: "matura" | "raw") => {
    if (!info?.device?.deviceId) return;
    setSavingMode(true);
    try {
      const r = await fetch(
        `/api/user/devices?deviceId=${encodeURIComponent(info.device.deviceId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ promptMode: mode }),
        }
      );
      const j = await r.json();
      if (!j.ok) {
        alert(j.error || t.saveModeError);
      } else {
        setInfo((prev) =>
          prev?.device ? { ...prev, device: { ...prev.device, promptMode: mode === "raw" ? "raw" : null } } : prev
        );
      }
    } finally {
      setSavingMode(false);
    }
  };

  // Notatki
  const [notes, setNotes] = useState<Note[]>([]);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  // Sprawdziany
  const [tests, setTests] = useState<Test[]>([]);
  const [editingTest, setEditingTest] = useState<Test | null>(null);
  const [newTestTitle, setNewTestTitle] = useState("");
  const [newTestContent, setNewTestContent] = useState("");
  const [savingTest, setSavingTest] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/auth/signin");
  }, [status, router]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r1 = await fetch("/api/user/license/claim", { cache: "no-store" });
      const j1: ClaimInfo = await r1.json();
      setInfo(j1);
      if (j1.claimed) {
        const [r2, r3, r4] = await Promise.all([
          fetch("/api/user/conversations?limit=50", { cache: "no-store" }),
          fetch("/api/user/notes", { cache: "no-store" }),
          fetch("/api/user/tests", { cache: "no-store" }),
        ]);
        const j2 = await r2.json();
        const j3 = await r3.json();
        const j4 = await r4.json();
        setItems(j2.items || []);
        setNotes(j3.notes || []);
        setTests(j4.tests || []);
      } else {
        setItems([]);
        setNotes([]);
        setTests([]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, []);

  const saveNote = async () => {
    if (!newTitle.trim() && !newContent.trim()) return;
    setSavingNote(true);
    try {
      if (editingNote) {
        await fetch("/api/user/notes", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editingNote.id,
            title: newTitle,
            content: newContent,
          }),
        });
      } else {
        await fetch("/api/user/notes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: newTitle, content: newContent }),
        });
      }
      setEditingNote(null);
      setNewTitle("");
      setNewContent("");
      await load();
    } finally {
      setSavingNote(false);
    }
  };

  const deleteNote = async (id: string) => {
    if (!confirm(t.confirmDeleteNote)) return;
    await fetch(`/api/user/notes?id=${id}`, { method: "DELETE" });
    await load();
  };

  const startEdit = (n: Note) => {
    setEditingNote(n);
    setNewTitle(n.title);
    setNewContent(n.content);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // === Sprawdziany ===
  const saveTest = async () => {
    if (!newTestTitle.trim() && !newTestContent.trim()) return;
    setSavingTest(true);
    try {
      if (editingTest) {
        await fetch("/api/user/tests", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editingTest.id, title: newTestTitle, content: newTestContent }),
        });
      } else {
        await fetch("/api/user/tests", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: newTestTitle, content: newTestContent }),
        });
      }
      setEditingTest(null);
      setNewTestTitle("");
      setNewTestContent("");
      await load();
    } finally {
      setSavingTest(false);
    }
  };

  const deleteTest = async (id: string) => {
    if (!confirm(t.confirmDeleteTest)) return;
    await fetch(`/api/user/tests?id=${id}`, { method: "DELETE" });
    await load();
  };

  const startEditTest = (t: Test) => {
    setEditingTest(t);
    setNewTestTitle(t.title);
    setNewTestContent(t.content);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  useEffect(() => { load(); }, [load]);

  const handleClaim = async () => {
    if (!code.trim()) return;
    setClaiming(true);
    setError(null);
    try {
      const r = await fetch("/api/user/license/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });
      const j = await r.json();
      if (!j.ok) {
        setError(j.error || t.claimError);
      } else {
        setCode("");
        await load();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setClaiming(false);
    }
  };

  if (status === "loading" || loading) {
    return <div className="p-6">{t.loading}</div>;
  }

  return (
    <div className="min-h-screen bg-[#0B0B0B] text-[#F2EDE3] p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">{t.title}</h1>
          <div className="flex items-center gap-4">
            <PanelLangSwitcher lang={lang} setLang={setLang} />
            <Link href="/panel" className="text-sm text-[#D8FF3D] hover:underline">
              {t.backToPanel}
            </Link>
          </div>
        </div>

        {/* Sekcja claim licencji */}
        {!info?.claimed && (
          <div className="bg-[#0E0E0E] border border-[rgba(242,237,227,0.10)] rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-bold mb-2">{t.claimHeading}</h2>
            <p className="text-sm text-gray-600 mb-4">
              {t.claimDescPrefix}
              <br />
              <strong>{t.claimRulePrefix}</strong> {t.claimRule}
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder={t.claimPlaceholder}
                className="flex-1 px-3 py-2 border rounded font-mono text-sm"
              />
              <button
                onClick={handleClaim}
                disabled={claiming || !code.trim()}
                className="px-4 py-2 bg-[#D8FF3D] text-white rounded hover:bg-[#F2EDE3] disabled:opacity-50"
              >
                {claiming ? t.saving : t.assign}
              </button>
            </div>
            {error && <div className="mt-2 text-red-600 text-sm">{error}</div>}
          </div>
        )}

        {/* Info o urzadzeniu */}
        {info?.claimed && (
          <div className="bg-[#0E0E0E] border border-[rgba(242,237,227,0.10)] rounded-lg shadow p-6 mb-6">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-xl font-bold mb-2">{t.deviceHeading}</h2>
                <div className="text-sm space-y-1">
                  <div>
                    <span className="text-gray-500">{t.license}</span>{" "}
                    <span className="font-mono">{info.license?.code}</span>
                  </div>
                  {info.device && (
                    <>
                      <div>
                        <span className="text-gray-500">{t.deviceId}</span>{" "}
                        <span className="font-mono">{info.device.deviceId}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">{t.firmware}</span>{" "}
                        <span className="font-mono">
                          {info.device.firmwareVersion || "—"}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">{t.requests}</span>{" "}
                        <strong>{info.device.requestCount}</strong>
                      </div>
                      <div>
                        <span className="text-gray-500">{t.lastContact}</span>{" "}
                        {fmt(info.device.lastSeen, lang)}
                      </div>
                      <div className="pt-3 mt-3 border-t border-[rgba(242,237,227,0.10)]">
                        <div className="text-gray-500 mb-2">{t.aiMode}</div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setPromptMode("matura")}
                            disabled={savingMode}
                            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all border ${
                              info.device.promptMode !== "raw"
                                ? "bg-[#3B82F6] border-[#3B82F6] text-white"
                                : "bg-transparent border-[rgba(242,237,227,0.20)] text-gray-400 hover:text-gray-200"
                            } disabled:opacity-50`}
                            title={t.maturaTitle}
                          >
                            {t.maturaLabel}
                          </button>
                          <button
                            onClick={() => setPromptMode("raw")}
                            disabled={savingMode}
                            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all border ${
                              info.device.promptMode === "raw"
                                ? "bg-[#3B82F6] border-[#3B82F6] text-white"
                                : "bg-transparent border-[rgba(242,237,227,0.20)] text-gray-400 hover:text-gray-200"
                            } disabled:opacity-50`}
                            title="Tryb uniwersalny — dowolny przedmiot (elektronika, informatyka, języki...)"
                          >
                            Czysty AI
                          </button>
                        </div>
                        <div className="text-[11px] text-gray-500 mt-2">
                          {info.device.promptMode === "raw"
                            ? "Tryb uniwersalny — AI działa dla elektroniki, informatyki, języków i innych."
                            : "Tryb egzaminacyjny — AI odpowiada krok po kroku (matematyka/fizyka/chemia/biologia)."}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Sekcja Notatek */}
        {info?.claimed && (
          <div className="bg-[#0E0E0E] border border-[rgba(242,237,227,0.10)] rounded-lg shadow p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">
                {t.notesHeading(notes.length)}
              </h2>
              <span className="text-xs text-gray-500">
                {t.notesSync}
              </span>
            </div>

            <div className="bg-[#0B0B0B] text-[#F2EDE3] rounded p-4 mb-4">
              <div className="font-semibold mb-2 text-sm">
                {editingNote ? t.editNote : t.newNote}
              </div>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder={t.noteTitlePlaceholder}
                maxLength={60}
                className="w-full px-3 py-2 border rounded mb-2 text-sm"
              />
              <textarea
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                placeholder={t.noteContentPlaceholder}
                maxLength={4000}
                rows={5}
                className="w-full px-3 py-2 border rounded text-sm font-mono"
              />
              <div className="flex justify-between items-center mt-2">
                <div className="text-xs text-gray-500">
                  {t.charsCount(newContent.length, 4000)}
                </div>
                <div className="flex gap-2">
                  {editingNote && (
                    <button
                      onClick={() => {
                        setEditingNote(null);
                        setNewTitle("");
                        setNewContent("");
                      }}
                      className="px-3 py-1 text-sm bg-gray-200 hover:bg-gray-300 rounded"
                    >
                      {t.cancel}
                    </button>
                  )}
                  <button
                    onClick={saveNote}
                    disabled={savingNote || (!newTitle.trim() && !newContent.trim())}
                    className="px-3 py-1 text-sm bg-[#D8FF3D] text-white rounded hover:bg-[#F2EDE3] disabled:opacity-50"
                  >
                    {savingNote ? t.savingShort : editingNote ? t.saveChanges : t.add}
                  </button>
                </div>
              </div>
            </div>

            {notes.length === 0 ? (
              <div className="text-gray-500 text-sm text-center py-4">
                {t.noNotes}
              </div>
            ) : (
              <div className="space-y-2">
                {notes.map((n) => (
                  <div
                    key={n.id}
                    className="border rounded p-3 hover:bg-[#0B0B0B] text-[#F2EDE3]"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium">
                          {n.title || <span className="text-gray-400">{t.untitled}</span>}
                        </div>
                        <div className="text-xs text-gray-600 mt-1 whitespace-pre-wrap line-clamp-3">
                          {n.content || <span className="text-gray-400">{t.emptyNote}</span>}
                        </div>
                      </div>
                      <div className="ml-2 flex gap-1">
                        <button
                          onClick={() => startEdit(n)}
                          className="text-xs px-2 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded"
                        >
                          {t.edit}
                        </button>
                        <button
                          onClick={() => deleteNote(n.id)}
                          className="text-xs px-2 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded"
                        >
                          {t.delete}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Sekcja Sprawdziany */}
        {info?.claimed && (
          <div className="bg-[#0E0E0E] border border-[rgba(242,237,227,0.10)] rounded-lg shadow p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">
                {t.testsHeading(tests.length)}
              </h2>
              <span className="text-xs text-gray-500">
                {t.testsSync}
              </span>
            </div>

            <div className="bg-[#0B0B0B] text-[#F2EDE3] rounded p-4 mb-4">
              <div className="font-semibold mb-2 text-sm">
                {editingTest ? t.editTest : t.newTest}
              </div>
              <input
                type="text"
                value={newTestTitle}
                onChange={(e) => setNewTestTitle(e.target.value)}
                placeholder={t.testTitlePlaceholder}
                maxLength={100}
                className="w-full px-3 py-2 border rounded mb-2 text-sm"
              />
              <textarea
                value={newTestContent}
                onChange={(e) => setNewTestContent(e.target.value)}
                placeholder={t.testContentPlaceholder}
                maxLength={30000}
                rows={10}
                className="w-full px-3 py-2 border rounded text-sm font-mono"
              />
              <div className="flex justify-between items-center mt-2">
                <div className="text-xs text-gray-500">
                  {t.charsCount(newTestContent.length, 30000)}
                </div>
                <div className="flex gap-2">
                  {editingTest && (
                    <button
                      onClick={() => {
                        setEditingTest(null);
                        setNewTestTitle("");
                        setNewTestContent("");
                      }}
                      className="px-3 py-1 text-sm bg-gray-200 hover:bg-gray-300 rounded"
                    >
                      {t.cancel}
                    </button>
                  )}
                  <button
                    onClick={saveTest}
                    disabled={savingTest || (!newTestTitle.trim() && !newTestContent.trim())}
                    className="px-3 py-1 text-sm bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
                  >
                    {savingTest ? t.savingShort : editingTest ? t.saveChanges : t.add}
                  </button>
                </div>
              </div>
            </div>

            {tests.length === 0 ? (
              <div className="text-gray-500 text-sm text-center py-4">
                {t.noTests}
              </div>
            ) : (
              <div className="space-y-2">
                {tests.map((test) => (
                  <div key={test.id} className="border rounded p-3 hover:bg-[#0B0B0B] text-[#F2EDE3]">
                    <div className="flex justify-between items-start">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium">
                          {test.title || <span className="text-gray-400">{t.untitled}</span>}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {t.testCharsCount(test.content.length)}
                        </div>
                      </div>
                      <div className="ml-2 flex gap-1">
                        <button
                          onClick={() => startEditTest(test)}
                          className="text-xs px-2 py-1 bg-purple-100 hover:bg-purple-200 text-purple-700 rounded"
                        >
                          {t.edit}
                        </button>
                        <button
                          onClick={() => deleteTest(test.id)}
                          className="text-xs px-2 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded"
                        >
                          {t.delete}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Lista konwersacji */}
        {info?.claimed && (
          <div className="bg-[#0E0E0E] border border-[rgba(242,237,227,0.10)] rounded-lg shadow p-6">
            <h2 className="text-xl font-bold mb-4">
              {t.historyHeading(items.length)}
            </h2>
            {items.length === 0 ? (
              <div className="text-gray-500 text-sm">
                {t.noHistory}
              </div>
            ) : (
              <div className="space-y-3">
                {items.map((it) => (
                  <button
                    key={it.id}
                    onClick={() => setOpened(it)}
                    className="block w-full text-left bg-[#0B0B0B] text-[#F2EDE3] hover:bg-gray-100 rounded p-3 transition"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">
                          {it.mode === "image" ? t.photo : it.question}
                        </div>
                        <div className="text-xs text-gray-500 mt-1 line-clamp-2">
                          {it.answer.slice(0, 120)}…
                        </div>
                      </div>
                      <div className="text-xs text-gray-400 ml-2 whitespace-nowrap">
                        {fmt(it.createdAt, lang)}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Modal szczegolow */}
        {opened && (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
            onClick={() => setOpened(null)}
          >
            <div
              className="bg-[#0E0E0E] border border-[rgba(242,237,227,0.10)] rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <div className="text-xs text-gray-500">{fmt(opened.createdAt, lang)}</div>
                  <div className="text-xs font-mono text-gray-400">
                    {opened.deviceId}
                  </div>
                </div>
                <button
                  onClick={() => setOpened(null)}
                  className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
                >
                  ×
                </button>
              </div>
              <div className="mb-4">
                <div className="text-sm font-bold mb-1">{t.taskLabel}</div>
                <div className="bg-[#0B0B0B] text-[#F2EDE3] p-3 rounded text-sm whitespace-pre-wrap">
                  {opened.question}
                </div>
              </div>
              <div>
                <div className="text-sm font-bold mb-1">{t.solutionLabel}</div>
                <div className="bg-blue-50 p-3 rounded text-sm whitespace-pre-wrap font-mono">
                  {opened.answer}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
