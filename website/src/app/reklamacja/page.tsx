"use client";

import { useState } from "react";
import type React from "react";
import Link from "next/link";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";

const inputClass =
  "w-full bg-transparent border border-[rgba(242,237,227,0.18)] text-[#F2EDE3] placeholder-[#F2EDE3]/30 px-4 py-3.5 focus:outline-none focus:border-[#D8FF3D] transition-colors km-mono-eyebrow text-[13px]";

const label = "km-mono-eyebrow text-[#F2EDE3]/55 block mb-2";

type Zadanie = "Naprawa urządzenia" | "Wymiana na nowy egzemplarz" | "Obniżenie ceny" | "Odstąpienie od umowy / zwrot pieniędzy";

const ZADANIA: { value: Zadanie; desc?: string }[] = [
  { value: "Naprawa urządzenia" },
  { value: "Wymiana na nowy egzemplarz" },
  { value: "Obniżenie ceny", desc: "Zaproponujemy kwotę po ocenie wady" },
  { value: "Odstąpienie od umowy / zwrot pieniędzy" },
];

export default function ReklamacjaPage() {
  const [form, setForm] = useState({
    imie: "", telefon: "", adres: "", email: "", konto: "",
    zamowienie: "", dataZakupu: "", dowod: "", sn: "", fw: "", dataWady: "",
    opis: "", zadanie: "" as Zadanie | "",
    oswiadczenie: false, rodo: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof typeof form>(key: K, value: typeof form[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const requiredOk =
    form.imie && form.telefon && form.adres && form.email &&
    form.zamowienie && form.dataZakupu && form.dataWady &&
    form.opis.length >= 5 && form.zadanie && form.oswiadczenie && form.rodo;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!requiredOk) {
      setError("Uzupełnij wszystkie wymagane pola oraz zaznacz oświadczenia poniżej.");
      return;
    }
    setSubmitting(true);
    try {
      const message = [
        "DANE ZGŁASZAJĄCEGO",
        `Adres: ${form.adres}`,
        `Telefon: ${form.telefon}`,
        `Numer konta do zwrotu: ${form.konto || "-"}`,
        "",
        "DANE ZAKUPU",
        `Numer zamówienia: ${form.zamowienie}`,
        `Data zakupu: ${form.dataZakupu}`,
        `Dowód zakupu: ${form.dowod || "-"}`,
        `Numer seryjny: ${form.sn || "-"}`,
        `Wersja firmware: ${form.fw || "-"}`,
        `Data stwierdzenia wady: ${form.dataWady}`,
        "",
        "OPIS WADY",
        form.opis,
        "",
        "ŻĄDANIE",
        form.zadanie,
        "",
        "Oświadczam, że opisana wada nie powstała z mojej winy i zgłaszam ją zgodnie z warunkami",
        "gwarancji / rękojmi określonymi w Regulaminie sklepu kalkmate.pl.",
        "",
        "(Zgłoszenie wysłane przez formularz reklamacyjny na kalkmate.pl/reklamacja.",
        "Zdjęcia/nagranie wady proszę dosłać w odpowiedzi na potwierdzenie tego zgłoszenia.)",
      ].join("\n");

      const r = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.imie,
          email: form.email,
          subject: `Reklamacja — zamówienie ${form.zamowienie}`,
          message,
        }),
      });
      const j = await r.json();
      if (!j.ok) setError(j.error || "Nie udało się wysłać zgłoszenia.");
      else setSent(true);
    } catch {
      setError("Błąd sieci — spróbuj ponownie.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0B0B] text-[#F2EDE3]">
      <Navigation />

      <section className="relative overflow-hidden border-b border-[rgba(242,237,227,0.10)] pt-28 lg:pt-32">
        <div className="pointer-events-none absolute -top-32 -left-20 w-[520px] h-[520px] rounded-full bg-[#D8FF3D] opacity-[0.06] blur-[140px]" />
        <div className="max-w-3xl mx-auto px-6 pb-14 lg:pb-16 relative">
          <p className="km-mono-eyebrow text-[#D8FF3D]">[ reklamacja ] · gwarancja 24 mies.</p>
          <h1 className="km-display text-[clamp(48px,7vw,96px)] mt-4 leading-[0.95] text-[#F2EDE3]">
            Formularz<br />
            <span className="italic text-[#D8FF3D]">reklamacyjny</span>.
          </h1>
          <p className="mt-6 text-[16px] leading-[1.65] text-[#F2EDE3]/65 max-w-xl">
            Wypełnij formularz — zgłoszenie trafi bezpośrednio do nas na kontakt@kalkmate.pl.
            Rozpatrujemy reklamacje w terminie do 14 dni kalendarzowych.
          </p>
        </div>
      </section>

      <div className="max-w-3xl mx-auto px-6 py-12 lg:py-16">
        {sent ? (
          <div className="border border-[#D8FF3D]/40 bg-[#D8FF3D]/[0.06] p-8">
            <p className="km-mono-eyebrow text-[#D8FF3D] mb-2">/ ZGŁOSZENIE WYSŁANE</p>
            <p className="text-[15px] text-[#F2EDE3]/80 leading-[1.6]">
              Dziękujemy. Potwierdzenie przyjęcia reklamacji wyślemy na podany adres e-mail.
              Jeśli masz zdjęcia lub nagranie wady — prześlij je w odpowiedzi na tego maila.
            </p>
            <div className="mt-6 pt-6 border-t border-[#D8FF3D]/20">
              <ShippingInstructions />
            </div>
            <Link href="/" className="inline-block mt-6 km-mono-eyebrow text-[#F2EDE3]/55 hover:text-[#D8FF3D] transition-colors">
              ← Strona główna
            </Link>
          </div>
        ) : (
          <>
            <div className="mb-12 border-l-2 border-[#D8FF3D] bg-[#D8FF3D]/[0.04] px-5 py-5">
              <ShippingInstructions />
            </div>

            <form onSubmit={submit} className="space-y-12">

            {/* 1 */}
            <div>
              <SectionTitle n={1}>Dane zgłaszającego</SectionTitle>
              <div className="grid sm:grid-cols-2 gap-5">
                <Field label="Imię i nazwisko" required>
                  <input className={inputClass} value={form.imie} onChange={(e) => set("imie", e.target.value)} required />
                </Field>
                <Field label="Telefon kontaktowy" required>
                  <input className={inputClass} value={form.telefon} onChange={(e) => set("telefon", e.target.value)} required />
                </Field>
                <Field label="Adres (ulica, nr, kod pocztowy, miejscowość)" required full>
                  <input className={inputClass} value={form.adres} onChange={(e) => set("adres", e.target.value)} required />
                </Field>
                <Field label="E-mail" required>
                  <input type="email" className={inputClass} value={form.email} onChange={(e) => set("email", e.target.value)} required />
                </Field>
                <Field label="Numer konta do zwrotu" hint="jeśli dotyczy zwrotu pieniędzy">
                  <input className={inputClass} value={form.konto} onChange={(e) => set("konto", e.target.value)} />
                </Field>
              </div>
            </div>

            {/* 2 */}
            <div>
              <SectionTitle n={2}>Dane zakupu</SectionTitle>
              <div className="grid sm:grid-cols-2 gap-5">
                <Field label="Numer zamówienia" required>
                  <input className={inputClass} value={form.zamowienie} onChange={(e) => set("zamowienie", e.target.value)} required />
                </Field>
                <Field label="Data zakupu" required>
                  <input type="date" className={inputClass} value={form.dataZakupu} onChange={(e) => set("dataZakupu", e.target.value)} required />
                </Field>
                <Field label="Dowód zakupu" hint="np. faktura nr FV/2026/...">
                  <input className={inputClass} value={form.dowod} onChange={(e) => set("dowod", e.target.value)} />
                </Field>
                <Field label="Numer seryjny urządzenia" hint="jeśli znany">
                  <input className={inputClass} value={form.sn} onChange={(e) => set("sn", e.target.value)} />
                </Field>
                <Field label="Wersja firmware" hint="jeśli znana, np. 1.7.2">
                  <input className={inputClass} value={form.fw} onChange={(e) => set("fw", e.target.value)} />
                </Field>
                <Field label="Data stwierdzenia wady" required>
                  <input type="date" className={inputClass} value={form.dataWady} onChange={(e) => set("dataWady", e.target.value)} required />
                </Field>
              </div>
            </div>

            {/* 3 */}
            <div>
              <SectionTitle n={3}>Opis wady</SectionTitle>
              <label className={label}>
                Co się stało — opisz dokładnie usterkę, okoliczności wystąpienia i czy jest odtwarzalna
                <span className="text-[#FF4D2E] ml-1">*</span>
              </label>
              <textarea
                className={inputClass + " resize-y"}
                rows={6}
                minLength={5}
                maxLength={4000}
                placeholder="Np.: Urządzenie nie włącza się od wczoraj / ekran jest pusty po naciśnięciu ON / kamera nie robi zdjęć / urządzenie zablokowało się po błędnym kodzie / inne..."
                value={form.opis}
                onChange={(e) => set("opis", e.target.value)}
                required
              />
              <p className="km-mono-eyebrow text-[#F2EDE3]/30 mt-2">{form.opis.length}/4000</p>
            </div>

            {/* 4 */}
            <div>
              <SectionTitle n={4}>Żądanie reklamującego</SectionTitle>
              <div className="space-y-3">
                {ZADANIA.map((z) => (
                  <label
                    key={z.value}
                    className={`flex items-start gap-3 border px-4 py-3.5 cursor-pointer transition-colors ${
                      form.zadanie === z.value
                        ? "border-[#D8FF3D] bg-[#D8FF3D]/[0.06]"
                        : "border-[rgba(242,237,227,0.18)] hover:border-[#F2EDE3]/40"
                    }`}
                  >
                    <input
                      type="radio"
                      name="zadanie"
                      className="mt-1 accent-[#D8FF3D]"
                      checked={form.zadanie === z.value}
                      onChange={() => set("zadanie", z.value)}
                      required
                    />
                    <span className="text-[14px]">
                      {z.value}
                      {z.desc && <span className="block text-[#F2EDE3]/45 text-[12px] mt-0.5">{z.desc}</span>}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* 5 — attachments note */}
            <div className="border-l-2 border-[#D8FF3D] bg-[#D8FF3D]/[0.04] px-4 py-3">
              <p className="km-mono-eyebrow text-[#D8FF3D] mb-1">/ ZAŁĄCZNIKI</p>
              <p className="text-[14px] text-[#F2EDE3]/80 leading-[1.6]">
                Zdjęcia lub nagranie wady oraz kopię dowodu zakupu prześlij w odpowiedzi na potwierdzenie
                zgłoszenia, które przyjdzie na podany e-mail.
              </p>
            </div>

            {/* declarations */}
            <div className="space-y-3">
              <label className="flex items-start gap-3 text-[13px] text-[#F2EDE3]/70 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-1 accent-[#D8FF3D]"
                  checked={form.oswiadczenie}
                  onChange={(e) => set("oswiadczenie", e.target.checked)}
                  required
                />
                Oświadczam, że opisana wada nie powstała z mojej winy (np. na skutek zalania, upadku,
                samowolnej ingerencji w urządzenie) i zgłaszam ją zgodnie z warunkami gwarancji / rękojmi
                określonymi w Regulaminie sklepu kalkmate.pl.
              </label>
              <label className="flex items-start gap-3 text-[13px] text-[#F2EDE3]/70 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-1 accent-[#D8FF3D]"
                  checked={form.rodo}
                  onChange={(e) => set("rodo", e.target.checked)}
                  required
                />
                Wyrażam zgodę na przetwarzanie podanych danych osobowych w celu rozpatrzenia niniejszej reklamacji.
              </label>
            </div>

            {error && (
              <div className="border border-[#FF4D2E]/40 bg-[#FF4D2E]/[0.06] p-3">
                <p className="km-mono-eyebrow text-[#FF4D2E]">/ ERROR</p>
                <p className="text-sm text-[#FF4D2E] mt-1">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className={`group w-full sm:w-auto px-6 py-4 km-mono-eyebrow flex items-center justify-center sm:justify-between gap-4 transition-colors ${
                submitting
                  ? "bg-[#D8FF3D]/30 text-[#0B0B0B]/50 cursor-not-allowed"
                  : "bg-[#D8FF3D] text-[#0B0B0B] hover:bg-[#F2EDE3]"
              }`}
            >
              <span>{submitting ? "Wysyłam..." : "Wyślij zgłoszenie"}</span>
              <span>→</span>
            </button>

            <p className="km-mono-eyebrow text-[#F2EDE3]/40">
              Sprzedawca: KAJPA Kacper Popko, ul. Zastawie I 37, 16-070 Choroszcz · NIP 9662222951
            </p>
          </form>
          </>
        )}
      </div>

      <Footer />
    </div>
  );
}

function ShippingInstructions() {
  return (
    <>
      <p className="km-mono-eyebrow text-[#D8FF3D] mb-2">/ JAK ODESŁAĆ URZĄDZENIE</p>
      <p className="text-[14px] text-[#F2EDE3]/80 leading-[1.6] mb-3">
        Po zgłoszeniu nadaj paczkę przez dowolny Paczkomat InPost (aplikacja InPost Mobile albo automat) —
        jako odbiorcę wpisz numer telefonu poniżej, paczka trafi bezpośrednio do wskazanego Paczkomatu:
      </p>
      <div className="grid sm:grid-cols-3 gap-3 text-[13.5px]">
        <div className="border border-[rgba(242,237,227,0.18)] px-3 py-2.5">
          <p className="km-mono-eyebrow text-[#F2EDE3]/40 text-[10px] mb-1">ODBIORCA</p>
          <p className="text-[#F2EDE3] font-medium">KAJPA Kacper Popko</p>
        </div>
        <div className="border border-[rgba(242,237,227,0.18)] px-3 py-2.5">
          <p className="km-mono-eyebrow text-[#F2EDE3]/40 text-[10px] mb-1">TELEFON</p>
          <p className="text-[#F2EDE3] font-medium">600 580 888</p>
        </div>
        <div className="border border-[rgba(242,237,227,0.18)] px-3 py-2.5">
          <p className="km-mono-eyebrow text-[#F2EDE3]/40 text-[10px] mb-1">PACZKOMAT</p>
          <p className="text-[#F2EDE3] font-medium">BIA10M</p>
        </div>
      </div>
      <p className="text-[12.5px] text-[#F2EDE3]/45 leading-[1.6] mt-3">
        Dołącz do paczki kartkę z numerem zamówienia i krótkim opisem usterki — ułatwi to i przyspieszy rozpatrzenie.
      </p>
    </>
  );
}

function SectionTitle({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 border-b border-[rgba(242,237,227,0.10)] pb-3 mb-6">
      <span className="w-6 h-6 flex items-center justify-center bg-[#D8FF3D] text-[#0B0B0B] km-mono-eyebrow text-[11px] font-bold">
        {n}
      </span>
      <h2 className="km-mono-eyebrow text-[#F2EDE3]">{children}</h2>
    </div>
  );
}

function Field({
  label: text, required, hint, full, children,
}: { label: string; required?: boolean; hint?: string; full?: boolean; children: React.ReactNode }) {
  return (
    <div className={full ? "sm:col-span-2" : undefined}>
      <label className={label}>
        {text}
        {required && <span className="text-[#FF4D2E] ml-1">*</span>}
      </label>
      {children}
      {hint && <p className="text-[11px] text-[#F2EDE3]/35 mt-1.5">{hint}</p>}
    </div>
  );
}
