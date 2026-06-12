"use client";

import {
  Area,
  AreaChart,
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

interface RevenueChartProps {
  data: DailyData[];
}

export default function RevenueChart({ data }: RevenueChartProps) {
  // Przekonwertuj revenue z groszy na złotówki dla łatwiejszego czytania osi Y
  const formattedData = data.map(d => ({
    ...d,
    displayDate: d.date.slice(5), // np. "06-12"
    revenuePln: d.revenue / 100,
  }));

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[#2B2D31] border border-[#3F4147] rounded-xl p-3 shadow-xl">
          <p className="text-[#E0E0E0] font-bold mb-1">{label}</p>
          <p className="text-emerald-400 font-medium">
            Przychód: <span className="font-bold">{payload[0].value.toLocaleString("pl-PL")} zł</span>
          </p>
          <p className="text-[#3B82F6] font-medium text-sm mt-1">
            Zamówienia: {payload[0].payload.count}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-gradient-to-br from-[#313338] to-[#2B2D31] rounded-2xl border border-[#3F4147] p-6 shadow-xl flex flex-col h-full w-full">
      <div className="mb-4">
        <h3 className="text-lg font-bold text-[#E0E0E0]">Przychód ze sprzedaży (30 dni)</h3>
        <p className="text-sm text-[#E0E0E0]/60">Dzienny przychód w PLN</p>
      </div>
      <div className="flex-1 w-full min-h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={formattedData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10B981" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
              </linearGradient>
            </defs>
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
              tickFormatter={(value) => `${value} zł`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area 
              type="monotone" 
              dataKey="revenuePln" 
              stroke="#10B981" 
              strokeWidth={3}
              fillOpacity={1} 
              fill="url(#colorRevenue)" 
              animationDuration={1500}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
