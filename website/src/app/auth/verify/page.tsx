import Link from "next/link";

export default function VerifyPage() {
  return (
    <div className="min-h-screen bg-[#0B0B0B] text-[#F2EDE3] km-grain flex items-center justify-center p-6">
      <div className="w-full max-w-md relative">
        <div className="absolute -top-1.5 -left-1.5 w-3 h-3 border-l border-t border-[#D8FF3D]" />
        <div className="absolute -top-1.5 -right-1.5 w-3 h-3 border-r border-t border-[#D8FF3D]" />
        <div className="absolute -bottom-1.5 -left-1.5 w-3 h-3 border-l border-b border-[#D8FF3D]" />
        <div className="absolute -bottom-1.5 -right-1.5 w-3 h-3 border-r border-b border-[#D8FF3D]" />
        <div className="border border-[rgba(242,237,227,0.18)] p-8 text-center">
          <div className="flex items-center justify-between border-b border-[rgba(242,237,227,0.10)] pb-4">
            <span className="km-mono-eyebrow text-[#D8FF3D] flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-[#D8FF3D] rounded-full km-blink" />
              Email wysłany
            </span>
            <span className="km-mono-eyebrow text-[#F2EDE3]/40">/VERIFY</span>
          </div>
          <h1 className="km-display text-4xl mt-6">
            Sprawdź <span className="italic text-[#D8FF3D]">skrzynkę</span>.
          </h1>
          <p className="mt-4 text-[14.5px] text-[#F2EDE3]/65">
            Wysłaliśmy link logowania na Twój adres email.
          </p>
          <p className="mt-2 km-mono-eyebrow text-[#F2EDE3]/40">
            Link jest ważny przez 24 godziny.
          </p>
          <Link
            href="/"
            className="mt-8 inline-block km-mono-eyebrow text-[#D8FF3D] hover:text-[#F2EDE3] transition-colors"
          >
            ← Powrót na stronę główną
          </Link>
        </div>
      </div>
    </div>
  );
}
