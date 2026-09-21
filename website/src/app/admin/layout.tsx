import type { Metadata, Viewport } from "next";

// Osobny manifest PWA dla /admin (nie ten sam co publiczna strona w
// src/app/layout.tsx) — zeby "Zainstaluj aplikacje" / "Dodaj do ekranu
// glownego" na telefonie dawalo osobna ikone/nazwe "KalkMate Admin", a nie
// mylilo sie z instalacja produktu dla klientow. Plik: public/admin.webmanifest
// (scope "/admin" — otwarcie linku poza panelem wychodzi z trybu standalone,
// co jest tu poprawnym zachowaniem).
export const metadata: Metadata = {
  title: "KalkMate Admin",
  robots: "noindex, nofollow",
  manifest: "/admin.webmanifest",
  appleWebApp: {
    capable: true,
    title: "KalkMate Admin",
    // "default" = pelny, niemy pasek statusu iOS POZA obszarem strony (nie
    // nachodzi na tresc) — prosciej i bezpieczniej niz "black-translucent",
    // ktore wymagaloby recznego doliczania env(safe-area-inset-top) we
    // wszystkich mobilnych naglowkach (AdminShell tego dzis nie robi).
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#1E1F22",
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
