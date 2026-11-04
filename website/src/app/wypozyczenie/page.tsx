"use client";

// Wypozyczenie KalkMate (tylko Polska): plan -> dane najemcy -> Paczkomat ->
// Przelewy24 (BLIK / przelew). Backend: /api/rental/checkout, lib/rentals.ts.
// PLANS/DEPOSIT to kopia z lib/rentals.ts (tamten modul importuje prisma —
// nie do przegladarki). Serwer i tak liczy kwote sam z planId.

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import type { InPostPoint } from "@/components/InPostGeowidget";

const InPostGeowidget = dynamic(() => import("@/components/InPostGeowidget"), { ssr: false });
const INPOST_TOKEN = process.env.NEXT_PUBLIC_INPOST_GEOWIDGET_TOKEN || "";

// Musi byc zgodne z RENTAL_PLANS / RENTAL_DEPOSIT_GROSZE w lib/rentals.ts.
const PLANS = [
  { id: "week", days: 7, fee: 79, label: "Tydzień", hint: "Na sprawdzian albo kartkówkę" },
  { id: "month", days: 30, fee: 149, label: "Miesiąc", hint: "Najczęściej wybierany", featured: true },
  { id: "season", days: 60, fee: 249, label: "2 miesiące", hint: "Cały okres matur" },
] as const;
const DEPOSIT = 300;

const inputClass =
  "w-full bg-transparent border border-[rgba(242,237,227,0.18)] text-[#F2EDE3] placeholder-[#F2EDE3]/30 px-4 py-3.5 focus:outline-none focus:border-[#D8FF3D] transition-colors text-[14px]";
const label = "km-mono-eyebrow text-[#F2EDE3]/55 block mb-2";

type ReturnState = { kind: "checking" } | { kind: "paid"; number: string; days: number } | { kind: "pending" } | null;

export default function WypozyczeniePage() {
  const [planId, setPlanId] = useState<(typeof PLANS)[number]["id"]>("month");
  const [form, setForm] = useState({ name: "", email: "", phone: "", street: "", postcode: "", city: "", adult: false, terms: false });
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
          planId, ...form,
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
            Pełna wersja z AI na tyle, ile potrzebujesz. Dostawa do Paczkomatu, zwrotna kaucja {DEPOSIT} zł,
            płatność BLIK albo przelewem. Po okresie najmu AI wyłącza się samo — odsyłasz kalkulator, my zwracamy kaucję.
          </p>
        </div>
      </section>

      <div className="max-w-4xl mx-auto px-6 py-12 lg:py-16">
        {ret?.kind === "paid" ? (
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

        {ret?.kind !== "paid" && ret?.kind !== "checking" && (
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
                    {"featured" in p && p.featured && <p className="km-mono-eyebrow text-[#D8FF3D] text-[10px] mt-2">POLECANY</p>}
                  </button>
                ))}
              </div>
              <p className="text-[13px] text-[#F2EDE3]/50 mt-3">
                + kaucja {DEPOSIT} zł (zwracamy w ciągu 7 dni od otrzymania sprawnego kalkulatora). Wysyłka gratis.
              </p>
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
            </div>

            {error && <p className="text-[14px] text-red-400">{error}</p>}

            <div className="border-t border-[rgba(242,237,227,0.10)] pt-6 flex flex-wrap items-center gap-4">
              <div>
                <p className="km-mono-eyebrow text-[#F2EDE3]/55">Do zapłaty teraz</p>
                <p className="km-display text-[40px] leading-none">{plan.fee + DEPOSIT} zł</p>
                <p className="text-[12px] text-[#F2EDE3]/45">{plan.fee} zł najem + {DEPOSIT} zł kaucja zwrotna</p>
              </div>
              <button type="submit" disabled={busy} className="ml-auto px-8 py-4 bg-[#D8FF3D] text-black km-mono-eyebrow text-[13px] disabled:opacity-50">
                {busy ? "Przekierowuję…" : "Zapłać BLIK / przelewem →"}
              </button>
            </div>
          </form>
        )}
      </div>

      <Footer />
    </div>
  );
}
