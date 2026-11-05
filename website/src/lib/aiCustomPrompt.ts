// Wlasny system prompt usera (tryb AI "custom"). Kolumna User.aiCustomPrompt
// NIE jest w Prisma schema (jak aiModel/aiMode) -> raw SQL, patrz dbInit.ts.
// Uzywany w /api/device/solve (kalkulator) i /api/chat (czat w panelu).

export const AI_CUSTOM_PROMPT_MAX = 4000;

// Usuwa znaki sterujace (poza \n i \t), normalizuje konce linii i przycina.
// Zwraca null gdy wynik przekracza limit.
export function sanitizeCustomPrompt(raw: unknown): string | null {
  const s = String(raw ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, "")
    .trim();
  return s.length > AI_CUSTOM_PROMPT_MAX ? null : s;
}
