"use client";

import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid
} from "recharts";

interface DailyData {
  date: string;
  count: number;
  revenue: number;
}

interface OrdersChartProps {
  data: DailyData[];
}

export default function OrdersChart({ data }: OrdersChartProps) {
  const formattedData = data.map(d => ({
    ...d,
    displayDate: d.date.slice(5),
  }));

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[#2B2D31] border border-[#3F4147] rounded-xl p-3 shadow-xl">
          <p className="text-[#E0E0E0] font-bold mb-1">{label}</p>
          <p className="text-[#3B82F6] font-medium">
            Zamówienia: <span className="font-bold text-white">{payload[0].value}</span>
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-gradient-to-br from-[#313338] to-[#2B2D31] rounded-2xl border border-[#3F4147] p-6 shadow-xl flex flex-col h-full w-full">
      <div className="mb-4">
        <h3 className="text-lg font-bold text-[#E0E0E0]">Sprzedane sztuki (30 dni)</h3>
        <p className="text-sm text-[#E0E0E0]/60">Dzienna liczba zamówień</p>
      </div>
      <div className="flex-1 w-full min-h-[250px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={formattedData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#3F4147" vertical={false} />
            <XAxis 
              dataKey="displayDate" 
              stroke="#E0E0E050" 
              fontSize={12} 
              tickLine={false} 
              axisLine={false}
              tickMargin={10}
              minTickGap={20}
            />
            <YAxis 
              stroke="#E0E0E050" 
              fontSize={12} 
              tickLine={false} 
              axisLine={false} 
              allowDecimals={false}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: '#3F4147', opacity: 0.4 }} />
            <Bar 
              dataKey="count" 
              fill="#3B82F6" 
              radius={[4, 4, 0, 0]} 
              animationDuration={1500}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
