"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

// Lista kompletacji do druku — z zaznaczonych zamowien (/admin/orders ->
// "Lista kompletacji"). Na kazda sztuke (zamowienie moze miec kilka): kod AI do wgrania, imie na etykiete,
// paczkomat/adres i pola do odhaczenia przy pakowaniu. Bez AdminShell —
// czysta strona pod drukarke (A4).

interface Order {
  id: string;
  order_number: string;
  created: number;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  customer_country: string;
  customer_address: string;
  pickup_point: string;
  pickup_point_address: string;
  personalized_code: string | null;
  personalized_name: string | null;
  quantity?: number;
  personalizations?: { code: string; name: string }[];
  tracking_number: string;
}

// Sztuki zamowienia: lista z API (wiele sztuk) albo stara para pol (1 szt.).
function unitsOf(o: Order): { code: string; name: string }[] {
  const qty = Math.max(1, Math.floor(Number(o.quantity) || 1));
  const list = o.personalizations?.length
    ? o.personalizations
    : o.personalized_code || o.personalized_name
      ? [{ code: o.personalized_code || "", name: o.personalized_name || "" }]
      : [];
  // Brakujace pozycje (np. niespojne dane) pokazujemy jako puste — nie gubimy sztuki.
  return Array.from({ length: Math.max(qty, list.length) }, (_, i) => list[i] ?? { code: "", name: "" });
}

export default function PackingListPage() {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    const ids = new URLSearchParams(window.location.search).get("ids") || "";
    (ids
      ? fetch(`/api/admin/orders?limit=200&ids=${encodeURIComponent(ids)}`).then(async (r) => {
          const d = await r.json().catch(() => null);
          // 401 (wygasla sesja) / 500 — inaczej pusta lista wygladala jak "0 zamowien".
          if (!r.ok || !d) throw new Error(`Błąd ładowania: ${d?.error || `HTTP ${r.status}`}${r.status === 401 ? " — zaloguj się ponownie" : ""}`);
          return d;
        })
      : Promise.reject(new Error("Nie zaznaczono zamówień.")))
      .then((d) => {
        const order = ids.split(",");
        const list: Order[] = (d.orders || []).sort((a: Order, b: Order) => order.indexOf(a.id) - order.indexOf(b.id));
        setOrders(list);
        const missing = order.length - list.length;
        if (missing > 0) setErr(`Uwaga: nie znaleziono ${missing} z ${order.length} zaznaczonych zamówień.`);
      })
      .catch((e: Error) => setErr(e.message || "Błąd ładowania."));
  }, []);

  const box = "inline-block w-4 h-4 border-2 border-black align-middle mr-1.5";

  return (
    <div className="min-h-screen bg-white text-black p-6 print:p-0">
      <style>{`@media print { @page { size: A4; margin: 12mm; } .no-print { display: none !important; } tr { break-inside: avoid; } }`}</style>
      <div className="no-print mb-4 flex flex-wrap items-center gap-3">
        <Link href="/admin/orders" className="text-sm text-blue-600 underline">← Zamówienia</Link>
        <button onClick={() => window.print()} className="px-4 py-2 rounded bg-black text-white text-sm">🖨 Drukuj</button>
      </div>
      <h1 className="text-xl font-bold mb-1">Lista kompletacji — KalkMate</h1>
      <p className="text-sm text-gray-600 mb-4">
        {new Date().toLocaleString("pl-PL")} · {orders?.length ?? 0} zamówień ·{" "}
        {orders?.reduce((n, o) => n + unitsOf(o).length, 0) ?? 0} szt.
      </p>
      {err && <p className="text-red-600">{err}</p>}
      {orders && (
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b-2 border-black text-left">
              <th className="py-2 pr-2">Zamówienie</th>
              <th className="py-2 pr-2">Klient</th>
              <th className="py-2 pr-2">Dostawa</th>
              <th className="py-2 pr-2">Szt.</th>
              <th className="py-2 pr-2">Kod AI · imię na etykietę (każda sztuka)</th>
              <th className="py-2">Kontrola</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className="border-b border-gray-400 align-top">
                <td className="py-2.5 pr-2 font-mono font-semibold whitespace-nowrap">
                  {o.order_number}
                  <div className="font-sans font-normal text-xs text-gray-600">{new Date(o.created * 1000).toLocaleDateString("pl-PL")}</div>
                </td>
                <td className="py-2.5 pr-2">
                  {o.customer_name}
                  <div className="text-xs text-gray-600">{o.customer_phone}</div>
                </td>
                <td className="py-2.5 pr-2 text-xs">
                  {o.pickup_point ? (
                    <><b>Paczkomat {o.pickup_point}</b><br />{o.pickup_point_address}</>
                  ) : (
                    <><b>{o.customer_country}</b> · {o.customer_address}</>
                  )}
                </td>
                <td className="py-2.5 pr-2 text-lg font-bold whitespace-nowrap">×{unitsOf(o).length}</td>
                <td className="py-2.5 pr-2">
                  {unitsOf(o).map((u, i, all) => (
                    <div key={i} className="whitespace-nowrap leading-7">
                      {all.length > 1 && <span className="text-xs text-gray-600 mr-1.5">{i + 1}.</span>}
                      <span className="font-mono text-lg font-bold">{u.code || "—"}</span>
                      <span className="font-semibold ml-2">{u.name || "—"}</span>
                      {all.length > 1 && <span className={`${box} ml-2`} />}
                    </div>
                  ))}
                </td>
                <td className="py-2.5 text-xs leading-6 whitespace-nowrap">
                  <span className={box} />{unitsOf(o).length > 1 ? "wszystkie kody wgrane" : "kod wgrany"}<br />
                  <span className={box} />{unitsOf(o).length > 1 ? "etykiety z imionami" : "etykieta z imieniem"}<br />
                  <span className={box} />test + spakowane
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
