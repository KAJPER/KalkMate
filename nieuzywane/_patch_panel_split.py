#!/usr/bin/env python3
"""Rozbij zakladke Kalkulator na 3: Kalkulator (claim+device+history), Notatki, Sprawdziany."""

path = "src/app/panel/page.tsx"
with open(path, "r", encoding="utf-8") as f:
    s = f.read()

# 1) Rozszerz typ activeTab o "notes" i "tests"
s = s.replace(
    'useState<"orders" | "chat" | "subscription" | "calculator">("orders")',
    'useState<"orders" | "chat" | "subscription" | "calculator" | "notes" | "tests">("orders")',
    1
)

# 2) Trigger calc data load takze gdy notes/tests aktywne
s = s.replace(
    'if (session && activeTab === "calculator") {',
    'if (session && (activeTab === "calculator" || activeTab === "notes" || activeTab === "tests")) {',
    1
)

# 3) Dodaj 2 nowe zakladki w nav (po "Kalkulator")
needle_calc_tab = '''            { id: "calculator" as const, label: "Kalkulator", icon: (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="4" y="2" width="16" height="20" rx="2" />
                <line x1="8" y1="6" x2="16" y2="6" />
                <line x1="8" y1="10" x2="16" y2="10" />
                <line x1="8" y1="14" x2="10" y2="14" />
                <line x1="13" y1="14" x2="16" y2="14" />
                <line x1="8" y1="18" x2="16" y2="18" />
              </svg>
            ) },
'''
new_tabs = needle_calc_tab + '''            { id: "notes" as const, label: "Notatki", icon: (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
            ) },
            { id: "tests" as const, label: "Sprawdziany", icon: (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 11l3 3L22 4" />
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
              </svg>
            ) },
'''
s = s.replace(needle_calc_tab, new_tabs, 1)

# 4) Wyciagnij sekcje notes z calculator i przeskocz na osobny activeTab="notes"
# Aktualnie blok Notatek znajduje sie w {activeTab === "calculator" && ... <> ... </>}
# Tniemy tam i dajemy osobne sekcje activeTab === "notes" i "tests"

# Marker: "{/* Notatki */}" do "{/* Sprawdziany */}" - wytnij Notatki
# i przenies do osobnej sekcji nad </AnimatePresence>.

# Strategia: wstaw nowe sekcje "notes" i "tests" przed </AnimatePresence>.
# W sekcji "calculator" zostaw tylko: claim, info, history, modal.
# Notatki i sprawdziany usuniemy z calculator.

# Najprostsze: znajdz blok {/* Notatki */}...{/* Sprawdziany */} - usun, zachowaj jako oddzielny
# znajdz blok {/* Sprawdziany */}...{/* Historia rozmów */} - usun, zachowaj

import re
# Wytnij blok Notatek
notes_re = re.compile(r'\s*\{/\* Notatki \*/\}\s*<div className="bg-white dark:bg-\[#2B2D31\][\s\S]*?\)\}\s*</div>\s*(?=\{/\* Sprawdziany)', re.MULTILINE)
m_notes = notes_re.search(s)
if m_notes:
    notes_block = m_notes.group(0)
    s = s[:m_notes.start()] + s[m_notes.end():]
else:
    notes_block = ""
    print("WARN: notes block not found")

# Wytnij blok Sprawdzianow
tests_re = re.compile(r'\s*\{/\* Sprawdziany \*/\}\s*<div className="bg-white dark:bg-\[#2B2D31\][\s\S]*?\)\}\s*</div>\s*(?=\{/\* Historia rozm)', re.MULTILINE)
m_tests = tests_re.search(s)
if m_tests:
    tests_block = m_tests.group(0)
    s = s[:m_tests.start()] + s[m_tests.end():]
else:
    tests_block = ""
    print("WARN: tests block not found")

# Wstaw notes i tests jako osobne activeTab sekcje przed </AnimatePresence>
end_anchor = "        </AnimatePresence>"

new_sections = ""
if notes_block.strip():
    notes_section = f'''
          {{activeTab === "notes" && (
            <motion.div
              key="notes"
              initial={{{{ opacity: 0, y: 20 }}}}
              animate={{{{ opacity: 1, y: 0 }}}}
              exit={{{{ opacity: 0, y: -20 }}}}
              transition={{{{ duration: 0.3, ease: "easeOut" as const }}}}
            >
              {{calcLoading && (
                <div className="text-[#1a1a1a]/60 dark:text-[#E0E0E0]/60">Ladowanie...</div>
              )}}
              {{!calcLoading && calcInfo && !calcInfo.claimed && (
                <div className="bg-white dark:bg-[#2B2D31] rounded-2xl p-6 border border-gray-100 dark:border-[#3F4147] text-sm text-[#1a1a1a]/70 dark:text-[#E0E0E0]/70">
                  Najpierw przypisz licencje w zakladce <strong>Kalkulator</strong>.
                </div>
              )}}
              {{!calcLoading && calcInfo && calcInfo.claimed && ({notes_block.strip()})}}
            </motion.div>
          )}}
'''
    new_sections += notes_section

if tests_block.strip():
    tests_section = f'''
          {{activeTab === "tests" && (
            <motion.div
              key="tests"
              initial={{{{ opacity: 0, y: 20 }}}}
              animate={{{{ opacity: 1, y: 0 }}}}
              exit={{{{ opacity: 0, y: -20 }}}}
              transition={{{{ duration: 0.3, ease: "easeOut" as const }}}}
            >
              {{calcLoading && (
                <div className="text-[#1a1a1a]/60 dark:text-[#E0E0E0]/60">Ladowanie...</div>
              )}}
              {{!calcLoading && calcInfo && !calcInfo.claimed && (
                <div className="bg-white dark:bg-[#2B2D31] rounded-2xl p-6 border border-gray-100 dark:border-[#3F4147] text-sm text-[#1a1a1a]/70 dark:text-[#E0E0E0]/70">
                  Najpierw przypisz licencje w zakladce <strong>Kalkulator</strong>.
                </div>
              )}}
              {{!calcLoading && calcInfo && calcInfo.claimed && ({tests_block.strip()})}}
            </motion.div>
          )}}
'''
    new_sections += tests_section

s = s.replace(end_anchor, new_sections + "\n" + end_anchor, 1)

with open(path, "w", encoding="utf-8") as f:
    f.write(s)
print("OK")
