"use client";

import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/panel";

  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      if (isLogin) {
        // Logowanie
        const result = await signIn("credentials", {
          email,
          password,
          redirect: false,
        });

        if (result?.error) {
          setError(result.error);
        } else if (result?.ok) {
          router.push(callbackUrl);
          router.refresh();
        }
      } else {
        // Rejestracja
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, name }),
        });

        const data = await res.json();

        if (!res.ok) {
          setError(data.error || "Błąd rejestracji");
        } else {
          // Auto-logowanie po rejestracji
          const result = await signIn("credentials", {
            email,
            password,
            redirect: false,
          });

          if (result?.ok) {
            router.push(callbackUrl);
            router.refresh();
          }
        }
      }
    } catch (error: any) {
      setError(error.message || "Wystąpił błąd");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F5F5] dark:bg-[#313338] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white dark:bg-[#2B2D31] rounded-2xl p-8 border border-gray-100 dark:border-[#3F4147]">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-[#2563EB] dark:text-[#3B82F6] mb-2">
            KalkMate
          </h1>
          <p className="text-[#1a1a1a]/60 dark:text-[#E0E0E0]/60">
            {isLogin ? "Zaloguj się do panelu klienta" : "Utwórz nowe konto"}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-lg text-sm text-red-700 dark:text-red-400">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-[#1a1a1a] dark:text-[#E0E0E0] mb-2">
                Imię (opcjonalne)
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jan Kowalski"
                className="w-full px-4 py-3 bg-[#F5F5F5] dark:bg-[#313338] border border-gray-200 dark:border-[#3F4147] rounded-lg text-[#1a1a1a] dark:text-[#E0E0E0] placeholder:text-[#1a1a1a]/40 dark:placeholder:text-[#E0E0E0]/40 focus:outline-none focus:ring-2 focus:ring-[#2563EB] dark:focus:ring-[#3B82F6] focus:border-transparent transition-all"
              />
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-[#1a1a1a] dark:text-[#E0E0E0] mb-2">
              Adres email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="twoj@email.pl"
              required
              className="w-full px-4 py-3 bg-[#F5F5F5] dark:bg-[#313338] border border-gray-200 dark:border-[#3F4147] rounded-lg text-[#1a1a1a] dark:text-[#E0E0E0] placeholder:text-[#1a1a1a]/40 dark:placeholder:text-[#E0E0E0]/40 focus:outline-none focus:ring-2 focus:ring-[#2563EB] dark:focus:ring-[#3B82F6] focus:border-transparent transition-all"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-[#1a1a1a] dark:text-[#E0E0E0] mb-2">
              Hasło
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
              className="w-full px-4 py-3 bg-[#F5F5F5] dark:bg-[#313338] border border-gray-200 dark:border-[#3F4147] rounded-lg text-[#1a1a1a] dark:text-[#E0E0E0] placeholder:text-[#1a1a1a]/40 dark:placeholder:text-[#E0E0E0]/40 focus:outline-none focus:ring-2 focus:ring-[#2563EB] dark:focus:ring-[#3B82F6] focus:border-transparent transition-all"
            />
            {!isLogin && (
              <p className="text-xs text-[#1a1a1a]/40 dark:text-[#E0E0E0]/40 mt-1">
                Minimum 6 znaków
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-[#2563EB] dark:bg-[#3B82F6] text-white font-semibold py-3 px-6 rounded-lg hover:bg-[#1d4ed8] dark:hover:bg-[#2563EB] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                {isLogin ? "Logowanie..." : "Tworzenie konta..."}
              </span>
            ) : (
              isLogin ? "Zaloguj się" : "Zarejestruj się"
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => {
              setIsLogin(!isLogin);
              setError("");
            }}
            className="text-sm text-[#2563EB] dark:text-[#3B82F6] hover:underline"
          >
            {isLogin ? "Nie masz konta? Zarejestruj się" : "Masz już konto? Zaloguj się"}
          </button>
        </div>

        <div className="mt-6 text-center">
          <Link href="/" className="text-sm text-[#1a1a1a]/60 dark:text-[#E0E0E0]/60 hover:text-[#1a1a1a] dark:hover:text-[#E0E0E0]">
            ← Powrót do strony głównej
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#F5F5F5] dark:bg-[#313338] flex items-center justify-center p-4">
        <div className="text-[#1a1a1a] dark:text-[#E0E0E0]">Ładowanie...</div>
      </div>
    }>
      <SignInForm />
    </Suspense>
  );
}
