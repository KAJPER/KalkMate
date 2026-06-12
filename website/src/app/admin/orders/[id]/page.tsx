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
  customer_address_street: string;
  customer_address_postcode: string;
  customer_address_city: string;
  pickup_point: string;
  pickup_point_address: string;
  product: string;
  fulfillment_status: string;
  shipped_at: string | null;
  tracking_number: string;
  admin_notes: string;
  furgonetka_package_id: string;
  furgonetka_order_uuid: string;
  furgonetka_status: string;
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

  // Furgonetka state
  const [furgonetkaLoading, setFurgonetkaLoading] = useState(false);
  const [furgonetkaMsg, setFurgonetkaMsg] = useState("");
  const [furgonetkaError, setFurgonetkaError] = useState("");
  const [furgonetkaPackageId, setFurgonetkaPackageId] = useState("");
  const [furgonetkaOrderUuid, setFurgonetkaOrderUuid] = useState("");
  const [furgonetkaStatus, setFurgonetkaStatus] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [documentUrl, setDocumentUrl] = useState("");
  const [documentLoading, setDocumentLoading] = useState(false);

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
          setFurgonetkaPackageId(data.order.furgonetka_package_id || "");
          setFurgonetkaOrderUuid(data.order.furgonetka_order_uuid || "");
          setFurgonetkaStatus(data.order.furgonetka_status || "");
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

  const handleCreateFurgonetkaLabel = async () => {
    setFurgonetkaLoading(true);
    setFurgonetkaError("");
    setFurgonetkaMsg("Tworzenie przesyłki...");

    try {
      const body: Record<string, unknown> = { action: "create" };
      if (serviceId) body.serviceId = parseInt(serviceId, 10);

      const res = await fetch(`/api/admin/orders/${id}/furgonetka`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Błąd tworzenia etykiety");
      }

      setFurgonetkaPackageId(data.package_id || "");
      setFurgonetkaOrderUuid(data.order_uuid || "");
      setFurgonetkaStatus(data.command_status?.status || "");
      setFurgonetkaMsg(
        `Przesyłka utworzona! ID: ${data.package_id} · Status: ${data.command_status?.status || "—"}`
      );
    } catch (e) {
      setFurgonetkaError((e as Error).message);
      setFurgonetkaMsg("");
    } finally {
      setFurgonetkaLoading(false);
    }
  };

  const handleDownloadLabel = async () => {
    if (!furgonetkaPackageId) {
      setFurgonetkaError("Brak ID przesyłki. Najpierw utwórz etykietę.");
      return;
    }

    setDocumentLoading(true);
    setFurgonetkaError("");
    setFurgonetkaMsg("Generowanie etykiety PDF...");

    try {
      // Step 1: Request documents
      const reqRes = await fetch(`/api/admin/orders/${id}/furgonetka`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "request_documents" }),
      });

      const reqData = await reqRes.json();
      if (!reqRes.ok) throw new Error(reqData.error || "Błąd żądania dokumentów");

      const docUuid = reqData.uuid;
      setFurgonetkaMsg("Oczekiwanie na dokument...");

      // Step 2: Poll for document URL
      let url = "";
      const pollDeadline = Date.now() + 35_000;

      while (Date.now() < pollDeadline) {
        await new Promise((r) => setTimeout(r, 2000));
        const pollRes = await fetch(`/api/admin/orders/${id}/furgonetka`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "documents", commandUuid: docUuid }),
        });
        const pollData = await pollRes.json();

        if (pollData.url) {
          url = pollData.url;
          break;
        }
        if (!pollData.pending) {
          throw new Error(pollData.message || "Nie udało się pobrać dokumentu");
        }
      }

      if (!url) {
        throw new Error("Generowanie etykiety przekroczyło czas");
      }

      setDocumentUrl(url);
      setFurgonetkaMsg("Etykieta gotowa! Kliknij poniżej aby pobrać.");
      window.open(url, "_blank");
    } catch (e) {
      setFurgonetkaError((e as Error).message);
      setFurgonetkaMsg("");
    } finally {
      setDocumentLoading(false);
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

              {/* Customer data */}
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
                  {/* Invoice address */}
                  {(order.customer_address_street || order.customer_address_city) && (
                    <div className="mt-2 bg-[#2B2D31] rounded-lg p-3 border border-[#3F4147]/50">
                      <p className="text-xs text-[#E0E0E0]/40 mb-1">Adres faktury</p>
                      <p className="text-sm text-[#E0E0E0]">{order.customer_address_street}</p>
                      <p className="text-sm text-[#E0E0E0]">
                        {order.customer_address_postcode} {order.customer_address_city}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Pickup point */}
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

              {/* Furgonetka info if exists */}
              {furgonetkaPackageId && (
                <div className="border-t border-[#3F4147] pt-3">
                  <p className="text-xs text-[#E0E0E0]/40 uppercase tracking-wider font-medium mb-2">
                    Furgonetka
                  </p>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-[#E0E0E0]/50">ID Przesyłki</span>
                      <span className="text-green-400 font-mono">{furgonetkaPackageId}</span>
                    </div>
                    {furgonetkaStatus && (
                      <div className="flex justify-between">
                        <span className="text-[#E0E0E0]/50">Status</span>
                        <span className={`font-medium ${furgonetkaStatus === "done" || furgonetkaStatus === "completed" ? "text-green-400" : "text-amber-400"}`}>
                          {furgonetkaStatus}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
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

          {/* Right column: Fulfillment + Furgonetka */}
          <div className="space-y-6">
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

            {/* Furgonetka Label Section */}
            <div className="bg-[#313338] rounded-lg border border-[#3F4147] p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-orange-700 flex items-center justify-center flex-shrink-0">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="1" y="3" width="15" height="13"/>
                    <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/>
                    <circle cx="5.5" cy="18.5" r="2.5"/>
                    <circle cx="18.5" cy="18.5" r="2.5"/>
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-[#E0E0E0]">Furgonetka — Etykieta</h2>
                  <p className="text-xs text-[#E0E0E0]/50">Utwórz i pobierz etykietę paczkomatową</p>
                </div>
              </div>

              {/* Status badge */}
              {furgonetkaPackageId && (
                <div className="bg-green-500/10 border border-green-500/30 rounded-lg px-4 py-3">
                  <div className="flex items-center gap-2">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-green-400">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    <p className="text-sm text-green-400 font-medium">
                      Przesyłka utworzona
                    </p>
                  </div>
                  <p className="text-xs text-green-400/70 mt-1 font-mono">ID: {furgonetkaPackageId}</p>
                </div>
              )}

              {/* Service ID input */}
              {!furgonetkaPackageId && (
                <div>
                  <label className="block text-sm text-[#E0E0E0]/70 mb-1">
                    Service ID Furgonetka
                    <span className="text-xs text-[#E0E0E0]/40 ml-2">(opcjonalne – domyślnie z .env)</span>
                  </label>
                  <input
                    type="number"
                    value={serviceId}
                    onChange={(e) => setServiceId(e.target.value)}
                    className={inputClass}
                    placeholder="np. 12345 (z panelu Furgonetka)"
                  />
                </div>
              )}

              {/* Info about receiver address */}
              {!order.customer_address_street && !order.pickup_point && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-3">
                  <p className="text-sm text-amber-400">
                    ⚠️ Brak adresu klienta ani punktu odbioru. Etykieta może wymagać ręcznego adresu.
                  </p>
                </div>
              )}

              {/* Messages */}
              {furgonetkaMsg && (
                <div className="bg-[#2B2D31] border border-[#3F4147] rounded-lg px-4 py-3">
                  <p className="text-sm text-[#E0E0E0]/80">{furgonetkaMsg}</p>
                </div>
              )}
              {furgonetkaError && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3">
                  <p className="text-sm text-red-400">{furgonetkaError}</p>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex flex-wrap gap-3">
                {!furgonetkaPackageId ? (
                  <button
                    onClick={handleCreateFurgonetkaLabel}
                    disabled={furgonetkaLoading}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium text-sm text-white transition-all ${
                      furgonetkaLoading
                        ? "bg-orange-500/50 cursor-not-allowed"
                        : "bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 shadow-lg shadow-orange-500/20"
                    }`}
                  >
                    {furgonetkaLoading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Tworzenie...
                      </>
                    ) : (
                      <>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 5v14M5 12h14"/>
                        </svg>
                        Utwórz etykietę
                      </>
                    )}
                  </button>
                ) : (
                  <>
                    <button
                      onClick={handleDownloadLabel}
                      disabled={documentLoading}
                      className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium text-sm text-white transition-all ${
                        documentLoading
                          ? "bg-blue-500/50 cursor-not-allowed"
                          : "bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow-lg shadow-blue-500/20"
                      }`}
                    >
                      {documentLoading ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Generowanie...
                        </>
                      ) : (
                        <>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                            <polyline points="7 10 12 15 17 10"/>
                            <line x1="12" y1="15" x2="12" y2="3"/>
                          </svg>
                          Pobierz etykietę PDF
                        </>
                      )}
                    </button>

                    {documentUrl && (
                      <a
                        href={documentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium text-sm text-white bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 shadow-lg shadow-green-500/20 transition-all"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="6 9 6 2 18 2 18 9"/>
                          <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
                          <rect x="6" y="14" width="12" height="8"/>
                        </svg>
                        Drukuj etykietę
                      </a>
                    )}

                    <button
                      onClick={handleCreateFurgonetkaLabel}
                      disabled={furgonetkaLoading}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm text-[#E0E0E0] bg-[#3F4147] hover:bg-[#4A4D55] transition-colors"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="23 4 23 10 17 10"/>
                        <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                      </svg>
                      Utwórz nową
                    </button>
                  </>
                )}
              </div>

              <p className="text-xs text-[#E0E0E0]/30 mt-2">
                Przesyłka zostanie nadana w Paczkomacie InPost. Punkt odbioru: {order.pickup_point || "—"}
              </p>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
