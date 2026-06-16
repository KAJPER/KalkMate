import type { Metadata } from "next";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "KalkMate — AI Calculator for Exams | Smart Photo Calculator",
  description:
    "KalkMate is the AI exam calculator that solves math, physics, chemistry and biology problems. Point the camera at a question — get the full solution on screen. 169 EUR.",
  keywords: [
    "AI calculator",
    "AI exam calculator",
    "smart calculator for exams",
    "photo calculator AI",
    "calculator with AI",
    "matura calculator",
    "AI math solver",
    "camera calculator",
    "KalkMate",
  ],
  authors: [{ name: "KalkMate" }],
  creator: "KalkMate",
  publisher: "KalkMate",
  formatDetection: { email: false, address: false, telephone: false },
  metadataBase: new URL("https://kalkmate.pl"),
  alternates: {
    canonical: "/en",
    languages: {
      "pl": "/",
      "en": "/en",
    },
  },
  openGraph: {
    title: "KalkMate — AI Calculator for Exams",
    description:
      "Point the camera at your exam question. KalkMate's built-in AI delivers a step-by-step solution on its OLED screen — no phone needed.",
    type: "website",
    locale: "en_US",
    url: "https://kalkmate.pl/en",
    siteName: "KalkMate",
    images: [
      { url: "/KalkMate.png", width: 1200, height: 630, alt: "KalkMate — AI Calculator for Exams" },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "KalkMate — AI Calculator for Exams",
    description:
      "Photo → AI → Solution. The smart calculator that solves math, physics, chemistry and biology problems for Polish exams.",
    images: ["/KalkMate.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Product",
  name: "KalkMate — AI Calculator for Exams",
  image: "https://kalkmate.pl/KalkMate.png",
  description:
    "Smart AI-powered calculator with built-in camera. Solves math, physics, chemistry and biology exam questions by analysing a photo and displaying a full solution on a 256×64 OLED screen.",
  brand: { "@type": "Brand", name: "KalkMate" },
  offers: {
    "@type": "Offer",
    url: "https://kalkmate.pl/en",
    priceCurrency: "EUR",
    price: "169",
    priceValidUntil: "2026-12-31",
    availability: "https://schema.org/InStock",
    seller: { "@type": "Organization", name: "KalkMate" },
  },
};

export default function EnglishPage() {
  return (
    <>
      {/* JSON-LD Product schema */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* hreflang self + pl alternate */}
      {/* Note: canonical alternates are declared in metadata.alternates above;
          these extra link tags provide belt-and-suspenders coverage for crawlers */}

      <Navigation />

      <main className="relative overflow-x-clip">

        {/* ─── HERO ─────────────────────────────────────────────── */}
        <section
          id="top"
          className="relative min-h-[92dvh] flex flex-col justify-center pt-32 pb-24 px-5 lg:px-10"
        >
          {/* Background grid accent */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage:
                "linear-gradient(rgba(216,255,61,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(216,255,61,0.03) 1px, transparent 1px)",
              backgroundSize: "64px 64px",
            }}
          />

          <div className="mx-auto max-w-[1400px] w-full relative z-10">
            {/* Eyebrow */}
            <p className="font-mono text-[11px] tracking-[0.18em] uppercase text-[#D8FF3D] mb-8">
              KalkMate · AI Exam Calculator · v0.6.4
            </p>

            {/* H1 */}
            <h1 className="font-serif text-[clamp(48px,9vw,128px)] leading-[0.92] tracking-tight text-[#F2EDE3] max-w-5xl">
              The{" "}
              <span className="italic text-[#D8FF3D]">AI calculator</span>
              <br />
              for your exams.
            </h1>

            {/* Subtitle */}
            <p className="mt-8 text-[clamp(17px,2.2vw,22px)] text-[#F2EDE3]/65 max-w-2xl leading-relaxed">
              Point the built-in camera at any exam question — KalkMate's AI
              analyses the photo and shows a step-by-step solution on its OLED
              screen. Math, physics, chemistry, biology. No phone, no app, no
              internet connection needed during use.
            </p>

            {/* CTAs */}
            <div className="mt-12 flex flex-wrap items-center gap-4">
              <a
                href="/#kup-teraz"
                className="inline-flex items-center gap-3 px-8 py-4 bg-[#D8FF3D] text-[#0B0B0B] font-mono text-[13px] tracking-[0.12em] uppercase font-bold hover:bg-[#F2EDE3] transition-colors"
              >
                Order now — 169 EUR
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
                  <path d="M1 7h12M8 2l5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </a>
              <a
                href="/"
                className="inline-flex items-center gap-2 px-6 py-4 font-mono text-[13px] tracking-[0.12em] uppercase text-[#F2EDE3]/60 border border-[rgba(242,237,227,0.20)] hover:border-[#D8FF3D] hover:text-[#F2EDE3] transition-colors"
              >
                Polski ↗
              </a>
            </div>

            {/* Stats row */}
            <div className="mt-16 flex flex-wrap gap-x-12 gap-y-6">
              {[
                { value: "4", label: "subjects covered" },
                { value: "256×64", label: "OLED display" },
                { value: "<3 s", label: "avg. response" },
                { value: "169 EUR", label: "incl. VAT" },
              ].map((s) => (
                <div key={s.label}>
                  <p className="font-serif text-[clamp(28px,4vw,44px)] italic text-[#D8FF3D] leading-none">
                    {s.value}
                  </p>
                  <p className="font-mono text-[11px] tracking-[0.14em] uppercase text-[#F2EDE3]/40 mt-1.5">
                    {s.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── HOW IT WORKS ─────────────────────────────────────── */}
        <section
          id="how-it-works"
          className="py-24 px-5 lg:px-10 bg-[#111111]"
        >
          <div className="mx-auto max-w-[1400px]">
            <p className="font-mono text-[11px] tracking-[0.18em] uppercase text-[#D8FF3D] mb-4">
              01 · How it works
            </p>
            <h2 className="font-serif text-[clamp(36px,5.5vw,72px)] leading-[0.95] text-[#F2EDE3] mb-16 max-w-2xl">
              Three steps to the solution.
            </h2>

            <div className="grid md:grid-cols-3 gap-0 border border-[rgba(242,237,227,0.10)]">
              {[
                {
                  n: "01",
                  icon: (
                    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden>
                      <rect x="4" y="6" width="24" height="20" rx="2" stroke="#D8FF3D" strokeWidth="1.8" />
                      <circle cx="16" cy="16" r="5" stroke="#D8FF3D" strokeWidth="1.8" />
                      <circle cx="16" cy="16" r="2" fill="#D8FF3D" />
                      <path d="M10 6V4M22 6V4" stroke="#D8FF3D" strokeWidth="1.8" strokeLinecap="round" />
                    </svg>
                  ),
                  title: "Photograph the question",
                  body: "Press the shutter button. The OV2640 camera captures the exam problem — handwritten or printed.",
                },
                {
                  n: "02",
                  icon: (
                    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden>
                      <path d="M6 16c0-5.523 4.477-10 10-10s10 4.477 10 10-4.477 10-10 10" stroke="#D8FF3D" strokeWidth="1.8" strokeLinecap="round" />
                      <path d="M16 10v6l4 2" stroke="#D8FF3D" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M6 22l2-2-2-2" stroke="#D8FF3D" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ),
                  title: "AI analyses via WiFi",
                  body: "The image is sent over WiFi to our AI server trained on Polish exam papers. The model identifies the subject and solves the problem step by step.",
                },
                {
                  n: "03",
                  icon: (
                    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden>
                      <rect x="3" y="9" width="26" height="14" rx="1.5" stroke="#D8FF3D" strokeWidth="1.8" />
                      <path d="M8 16h4M16 13l2 3-2 3M20 13l2 3-2 3" stroke="#D8FF3D" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ),
                  title: "Solution on screen",
                  body: "The full solution scrolls across the 256×64 OLED display. Follow each step, understand the method, write down the answer.",
                },
              ].map((step, i) => (
                <div
                  key={step.n}
                  className={`p-8 lg:p-10 flex flex-col gap-6 ${i < 2 ? "border-b md:border-b-0 md:border-r border-[rgba(242,237,227,0.10)]" : ""}`}
                >
                  <div className="flex items-start justify-between">
                    {step.icon}
                    <span className="font-mono text-[11px] tracking-[0.18em] text-[#F2EDE3]/25">
                      {step.n}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-bold text-[#F2EDE3] text-[20px] mb-3">
                      {step.title}
                    </h3>
                    <p className="text-[15px] text-[#F2EDE3]/60 leading-relaxed">
                      {step.body}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── SPECS ────────────────────────────────────────────── */}
        <section id="specs" className="py-24 px-5 lg:px-10">
          <div className="mx-auto max-w-[1400px]">
            <p className="font-mono text-[11px] tracking-[0.18em] uppercase text-[#D8FF3D] mb-4">
              02 · Hardware specs
            </p>
            <h2 className="font-serif text-[clamp(36px,5.5vw,72px)] leading-[0.95] text-[#F2EDE3] mb-16 max-w-2xl">
              Built to last an exam.
            </h2>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-px bg-[rgba(242,237,227,0.10)]">
              {[
                {
                  label: "Display",
                  value: "256×64 OLED",
                  sub: "SSD1322 — high-contrast, wide viewing angle",
                },
                {
                  label: "Camera",
                  value: "OV2640",
                  sub: "2 MP — clear capture of printed & handwritten text",
                },
                {
                  label: "Processor",
                  value: "ESP32-WROVER-E",
                  sub: "240 MHz dual-core, 8 MB PSRAM",
                },
                {
                  label: "Connectivity",
                  value: "WiFi 802.11 b/g/n",
                  sub: "2.4 GHz — school & home networks",
                },
                {
                  label: "Subjects",
                  value: "Math · Physics · Chemistry · Biology",
                  sub: "Trained on Polish CKE matura exam papers",
                },
                {
                  label: "Battery",
                  value: "LiPo 3.7 V",
                  sub: "MCP73831 charging, DW01A protection, USB-C",
                },
              ].map((spec) => (
                <div
                  key={spec.label}
                  className="bg-[#0B0B0B] p-7 flex flex-col gap-2 group hover:bg-[#141414] transition-colors"
                >
                  <p className="font-mono text-[10px] tracking-[0.16em] uppercase text-[#D8FF3D]">
                    {spec.label}
                  </p>
                  <p className="font-bold text-[#F2EDE3] text-[17px] leading-snug">
                    {spec.value}
                  </p>
                  <p className="text-[13.5px] text-[#F2EDE3]/45 leading-snug">
                    {spec.sub}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── PRICE CARD ───────────────────────────────────────── */}
        <section id="price" className="py-24 px-5 lg:px-10 bg-[#111111]">
          <div className="mx-auto max-w-[1400px]">
            <p className="font-mono text-[11px] tracking-[0.18em] uppercase text-[#D8FF3D] mb-4">
              03 · Pricing
            </p>
            <h2 className="font-serif text-[clamp(36px,5.5vw,72px)] leading-[0.95] text-[#F2EDE3] mb-16 max-w-2xl">
              One price, everything included.
            </h2>

            <div className="grid lg:grid-cols-2 gap-8 items-start">
              {/* Card */}
              <div className="border border-[#D8FF3D] p-8 lg:p-10 relative overflow-hidden">
                {/* corner decoration */}
                <div
                  aria-hidden
                  className="absolute top-0 right-0 w-32 h-32 opacity-[0.04]"
                  style={{
                    background: "radial-gradient(circle at top right, #D8FF3D, transparent 70%)",
                  }}
                />

                <div className="flex items-start justify-between mb-8">
                  <div>
                    <p className="font-mono text-[11px] tracking-[0.16em] uppercase text-[#F2EDE3]/40 mb-2">
                      KalkMate · Standard
                    </p>
                    <p className="font-serif text-[clamp(52px,8vw,96px)] italic leading-none text-[#D8FF3D]">
                      169 EUR
                    </p>
                    <p className="font-mono text-[12px] text-[#F2EDE3]/40 mt-2">
                      ≈ 699 PLN · incl. VAT
                    </p>
                  </div>
                </div>

                <ul className="space-y-3 mb-10">
                  {[
                    "KalkMate device",
                    "Free InPost shipping to Poland",
                    "EU shipping — flat 20 EUR",
                    "12-month hardware warranty",
                    "OTA firmware updates",
                    "Access to AI solver service",
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-3 text-[15px] text-[#F2EDE3]/80">
                      <span className="text-[#D8FF3D] font-mono text-[13px]">✓</span>
                      {item}
                    </li>
                  ))}
                </ul>

                <a
                  href="/#kup-teraz"
                  className="inline-flex w-full items-center justify-center gap-3 px-8 py-4 bg-[#D8FF3D] text-[#0B0B0B] font-mono text-[13px] tracking-[0.12em] uppercase font-bold hover:bg-[#F2EDE3] transition-colors"
                >
                  Order on the Polish page
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
                    <path d="M1 7h12M8 2l5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </a>

                <p className="mt-4 font-mono text-[11px] text-[#F2EDE3]/30 text-center">
                  Checkout & payment processed in Polish — contact us at{" "}
                  <a href="mailto:kontakt@kalkmate.pl" className="text-[#F2EDE3]/50 hover:text-[#D8FF3D] transition-colors">
                    kontakt@kalkmate.pl
                  </a>{" "}
                  for English support.
                </p>
              </div>

              {/* Right column — shipping info */}
              <div className="flex flex-col gap-6">
                <div className="border border-[rgba(242,237,227,0.12)] p-6">
                  <p className="font-mono text-[10px] tracking-[0.16em] uppercase text-[#D8FF3D] mb-3">
                    Shipping · Poland
                  </p>
                  <p className="font-bold text-[#F2EDE3] text-[18px] mb-1">Free · InPost parcel locker</p>
                  <p className="text-[14px] text-[#F2EDE3]/50">
                    Delivered to any InPost parcel locker in Poland within 1–2 business days.
                  </p>
                </div>

                <div className="border border-[rgba(242,237,227,0.12)] p-6">
                  <p className="font-mono text-[10px] tracking-[0.16em] uppercase text-[#D8FF3D] mb-3">
                    Shipping · European Union
                  </p>
                  <p className="font-bold text-[#F2EDE3] text-[18px] mb-1">20 EUR — tracked courier</p>
                  <p className="text-[14px] text-[#F2EDE3]/50">
                    Shipped via Furgonetka to all EU countries. Estimated delivery 3–6 business days.
                  </p>
                </div>

                <div className="border border-[rgba(242,237,227,0.12)] p-6">
                  <p className="font-mono text-[10px] tracking-[0.16em] uppercase text-[#D8FF3D] mb-3">
                    Questions?
                  </p>
                  <p className="text-[14px] text-[#F2EDE3]/60 leading-relaxed">
                    We speak English. Reach out at{" "}
                    <a
                      href="mailto:kontakt@kalkmate.pl"
                      className="text-[#F2EDE3] underline underline-offset-2 hover:text-[#D8FF3D] transition-colors"
                    >
                      kontakt@kalkmate.pl
                    </a>{" "}
                    and we&rsquo;ll help you place your order.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ─── FINAL CTA ────────────────────────────────────────── */}
        <section className="py-28 px-5 lg:px-10 text-center">
          <div className="mx-auto max-w-3xl">
            <p className="font-mono text-[11px] tracking-[0.18em] uppercase text-[#D8FF3D] mb-6">
              Ready?
            </p>
            <h2 className="font-serif text-[clamp(40px,7vw,96px)] leading-[0.92] text-[#F2EDE3] mb-8">
              Stop guessing.
              <br />
              <span className="italic text-[#D8FF3D]">Start solving.</span>
            </h2>
            <p className="text-[16px] text-[#F2EDE3]/55 mb-10 leading-relaxed">
              KalkMate is the smart AI calculator for exam students. Built in Poland, ships across Europe.
            </p>
            <a
              href="/#kup-teraz"
              className="inline-flex items-center gap-3 px-10 py-5 bg-[#D8FF3D] text-[#0B0B0B] font-mono text-[14px] tracking-[0.14em] uppercase font-bold hover:bg-[#F2EDE3] transition-colors"
            >
              Order KalkMate — 169 EUR
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
                <path d="M1 8h14M9 2l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
          </div>
        </section>

      </main>

      <Footer />
    </>
  );
}
