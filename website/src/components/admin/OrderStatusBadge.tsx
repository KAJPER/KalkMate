interface OrderStatusBadgeProps {
  status: string;
  type?: "payment" | "fulfillment";
}

const paymentColors: Record<string, string> = {
  succeeded: "bg-green-500/10 text-green-400",
  processing: "bg-amber-500/10 text-amber-400",
  requires_payment_method: "bg-amber-500/10 text-amber-400",
  requires_confirmation: "bg-amber-500/10 text-amber-400",
  requires_action: "bg-amber-500/10 text-amber-400",
  canceled: "bg-red-500/10 text-red-400",
  refunded: "bg-red-500/10 text-red-400",
  partially_refunded: "bg-orange-500/10 text-orange-400",
};

const paymentLabels: Record<string, string> = {
  succeeded: "Opłacone",
  processing: "Przetwarzanie",
  requires_payment_method: "Oczekuje",
  requires_confirmation: "Oczekuje",
  requires_action: "Wymaga akcji",
  canceled: "Anulowane",
  refunded: "Zwrócone",
  partially_refunded: "Częściowy zwrot",
};

const fulfillmentColors: Record<string, string> = {
  unfulfilled: "bg-[#3F4147] text-[#E0E0E0]/60",
  in_progress: "bg-amber-500/10 text-amber-400",
  shipped: "bg-blue-500/10 text-blue-400",
  fulfilled: "bg-green-500/10 text-green-400",
  cancelled: "bg-red-500/10 text-red-400",
};

const fulfillmentLabels: Record<string, string> = {
  unfulfilled: "Niezrealizowane",
  in_progress: "W realizacji",
  shipped: "Wysłane",
  fulfilled: "Zrealizowane",
  cancelled: "Anulowane",
};

export default function OrderStatusBadge({
  status,
  type = "payment",
}: OrderStatusBadgeProps) {
  const colors = type === "payment" ? paymentColors : fulfillmentColors;
  const labels = type === "payment" ? paymentLabels : fulfillmentLabels;

  return (
    <span
      className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
        colors[status] || "bg-[#3F4147] text-[#E0E0E0]/60"
      }`}
    >
      {labels[status] || status}
    </span>
  );
}
