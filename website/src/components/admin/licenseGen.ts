// Generowanie kodow licencji (kod z pudelka) — wspolne dla dashboardu (/admin)
// i /admin/licenses.
//
// Model tokenowy: licencja po aktywacji w panelu dodaje jednorazowo
// LICENSE_TOKENS tokenow (bez okresu dostepu). Pole durationDays wysylamy
// nadal tylko dla zgodnosci z kolumna License.durationDays / API — nie
// oznacza juz zadnego okresu.

export const LICENSE_TOKENS = 2_000_000;
export const LICENSE_TOKENS_LABEL = "2 mln tokenów";
export const LEGACY_DURATION_DAYS = 30;

// Zwraca wygenerowane kody albo rzuca Error z komunikatem do pokazania.
export async function createLicenses(count: number, description?: string): Promise<string[]> {
  const res = await fetch("/api/admin/licenses", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ count, durationDays: LEGACY_DURATION_DAYS, ...(description ? { description } : {}) }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !Array.isArray(data?.codes)) {
    throw new Error(data?.error || "Nie udało się wygenerować licencji");
  }
  return data.codes as string[];
}
