import type { Metadata } from "next";

// Koszyk — strona transakcyjna, bez wartości w wynikach wyszukiwania.
export const metadata: Metadata = {
  title: "Koszyk — KalkMate",
  robots: { index: false, follow: false },
};

export default function KoszykLayout({ children }: { children: React.ReactNode }) {
  return children;
}
