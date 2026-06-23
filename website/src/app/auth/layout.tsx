import type { Metadata } from "next";

// Strony logowania/rejestracji/resetu — nie indeksujemy (niska wartość SEO,
// strony za-/przed-logowaniem). Canonical celowo nie ustawiany.
export const metadata: Metadata = {
  title: "Logowanie — KalkMate",
  robots: { index: false, follow: false },
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return children;
}
