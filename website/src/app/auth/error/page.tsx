"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

function ErrorContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  const errorMessages: Record<string, string> = {
    Configuration: "Problem z konfiguracją serwera.",
    AccessDenied: "Dostęp został odrzucony.",
    Verification: "Link weryfikacyjny wygasł lub jest nieprawidłowy.",
    Default: "Wystąpił nieoczekiwany błąd podczas logowania.",
  };

  const message = error && errorMessages[error] ? errorMessages[error] : errorMessages.Default;

  return (
    <div className="min-h-screen bg-[#0B0B0B] text-[#F2EDE3] km-grain flex items-center justify-center p-6">
      <div className="w-full max-w-md relative">
        <div className="absolute -top-1.5 -left-1.5 w-3 h-3 border-l border-t border-[#FF4D2E]" />
        <div className="absolute -top-1.5 -right-1.5 w-3 h-3 border-r border-t border-[#FF4D2E]" />
        <div className="absolute -bottom-1.5 -left-1.5 w-3 h-3 border-l border-b border-[#FF4D2E]" />
        <div className="absolute -bottom-1.5 -right-1.5 w-3 h-3 border-r border-b border-[#FF4D2E]" />
        <div className="border border-[rgba(242,237,227,0.18)] p-8 text-center">
          <div className="flex items-center justify-between border-b border-[rgba(242,237,227,0.10)] pb-4">
            <span className="km-mono-eyebrow text-[#FF4D2E] flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-[#FF4D2E] rounded-full km-blink" />
              Błąd
            </span>
            <span className="km-mono-eyebrow text-[#F2EDE3]/40">
              /AUTH · ERROR {error ? "· " + error.toUpperCase() : ""}
            </span>
          </div>
          <h1 className="km-display text-4xl mt-6">
            Coś <span className="italic text-[#FF4D2E]">poszło</span> nie tak.
          </h1>
          <p className="mt-4 text-[14.5px] text-[#F2EDE3]/65">{message}</p>
          <div className="mt-8 flex flex-col gap-3">
            <Link
              href="/auth/signin"
              className="inline-flex items-center justify-between px-5 py-3 km-mono-eyebrow bg-[#D8FF3D] text-[#0B0B0B] hover:bg-[#F2EDE3] transition-colors"
            >
              <span>Spróbuj ponownie</span>
              <span>→</span>
            </Link>
            <Link
              href="/"
              className="km-mono-eyebrow text-[#F2EDE3]/45 hover:text-[#F2EDE3] transition-colors"
            >
              ← Strona główna
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ErrorPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0B0B0B] flex items-center justify-center">
          <span className="km-mono-eyebrow text-[#F2EDE3]/55">Ładowanie...</span>
        </div>
      }
    >
      <ErrorContent />
    </Suspense>
  );
}
