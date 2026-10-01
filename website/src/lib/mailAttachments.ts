// Zalaczniki wysylane z /admin/mailbox (Nowa wiadomosc / Odpowiedz).
// Panel wysyla je w JSON jako base64 (zdjecia sa wczesniej zmniejszane w
// przegladarce, wiec realnie to setki KB). Zdjecia osadzamy w tresci maila
// przez cid — klient widzi je pod tekstem, a nie tylko jako "spinacz".

import type { OutgoingAttachment } from "@/lib/contactMailbox";

const MAX_FILES = 10;
const MAX_TOTAL_BYTES = 15 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "image/jpeg", "image/png", "image/gif", "image/webp", "image/heic", "image/heif",
  "application/pdf",
]);
// Obrazki, ktore klienci poczty potrafia pokazac inline (HEIC juz nie).
const INLINE_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

function safeFilename(raw: unknown, index: number): string {
  const name = typeof raw === "string" ? raw.replace(/[\\/\r\n\0"]/g, "_").trim().slice(0, 120) : "";
  return name || `zalacznik-${index + 1}`;
}

export function parseAttachments(raw: unknown):
  | { ok: true; list: OutgoingAttachment[] }
  | { ok: false; error: string } {
  if (raw === undefined || raw === null) return { ok: true, list: [] };
  if (!Array.isArray(raw)) return { ok: false, error: "Nieprawidłowe załączniki." };
  if (raw.length > MAX_FILES) return { ok: false, error: `Maksymalnie ${MAX_FILES} załączników.` };

  const list: OutgoingAttachment[] = [];
  let total = 0;
  for (let i = 0; i < raw.length; i++) {
    const a = raw[i] as Record<string, unknown> | null;
    const contentType = typeof a?.contentType === "string" ? a.contentType.toLowerCase() : "";
    const data = typeof a?.data === "string" ? a.data : "";
    const filename = safeFilename(a?.filename, i);
    if (!ALLOWED_TYPES.has(contentType)) return { ok: false, error: `Nieobsługiwany typ pliku: ${filename}` };
    if (!data || !/^[A-Za-z0-9+/=\s]+$/.test(data)) return { ok: false, error: `Uszkodzony plik: ${filename}` };
    const content = Buffer.from(data, "base64");
    if (!content.length) return { ok: false, error: `Pusty plik: ${filename}` };
    total += content.length;
    if (total > MAX_TOTAL_BYTES) return { ok: false, error: "Załączniki są za duże (max 15 MB łącznie)." };
    list.push({
      filename,
      contentType,
      content,
      cid: INLINE_TYPES.has(contentType) ? `img${i}.${Date.now()}@kalkmate.pl` : undefined,
    });
  }
  return { ok: true, list };
}

// Dokleja osadzone zdjecia pod trescia maila.
export function appendInlineImages(html: string, list: OutgoingAttachment[]): string {
  const imgs = list
    .filter((a) => a.cid)
    .map((a) => `<p style="margin:12px 0 0;"><img src="cid:${a.cid}" alt="" style="max-width:100%;height:auto;border-radius:6px;" /></p>`)
    .join("");
  return imgs ? `${html}${imgs}` : html;
}
