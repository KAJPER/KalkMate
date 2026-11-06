"use client";

// Wypozyczenie KalkMate (tylko Polska): plan -> dane najemcy -> Paczkomat ->
// Przelewy24 (BLIK / przelew). Backend: /api/rental/checkout, lib/rentals.ts.
// Cennik: lib/content/rentalPlans.ts (wspolny z serwerem, ktory i tak liczy
// kwote sam z planId).

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import type { InPostPoint } from "@/components/InPostGeowidget";
import { RENTAL_PLANS, RENTAL_DEPOSIT_GROSZE, type RentalPlan } from "@/lib/content/rentalPlans";

const InPostGeowidget = dynamic(() => import("@/components/InPostGeowidget"), { ssr: false });
const INPOST_TOKEN = process.env.NEXT_PUBLIC_INPOST_GEOWIDGET_TOKEN || "";

const PLANS = RENTAL_PLANS.map((p) => ({ ...p, fee: p.feeGrosze / 100 }));
const DEPOSIT = RENTAL_DEPOSIT_GROSZE / 100;

const inputClass =
  "w-full bg-transparent border border-[rgba(242,237,227,0.18)] text-[#F2EDE3] placeholder-[#F2EDE3]/30 px-4 py-3.5 focus:outline-none focus:border-[#D8FF3D] transition-colors text-[14px]";
const label = "km-mono-eyebrow text-[#F2EDE3]/55 block mb-2";

type ReturnState = { kind: "checking" } | { kind: "paid"; number: string; days: number } | { kind: "pending" } | null;

// Powrot z Didit (/wypozyczenie?r=<id>&t=<token>): wynik weryfikacji tozsamosci.
type IdentityView =
  | { kind: "waiting" }
  | { kind: "approved"; fee: number }
  | { kind: "failed"; fee: number; reason: "declined" | "mismatch" }
  | { kind: "review"; fee: number }
  | { kind: "paid"; number: string; days: number }
  | { kind: "lost" };

export default function WypozyczeniePage() {
  const [planId, setPlanId] = useState<RentalPlan["id"]>("month");
  const [form, setForm] = useState({ name: "", email: "", phone: "", street: "", postcode: "", city: "", adult: false, terms: false, biometric: false });
  const [mode, setMode] = useState<"deposit" | "identity">("deposit");
  const [identityAvailable, setIdentityAvailable] = useState(false);
  const [idView, setIdView] = useState<IdentityView | null>(null);
  const [access, setAccess] = useState<{ r: string; t: string } | null>(null);
  const [point, setPoint] = useState<InPostPoint | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ret, setRet] = useState<ReturnState>(null);

  const plan = PLANS.find((p) => p.id === planId)!;
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  // Powrot z Przelewy24: ?p24_session=... — webhook moze przyjsc chwile pozniej.
  useEffect(() => {
    const session = new URLSearchParams(window.location.search).get("p24_session");
    if (!session) return;
    let tries = 0;
    let stop = false;
    const check = async () => {
      if (stop) return;
      try {
        const r = await fetch(`/api/rental/status?session=${encodeURIComponent(session)}`, { cache: "no-store" });
        const d = await r.json();
        if (d.ok && d.status !== "pending") { setRet({ kind: "paid", number: d.rentalNumber, days: d.days }); return; }
      } catch { /* sprobujemy znowu */ }
      if (++tries < 10) setTimeout(check, 3000);
      else setRet({ kind: "pending" });
    };
    // Ustawione asynchronicznie (nie w ciele efektu) — formularz chowa sie od razu.
    void Promise.resolve().then(() => { if (!stop) setRet({ kind: "checking" }); }).then(check);
    return () => { stop = true; };
  }, []);

  // ?plan=week|month|season — plan klikniety na stronie glownej (RentalPromo).
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("plan");
    const found = RENTAL_PLANS.find((x) => x.id === p);
    if (found) void Promise.resolve().then(() => setPlanId(found.id));
  }, []);

  // Wariant bez kaucji widoczny tylko, gdy serwer ma skonfigurowany Didit.
  useEffect(() => {
    fetch("/api/rental/status?options=1").then((r) => r.json()).then((d) => setIdentityAvailable(!!d?.identityAvailable)).catch(() => {});
  }, []);

  // Powrot z Didit — webhook z wynikiem przychodzi zwykle w kilka sekund.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const r = q.get("r"), t = q.get("t");
    if (!r || !t) return;
    let stop = false;
    let tries = 0;
    const check = async () => {
      if (stop) return;
      try {
        const res = await fetch(`/api/rental/status?r=${encodeURIComponent(r)}&t=${encodeURIComponent(t)}`, { cache: "no-store" });
        if (res.status === 404) { setIdView({ kind: "lost" }); return; }
        const d = await res.json();
        if (d.status !== "pending") { setIdView({ kind: "paid", number: d.rentalNumber, days: d.days }); return; }
        if (d.identityStatus === "approved") { setIdView({ kind: "approved", fee: d.fee }); return; }
        if (d.identityStatus === "declined" || d.identityStatus === "mismatch") { setIdView({ kind: "failed", fee: d.fee, reason: d.identityStatus }); return; }
        if (d.identityStatus === "review") { setIdView({ kind: "review", fee: d.fee }); return; }
        if (++tries >= 40) { setIdView({ kind: "review", fee: d.fee }); return; }   // ~2 min bez wyniku
      } catch { /* sprobujemy znowu */ }
      setTimeout(check, 3000);
    };
    void Promise.resolve().then(() => { if (!stop) { setAccess({ r, t }); setIdView({ kind: "waiting" }); } }).then(check);
    return () => { stop = true; };
  }, []);

  const payAfterIdentity = async (withDeposit: boolean) => {
    if (!access) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/rental/pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...access, withDeposit }),
      });
      const d = await res.json().catch(() => ({ ok: false, error: "Błąd połączenia." }));
      if (!d.ok) { setError(d.error || "Błąd."); return; }
      window.location.href = d.url;
    } catch {
      setError("Błąd połączenia. Spróbuj ponownie.");
    } finally {
      setBusy(false);
    }
  };

  const pay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!point) { setError("Wybierz Paczkomat."); return; }
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/rental/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId, ...form, mode,
          biometricConsent: mode === "identity" && form.biometric,
          pickupPoint: point.name,
          pickupPointAddress: `${point.address.line1}, ${point.address.line2}`,
        }),
      });
      const d = await res.json().catch(() => ({ ok: false, error: "Błąd połączenia." }));
      if (!d.ok) { setError(d.error || "Błąd."); return; }
      window.location.href = d.url;
    } catch {
      setError("Błąd połączenia. Spróbuj ponownie.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0B0B] text-[#F2EDE3]">
      <Navigation />

      <section className="relative overflow-hidden border-b border-[rgba(242,237,227,0.10)] pt-28 lg:pt-32">
        <div className="pointer-events-none absolute -top-32 -left-20 w-[520px] h-[520px] rounded-full bg-[#D8FF3D] opacity-[0.06] blur-[140px]" />
        <div className="max-w-4xl mx-auto px-6 pb-14 lg:pb-16 relative">
          <p className="km-mono-eyebrow text-[#D8FF3D]">[ wypożyczenie ] · od {PLANS[0].fee} zł</p>
          <h1 className="km-display text-[clamp(48px,7vw,96px)] mt-4 leading-[0.95] text-[#F2EDE3]">
            Wypożycz<br />
            <span className="italic text-[#D8FF3D]">KalkMate</span>.
          </h1>
          <p className="mt-6 text-[16px] leading-[1.65] text-[#F2EDE3]/65 max-w-xl">
            Pełna wersja z AI na tyle, ile potrzebujesz. Dostawa do Paczkomatu, płatność BLIK albo przelewem,
            zwrotna kaucja {DEPOSIT} zł{identityAvailable ? " — albo bez kaucji, jeśli potwierdzisz tożsamość dowodem" : ""}.
            Po okresie najmu AI wyłącza się samo i odsyłasz kalkulator.
          </p>
        </div>
      </section>

      <div className="max-w-4xl mx-auto px-6 py-12 lg:py-16">
        {idView ? (
          <div className="border border-[rgba(242,237,227,0.18)] p-8 space-y-4">
            {idView.kind === "waiting" && <p className="km-mono-eyebrow text-[#F2EDE3]/60">Sprawdzamy wynik weryfikacji tożsamości…</p>}
            {idView.kind === "approved" && (
              <>
                <p className="km-mono-eyebrow text-[#D8FF3D]">/ TOŻSAMOŚĆ POTWIERDZONA</p>
                <p className="text-[15px] text-[#F2EDE3]/80 leading-[1.6]">Wypożyczasz bez kaucji. Zostało opłacić najem.</p>
                <button type="button" disabled={busy} onClick={() => payAfterIdentity(false)} className="px-8 py-4 bg-[#D8FF3D] text-black km-mono-eyebrow text-[13px] disabled:opacity-50">
                  {busy ? "Przekierowuję…" : `Zapłać ${idView.fee / 100} zł BLIK / przelewem →`}
                </button>
              </>
            )}
            {(idView.kind === "failed" || idView.kind === "review") && (
              <>
                <p className="km-mono-eyebrow text-amber-300">/ {idView.kind === "review" ? "WERYFIKACJA W TOKU" : "NIE UDAŁO SIĘ POTWIERDZIĆ TOŻSAMOŚCI"}</p>
                <p className="text-[15px] text-[#F2EDE3]/80 leading-[1.6]">
                  {idView.kind === "review"
                    ? "Weryfikacja wymaga dodatkowego sprawdzenia. Jeśli przejdzie, dostaniesz maila z linkiem do płatności bez kaucji. Możesz też od razu wypożyczyć z kaucją."
                    : idView.reason === "mismatch"
                      ? "Dane z dokumentu nie zgadzają się z danymi najemcy (albo najemca nie ma 18 lat). Możesz wypożyczyć z kaucją."
                      : "Weryfikacja nie powiodła się. Możesz wypożyczyć z kaucją — kaucję zwracamy po oddaniu kalkulatora."}
                </p>
                <button type="button" disabled={busy} onClick={() => payAfterIdentity(true)} className="px-8 py-4 bg-[#D8FF3D] text-black km-mono-eyebrow text-[13px] disabled:opacity-50">
                  {busy ? "Przekierowuję…" : `Zapłać ${(idView.fee / 100) + DEPOSIT} zł (z kaucją ${DEPOSIT} zł) →`}
                </button>
              </>
            )}
            {idView.kind === "paid" && (
              <>
                <p className="km-mono-eyebrow text-[#D8FF3D]">/ OPŁACONE · {idView.number}</p>
                <p className="text-[15px] text-[#F2EDE3]/80 leading-[1.6]">To wypożyczenie jest już opłacone. Wyślemy kalkulator w ciągu 1–2 dni roboczych.</p>
              </>
            )}
            {idView.kind === "lost" && <p className="text-[15px] text-[#F2EDE3]/80">Nie znaleźliśmy tego wypożyczenia. Zacznij od nowa albo napisz na kontakt@kalkmate.pl.</p>}
            {error && <p className="text-[14px] text-red-400">{error}</p>}
          </div>
        ) : ret?.kind === "paid" ? (
          <div className="border border-[#D8FF3D]/40 bg-[#D8FF3D]/[0.06] p-8">
            <p className="km-mono-eyebrow text-[#D8FF3D] mb-2">/ OPŁACONE · {ret.number}</p>
            <p className="text-[15px] text-[#F2EDE3]/80 leading-[1.6]">
              Dziękujemy! Wyślemy kalkulator w ciągu 1–2 dni roboczych — numer przesyłki dostaniesz mailem.
              Najem ({ret.days} dni) liczymy od nadania paczki.
            </p>
          </div>
        ) : ret?.kind === "checking" ? (
          <p className="km-mono-eyebrow text-[#F2EDE3]/60">Sprawdzam płatność…</p>
        ) : ret?.kind === "pending" ? (
          <div className="border border-[rgba(242,237,227,0.18)] p-8 mb-10">
            <p className="text-[15px] text-[#F2EDE3]/80 leading-[1.6]">
              Nie widzimy jeszcze płatności. Jeśli zapłaciłeś, potwierdzenie przyjdzie mailem w ciągu kilku minut.
              Jeśli nie — możesz spróbować ponownie poniżej.
            </p>
          </div>
        ) : null}

        {!idView && ret?.kind !== "paid" && ret?.kind !== "checking" && (
          <form onSubmit={pay} className="space-y-10">
            <div>
              <p className="km-mono-eyebrow text-[#D8FF3D] mb-4">/ 01 · OKRES NAJMU</p>
              <div className="grid sm:grid-cols-3 gap-3">
                {PLANS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPlanId(p.id)}
                    className={`text-left p-5 border transition-colors ${planId === p.id ? "border-[#D8FF3D] bg-[#D8FF3D]/[0.06]" : "border-[rgba(242,237,227,0.18)] hover:border-[#F2EDE3]/40"}`}
                  >
                    <p className="km-mono-eyebrow text-[#F2EDE3]/55">{p.label} · {p.days} dni</p>
                    <p className="km-display text-[44px] leading-none mt-2">{p.fee}<span className="text-[18px] text-[#F2EDE3]/60"> zł</span></p>
                    <p className="text-[13px] text-[#F2EDE3]/60 mt-2">{p.hint}</p>
                    {p.featured && <p className="km-mono-eyebrow text-[#D8FF3D] text-[10px] mt-2">POLECANY</p>}
                  </button>
                ))}
              </div>
              {identityAvailable ? (
                <div className="grid sm:grid-cols-2 gap-3 mt-4">
                  {([
                    ["deposit", `Z kaucją ${DEPOSIT} zł`, "Kaucję zwracamy w ciągu 7 dni od otrzymania sprawnego kalkulatora."],
                    ["identity", "Bez kaucji", "Potwierdzasz tożsamość zdjęciem dowodu i selfie (ok. 2 minuty, przez Didit)."],
                  ] as const).map(([m, title, desc]) => (
                    <button key={m} type="button" onClick={() => setMode(m)}
                      className={`text-left p-4 border transition-colors ${mode === m ? "border-[#D8FF3D] bg-[#D8FF3D]/[0.06]" : "border-[rgba(242,237,227,0.18)] hover:border-[#F2EDE3]/40"}`}>
                      <p className="text-[15px] text-[#F2EDE3]">{title}</p>
                      <p className="text-[13px] text-[#F2EDE3]/55 mt-1">{desc}</p>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-[13px] text-[#F2EDE3]/50 mt-3">
                  + kaucja {DEPOSIT} zł (zwracamy w ciągu 7 dni od otrzymania sprawnego kalkulatora). Wysyłka gratis.
                </p>
              )}
            </div>

            <div>
              <p className="km-mono-eyebrow text-[#D8FF3D] mb-4">/ 02 · NAJEMCA (OSOBA PEŁNOLETNIA)</p>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className={label}>Imię i nazwisko</label>
                  <input className={inputClass} value={form.name} onChange={(e) => set("name", e.target.value)} autoComplete="name" required />
                </div>
                <div>
                  <label className={label}>E-mail</label>
                  <input className={inputClass} type="email" value={form.email} onChange={(e) => set("email", e.target.value)} autoComplete="email" required />
                </div>
                <div>
                  <label className={label}>Telefon</label>
                  <input className={inputClass} type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} autoComplete="tel" placeholder="9 cyfr" required />
                </div>
                <div className="sm:col-span-2">
                  <label className={label}>Adres zamieszkania (ulica i numer)</label>
                  <input className={inputClass} value={form.street} onChange={(e) => set("street", e.target.value)} autoComplete="street-address" required />
                </div>
                <div>
                  <label className={label}>Kod pocztowy</label>
                  <input className={inputClass} value={form.postcode} onChange={(e) => set("postcode", e.target.value)} autoComplete="postal-code" placeholder="00-000" required />
                </div>
                <div>
                  <label className={label}>Miasto</label>
                  <input className={inputClass} value={form.city} onChange={(e) => set("city", e.target.value)} autoComplete="address-level2" required />
                </div>
              </div>
            </div>

            <div>
              <p className="km-mono-eyebrow text-[#D8FF3D] mb-4">/ 03 · PACZKOMAT</p>
              {point ? (
                <div className="flex flex-wrap items-center gap-3 border border-[rgba(242,237,227,0.18)] p-4">
                  <div>
                    <p className="font-mono text-[#F2EDE3]">{point.name}</p>
                    <p className="text-[13px] text-[#F2EDE3]/60">{point.address.line1}, {point.address.line2}</p>
                  </div>
                  <button type="button" onClick={() => setShowMap(true)} className="ml-auto km-mono-eyebrow text-[#D8FF3D]">Zmień</button>
                </div>
              ) : !showMap ? (
                <button type="button" onClick={() => setShowMap(true)} className="w-full border border-dashed border-[rgba(242,237,227,0.3)] p-5 km-mono-eyebrow text-[#F2EDE3]/70 hover:border-[#D8FF3D]">
                  Wybierz Paczkomat na mapie
                </button>
              ) : null}
              {showMap && (
                <div className="mt-3">
                  <InPostGeowidget token={INPOST_TOKEN} height="420px" onPointSelect={(p) => { setPoint(p); setShowMap(false); }} />
                </div>
              )}
            </div>

            <div className="space-y-3">
              <label className="flex items-start gap-3 text-[14px] text-[#F2EDE3]/75">
                <input type="checkbox" className="mt-1 accent-[#D8FF3D]" checked={form.adult} onChange={(e) => set("adult", e.target.checked)} required />
                <span>Jestem osobą pełnoletnią i zawieram umowę najmu we własnym imieniu (np. jako rodzic ucznia).</span>
              </label>
              <label className="flex items-start gap-3 text-[14px] text-[#F2EDE3]/75">
                <input type="checkbox" className="mt-1 accent-[#D8FF3D]" checked={form.terms} onChange={(e) => set("terms", e.target.checked)} required />
                <span>
                  Akceptuję <Link href="/regulamin#wypozyczenie" target="_blank" className="text-[#D8FF3D] hover:underline">regulamin wypożyczeń</Link>,
                  w tym zasady zwrotu kaucji i opłat za opóźnienie, oraz <Link href="/polityka-prywatnosci" target="_blank" className="text-[#D8FF3D] hover:underline">politykę prywatności</Link>.
                </span>
              </label>
              {mode === "identity" && (
                <label className="flex items-start gap-3 text-[14px] text-[#F2EDE3]/75">
                  <input type="checkbox" className="mt-1 accent-[#D8FF3D]" checked={form.biometric} onChange={(e) => set("biometric", e.target.checked)} required />
                  <span>
                    Wyrażam zgodę na weryfikację mojej tożsamości przez Didit na podstawie zdjęcia dokumentu tożsamości i selfie
                    (dane biometryczne, art. 9 ust. 2 lit. a RODO). Zgodę mogę wycofać — wtedy wypożyczę z kaucją.{" "}
                    <Link href="/polityka-prywatnosci#sek-3" target="_blank" className="text-[#D8FF3D] hover:underline">Szczegóły</Link>
                  </span>
                </label>
              )}
            </div>

            {error && <p className="text-[14px] text-red-400">{error}</p>}

            <div className="border-t border-[rgba(242,237,227,0.10)] pt-6 flex flex-wrap items-center gap-4">
              <div>
                <p className="km-mono-eyebrow text-[#F2EDE3]/55">Do zapłaty teraz</p>
                <p className="km-display text-[40px] leading-none">{plan.fee + (mode === "identity" ? 0 : DEPOSIT)} zł</p>
                <p className="text-[12px] text-[#F2EDE3]/45">
                  {mode === "identity" ? `${plan.fee} zł najem, bez kaucji — płatność po weryfikacji` : `${plan.fee} zł najem + ${DEPOSIT} zł kaucja zwrotna`}
                </p>
              </div>
              <button type="submit" disabled={busy} className="ml-auto px-8 py-4 bg-[#D8FF3D] text-black km-mono-eyebrow text-[13px] disabled:opacity-50">
                {busy ? "Przekierowuję…" : mode === "identity" ? "Potwierdź tożsamość →" : "Zapłać BLIK / przelewem →"}
              </button>
            </div>
          </form>
        )}
      </div>

      <Footer />
    </div>
  );
}
