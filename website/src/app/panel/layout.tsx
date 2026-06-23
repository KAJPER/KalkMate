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
      <div className="min-h-screen bg-[#0B0B0B] text-[#F2EDE3] km-grain">
        {children}
      </div>
    </SessionProvider>
  );
}
