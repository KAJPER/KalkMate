// Next.js instrumentation hook — wolany raz przy starcie serwera (Next >= 15:
// bez flag w next.config). Inicjalizacja bazy tylko w runtime Node.js (Prisma
// nie dziala w Edge) i nie podczas `next build`.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  try {
    const { initDatabase } = await import("./lib/dbInit");
    await initDatabase();
  } catch (e) {
    console.error("[instrumentation] initDatabase fail:", e);
  }
}
