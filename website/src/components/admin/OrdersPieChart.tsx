"use client";

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend
} from "recharts";

interface OrdersPieChartProps {
  succeeded: number;
  pending: number;
  canceled: number;
}

export default function OrdersPieChart({ succeeded, pending, canceled }: OrdersPieChartProps) {
  const data = [
    { name: "Opłacone", value: succeeded, color: "#10B981" },
    { name: "Oczekujące", value: pending, color: "#F59E0B" },
    { name: "Anulowane", value: canceled, color: "#EF4444" },
  ].filter(d => d.value > 0); // Ukryj statusy z zerową ilością

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-[#2B2D31] border border-[#3F4147] rounded-xl p-3 shadow-xl flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: data.color }}></div>
          <p className="text-[#E0E0E0] font-medium">
            {data.name}: <span className="font-bold">{data.value}</span>
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-gradient-to-br from-[#313338] to-[#2B2D31] rounded-2xl border border-[#3F4147] p-6 shadow-xl flex flex-col h-full w-full">
      <div className="mb-2">
        <h3 className="text-lg font-bold text-[#E0E0E0]">Status Zamówień</h3>
        <p className="text-sm text-[#E0E0E0]/60">Proporcja wszystkich transakcji</p>
      </div>
      <div className="flex-1 w-full min-h-[250px]">
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
                stroke="none"
                animationDuration={1500}
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend 
                verticalAlign="bottom" 
                height={36}
                iconType="circle"
                wrapperStyle={{ fontSize: '12px', color: '#E0E0E0' }}
              />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-[#E0E0E0]/40 text-sm">
            Brak danych do wyświetlenia
          </div>
        )}
      </div>
    </div>
  );
}
