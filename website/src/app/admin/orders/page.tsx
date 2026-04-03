"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import AdminShell from "@/components/admin/AdminShell";
import OrderStatusBadge from "@/components/admin/OrderStatusBadge";

interface Order {
  id: string;
  amount: number;
  status: string;
  created: number;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  pickup_point: string;
  fulfillment_status: string;
}

export default function OrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [lastId, setLastId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const fetchOrders = useCallback(async (after?: string) => {
    setLoading(true);
    try {
      const url = new URL("/api/admin/orders", window.location.origin);
      url.searchParams.set("limit", "50");
      if (after) url.searchParams.set("starting_after", after);

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (after) {
          setOrders((prev) => [...prev, ...data.orders]);
        } else {
          setOrders(data.orders);
        }
        setHasMore(data.has_more);
        setLastId(data.last_id);
      }
    } catch (error) {
      console.error("Failed to fetch orders:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const filtered = search
    ? orders.filter(
        (o) =>
          o.customer_name.toLowerCase().includes(search.toLowerCase()) ||
          o.customer_email.toLowerCase().includes(search.toLowerCase()) ||
          o.id.toLowerCase().includes(search.toLowerCase())
      )
    : orders;

  const formatDate = (ts: number) => {
    const d = new Date(ts * 1000);
    return d.toLocaleDateString("pl-PL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <AdminShell>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
        <h1 className="text-xl font-bold text-[#E0E0E0]">Zamówienia</h1>
        <input
          type="text"
          placeholder="Szukaj po nazwisku, email lub ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:w-72 px-3 py-2 rounded-lg border border-[#3F4147] bg-[#2B2D31] text-[#E0E0E0] text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6] placeholder:text-[#E0E0E0]/30"
        />
      </div>

      <div className="bg-[#313338] rounded-lg border border-[#3F4147] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#3F4147] text-left">
                <th className="px-4 py-3 text-xs font-medium text-[#E0E0E0]/50 uppercase tracking-wider">
                  Data
                </th>
                <th className="px-4 py-3 text-xs font-medium text-[#E0E0E0]/50 uppercase tracking-wider">
                  Klient
                </th>
                <th className="px-4 py-3 text-xs font-medium text-[#E0E0E0]/50 uppercase tracking-wider hidden md:table-cell">
                  Paczkomat
                </th>
                <th className="px-4 py-3 text-xs font-medium text-[#E0E0E0]/50 uppercase tracking-wider">
                  Kwota
                </th>
                <th className="px-4 py-3 text-xs font-medium text-[#E0E0E0]/50 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-xs font-medium text-[#E0E0E0]/50 uppercase tracking-wider hidden sm:table-cell">
                  Realizacja
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#3F4147]">
              {filtered.map((order) => (
                <tr
                  key={order.id}
                  onClick={() => router.push(`/admin/orders/${order.id}`)}
                  className="cursor-pointer hover:bg-[#3F4147]/30 transition-colors"
                >
                  <td className="px-4 py-3 text-[#E0E0E0]/70 whitespace-nowrap">
                    {formatDate(order.created)}
                  </td>
                  <td className="px-4 py-3">
                    <div>
                      <p className="text-[#E0E0E0] font-medium">
                        {order.customer_name || "—"}
                      </p>
                      <p className="text-xs text-[#E0E0E0]/40">
                        {order.customer_email || "—"}
                      </p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[#E0E0E0]/60 hidden md:table-cell">
                    {order.pickup_point || "—"}
                  </td>
                  <td className="px-4 py-3 text-[#E0E0E0] font-medium whitespace-nowrap">
                    {(order.amount / 100).toFixed(2)} zł
                  </td>
                  <td className="px-4 py-3">
                    <OrderStatusBadge status={order.status} type="payment" />
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <OrderStatusBadge
                      status={order.fulfillment_status}
                      type="fulfillment"
                    />
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && !loading && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-[#E0E0E0]/40 text-sm"
                  >
                    Brak zamówień
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {loading && (
          <div className="px-4 py-6 text-center text-[#E0E0E0]/40 text-sm">
            Ładowanie...
          </div>
        )}

        {hasMore && !loading && (
          <div className="px-4 py-3 border-t border-[#3F4147]">
            <button
              onClick={() => lastId && fetchOrders(lastId)}
              className="text-sm text-[#3B82F6] hover:underline"
            >
              Załaduj więcej
            </button>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
