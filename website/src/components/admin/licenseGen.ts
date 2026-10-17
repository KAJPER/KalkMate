// Generowanie kodow licencji AI Chat — wspolne dla dashboardu (/admin)
// i /admin/licenses (wczesniej skopiowane 1:1 w obu miejscach).

export type LicenseDuration = "week" | "month" | "3months";

export const LICENSE_DURATION_DAYS: Record<LicenseDuration, number> = {
  week: 7,
  month: 30,
  "3months": 90,
};

// Zwraca wygenerowane kody albo rzuca Error z komunikatem do pokazania.
export async function createLicenses(count: number, duration: LicenseDuration, description?: string): Promise<string[]> {
  const res = await fetch("/api/admin/licenses", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ count, durationDays: LICENSE_DURATION_DAYS[duration], ...(description ? { description } : {}) }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !Array.isArray(data?.codes)) {
    throw new Error(data?.error || "Nie udało się wygenerować licencji");
  }
  return data.codes as string[];
}
