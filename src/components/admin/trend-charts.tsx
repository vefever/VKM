import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import { SectionCard } from "@/components/vkm/section-card";

// Shared trend primitives for the admin dashboards. Extracted from
// system-overview so the batch-scoped views can reuse them without a
// circular import.
export const NAVY = "#0B2545";
export const GOLD = "#C9A227";
export const SKY = "#0ea5e9";

export type TrendPoint = { label: string; v: number };

export function TrendCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <SectionCard title={<span className="text-sm font-semibold">{title}</span>} subtitle={subtitle}>
      <div className="h-[180px] w-full min-w-0">{children}</div>
    </SectionCard>
  );
}

export function AreaTrend({
  data,
  id,
  color,
  pct,
}: {
  data: TrendPoint[];
  id: string;
  color: string;
  pct?: boolean;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.35} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="0" vertical={false} stroke="oklch(0.9 0.01 90)" />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 10 }}
          interval={Math.max(0, Math.floor(data.length / 6))}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={30}
          tick={{ fontSize: 10 }}
          domain={pct ? [0, 100] : undefined}
          allowDecimals={false}
          tickFormatter={pct ? (v) => `${v}%` : undefined}
        />
        <Tooltip
          contentStyle={{ borderRadius: 12, fontSize: 12 }}
          formatter={(v: number) => [pct ? `${v}%` : v, ""]}
        />
        <Area
          type="monotone"
          dataKey="v"
          stroke={color}
          strokeWidth={2}
          fill={`url(#${id})`}
          dot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function BarTrend({ data, id, color }: { data: TrendPoint[]; id: string; color: string }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.9} />
            <stop offset="100%" stopColor={color} stopOpacity={0.5} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="0" vertical={false} stroke="oklch(0.9 0.01 90)" />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 10 }}
          interval={Math.max(0, Math.floor(data.length / 6))}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={30}
          tick={{ fontSize: 10 }}
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={{ borderRadius: 12, fontSize: 12 }}
          cursor={{ fill: "oklch(0.9 0.01 90 / 0.4)" }}
        />
        <Bar dataKey="v" fill={`url(#${id})`} radius={[4, 4, 0, 0]} maxBarSize={18} />
      </BarChart>
    </ResponsiveContainer>
  );
}
