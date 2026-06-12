"use client";

import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend
} from "recharts";

interface GeminiDailyData {
  date: string;
  userMessages: number;
  assistantMessages: number;
  total: number;
}

interface GeminiUsageChartProps {
  data: GeminiDailyData[];
}

export default function GeminiUsageChart({ data }: GeminiUsageChartProps) {
  const formattedData = data.map(d => ({
    ...d,
    displayDate: d.date.slice(5),
  }));

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[#2B2D31] border border-[#3F4147] rounded-xl p-3 shadow-xl">
          <p className="text-[#E0E0E0] font-bold mb-2">{label}</p>
          <p className="text-purple-400 font-medium text-sm">
            AI: <span className="font-bold text-white">{payload[0].value}</span>
          </p>
          <p className="text-cyan-400 font-medium text-sm mt-1">
            Użytkownicy: <span className="font-bold text-white">{payload[1].value}</span>
          </p>
          <div className="mt-2 pt-2 border-t border-[#3F4147]/50">
            <p className="text-[#E0E0E0]/60 text-xs">Łącznie: {payload[0].value + payload[1].value} msg</p>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-gradient-to-br from-[#313338] to-[#2B2D31] rounded-2xl border border-[#3F4147] p-6 shadow-xl flex flex-col h-full w-full">
      <div className="mb-4">
        <h3 className="text-lg font-bold text-[#E0E0E0]">Ruch AI (30 dni)</h3>
        <p className="text-sm text-[#E0E0E0]/60">Wiadomości od AI i użytkowników</p>
      </div>
      <div className="flex-1 w-full min-h-[250px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={formattedData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
            <Tooltip content={<CustomTooltip />} />
            <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', color: '#E0E0E080' }} />
            <Line 
              type="monotone" 
              name="Assistant"
              dataKey="assistantMessages" 
              stroke="#A855F7" 
              strokeWidth={3}
              dot={false}
              activeDot={{ r: 6, fill: '#A855F7', stroke: '#2B2D31', strokeWidth: 2 }}
              animationDuration={1500}
            />
            <Line 
              type="monotone" 
              name="User"
              dataKey="userMessages" 
              stroke="#22D3EE" 
              strokeWidth={3}
              dot={false}
              activeDot={{ r: 6, fill: '#22D3EE', stroke: '#2B2D31', strokeWidth: 2 }}
              animationDuration={1500}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
