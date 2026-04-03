"use client";

interface DailyData {
  date: string;
  count: number;
  revenue: number;
}

interface DailyChartProps {
  data: DailyData[];
}

export default function DailyChart({ data }: DailyChartProps) {
  const maxCount = Math.max(...data.map((d) => d.count), 1);

  return (
    <div className="bg-[#313338] rounded-lg border border-[#3F4147] p-5">
      <h3 className="text-sm font-medium text-[#E0E0E0]/70 mb-4">
        Zamówienia / dzień (ostatnie 30 dni)
      </h3>
      <div className="flex items-end gap-[3px] h-32">
        {data.map((d) => {
          const height = d.count > 0 ? Math.max((d.count / maxCount) * 100, 4) : 0;
          const day = d.date.slice(8, 10);
          return (
            <div
              key={d.date}
              className="flex-1 flex flex-col items-center group relative"
            >
              <div
                className="w-full bg-[#3B82F6] rounded-t-sm transition-all hover:bg-[#2563EB] min-w-[4px]"
                style={{ height: `${height}%` }}
              />
              {/* Tooltip */}
              <div className="absolute bottom-full mb-2 hidden group-hover:block z-10">
                <div className="bg-[#2B2D31] border border-[#3F4147] rounded-lg px-3 py-2 text-xs whitespace-nowrap shadow-xl">
                  <p className="text-[#E0E0E0] font-medium">{d.date}</p>
                  <p className="text-[#E0E0E0]/60">
                    {d.count} zam. &middot; {(d.revenue / 100).toFixed(0)} zł
                  </p>
                </div>
              </div>
              {/* Day label (show every 5th) */}
              {parseInt(day) % 5 === 0 && (
                <span className="text-[9px] text-[#E0E0E0]/30 mt-1">{day}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
