import type { Metadata } from "next";
import SessionProvider from "@/components/SessionProvider";

// Panel za logowaniem — nie indeksujemy.
export const metadata: Metadata = {
  title: "Panel — KalkMate",
  robots: { index: false, follow: false },
};

export default function PanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SessionProvider>
      {/* data-clarity-mask: druga linia obrony — gdyby Clarity jednak się
          załadował na /panel, nie nagrywa treści (czaty, notatki, e-mail). */}
      <div className="min-h-screen bg-[#0B0B0B] text-[#F2EDE3] km-grain" data-clarity-mask="true">
        {children}
      </div>
    </SessionProvider>
  );
}
