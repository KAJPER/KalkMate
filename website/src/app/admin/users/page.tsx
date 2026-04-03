"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import AdminShell from "@/components/admin/AdminShell";

interface User {
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
  subscription: {
    status: string;
    trialEndsAt: string | null;
    plan: string | null;
  } | null;
  licensesUsed: number;
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [limit] = useState(50);
  const [offset, setOffset] = useState(0);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", email: "", subscriptionStatus: "" });

  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/users?limit=${limit}&offset=${offset}`);
        if (res.ok) {
          const data = await res.json();
          setUsers(data.users);
          setTotal(data.total);
        }
      } catch (error) {
        console.error("Failed to fetch users:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, [limit, offset]);

  const nextPage = () => setOffset(offset + limit);
  const prevPage = () => setOffset(Math.max(0, offset - limit));

  const openEditModal = (user: User) => {
    setSelectedUser(user);
    setEditForm({
      name: user.name || "",
      email: user.email,
      subscriptionStatus: user.subscription?.status || "",
    });
    setShowEditModal(true);
  };

  const saveUser = async () => {
    if (!selectedUser) return;

    try {
      // Update user info
      await fetch(`/api/admin/users/${selectedUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "updateUser",
          data: { name: editForm.name, email: editForm.email },
        }),
      });

      // Update subscription if changed
      if (editForm.subscriptionStatus !== selectedUser.subscription?.status) {
        await fetch(`/api/admin/users/${selectedUser.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "updateSubscription",
            data: { status: editForm.subscriptionStatus },
          }),
        });
      }

      alert("Zapisano zmiany!");
      setShowEditModal(false);

      // Refresh list
      const res = await fetch(`/api/admin/users?limit=${limit}&offset=${offset}`);
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users);
      }
    } catch (error) {
      alert("Nie udało się zapisać zmian");
      console.error(error);
    }
  };

  const deleteUser = async (user: User) => {
    if (!confirm(`Czy na pewno chcesz usunąć użytkownika ${user.email}?`)) return;

    try {
      const res = await fetch(`/api/admin/users/${user.id}`, { method: "DELETE" });
      if (res.ok) {
        alert("Użytkownik usunięty");
        // Refresh list
        const refreshRes = await fetch(`/api/admin/users?limit=${limit}&offset=${offset}`);
        if (refreshRes.ok) {
          const data = await refreshRes.json();
          setUsers(data.users);
          setTotal(data.total);
        }
      }
    } catch (error) {
      alert("Nie udało się usunąć użytkownika");
      console.error(error);
    }
  };

  return (
    <AdminShell>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#E0E0E0] mb-1">Użytkownicy</h1>
          <p className="text-sm text-[#E0E0E0]/60">Zarządzanie kontami użytkowników ({total} total)</p>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center h-64 text-[#E0E0E0]/50">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500 mb-4"></div>
          <p className="text-sm">Ładowanie użytkowników...</p>
        </div>
      ) : users.length > 0 ? (
        <div className="space-y-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-[#313338] to-[#2B2D31] rounded-2xl border border-[#3F4147] shadow-xl overflow-hidden"
          >
            {/* Header */}
            <div className="bg-[#2B2D31] px-6 py-4 border-b border-[#3F4147]">
              <div className="grid grid-cols-12 gap-4 text-xs font-semibold text-[#E0E0E0]/60 uppercase">
                <div className="col-span-4">Użytkownik</div>
                <div className="col-span-3">Email</div>
                <div className="col-span-2">Status</div>
                <div className="col-span-2">Dołączył</div>
                <div className="col-span-1 text-right">Licencje</div>
              </div>
            </div>

            {/* User List */}
            <div className="divide-y divide-[#3F4147]">
              {users.map((user, i) => (
                <motion.div
                  key={user.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="px-6 py-4 hover:bg-[#313338] transition-colors"
                >
                  <div className="grid grid-cols-12 gap-4 items-center">
                    <div className="col-span-4">
                      <p className="text-sm font-semibold text-[#E0E0E0]">{user.name || "Brak imienia"}</p>
                      <p className="text-xs text-[#E0E0E0]/40">ID: {user.id.slice(0, 8)}...</p>
                    </div>
                    <div className="col-span-3">
                      <p className="text-sm text-[#E0E0E0]/80">{user.email}</p>
                    </div>
                    <div className="col-span-2">
                      {user.subscription ? (
                        <span className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold ${
                          user.subscription.status === "active" ? "bg-green-500/20 text-green-400" :
                          user.subscription.status === "trial" ? "bg-blue-500/20 text-blue-400" :
                          user.subscription.status === "cancelled" ? "bg-orange-500/20 text-orange-400" :
                          "bg-gray-500/20 text-gray-400"
                        }`}>
                          {user.subscription.status === "active" ? "✓ Aktywna" :
                           user.subscription.status === "trial" ? "⏱ Trial" :
                           user.subscription.status === "cancelled" ? "⊗ Anulowana" :
                           user.subscription.status}
                        </span>
                      ) : (
                        <span className="inline-flex px-3 py-1 rounded-full text-xs font-semibold bg-gray-500/20 text-gray-400">
                          Brak
                        </span>
                      )}
                    </div>
                    <div className="col-span-2">
                      <p className="text-sm text-[#E0E0E0]/80">
                        {new Date(user.createdAt).toLocaleDateString("pl-PL", { day: "2-digit", month: "short", year: "numeric" })}
                      </p>
                      {user.subscription?.trialEndsAt && (
                        <p className="text-xs text-[#E0E0E0]/40">
                          Trial: {new Date(user.subscription.trialEndsAt).toLocaleDateString("pl-PL", { day: "2-digit", month: "short" })}
                        </p>
                      )}
                    </div>
                    <div className="col-span-1 text-right">
                      <span className={`text-sm font-bold ${user.licensesUsed > 0 ? "text-[#3B82F6]" : "text-[#E0E0E0]/40"}`}>
                        {user.licensesUsed}
                      </span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      onClick={() => openEditModal(user)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-[#3B82F6] hover:bg-[#2563EB] text-white text-xs font-medium rounded-lg transition-colors"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                      </svg>
                      Edytuj
                    </button>
                    <button
                      onClick={() => deleteUser(user)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 text-xs font-medium rounded-lg transition-colors"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                      </svg>
                      Usuń
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Pagination */}
            <div className="bg-[#2B2D31] px-6 py-4 border-t border-[#3F4147] flex items-center justify-between">
              <p className="text-sm text-[#E0E0E0]/60">
                Wyświetlono {offset + 1}-{Math.min(offset + limit, total)} z {total}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={prevPage}
                  disabled={offset === 0}
                  className="px-4 py-2 bg-[#313338] hover:bg-[#3F4147] text-[#E0E0E0] text-sm rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  ← Poprzednia
                </button>
                <button
                  onClick={nextPage}
                  disabled={offset + limit >= total}
                  className="px-4 py-2 bg-[#313338] hover:bg-[#3F4147] text-[#E0E0E0] text-sm rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Następna →
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      ) : (
        <div className="bg-[#313338] rounded-xl border border-[#3F4147] p-8 text-center">
          <p className="text-[#E0E0E0]/60">Brak użytkowników</p>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowEditModal(false)}>
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-[#2B2D31] rounded-2xl border border-[#3F4147] p-6 w-full max-w-md shadow-2xl"
          >
            <h2 className="text-xl font-bold text-[#E0E0E0] mb-6">Edytuj użytkownika</h2>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-[#E0E0E0] block mb-2">Imię</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-4 py-2 bg-[#313338] border border-[#3F4147] rounded-lg text-[#E0E0E0] focus:outline-none focus:border-[#3B82F6]"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-[#E0E0E0] block mb-2">Email</label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="w-full px-4 py-2 bg-[#313338] border border-[#3F4147] rounded-lg text-[#E0E0E0] focus:outline-none focus:border-[#3B82F6]"
                />
              </div>

              {selectedUser.subscription && (
                <div>
                  <label className="text-sm font-medium text-[#E0E0E0] block mb-2">Status subskrypcji</label>
                  <select
                    value={editForm.subscriptionStatus}
                    onChange={(e) => setEditForm({ ...editForm, subscriptionStatus: e.target.value })}
                    className="w-full px-4 py-2 bg-[#313338] border border-[#3F4147] rounded-lg text-[#E0E0E0] focus:outline-none focus:border-[#3B82F6]"
                  >
                    <option value="trial">Trial</option>
                    <option value="active">Aktywna</option>
                    <option value="cancelled">Anulowana</option>
                    <option value="expired">Wygasła</option>
                  </select>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={saveUser}
                className="flex-1 px-4 py-2 bg-[#3B82F6] hover:bg-[#2563EB] text-white font-semibold rounded-lg transition-colors"
              >
                Zapisz
              </button>
              <button
                onClick={() => setShowEditModal(false)}
                className="flex-1 px-4 py-2 bg-[#313338] hover:bg-[#3F4147] text-[#E0E0E0] font-semibold rounded-lg transition-colors"
              >
                Anuluj
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AdminShell>
  );
}
