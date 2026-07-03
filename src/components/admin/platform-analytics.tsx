import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import {
  LineChart as LineChartIcon,
  Users,
  UsersRound,
  GraduationCap,
  Layers3,
  Radio,
  UserPlus,
  AlertTriangle,
  LifeBuoy,
  RefreshCw,
  Activity,
  type LucideIcon,
} from "lucide-react";
import { PageHeader } from "@/components/vkm/page-header";
import { SectionCard } from "@/components/vkm/section-card";
import { Button } from "@/components/ui/button";
import { useCountUp } from "@/hooks/use-count-up";
import {
  useAnalyticsOverview,
  useAnalyticsCoaches,
  useAnalyticsBatches,
  useAnalyticsMentors,
  useLiveActivity,
  timeAgo,
  type ActivityRow,
} from "@/components/admin/analytics-data";

const HABIT_LABELS: Record<string, string> = {
  walking: "Walking 20 Min",
  water: "Drink Water (4L)",
  meditation: "Meditation",
  affirmation: "Affirmation",
  gratitude: "Gratitude Journal",
  todo: "Daily To-Do List",
};

function describeActivity(row: ActivityRow): string {
  if (row.source === "habit" && row.reference) {
    const parts = row.reference.split(":"); // "habit:<day>:<habit_id>"
    const habitId = parts[2] ?? parts[1];
    const label = HABIT_LABELS[habitId] ?? habitId ?? "a habit";
    return `completed ${label}`;
  }
  const bySource: Record<string, string> = {
    attend: "marked attendance",
    task: "submitted a weekly task",
    revenue: "logged a revenue update",
    leads: "logged new leads",
    closing: "logged a closing update",
    bonus: "received a bonus",
    manual: "received a manual award",
  };
  return bySource[row.source] ?? "was awarded points";
}

export function PlatformAnalyticsPage() {
  const { data: overview, loading: overviewLoading } = useAnalyticsOverview();
  const { coaches, loading: coachesLoading } = useAnalyticsCoaches();
  const { batches, loading: batchesLoading } = useAnalyticsBatches();
  const { mentors, loading: mentorsLoading } = useAnalyticsMentors();
  const { activity, loading: activityLoading } = useLiveActivity(30);

  const k = overview?.kpis;

  const signupChart = useMemo(
    () =>
      (overview?.signup_trend ?? []).map((d) => ({
        label: d.date.slice(5).replace("-", "/"),
        count: d.count,
      })),
    [overview],
  );
  const habitChart = useMemo(
    () =>
      (overview?.habit_trend ?? []).map((d) => ({
        label: d.date.slice(5).replace("-", "/"),
        pct: d.avg_completion_pct,
      })),
    [overview],
  );
  const pointsChart = useMemo(
    () =>
      (overview?.points_trend ?? []).map((d) => ({
        label: d.date.slice(5).replace("-", "/"),
        points: d.points,
      })),
    [overview],
  );

  if (overviewLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-5"
    >
      <PageHeader
        eyebrow="Admin · VK"
        title="Platform Analytics"
        description="Live participant, coach & mentor activity — computed from real platform data, refreshing automatically."
        icon={LineChartIcon}
        actions={
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary/50 px-3 py-1.5 text-xs font-semibold text-foreground">
            <span className="relative inline-flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[oklch(0.6_0.16_150)] opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[oklch(0.6_0.16_150)]" />
            </span>
            Live
          </span>
        }
      />

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
        <Metric label="Participants" value={k?.total_participants ?? 0} icon={Users} accent="navy" />
        <Metric label="Coaches" value={k?.total_coaches ?? 0} icon={UsersRound} accent="gold" />
        <Metric label="Mentors" value={k?.total_mentors ?? 0} icon={GraduationCap} accent="navy" />
        <Metric label="Active batches" value={k?.active_batches ?? 0} icon={Layers3} accent="gold" />
        <Metric label="Active now (15m)" value={k?.active_last_15m ?? 0} icon={Radio} accent="live" />
        <Metric label="New signups (7d)" value={k?.new_signups_7d ?? 0} icon={UserPlus} accent="navy" />
        <Metric label="At risk" value={k?.at_risk_count ?? 0} icon={AlertTriangle} accent="danger" />
        <Metric label="Open tickets" value={k?.open_tickets ?? 0} icon={LifeBuoy} accent="warning" />
      </div>

      {/* Trends */}
      <div className="grid gap-4 lg:grid-cols-3">
        <SectionCard title="New signups" subtitle="Last 30 days">
          <div className="h-[200px] w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={signupChart} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <defs>
                  <linearGradient id="signup-area" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0B2545" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#0B2545" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="0" vertical={false} stroke="oklch(0.9 0.01 90)" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} interval={4} />
                <YAxis tickLine={false} axisLine={false} width={28} tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip
                  formatter={(v: number) => [v, "New signups"]}
                  contentStyle={{ borderRadius: 12, fontSize: 12 }}
                />
                <Area type="monotone" dataKey="count" stroke="#0B2545" strokeWidth={2} fill="url(#signup-area)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard title="Habit completion" subtitle="Avg % of 6 daily tasks · 14 days">
          <div className="h-[200px] w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={habitChart} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <defs>
                  <linearGradient id="habit-area" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#C9A227" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#C9A227" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="0" vertical={false} stroke="oklch(0.9 0.01 90)" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} interval={2} />
                <YAxis
                  domain={[0, 100]}
                  tickFormatter={(v) => `${v}%`}
                  tickLine={false}
                  axisLine={false}
                  width={32}
                  tick={{ fontSize: 10 }}
                />
                <Tooltip
                  formatter={(v: number) => [`${v}%`, "Avg completion"]}
                  contentStyle={{ borderRadius: 12, fontSize: 12 }}
                />
                <Area type="monotone" dataKey="pct" stroke="#C9A227" strokeWidth={2} fill="url(#habit-area)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard title="Points awarded" subtitle="Last 30 days">
          <div className="h-[200px] w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={pointsChart} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="0" vertical={false} stroke="oklch(0.9 0.01 90)" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} interval={4} />
                <YAxis tickLine={false} axisLine={false} width={32} tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip
                  formatter={(v: number) => [v, "Points"]}
                  contentStyle={{ borderRadius: 12, fontSize: 12 }}
                />
                <Bar dataKey="points" fill="#0ea5e9" radius={[4, 4, 0, 0]} maxBarSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <div className="space-y-4">
          {/* Coaches */}
          <SectionCard title="Coaches" subtitle="Caseload & cohort performance">
            {coachesLoading ? (
              <SkeletonRows />
            ) : coaches.length === 0 ? (
              <EmptyRow text="No coaches yet." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                      <th className="py-2 pr-3 font-medium">Coach</th>
                      <th className="py-2 pr-3 font-medium">Participants</th>
                      <th className="py-2 pr-3 font-medium">Avg completion</th>
                      <th className="py-2 pr-3 font-medium">At risk</th>
                      <th className="py-2 pr-3 font-medium">Points (30d)</th>
                      <th className="py-2 font-medium">Last active</th>
                    </tr>
                  </thead>
                  <tbody>
                    {coaches.map((c) => (
                      <tr key={c.coach_id} className="border-b border-border/60 last:border-0">
                        <td className="py-2.5 pr-3 font-medium text-foreground">{c.full_name ?? "—"}</td>
                        <td className="py-2.5 pr-3 tabular-nums text-foreground">{c.participant_count}</td>
                        <td className="py-2.5 pr-3 tabular-nums text-foreground">{c.avg_completion_pct}%</td>
                        <td className="py-2.5 pr-3">
                          {c.at_risk_count > 0 ? (
                            <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-600">
                              {c.at_risk_count}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </td>
                        <td className="py-2.5 pr-3 tabular-nums text-foreground">{c.points_awarded_30d}</td>
                        <td className="py-2.5 text-muted-foreground">{timeAgo(c.last_active_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>

          {/* Batches */}
          <SectionCard title="Batches" subtitle="Per-cohort health">
            {batchesLoading ? (
              <SkeletonRows />
            ) : batches.length === 0 ? (
              <EmptyRow text="No batches yet." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                      <th className="py-2 pr-3 font-medium">Batch</th>
                      <th className="py-2 pr-3 font-medium">Status</th>
                      <th className="py-2 pr-3 font-medium">Participants</th>
                      <th className="py-2 pr-3 font-medium">Avg week</th>
                      <th className="py-2 pr-3 font-medium">Avg completion</th>
                      <th className="py-2 font-medium">At risk</th>
                    </tr>
                  </thead>
                  <tbody>
                    {batches.map((b) => (
                      <tr key={b.batch_id} className="border-b border-border/60 last:border-0">
                        <td className="py-2.5 pr-3 font-medium text-foreground">{b.name}</td>
                        <td className="py-2.5 pr-3">
                          <span
                            className={
                              b.status === "active"
                                ? "rounded-full bg-[oklch(0.93_0.06_160)] px-2 py-0.5 text-xs font-semibold text-[oklch(0.35_0.12_160)]"
                                : "rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold text-muted-foreground"
                            }
                          >
                            {b.status}
                          </span>
                        </td>
                        <td className="py-2.5 pr-3 tabular-nums text-foreground">{b.participant_count}</td>
                        <td className="py-2.5 pr-3 tabular-nums text-foreground">{b.avg_week ?? "—"}</td>
                        <td className="py-2.5 pr-3 tabular-nums text-foreground">{b.avg_completion_pct}%</td>
                        <td className="py-2.5">
                          {b.at_risk_count > 0 ? (
                            <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-600">
                              {b.at_risk_count}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>

          {/* Mentors */}
          <SectionCard title="Mentors" subtitle="Oversight activity — proof reviews & tickets, last 30 days">
            {mentorsLoading ? (
              <SkeletonRows />
            ) : mentors.length === 0 ? (
              <EmptyRow text="No mentors yet." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px] text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                      <th className="py-2 pr-3 font-medium">Mentor</th>
                      <th className="py-2 pr-3 font-medium">Proofs reviewed</th>
                      <th className="py-2 pr-3 font-medium">Tickets resolved</th>
                      <th className="py-2 font-medium">Last active</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mentors.map((m) => (
                      <tr key={m.mentor_id} className="border-b border-border/60 last:border-0">
                        <td className="py-2.5 pr-3 font-medium text-foreground">{m.full_name ?? "—"}</td>
                        <td className="py-2.5 pr-3 tabular-nums text-foreground">{m.proofs_reviewed_30d}</td>
                        <td className="py-2.5 pr-3 tabular-nums text-foreground">{m.tickets_handled_30d}</td>
                        <td className="py-2.5 text-muted-foreground">{timeAgo(m.last_active_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        </div>

        {/* Live activity feed */}
        <SectionCard
          title="Live activity"
          subtitle="Real participant events, pushed the instant they happen"
          action={
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[oklch(0.5_0.14_150)]">
              <Activity className="h-3.5 w-3.5" /> Realtime
            </span>
          }
          bodyClassName="p-0"
        >
          <div className="max-h-[720px] divide-y divide-border/60 overflow-y-auto">
            {activityLoading ? (
              <div className="p-5">
                <SkeletonRows />
              </div>
            ) : activity.length === 0 ? (
              <EmptyRow text="No activity yet today." />
            ) : (
              activity.map((row) => (
                <div key={row.id} className="flex items-center gap-3 px-5 py-3">
                  <img
                    src={row.avatar_url || "/icon-512.png"}
                    alt=""
                    className="h-8 w-8 shrink-0 rounded-full border border-border object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-foreground">
                      <span className="font-semibold">{row.full_name ?? "Someone"}</span>{" "}
                      {describeActivity(row)}
                    </p>
                    <p className="text-[11px] text-muted-foreground">{timeAgo(row.awarded_at)}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold text-foreground">
                    +{row.points}
                  </span>
                </div>
              ))
            )}
          </div>
        </SectionCard>
      </div>
    </motion.div>
  );
}

type Accent = "navy" | "gold" | "live" | "danger" | "warning";
const ACCENT_STYLE: Record<Accent, { bar: string; chip: string }> = {
  navy: { bar: "bg-gradient-navy", chip: "bg-gradient-navy text-primary-foreground" },
  gold: { bar: "bg-gradient-gold", chip: "bg-gradient-gold text-navy" },
  live: {
    bar: "bg-[oklch(0.6_0.16_150)]",
    chip: "bg-[oklch(0.93_0.06_160)] text-[oklch(0.35_0.12_160)]",
  },
  danger: { bar: "bg-red-400", chip: "bg-red-50 text-red-600" },
  warning: { bar: "bg-amber-400", chip: "bg-amber-50 text-amber-700" },
};

function Metric({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  accent: Accent;
}) {
  const count = useCountUp(value, 900);
  const style = ACCENT_STYLE[accent];
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-vkm">
      <span aria-hidden className={`absolute inset-x-0 top-0 h-[3px] opacity-80 ${style.bar}`} />
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            {label}
          </p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-foreground tabular-nums">{count}</p>
        </div>
        <span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${style.chip}`}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
    </div>
  );
}

function SkeletonRows() {
  return (
    <div className="space-y-2.5">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-4 w-full animate-pulse rounded bg-secondary/60" />
      ))}
    </div>
  );
}

function EmptyRow({ text }: { text: string }) {
  return <p className="px-5 py-6 text-center text-sm text-muted-foreground">{text}</p>;
}
