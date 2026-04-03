"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import AdminShell from "@/components/admin/AdminShell";
import OrderStatusBadge from "@/components/admin/OrderStatusBadge";

interface OrderDetail {
  id: string;
  amount: number;
  currency: string;
  status: string;
  created: number;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  pickup_point: string;
  pickup_point_address: string;
  product: string;
  fulfillment_status: string;
  shipped_at: string | null;
  tracking_number: string;
  admin_notes: string;
}

export default function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fulfillment, setFulfillment] = useState("unfulfilled");
  const [tracking, setTracking] = useState("");
  const [notes, setNotes] = useState("");
  const [saveMsg, setSaveMsg] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/admin/orders/${id}`);
        if (res.ok) {
          const data = await res.json();
          setOrder(data.order);
          setFulfillment(data.order.fulfillment_status);
          setTracking(data.order.tracking_number);
          setNotes(data.order.admin_notes);
        }
      } catch (error) {
        console.error("Failed to load order:", error);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  const handleSave = async () => {
    setSaving(true);
    setSaveMsg("");

    try {
      const res = await fetch(`/api/admin/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fulfillment_status: fulfillment,
          tracking_number: tracking,
          notes,
        }),
      });

      if (res.ok) {
        setSaveMsg("Zapisano");
        setTimeout(() => setSaveMsg(""), 3000);
      } else {
        setSaveMsg("Błąd zapisu");
      }
    } catch {
      setSaveMsg("Błąd zapisu");
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (ts: number) =>
    new Date(ts * 1000).toLocaleString("pl-PL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

  const inputClass =
    "w-full px-3 py-2 rounded-lg border border-[#3F4147] bg-[#2B2D31] text-[#E0E0E0] text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6]";

  return (
    <AdminShell>
      <div className="mb-6">
        <Link
          href="/admin/orders"
          className="text-sm text-[#3B82F6] hover:underline"
        >
          &larr; Zamówienia
        </Link>
      </div>

      {loading ? (
        <div className="text-[#E0E0E0]/50 text-sm">Ładowanie...</div>
      ) : !order ? (
        <div className="text-red-400 text-sm">Nie znaleziono zamówienia.</div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Order info */}
          <div className="bg-[#313338] rounded-lg border border-[#3F4147] p-6 space-y-4">
            <h2 className="text-lg font-bold text-[#E0E0E0]">
              Szczegóły zamówienia
            </h2>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-[#E0E0E0]/50">ID</span>
                <span className="text-[#E0E0E0] font-mono text-xs">
                  {order.id}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#E0E0E0]/50">Data</span>
                <span className="text-[#E0E0E0]">
                  {formatDate(order.created)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#E0E0E0]/50">Kwota</span>
                <span className="text-[#E0E0E0] font-bold">
                  {(order.amount / 100).toFixed(2)} zł
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#E0E0E0]/50">Status płatności</span>
                <OrderStatusBadge status={order.status} type="payment" />
              </div>
              <div className="flex justify-between">
                <span className="text-[#E0E0E0]/50">Produkt</span>
                <span className="text-[#E0E0E0]">{order.product}</span>
              </div>

              <div className="border-t border-[#3F4147] pt-3">
                <p className="text-xs text-[#E0E0E0]/40 uppercase tracking-wider font-medium mb-2">
                  Dane klienta
                </p>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-[#E0E0E0]/50">Imię</span>
                    <span className="text-[#E0E0E0]">
                      {order.customer_name}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#E0E0E0]/50">Email</span>
                    <a
                      href={`mailto:${order.customer_email}`}
                      className="text-[#3B82F6] hover:underline"
                    >
                      {order.customer_email}
                    </a>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#E0E0E0]/50">Telefon</span>
                    <span className="text-[#E0E0E0]">
                      {order.customer_phone}
                    </span>
                  </div>
                </div>
              </div>

              <div className="border-t border-[#3F4147] pt-3">
                <p className="text-xs text-[#E0E0E0]/40 uppercase tracking-wider font-medium mb-2">
                  Punkt odbioru
                </p>
                <p className="text-[#E0E0E0] font-medium">
                  {order.pickup_point}
                </p>
                <p className="text-[#E0E0E0]/50 text-xs">
                  {order.pickup_point_address}
                </p>
              </div>
            </div>

            <a
              href={`https://dashboard.stripe.com/payments/${order.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-center text-xs text-[#3B82F6] hover:underline mt-4"
            >
              Otwórz w Stripe Dashboard &rarr;
            </a>
          </div>

          {/* Fulfillment management */}
          <div className="bg-[#313338] rounded-lg border border-[#3F4147] p-6 space-y-4">
            <h2 className="text-lg font-bold text-[#E0E0E0]">Realizacja</h2>

            <div>
              <label className="block text-sm text-[#E0E0E0]/70 mb-1">
                Status realizacji
              </label>
              <select
                value={fulfillment}
                onChange={(e) => setFulfillment(e.target.value)}
                className={inputClass}
              >
                <option value="unfulfilled">Niezrealizowane</option>
                <option value="in_progress">W realizacji</option>
                <option value="shipped">Wysłane</option>
                <option value="fulfilled">Zrealizowane</option>
              </select>
            </div>

            <div>
              <label className="block text-sm text-[#E0E0E0]/70 mb-1">
                Numer przesyłki
              </label>
              <input
                type="text"
                value={tracking}
                onChange={(e) => setTracking(e.target.value)}
                className={inputClass}
                placeholder="np. 620012345678901234"
              />
            </div>

            <div>
              <label className="block text-sm text-[#E0E0E0]/70 mb-1">
                Notatki
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className={inputClass + " resize-none"}
                placeholder="Notatki wewnętrzne..."
              />
            </div>

            {order.shipped_at && (
              <p className="text-xs text-[#E0E0E0]/40">
                Wysłano: {new Date(order.shipped_at).toLocaleString("pl-PL")}
              </p>
            )}

            <div className="flex items-center gap-3">
              <button
                onClick={handleSave}
                disabled={saving}
                className={`px-6 py-2 font-medium rounded-lg text-white text-sm transition-colors ${
                  saving
                    ? "bg-[#3B82F6]/60 cursor-not-allowed"
                    : "bg-[#3B82F6] hover:bg-[#2563EB]"
                }`}
              >
                {saving ? "Zapisywanie..." : "Zapisz"}
              </button>
              {saveMsg && (
                <span
                  className={`text-sm ${
                    saveMsg === "Zapisano" ? "text-green-400" : "text-red-400"
                  }`}
                >
                  {saveMsg}
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
