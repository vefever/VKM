import {
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { TrendingUp, BarChart3 } from "lucide-react";
import { SectionCard } from "@/components/vkm/section-card";
import { cn } from "@/lib/utils";
import { momDelta, monthShort, type useBusinessData } from "@/components/business/business-data";

type Data = ReturnType<typeof useBusinessData>;

const inr = (n: number | null | undefined) => {
  if (n == null) return "—";
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(1)}Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(1)}L`;
  if (n >= 1e3) return `₹${(n / 1e3).toFixed(1)}K`;
  return `₹${n}`;
};

export function AnalyticsSection({ data }: { data: Data }) {
  const { snapshots, latest, previous, profile } = data;
  const rows = snapshots.map((s) => ({
    month: monthShort(s.month),
    revenue: Number(s.revenue_inr ?? 0),
    closing: Number(s.closing_rate_pct ?? 0),
    followup: Number(s.followup_pct ?? 0),
  }));
  const target = profile?.target_mrr_inr ?? null;

  // Derived strategic metrics.
  const first = snapshots[0] ?? null;
  const sinceStart = momDelta(latest?.revenue_inr ?? null, first?.revenue_inr ?? null);
  const mom = momDelta(latest?.revenue_inr ?? null, previous?.revenue_inr ?? null);
  const gap =
    target != null && latest?.mrr_inr != null ? Math.max(0, target - latest.mrr_inr) : null;
  const L = latest?.leads ?? 0;
  const D = latest?.deals ?? 0;
  const conv = L ? Math.round((D / L) * 100) : null;

  if (snapshots.length === 0) {
    return (
      <section id="analytics" className="scroll-mt-32">
        <SectionCard title="Analytics" subtitle="Charts, funnels & derived metrics">
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-navy text-primary-foreground shadow-vkm">
              <BarChart3 className="h-6 w-6" />
            </span>
            <p className="text-base font-semibold text-foreground">
              Analytics unlock with your data
            </p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Post a month or two of numbers and your revenue-vs-target trajectory, sales funnel and
              conversion trends appear here.
            </p>
          </div>
        </SectionCard>
      </section>
    );
  }

  return (
    <section id="analytics" className="scroll-mt-32 space-y-4">
      <SectionCard title="Analytics" subtitle="The numbers behind the numbers">
        {/* Derived metrics */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Derived
            label="Growth since start"
            value={fmtPct(sinceStart)}
            signal={sign(sinceStart)}
          />
          <Derived label="Growth MoM" value={fmtPct(mom)} signal={sign(mom)} />
          <Derived
            label="Gap to MRR goal"
            value={target == null ? "Set target" : gap === 0 ? "Goal hit 🎉" : inr(gap)}
          />
          <Derived label="Lead → deal" value={conv == null ? "—" : `${conv}%`} />
        </div>
      </SectionCard>

      {/* Revenue vs target */}
      <SectionCard
        title="Revenue vs goal"
        subtitle="Actual revenue with your MRR target as a reference line"
      >
        <div className="h-[200px] w-full min-w-0 overflow-hidden sm:h-[240px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={rows} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="rev-area" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="oklch(0.9 0.01 90)" />
              <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
              <YAxis
                tickFormatter={(v) => inr(v)}
                tickLine={false}
                axisLine={false}
                width={46}
                tick={{ fontSize: 10 }}
              />
              <Tooltip
                formatter={(v: number) => [inr(v), "Revenue"]}
                contentStyle={{ borderRadius: 12, fontSize: 12 }}
              />
              {target != null && (
                <ReferenceLine
                  y={target}
                  stroke="#c79a1e"
                  strokeDasharray="5 4"
                  label={{
                    value: `Goal ${inr(target)}`,
                    position: "insideTopRight",
                    fontSize: 10,
                    fill: "#c79a1e",
                  }}
                />
              )}
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#10b981"
                strokeWidth={2.5}
                fill="url(#rev-area)"
                dot={{ r: 3 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </SectionCard>

      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        {/* Lead → deal funnel */}
        <SectionCard
          className="min-w-0"
          title="Lead → deal funnel"
          subtitle="Where prospects drop off this month"
        >
          <Funnel leads={L} deals={D} />
          {conv != null && (
            <p className="mt-3 text-sm text-muted-foreground">
              You convert <span className="font-semibold text-foreground">{conv}%</span> of leads
              into deals — about 1 in {Math.max(1, Math.round(100 / Math.max(conv, 1)))}.
            </p>
          )}
        </SectionCard>

        {/* Conversion trend */}
        <SectionCard
          className="min-w-0"
          title="Execution trend"
          subtitle="Closing & follow-up rate over time"
        >
          <div className="h-[200px] w-full min-w-0 overflow-hidden">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={rows} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="oklch(0.9 0.01 90)" />
                <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                <YAxis
                  domain={[0, 100]}
                  tickFormatter={(v) => `${v}%`}
                  tickLine={false}
                  axisLine={false}
                  width={36}
                  tick={{ fontSize: 11 }}
                />
                <Tooltip
                  formatter={(v: number, n) => [`${v}%`, n]}
                  contentStyle={{ borderRadius: 12, fontSize: 12 }}
                />
                <Line
                  type="monotone"
                  dataKey="closing"
                  name="Closing rate"
                  stroke="#3b6fb0"
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                />
                <Line
                  type="monotone"
                  dataKey="followup"
                  name="Follow-up rate"
                  stroke="#c79a1e"
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 flex items-center gap-4 text-[11px] text-muted-foreground">
            <Legend color="#3b6fb0" label="Closing rate" />
            <Legend color="#c79a1e" label="Follow-up rate" />
          </div>
        </SectionCard>
      </div>
    </section>
  );
}

const fmtPct = (n: number | null) => (n == null ? "—" : `${n > 0 ? "+" : ""}${n}%`);
const sign = (n: number | null): "good" | "bad" | undefined =>
  n == null ? undefined : n > 0 ? "good" : n < 0 ? "bad" : undefined;

function Derived({
  label,
  value,
  signal,
}: {
  label: string;
  value: string;
  signal?: "good" | "bad";
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3 shadow-vkm">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1 inline-flex items-center gap-1 text-base font-bold sm:text-lg",
          signal === "good"
            ? "text-[oklch(0.45_0.13_160)]"
            : signal === "bad"
              ? "text-destructive"
              : "text-foreground",
        )}
      >
        {signal === "good" && <TrendingUp className="h-3.5 w-3.5" />}
        {value}
      </p>
    </div>
  );
}

function Funnel({ leads, deals }: { leads: number; deals: number }) {
  const inPipeline = Math.max(0, leads - deals);
  const max = Math.max(leads, 1);
  const stages = [
    { label: "Leads", value: leads, color: "#0f1b2d" },
    { label: "In pipeline", value: inPipeline, color: "#3b6fb0" },
    { label: "Deals closed", value: deals, color: "#10b981" },
  ];
  return (
    <div className="space-y-2">
      {stages.map((s) => (
        <div key={s.label}>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{s.label}</span>
            <span className="font-semibold text-foreground tabular-nums">{s.value}</span>
          </div>
          <div className="h-6 overflow-hidden rounded-lg bg-secondary/50">
            <div
              className="h-full rounded-lg transition-all"
              style={{ width: `${Math.max((s.value / max) * 100, 3)}%`, background: s.color }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}
