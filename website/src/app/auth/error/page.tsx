"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

function ErrorContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  const errorMessages: Record<string, string> = {
    Configuration: "Wystąpił problem z konfiguracją serwera.",
    AccessDenied: "Dostęp został odrzucony.",
    Verification: "Link weryfikacyjny wygasł lub jest nieprawidłowy.",
    Default: "Wystąpił nieoczekiwany błąd podczas logowania.",
  };

  const message = error && errorMessages[error] ? errorMessages[error] : errorMessages.Default;

  return (
    <div className="min-h-screen bg-[#F5F5F5] dark:bg-[#313338] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white dark:bg-[#2B2D31] rounded-2xl p-8 border border-gray-100 dark:border-[#3F4147] text-center">
        <div className="w-16 h-16 bg-red-100 dark:bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-600 dark:text-red-400">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-[#1a1a1a] dark:text-[#E0E0E0] mb-2">
          Błąd logowania
        </h1>
        <p className="text-[#1a1a1a]/60 dark:text-[#E0E0E0]/60 mb-6">
          {message}
        </p>
        <Link
          href="/auth/signin"
          className="inline-block bg-gradient-to-r from-[#FF4D00] to-[#FF8000] text-white font-semibold py-3 px-6 rounded-lg hover:shadow-lg hover:shadow-[#FF4D00]/25 transition-all"
        >
          Spróbuj ponownie
        </Link>
      </div>
    </div>
  );
}

export default function ErrorPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#F5F5F5] dark:bg-[#313338] flex items-center justify-center p-4">
        <div className="text-[#1a1a1a] dark:text-[#E0E0E0]">Ładowanie...</div>
      </div>
    }>
      <ErrorContent />
    </Suspense>
  );
}
