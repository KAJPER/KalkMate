import SessionProvider from "@/components/SessionProvider";

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
