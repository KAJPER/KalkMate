"use client";

import { useState, useEffect } from "react";
import AdminShell from "@/components/admin/AdminShell";

interface InventoryItem {
  id: string;
  name: string;
  count: number;
  notes: string | null;
  updatedAt: string;
}

interface InventoryData {
  ok: boolean;
  stats: { totalItems: number; totalUnits: number };
  items: InventoryItem[];
}

function fmt(s: string) {
  return new Date(s).toLocaleString("pl-PL", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function InventoryPage() {
  const [data, setData] = useState<InventoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  // Add new item form
  const [newName, setNewName] = useState("");
  const [newCount, setNewCount] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [adding, setAdding] = useState(false);

  // Inline edit
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editCount, setEditCount] = useState("");
  const [editNotes, setEditNotes] = useState("");

  const load = async () => {
    try {
      const res = await fetch("/api/admin/inventory", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const addItem = async () => {
    if (!newName.trim()) return;
    setAdding(true);
    try {
      const r = await fetch("/api/admin/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          count: newCount ? Number(newCount) : 0,
          notes: newNotes.trim() || undefined,
        }),
      });
      const j = await r.json();
      if (!j.ok) {
        alert(j.error || "Blad dodawania");
      } else {
        setNewName("");
        setNewCount("");
        setNewNotes("");
        await load();
      }
    } finally {
      setAdding(false);
    }
  };

  const updateDelta = async (id: string, delta: number) => {
    setBusy(id);
    try {
      const r = await fetch(`/api/admin/inventory?id=${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ delta }),
      });
      const j = await r.json();
      if (!j.ok) alert(j.error || "Blad");
      await load();
    } finally {
      setBusy(null);
    }
  };

  const startEdit = (item: InventoryItem) => {
    setEditingId(item.id);
    setEditName(item.name);
    setEditCount(String(item.count));
    setEditNotes(item.notes || "");
  };

  const saveEdit = async () => {
    if (!editingId) return;
    setBusy(editingId);
    try {
      const r = await fetch(`/api/admin/inventory?id=${encodeURIComponent(editingId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          count: Number(editCount) || 0,
          notes: editNotes.trim(),
        }),
      });
      const j = await r.json();
      if (!j.ok) {
        alert(j.error || "Blad zapisu");
      } else {
        setEditingId(null);
        await load();
      }
    } finally {
      setBusy(null);
    }
  };

  const deleteItem = async (id: string, name: string) => {
    if (!confirm(`Usunac "${name}" z magazynu?`)) return;
    setBusy(id);
    try {
      const r = await fetch(`/api/admin/inventory?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const j = await r.json();
      if (!j.ok) alert(j.error || "Blad usuwania");
      await load();
    } finally {
      setBusy(null);
    }
  };

  return (
    <AdminShell>
      <div className="p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#E0E0E0] mb-1">Magazyn</h1>
            <p className="text-sm text-[#E0E0E0]/60">
              Stan zapasów — ile czego masz na stanie
            </p>
          </div>
          <button
            onClick={load}
            className="flex items-center gap-2 px-4 py-2 bg-[#313338] hover:bg-[#3F4147] rounded-lg text-sm text-[#3B82F6] transition-colors"
          >
            Odśwież
          </button>
        </div>

        {loading && <div className="text-[#E0E0E0]/60">Ładowanie…</div>}
        {error && (
          <div className="text-red-400 bg-red-900/20 border border-red-800 rounded-lg p-4">
            Błąd: {error}
          </div>
        )}

        {data && (
          <>
            <div className="grid grid-cols-2 gap-4 mb-6 max-w-xl">
              <div className="bg-gradient-to-br from-[#313338] to-[#2B2D31] rounded-xl border border-[#3F4147] p-5">
                <p className="text-xs text-[#E0E0E0]/60 mb-1">Pozycji w magazynie</p>
                <p className="text-3xl font-bold text-[#3B82F6]">{data.stats.totalItems}</p>
              </div>
              <div className="bg-gradient-to-br from-[#313338] to-[#2B2D31] rounded-xl border border-[#3F4147] p-5">
                <p className="text-xs text-[#E0E0E0]/60 mb-1">Łącznie sztuk</p>
                <p className="text-3xl font-bold text-green-400">{data.stats.totalUnits}</p>
              </div>
            </div>

            {/* Lista pozycji */}
            <div className="bg-gradient-to-br from-[#313338] to-[#2B2D31] rounded-2xl border border-[#3F4147] overflow-hidden shadow-xl mb-6">
              <table className="w-full text-sm">
                <thead className="bg-[#2B2D31] border-b border-[#3F4147]">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[#E0E0E0]/60 uppercase">Nazwa</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-[#E0E0E0]/60 uppercase">Stan</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[#E0E0E0]/60 uppercase">Notatki</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[#E0E0E0]/60 uppercase">Aktualizacja</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-[#E0E0E0]/60 uppercase">Akcje</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-8 text-[#E0E0E0]/40">
                        Magazyn pusty. Dodaj pozycję poniżej.
                      </td>
                    </tr>
                  ) : (
                    data.items.map((item) => {
                      const isEditing = editingId === item.id;
                      const isBusy = busy === item.id;
                      const low = item.count <= 5;
                      return (
                        <tr key={item.id} className="border-t border-[#3F4147] hover:bg-[#3F4147]/30">
                          <td className="px-4 py-3 text-[#E0E0E0]">
                            {isEditing ? (
                              <input
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                className="bg-[#2B2D31] border border-[#3F4147] rounded px-2 py-1 text-[#E0E0E0] text-sm w-full"
                              />
                            ) : (
                              <div className="font-medium">{item.name}</div>
                            )}
                            <div className="text-[10px] text-[#E0E0E0]/30 font-mono mt-0.5">{item.id}</div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            {isEditing ? (
                              <input
                                type="number"
                                min="0"
                                value={editCount}
                                onChange={(e) => setEditCount(e.target.value)}
                                className="bg-[#2B2D31] border border-[#3F4147] rounded px-2 py-1 text-[#E0E0E0] text-center w-20"
                              />
                            ) : (
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  onClick={() => updateDelta(item.id, -1)}
                                  disabled={isBusy || item.count === 0}
                                  className="w-7 h-7 rounded bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 text-sm font-bold disabled:opacity-30"
                                  title="−1"
                                >
                                  −
                                </button>
                                <span
                                  className={`min-w-[2.5rem] text-center text-xl font-bold ${
                                    low ? "text-amber-400" : "text-green-400"
                                  }`}
                                  title={low ? "Mało na stanie" : ""}
                                >
                                  {item.count}
                                </span>
                                <button
                                  onClick={() => updateDelta(item.id, 1)}
                                  disabled={isBusy}
                                  className="w-7 h-7 rounded bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 text-green-400 text-sm font-bold disabled:opacity-30"
                                  title="+1"
                                >
                                  +
                                </button>
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs text-[#E0E0E0]/60 max-w-xs">
                            {isEditing ? (
                              <input
                                value={editNotes}
                                onChange={(e) => setEditNotes(e.target.value)}
                                placeholder="opcjonalne"
                                className="bg-[#2B2D31] border border-[#3F4147] rounded px-2 py-1 text-[#E0E0E0] text-sm w-full"
                              />
                            ) : (
                              item.notes || <span className="text-[#E0E0E0]/30">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs text-[#E0E0E0]/40">{fmt(item.updatedAt)}</td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex justify-end gap-2">
                              {isEditing ? (
                                <>
                                  <button
                                    onClick={saveEdit}
                                    disabled={isBusy}
                                    className="px-3 py-1.5 bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 text-green-400 text-xs rounded-lg disabled:opacity-50"
                                  >
                                    Zapisz
                                  </button>
                                  <button
                                    onClick={() => setEditingId(null)}
                                    disabled={isBusy}
                                    className="px-3 py-1.5 bg-[#2B2D31] hover:bg-[#3F4147] border border-[#3F4147] text-[#E0E0E0]/60 text-xs rounded-lg"
                                  >
                                    Anuluj
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    onClick={() => startEdit(item)}
                                    disabled={isBusy}
                                    className="px-3 py-1.5 bg-[#3B82F6]/10 hover:bg-[#3B82F6]/20 border border-[#3B82F6]/30 text-[#3B82F6] text-xs rounded-lg disabled:opacity-50"
                                  >
                                    Edytuj
                                  </button>
                                  <button
                                    onClick={() => deleteItem(item.id, item.name)}
                                    disabled={isBusy}
                                    className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 text-xs rounded-lg disabled:opacity-50"
                                  >
                                    Usuń
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Dodaj nowa pozycje */}
            <div className="bg-gradient-to-br from-[#313338] to-[#2B2D31] rounded-2xl border border-[#3F4147] p-6 max-w-3xl shadow-xl">
              <h2 className="text-lg font-bold text-[#E0E0E0] mb-4">Dodaj pozycję do magazynu</h2>
              <div className="grid grid-cols-12 gap-3">
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Nazwa (np. Kalkulator gotowy, PCB v3, Obudowa...)"
                  className="col-span-6 bg-[#2B2D31] border border-[#3F4147] rounded-lg px-3 py-2 text-[#E0E0E0] text-sm focus:outline-none focus:border-[#3B82F6]"
                />
                <input
                  type="number"
                  min="0"
                  value={newCount}
                  onChange={(e) => setNewCount(e.target.value)}
                  placeholder="Sztuk (0)"
                  className="col-span-2 bg-[#2B2D31] border border-[#3F4147] rounded-lg px-3 py-2 text-[#E0E0E0] text-sm focus:outline-none focus:border-[#3B82F6]"
                />
                <input
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="Notatki (opcjonalne)"
                  className="col-span-4 bg-[#2B2D31] border border-[#3F4147] rounded-lg px-3 py-2 text-[#E0E0E0] text-sm focus:outline-none focus:border-[#3B82F6]"
                />
              </div>
              <button
                onClick={addItem}
                disabled={adding || !newName.trim()}
                className="mt-4 px-5 py-2 bg-[#3B82F6] hover:bg-[#2563EB] text-white rounded-lg font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {adding ? "Dodawanie…" : "+ Dodaj"}
              </button>
            </div>

            <div className="mt-4 text-xs text-[#E0E0E0]/40">
              Stan ≤ 5 podświetlany na pomarańczowo (alert „mało na stanie"). Przyciski +/− zmieniają o 1, edycja inline pozwala wpisać dowolną liczbę.
            </div>
          </>
        )}
      </div>
    </AdminShell>
  );
}
