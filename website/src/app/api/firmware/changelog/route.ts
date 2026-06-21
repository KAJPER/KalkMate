import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

// GET /api/firmware/changelog  (PUBLICZNY — zasila stronę /pomoc)
//
// Single source of truth: firmware-private/releases.json — plik karmiony przez
// deploy.ps1 przy kazdym wydaniu (wersja + data + notes wpisane w deployu).
// Zwraca pelna historie wersji + najnowsza. Dzieki temu /pomoc nie ma juz
// zahardkodowanej listy ani numeru wersji.

const FIRMWARE_DIR =
  process.env.CALCULATOR_FIRMWARE_DIR ||
  path.join(process.cwd(), "..", "firmware-private");

// Czytamy plik przy kazdym zadaniu (po deployu od razu aktualny).
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const raw = await readFile(path.join(FIRMWARE_DIR, "releases.json"), "utf-8");
    const data = JSON.parse(raw);
    const releases = Array.isArray(data?.releases) ? data.releases : [];
    const latest =
      data?.latest ||
      (releases.length > 0 ? releases[0].v : process.env.FIRMWARE_LATEST_VERSION || "");
    return NextResponse.json(
      { ok: true, latest, releases },
      { headers: { "Cache-Control": "public, max-age=60" } }
    );
  } catch {
    // Fallback gdy releases.json brak/uszkodzony — przynajmniej najnowsza z env,
    // zeby strona pokazala aktualna wersje nawet bez pliku historii.
    const latest = process.env.FIRMWARE_LATEST_VERSION || "";
    const notes = process.env.FIRMWARE_LATEST_NOTES || "";
    return NextResponse.json({
      ok: true,
      latest,
      releases: latest ? [{ v: latest, date: "", notes }] : [],
    });
  }
}
