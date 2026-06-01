import { readdir, readFile, stat } from "fs/promises";
import path from "path";

export const CAPTURES_DIR =
  process.env.CALCULATOR_CAPTURES_DIR ||
  path.join(process.cwd(), "..", "captures");

// Filename format z device/solve/route.ts:
//   YYYY-MM-DD-HH-MM-SS_<deviceId>_<licenseTag>.jpg
// (toISOString z replace(/[:T]/g, "-") + slice(0,19), potem _devTag_licTag.jpg)

export interface CaptureMeta {
  filename: string;
  deviceId: string;
  timestamp: string; // ISO
  sizeKB: number;
}

const FILENAME_RE = /^[A-Za-z0-9_\-]+\.jpg$/;

export function isSafeFilename(name: string): boolean {
  return FILENAME_RE.test(name) && !name.includes("..") && !name.includes("/");
}

function parseFilename(filename: string): { deviceId: string; timestamp: string } | null {
  const parts = filename.replace(/\.jpg$/, "").split("_");
  if (parts.length < 2) return null;
  const tsParts = parts[0].split("-");
  if (tsParts.length !== 6) return null;
  const [Y, M, D, h, m, s] = tsParts;
  const iso = `${Y}-${M}-${D}T${h}:${m}:${s}Z`;
  if (Number.isNaN(new Date(iso).getTime())) return null;
  return { deviceId: parts[1], timestamp: iso };
}

// Lista wszystkich captures (newest first). Bez filtrowania.
export async function listAllCaptures(): Promise<CaptureMeta[]> {
  let entries: string[];
  try {
    entries = await readdir(CAPTURES_DIR);
  } catch {
    return [];
  }
  const items: CaptureMeta[] = [];
  for (const f of entries) {
    if (!f.endsWith(".jpg")) continue;
    if (!isSafeFilename(f)) continue;
    const parsed = parseFilename(f);
    if (!parsed) continue;
    try {
      const st = await stat(path.join(CAPTURES_DIR, f));
      items.push({
        filename: f,
        deviceId: parsed.deviceId,
        timestamp: parsed.timestamp,
        sizeKB: Math.round(st.size / 1024),
      });
    } catch {
      // skip
    }
  }
  items.sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
  return items;
}

// Czyta plik z CAPTURES_DIR jako Buffer. Wraca null gdy nie istnieje / niebezpieczna nazwa.
export async function readCapture(filename: string): Promise<Buffer | null> {
  if (!isSafeFilename(filename)) return null;
  const full = path.join(CAPTURES_DIR, filename);
  // Druga warstwa anty-traversal: po resolve sciezka musi zaczynac sie od CAPTURES_DIR
  const resolved = path.resolve(full);
  if (!resolved.startsWith(path.resolve(CAPTURES_DIR))) return null;
  try {
    return await readFile(resolved);
  } catch {
    return null;
  }
}
