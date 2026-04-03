interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  color: "blue" | "green" | "red" | "yellow" | "purple" | "cyan" | "indigo" | "pink" | "teal";
}

const colorMap = {
  blue: "border-[#3B82F6]",
  green: "border-green-500",
  red: "border-red-500",
  yellow: "border-amber-500",
  purple: "border-purple-500",
  cyan: "border-cyan-500",
  indigo: "border-indigo-500",
  pink: "border-pink-500",
  teal: "border-teal-500",
};

export default function StatCard({ title, value, subtitle, color }: StatCardProps) {
  return (
    <div
      className={`bg-[#313338] rounded-lg border border-[#3F4147] border-l-4 ${colorMap[color]} p-5`}
    >
      <p className="text-xs text-[#E0E0E0]/50 uppercase tracking-wider font-medium">
        {title}
      </p>
      <p className="mt-2 text-2xl font-bold text-[#E0E0E0]">{value}</p>
      {subtitle && (
        <p className="mt-1 text-xs text-[#E0E0E0]/40">{subtitle}</p>
      )}
    </div>
  );
}
