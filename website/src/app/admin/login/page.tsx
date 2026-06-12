"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLogin() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      if (!res.ok) {
        setError("Nieprawidłowy kod");
        setLoading(false);
        return;
      }

      router.push("/admin");
    } catch {
      setError("Wystąpił błąd. Spróbuj ponownie.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#2B2D31] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-[#E0E0E0]">KalkMate</h1>
          <p className="text-sm text-[#E0E0E0]/50 mt-1">Panel administracyjny</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-[#313338] rounded-xl border border-[#3F4147] p-6 space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-[#E0E0E0]/70 mb-1">
              Kod Authenticator
            </label>
            <input
              type="text"
              required
              autoFocus
              maxLength={6}
              value={token}
              onChange={(e) => setToken(e.target.value.replace(/\D/g, ''))}
              className="w-full px-4 py-2.5 rounded-lg border border-[#3F4147] bg-[#2B2D31] text-[#E0E0E0] text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
              placeholder="Wpisz 6-cyfrowy kod"
              inputMode="numeric"
            />
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-2.5 font-medium rounded-lg text-white transition-colors ${
              loading
                ? "bg-[#3B82F6]/60 cursor-not-allowed"
                : "bg-[#3B82F6] hover:bg-[#2563EB]"
            }`}
          >
            {loading ? "Logowanie..." : "Zaloguj się"}
          </button>
        </form>
      </div>
    </div>
  );
}
