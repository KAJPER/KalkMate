"use client";

// Komunikaty w panelu zamiast alert(): nie blokuja strony, znikaja same.
// Uzycie z dowolnego miejsca w /admin: toast("Zapisano") / toast("Blad", "error").
// <Toaster /> jest zamontowany raz w src/app/admin/layout.tsx.

import { useSyncExternalStore } from "react";

export type ToastKind = "success" | "error" | "info";
interface ToastItem { id: number; text: string; kind: ToastKind }

let items: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function dismiss(id: number) {
  items = items.filter((t) => t.id !== id);
  emit();
}

export function toast(text: string, kind: ToastKind = "success") {
  const id = nextId++;
  items = [...items.slice(-4), { id, text, kind }];
  emit();
  setTimeout(() => dismiss(id), kind === "error" ? 7000 : 3500);
}

export function toastError(e: unknown, fallback = "Błąd sieci") {
  toast(e instanceof Error && e.message ? e.message : fallback, "error");
}

const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
const getSnapshot = () => items;
const EMPTY: ToastItem[] = [];
const getServerSnapshot = () => EMPTY;

const STYLE: Record<ToastKind, string> = {
  success: "border-[#3BA55C]/50 bg-[#1f3326] text-[#C8F0D4]",
  error: "border-[#ED4245]/50 bg-[#3a1f21] text-[#F8C8C9]",
  info: "border-[#5865F2]/50 bg-[#22253a] text-[#D0D4FA]",
};
const ICON: Record<ToastKind, string> = { success: "✓", error: "⚠", info: "ℹ" };

export function Toaster() {
  const list = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  if (!list.length) return null;
  return (
    <div className="fixed z-[100] bottom-4 right-4 left-4 sm:left-auto flex flex-col gap-2 items-stretch sm:items-end pointer-events-none print:hidden">
      {list.map((t) => (
        <div
          key={t.id}
          role={t.kind === "error" ? "alert" : "status"}
          className={`pointer-events-auto flex items-start gap-2 rounded-lg border px-4 py-3 text-sm shadow-lg sm:max-w-sm ${STYLE[t.kind]}`}
        >
          <span aria-hidden>{ICON[t.kind]}</span>
          <span className="flex-1 break-words">{t.text}</span>
          <button onClick={() => dismiss(t.id)} className="opacity-60 hover:opacity-100" aria-label="Zamknij">✕</button>
        </div>
      ))}
    </div>
  );
}
