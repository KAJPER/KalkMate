#!/usr/bin/env python3
"""Wklej zakladke 'Kalkulator' inline do /panel/page.tsx z dark theme."""
import re

path = "src/app/panel/page.tsx"
with open(path, "r", encoding="utf-8") as f:
    s = f.read()

# 1) Zmien typ activeTab
s = s.replace(
    'useState<"orders" | "chat" | "subscription">("orders")',
    'useState<"orders" | "chat" | "subscription" | "calculator">("orders")',
    1
)

# 2) Usun stary Link "Kalkulator" (jesli istnieje) i dodaj button do tab list
# Stary blok zaczyna sie od komentarza "{/* Link do osobnej strony"
import re as _re
old_link = _re.compile(
    r'\s*\{/\* Link do osobnej strony /panel/kalkulator \*/\}\s*<Link[\s\S]*?Kalkulator\s*</Link>\s*',
    _re.MULTILINE
)
s = old_link.sub("\n          ", s)

# 3) Dodaj 4 zakladke w listach tabs - wstaw przed `].map((tab) =>`
# Znajdz "subscription" tab block koniec
needle = '            { id: "subscription" as const, label: "Subskrypcja", icon: ('
if needle in s:
    # Znajdz koniec tej pozycji "  )},"
    idx = s.index(needle)
    # zlokalizuj koncowke "    ) },\n          ].map"
    end_of_subscription = s.index("          ].map", idx)
    new_tab = """            { id: "calculator" as const, label: "Kalkulator", icon: (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="4" y="2" width="16" height="20" rx="2" />
                <line x1="8" y1="6" x2="16" y2="6" />
                <line x1="8" y1="10" x2="16" y2="10" />
                <line x1="8" y1="14" x2="10" y2="14" />
                <line x1="13" y1="14" x2="16" y2="14" />
                <line x1="8" y1="18" x2="16" y2="18" />
              </svg>
            ) },
"""
    s = s[:end_of_subscription] + new_tab + s[end_of_subscription:]

# 4) Dodaj state + useEffect dla calculator (po deklaracji ordersLoading)
state_anchor = "  const [ordersLoading, setOrdersLoading] = useState(false);"
calc_state = """  const [ordersLoading, setOrdersLoading] = useState(false);

  // === Kalkulator: state ===
  const [calcInfo, setCalcInfo] = useState<any>(null);
  const [calcConvs, setCalcConvs] = useState<any[]>([]);
  const [calcNotes, setCalcNotes] = useState<any[]>([]);
  const [calcTests, setCalcTests] = useState<any[]>([]);
  const [calcLoading, setCalcLoading] = useState(false);
  const [calcClaimCode, setCalcClaimCode] = useState("");
  const [calcClaiming, setCalcClaiming] = useState(false);
  const [calcError, setCalcError] = useState<string | null>(null);
  const [calcOpenedConv, setCalcOpenedConv] = useState<any>(null);

  // Notes
  const [editingNote, setEditingNote] = useState<any>(null);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  // Tests
  const [editingTest, setEditingTest] = useState<any>(null);
  const [testTitle, setTestTitle] = useState("");
  const [testContent, setTestContent] = useState("");
  const [savingTest, setSavingTest] = useState(false);

  // Load calculator data when tab activated
  useEffect(() => {
    if (session && activeTab === "calculator") {
      const load = async () => {
        setCalcLoading(true);
        try {
          const r1 = await fetch("/api/user/license/claim", { cache: "no-store" });
          const j1 = await r1.json();
          setCalcInfo(j1);
          if (j1.claimed) {
            const [r2, r3, r4] = await Promise.all([
              fetch("/api/user/conversations?limit=50", { cache: "no-store" }),
              fetch("/api/user/notes", { cache: "no-store" }),
              fetch("/api/user/tests", { cache: "no-store" }),
            ]);
            setCalcConvs((await r2.json()).items || []);
            setCalcNotes((await r3.json()).notes || []);
            setCalcTests((await r4.json()).tests || []);
          }
        } finally {
          setCalcLoading(false);
        }
      };
      load();
    }
  }, [session, activeTab]);

  const calcDoClaim = async () => {
    if (!calcClaimCode.trim()) return;
    setCalcClaiming(true);
    setCalcError(null);
    try {
      const r = await fetch("/api/user/license/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: calcClaimCode.trim() }),
      });
      const j = await r.json();
      if (!j.ok) setCalcError(j.error || "Blad");
      else {
        setCalcClaimCode("");
        // reload
        const r1 = await fetch("/api/user/license/claim", { cache: "no-store" });
        setCalcInfo(await r1.json());
      }
    } finally {
      setCalcClaiming(false);
    }
  };

  const calcSaveNote = async () => {
    if (!noteTitle.trim() && !noteContent.trim()) return;
    setSavingNote(true);
    try {
      if (editingNote) {
        await fetch("/api/user/notes", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editingNote.id, title: noteTitle, content: noteContent }),
        });
      } else {
        await fetch("/api/user/notes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: noteTitle, content: noteContent }),
        });
      }
      setEditingNote(null); setNoteTitle(""); setNoteContent("");
      const r = await fetch("/api/user/notes", { cache: "no-store" });
      setCalcNotes((await r.json()).notes || []);
    } finally { setSavingNote(false); }
  };
  const calcDelNote = async (id: string) => {
    if (!confirm("Usunac notatke?")) return;
    await fetch(`/api/user/notes?id=${id}`, { method: "DELETE" });
    const r = await fetch("/api/user/notes", { cache: "no-store" });
    setCalcNotes((await r.json()).notes || []);
  };

  const calcSaveTest = async () => {
    if (!testTitle.trim() && !testContent.trim()) return;
    setSavingTest(true);
    try {
      if (editingTest) {
        await fetch("/api/user/tests", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editingTest.id, title: testTitle, content: testContent }),
        });
      } else {
        await fetch("/api/user/tests", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: testTitle, content: testContent }),
        });
      }
      setEditingTest(null); setTestTitle(""); setTestContent("");
      const r = await fetch("/api/user/tests", { cache: "no-store" });
      setCalcTests((await r.json()).tests || []);
    } finally { setSavingTest(false); }
  };
  const calcDelTest = async (id: string) => {
    if (!confirm("Usunac sprawdzian?")) return;
    await fetch(`/api/user/tests?id=${id}`, { method: "DELETE" });
    const r = await fetch("/api/user/tests", { cache: "no-store" });
    setCalcTests((await r.json()).tests || []);
  };
"""
s = s.replace(state_anchor, calc_state, 1)

# 5) Dodaj sekcje JSX dla activeTab === "calculator" — wstaw przed </AnimatePresence>
# Znajdz koncowke ostatniego tabu (subscription) - "</motion.div>\n          )}"
# i przed </AnimatePresence> wstaw nasz blok
end_anchor = "        </AnimatePresence>"
calc_jsx = '''
          {activeTab === "calculator" && (
            <motion.div
              key="calculator"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3, ease: "easeOut" as const }}
              className="space-y-6"
            >
              {calcLoading && (
                <div className="text-[#1a1a1a]/60 dark:text-[#E0E0E0]/60">Ladowanie...</div>
              )}

              {!calcLoading && calcInfo && !calcInfo.claimed && (
                <div className="bg-white dark:bg-[#2B2D31] rounded-2xl p-6 border border-gray-100 dark:border-[#3F4147]">
                  <h2 className="text-xl font-bold text-[#1a1a1a] dark:text-[#E0E0E0] mb-2">
                    Przypisz licencje kalkulatora
                  </h2>
                  <p className="text-sm text-[#1a1a1a]/60 dark:text-[#E0E0E0]/60 mb-4">
                    Wpisz kod licencji ktory masz w urzadzeniu (Settings → Licencja).
                    Po zapisaniu zobaczysz tutaj historie rozwiazan, notatki i sprawdziany z kalkulatora.
                    <br /><strong>Zasada:</strong> jedno konto = jedna licencja = jedno urzadzenie.
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={calcClaimCode}
                      onChange={(e) => setCalcClaimCode(e.target.value)}
                      placeholder="Np. h33=q%%ok21682y%"
                      className="flex-1 px-3 py-2 bg-white dark:bg-[#1A1B1E] border border-gray-200 dark:border-[#3F4147] rounded text-sm font-mono text-[#1a1a1a] dark:text-[#E0E0E0]"
                    />
                    <button
                      onClick={calcDoClaim}
                      disabled={calcClaiming || !calcClaimCode.trim()}
                      className="px-4 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded disabled:opacity-50"
                    >
                      {calcClaiming ? "Zapisuje..." : "Przypisz"}
                    </button>
                  </div>
                  {calcError && <div className="mt-2 text-red-400 text-sm">{calcError}</div>}
                </div>
              )}

              {!calcLoading && calcInfo && calcInfo.claimed && (
                <>
                  {/* Info o urzadzeniu */}
                  <div className="bg-white dark:bg-[#2B2D31] rounded-2xl p-6 border border-gray-100 dark:border-[#3F4147]">
                    <h2 className="text-xl font-bold text-[#1a1a1a] dark:text-[#E0E0E0] mb-3">
                      Twoje urzadzenie
                    </h2>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <div className="text-[#1a1a1a]/60 dark:text-[#E0E0E0]/60">Licencja</div>
                        <div className="font-mono text-[#1a1a1a] dark:text-[#E0E0E0]">{calcInfo.license?.code}</div>
                      </div>
                      {calcInfo.device && (
                        <>
                          <div>
                            <div className="text-[#1a1a1a]/60 dark:text-[#E0E0E0]/60">Device ID (MAC)</div>
                            <div className="font-mono text-[#1a1a1a] dark:text-[#E0E0E0]">{calcInfo.device.deviceId}</div>
                          </div>
                          <div>
                            <div className="text-[#1a1a1a]/60 dark:text-[#E0E0E0]/60">Firmware</div>
                            <div className="font-mono text-[#1a1a1a] dark:text-[#E0E0E0]">{calcInfo.device.firmwareVersion || "—"}</div>
                          </div>
                          <div>
                            <div className="text-[#1a1a1a]/60 dark:text-[#E0E0E0]/60">Zapytan</div>
                            <div className="font-bold text-[#3B82F6]">{calcInfo.device.requestCount}</div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Notatki */}
                  <div className="bg-white dark:bg-[#2B2D31] rounded-2xl p-6 border border-gray-100 dark:border-[#3F4147]">
                    <div className="flex justify-between items-center mb-4">
                      <h2 className="text-xl font-bold text-[#1a1a1a] dark:text-[#E0E0E0]">
                        Notatki offline ({calcNotes.length}/50)
                      </h2>
                      <span className="text-xs text-[#1a1a1a]/60 dark:text-[#E0E0E0]/60">
                        Sync do urzadzenia przy WiFi
                      </span>
                    </div>
                    <div className="bg-gray-50 dark:bg-[#1A1B1E] rounded p-4 mb-4 border border-gray-100 dark:border-[#3F4147]">
                      <div className="font-semibold mb-2 text-sm text-[#1a1a1a] dark:text-[#E0E0E0]">
                        {editingNote ? "Edytuj notatke" : "Nowa notatka"}
                      </div>
                      <input
                        type="text"
                        value={noteTitle}
                        onChange={(e) => setNoteTitle(e.target.value)}
                        placeholder="Tytul (max 60 znakow)"
                        maxLength={60}
                        className="w-full px-3 py-2 bg-white dark:bg-[#2B2D31] border border-gray-200 dark:border-[#3F4147] rounded mb-2 text-sm text-[#1a1a1a] dark:text-[#E0E0E0]"
                      />
                      <textarea
                        value={noteContent}
                        onChange={(e) => setNoteContent(e.target.value)}
                        placeholder="Tresc (max 4000 znakow - wzory, definicje)"
                        maxLength={4000}
                        rows={4}
                        className="w-full px-3 py-2 bg-white dark:bg-[#2B2D31] border border-gray-200 dark:border-[#3F4147] rounded text-sm font-mono text-[#1a1a1a] dark:text-[#E0E0E0]"
                      />
                      <div className="flex justify-between items-center mt-2">
                        <div className="text-xs text-[#1a1a1a]/60 dark:text-[#E0E0E0]/60">{noteContent.length}/4000</div>
                        <div className="flex gap-2">
                          {editingNote && (
                            <button
                              onClick={() => { setEditingNote(null); setNoteTitle(""); setNoteContent(""); }}
                              className="px-3 py-1 text-sm bg-gray-200 dark:bg-[#3F4147] hover:bg-gray-300 dark:hover:bg-[#4A4D52] text-[#1a1a1a] dark:text-[#E0E0E0] rounded"
                            >Anuluj</button>
                          )}
                          <button
                            onClick={calcSaveNote}
                            disabled={savingNote || (!noteTitle.trim() && !noteContent.trim())}
                            className="px-3 py-1 text-sm bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded disabled:opacity-50"
                          >{savingNote ? "Zapisuje..." : editingNote ? "Zapisz" : "Dodaj"}</button>
                        </div>
                      </div>
                    </div>
                    {calcNotes.length === 0 ? (
                      <div className="text-[#1a1a1a]/60 dark:text-[#E0E0E0]/60 text-sm text-center py-4">
                        Brak notatek.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {calcNotes.map((n: any) => (
                          <div key={n.id} className="border border-gray-100 dark:border-[#3F4147] rounded p-3 hover:bg-gray-50 dark:hover:bg-[#3F4147]/30">
                            <div className="flex justify-between items-start">
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-[#1a1a1a] dark:text-[#E0E0E0]">{n.title || "(bez tytulu)"}</div>
                                <div className="text-xs text-[#1a1a1a]/60 dark:text-[#E0E0E0]/60 mt-1 line-clamp-2 whitespace-pre-wrap">{n.content || "(pusta)"}</div>
                              </div>
                              <div className="ml-2 flex gap-1">
                                <button onClick={() => { setEditingNote(n); setNoteTitle(n.title); setNoteContent(n.content); }}
                                  className="text-xs px-2 py-1 bg-[#3B82F6]/20 hover:bg-[#3B82F6]/30 text-[#3B82F6] rounded">Edytuj</button>
                                <button onClick={() => calcDelNote(n.id)}
                                  className="text-xs px-2 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded">Usun</button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Sprawdziany */}
                  <div className="bg-white dark:bg-[#2B2D31] rounded-2xl p-6 border border-gray-100 dark:border-[#3F4147]">
                    <div className="flex justify-between items-center mb-4">
                      <h2 className="text-xl font-bold text-[#1a1a1a] dark:text-[#E0E0E0]">
                        Sprawdziany ({calcTests.length}/50)
                      </h2>
                      <span className="text-xs text-[#1a1a1a]/60 dark:text-[#E0E0E0]/60">Markdown/LaTeX OK</span>
                    </div>
                    <div className="bg-gray-50 dark:bg-[#1A1B1E] rounded p-4 mb-4 border border-gray-100 dark:border-[#3F4147]">
                      <div className="font-semibold mb-2 text-sm text-[#1a1a1a] dark:text-[#E0E0E0]">
                        {editingTest ? "Edytuj sprawdzian" : "Nowy sprawdzian"}
                      </div>
                      <input
                        type="text"
                        value={testTitle}
                        onChange={(e) => setTestTitle(e.target.value)}
                        placeholder="Tytul (np. Matma 2026 - probna 1)"
                        maxLength={100}
                        className="w-full px-3 py-2 bg-white dark:bg-[#2B2D31] border border-gray-200 dark:border-[#3F4147] rounded mb-2 text-sm text-[#1a1a1a] dark:text-[#E0E0E0]"
                      />
                      <textarea
                        value={testContent}
                        onChange={(e) => setTestContent(e.target.value)}
                        placeholder="Wklej tutaj rozwiazanie (markdown, LaTeX, $..$, **bold**...)"
                        maxLength={30000}
                        rows={8}
                        className="w-full px-3 py-2 bg-white dark:bg-[#2B2D31] border border-gray-200 dark:border-[#3F4147] rounded text-sm font-mono text-[#1a1a1a] dark:text-[#E0E0E0]"
                      />
                      <div className="flex justify-between items-center mt-2">
                        <div className="text-xs text-[#1a1a1a]/60 dark:text-[#E0E0E0]/60">{testContent.length}/30000</div>
                        <div className="flex gap-2">
                          {editingTest && (
                            <button
                              onClick={() => { setEditingTest(null); setTestTitle(""); setTestContent(""); }}
                              className="px-3 py-1 text-sm bg-gray-200 dark:bg-[#3F4147] text-[#1a1a1a] dark:text-[#E0E0E0] rounded"
                            >Anuluj</button>
                          )}
                          <button
                            onClick={calcSaveTest}
                            disabled={savingTest || (!testTitle.trim() && !testContent.trim())}
                            className="px-3 py-1 text-sm bg-purple-600 hover:bg-purple-700 text-white rounded disabled:opacity-50"
                          >{savingTest ? "Zapisuje..." : editingTest ? "Zapisz" : "Dodaj"}</button>
                        </div>
                      </div>
                    </div>
                    {calcTests.length === 0 ? (
                      <div className="text-[#1a1a1a]/60 dark:text-[#E0E0E0]/60 text-sm text-center py-4">
                        Brak sprawdzianow.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {calcTests.map((t: any) => (
                          <div key={t.id} className="border border-gray-100 dark:border-[#3F4147] rounded p-3 hover:bg-gray-50 dark:hover:bg-[#3F4147]/30">
                            <div className="flex justify-between items-start">
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-[#1a1a1a] dark:text-[#E0E0E0]">{t.title || "(bez tytulu)"}</div>
                                <div className="text-xs text-[#1a1a1a]/60 dark:text-[#E0E0E0]/60 mt-1">{t.content.length} znakow</div>
                              </div>
                              <div className="ml-2 flex gap-1">
                                <button onClick={() => { setEditingTest(t); setTestTitle(t.title); setTestContent(t.content); }}
                                  className="text-xs px-2 py-1 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 rounded">Edytuj</button>
                                <button onClick={() => calcDelTest(t.id)}
                                  className="text-xs px-2 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded">Usun</button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Historia rozmów */}
                  <div className="bg-white dark:bg-[#2B2D31] rounded-2xl p-6 border border-gray-100 dark:border-[#3F4147]">
                    <h2 className="text-xl font-bold text-[#1a1a1a] dark:text-[#E0E0E0] mb-4">
                      Historia rozwiazan ({calcConvs.length})
                    </h2>
                    {calcConvs.length === 0 ? (
                      <div className="text-[#1a1a1a]/60 dark:text-[#E0E0E0]/60 text-sm">
                        Zadnych zadan jeszcze nie rozwiazano.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {calcConvs.map((it: any) => (
                          <button
                            key={it.id}
                            onClick={() => setCalcOpenedConv(it)}
                            className="block w-full text-left bg-gray-50 dark:bg-[#1A1B1E] hover:bg-gray-100 dark:hover:bg-[#3F4147]/40 rounded p-3 border border-gray-100 dark:border-[#3F4147]"
                          >
                            <div className="flex justify-between items-start">
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-[#1a1a1a] dark:text-[#E0E0E0] truncate">
                                  {it.mode === "image" ? "Zdjecie" : it.question}
                                </div>
                                <div className="text-xs text-[#1a1a1a]/60 dark:text-[#E0E0E0]/60 mt-1 line-clamp-2">
                                  {it.answer.slice(0, 120)}...
                                </div>
                              </div>
                              <div className="text-xs text-[#1a1a1a]/40 dark:text-[#E0E0E0]/40 ml-2 whitespace-nowrap">
                                {new Date(it.createdAt).toLocaleString("pl-PL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Modal pelnego widoku konwersacji */}
              {calcOpenedConv && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50" onClick={() => setCalcOpenedConv(null)}>
                  <div className="bg-white dark:bg-[#2B2D31] rounded-2xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6 border border-gray-100 dark:border-[#3F4147]" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <div className="text-xs text-[#1a1a1a]/60 dark:text-[#E0E0E0]/60">{new Date(calcOpenedConv.createdAt).toLocaleString("pl-PL")}</div>
                        <div className="text-xs font-mono text-[#1a1a1a]/40 dark:text-[#E0E0E0]/40">{calcOpenedConv.deviceId}</div>
                      </div>
                      <button onClick={() => setCalcOpenedConv(null)} className="text-[#1a1a1a]/60 dark:text-[#E0E0E0]/60 hover:text-[#1a1a1a] dark:hover:text-[#E0E0E0] text-2xl leading-none">×</button>
                    </div>
                    <div className="mb-4">
                      <div className="text-sm font-bold mb-1 text-[#1a1a1a] dark:text-[#E0E0E0]">Zadanie:</div>
                      <div className="bg-gray-50 dark:bg-[#1A1B1E] p-3 rounded text-sm whitespace-pre-wrap text-[#1a1a1a] dark:text-[#E0E0E0]">{calcOpenedConv.question}</div>
                    </div>
                    <div>
                      <div className="text-sm font-bold mb-1 text-[#1a1a1a] dark:text-[#E0E0E0]">Rozwiazanie:</div>
                      <div className="bg-blue-50 dark:bg-[#1A1B1E] p-3 rounded text-sm whitespace-pre-wrap font-mono text-[#1a1a1a] dark:text-[#E0E0E0] border border-blue-100 dark:border-[#3B82F6]/30">{calcOpenedConv.answer}</div>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}
'''
s = s.replace(end_anchor, calc_jsx + "\n        </AnimatePresence>", 1)

with open(path, "w", encoding="utf-8") as f:
    f.write(s)
print("OK")
