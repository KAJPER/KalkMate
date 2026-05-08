import { Inter } from "next/font/google";
import SessionProvider from "@/components/SessionProvider";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "latin-ext"],
});

export default function ClaimLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SessionProvider>
      <div className={`${inter.variable} min-h-screen bg-[#F5F5F5] dark:bg-[#313338]`}>
        {children}
      </div>
    </SessionProvider>
  );
}
