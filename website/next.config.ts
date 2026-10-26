import type { NextConfig } from "next";

// 'unsafe-eval' tylko w dev (React Refresh / HMR Next.js go wymaga). W produkcji
// nic z naszego stosu go nie potrzebuje (Stripe.js, KaTeX, framer-motion,
// geowidget InPost). 'unsafe-inline' zostaje — Next bez nonce wstrzykuje
// inline skrypty hydracji, a JSON-LD jest inline.
const isDev = process.env.NODE_ENV !== "production";

const scriptSrc = [
  "'self'",
  "'unsafe-inline'",
  ...(isDev ? ["'unsafe-eval'"] : []),
  "https://js.stripe.com",
  "https://apm.przelewy24.pl",
  "https://geowidget.inpost.pl",
  "https://www.clarity.ms",
  "https://*.clarity.ms",
  // Google Customer Reviews (opt-in po zakupie, BuyNow) — platform.js + gapi.
  "https://apis.google.com",
].join(" ");

const securityHeaders = [
  { key: "X-Content-Type-Options",  value: "nosniff" },
  { key: "X-Frame-Options",         value: "DENY" },
  { key: "X-XSS-Protection",        value: "1; mode=block" },
  { key: "Referrer-Policy",         value: "strict-origin-when-cross-origin" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      `script-src ${scriptSrc}`,
      "style-src 'self' 'unsafe-inline' https://geowidget.inpost.pl",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data: https://geowidget.inpost.pl",
      "connect-src 'self' https://api.stripe.com https://openrouter.ai https://secure.przelewy24.pl https://sandbox.przelewy24.pl https://geowidget.inpost.pl https://api.inpost.pl https://www.clarity.ms https://*.clarity.ms",
      // www.google.com / apis.google.com — iframe opt-inu Google Customer Reviews.
      "frame-src https://js.stripe.com https://hooks.stripe.com https://secure.przelewy24.pl https://sandbox.przelewy24.pl https://geowidget.inpost.pl https://*.inpost.pl https://www.google.com https://apis.google.com",
      "form-action 'self' https://secure.przelewy24.pl https://sandbox.przelewy24.pl",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  images: {
    formats: ["image/webp", "image/avif"],
    deviceSizes: [640, 828, 1200, 1920, 2048],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    qualities: [60, 75, 90, 92],
    minimumCacheTTL: 60 * 60 * 24 * 365,
  },
  async headers() {
    return [
      { source: "/(.*)", headers: securityHeaders },
      // Zalaczniki maili z IMAP (tresc od obcych nadawcow) — sandbox bez skryptow.
      // Musi byc PO regule globalnej: przy tym samym kluczu wygrywa ostatnia,
      // a naglowek ustawiony w samym route jest przez next.config nadpisywany.
      {
        source: "/api/admin/mailbox/:uid/attachment/:index",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "sandbox; default-src 'none'; img-src data:; style-src 'unsafe-inline'",
          },
        ],
      },
      // Root layout renderuje <html lang="pl"> (HtmlLang poprawia to dopiero
      // w JS), wiec jezyk wersji /xx podajemy tez naglowkiem — Bing/Yandex
      // biora go pod uwage przy przypisaniu strony do jezyka.
      ...["en", "de", "cs", "sk", "lt", "be", "es", "pt", "fr", "it"].flatMap((l) => [
        { source: `/${l}`, headers: [{ key: "Content-Language", value: l }] },
        { source: `/${l}/:path*`, headers: [{ key: "Content-Language", value: l }] },
      ]),
      { source: "/", headers: [{ key: "Content-Language", value: "pl" }] },
      { source: "/pomoc", headers: [{ key: "Content-Language", value: "pl" }] },
      {
        source: "/frames/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ];
  },
};

export default nextConfig;
