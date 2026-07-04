import { useMemo, useState, type ComponentType } from "react";
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
  Users,
  Radio,
  Activity,
  AlertTriangle,
  Clock3,
  LifeBuoy,
  TrendingUp,
  Wallet,
  Search,
  Layers3,
  Trophy,
  Mail,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { PageHeader } from "@/components/vkm/page-header";
import { SectionCard } from "@/components/vkm/section-card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useCountUp } from "@/hooks/use-count-up";
import {
  useLiveParticipants,
  useAnalyticsOverview,
  useAnalyticsBatches,
  useLiveActivity,
  deriveKpis,
  describeActivity,
  lastSeenLabel,
  timeAgo,
  inrShort,
  type LiveParticipant,
  type BatchRow,
} from "@/components/admin/overview-data";

const NAVY = "#0B2545";
const GOLD = "#C9A227";
const SKY = "#0ea5e9";

export function SystemOverview() {
  const [batchId, setBatchId] = useState<string | null>(null); // null = all batches
  const { rows, loading } = useLiveParticipants(batchId);
  const { batches } = useAnalyticsBatches();
  const { data: overview } = useAnalyticsOverview();
  const { activity } = useLiveActivity(40);

  const kpis = useMemo(() => deriveKpis(rows), [rows]);
  const selectedBatch = batches.find((b) => b.batch_id === batchId) ?? null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
      className="space-y-5"
    >
      {/* Command bar */}
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <PageHeader
          eyebrow="Super Admin · Live"
          title="System Overview"
          description={
            selectedBatch
              ? `Live command center — scoped to ${selectedBatch.name}.`
              : "Live command center across every batch — real-time participant tracking."
          }
          icon={Radio}
          className="pb-0 md:pb-0"
        />
        <div className="flex items-center gap-2">
          <LivePill online={kpis.online} />
          <BatchSelector batches={batches} value={batchId} onChange={setBatchId} />
        </div>
      </div>

      {/* KPI grid — derived from the live roster (single source of truth) */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Metric label="Participants" value={kpis.participants} icon={Users} accent="navy" loading={loading} />
        <Metric label="Online now" value={kpis.online} icon={Radio} accent="live" loading={loading} live />
        <Metric label="Today's completion" value={kpis.todayCompletionPct} suffix="%" icon={Activity} accent="gold" loading={loading} />
        <Metric label="At risk" value={kpis.atRisk} icon={AlertTriangle} accent="danger" loading={loading} />
        <Metric label="Pending proofs" value={kpis.pendingProofs} icon={Clock3} accent="warning" loading={loading} />
        <Metric label="Open tickets" value={kpis.openTickets} icon={LifeBuoy} accent="navy" loading={loading} />
        <Metric label="New signups · 7d" value={overview?.kpis.new_signups_7d ?? 0} icon={TrendingUp} accent="gold" loading={!overview} />
        <Metric label="Cohort revenue" value={kpis.revenueInr} icon={Wallet} accent="navy" loading={loading} money />
      </section>

      {/* Tracker (2/3) + live feed (1/3) */}
      <section className="grid gap-4 xl:grid-cols-[1.7fr_1fr]">
        <LiveTracker rows={rows} loading={loading} scopeLabel={selectedBatch?.name ?? "All batches"} />
        <LiveFeed activity={activity} />
      </section>

      {/* Trends */}
      <section className="grid gap-4 lg:grid-cols-3">
        <TrendCard title="New signups · 30 days" subtitle="Daily new accounts">
          <AreaTrend data={(overview?.signup_trend ?? []).map((d) => ({ label: d.date.slice(5), v: d.count }))} id="ov-signup" color={NAVY} />
        </TrendCard>
        <TrendCard title="Habit completion · 14 days" subtitle="Avg % of 6 daily habits">
          <AreaTrend data={(overview?.habit_trend ?? []).map((d) => ({ label: d.date.slice(5), v: d.avg_completion_pct }))} id="ov-habit" color={GOLD} pct />
        </TrendCard>
        <TrendCard title="Points awarded · 30 days" subtitle="Daily points across the platform">
          <BarTrend data={(overview?.points_trend ?? []).map((d) => ({ label: d.date.slice(5), v: d.points }))} id="ov-points" color={SKY} />
        </TrendCard>
      </section>

      {/* Batch health — current (active) vs previous (completed); click to scope */}
      <BatchHealth batches={batches} selectedId={batchId} onSelect={setBatchId} />

      {/* System health strip */}
      <SystemHealthStrip overview={overview} />
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Command bar bits
// ---------------------------------------------------------------------------
function LivePill({ online }: { online: number }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground shadow-vkm">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[oklch(0.6_0.16_150)] opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-[oklch(0.6_0.16_150)]" />
      </span>
      {online} online
    </span>
  );
}

const BATCH_STATUS_LABEL: Record<string, string> = {
  active: "Active",
  upcoming: "Upcoming",
  completed: "Completed",
  archived: "Archived",
};

function BatchSelector({
  batches,
  value,
  onChange,
}: {
  batches: BatchRow[];
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  const active = batches.filter((b) => b.status === "active" || b.status === "upcoming");
  const previous = batches.filter((b) => b.status === "completed" || b.status === "archived");
  return (
    <Select value={value ?? "all"} onValueChange={(v) => onChange(v === "all" ? null : v)}>
      <SelectTrigger className="h-10 w-[220px] rounded-xl">
        <Layers3 className="h-4 w-4 text-muted-foreground" />
        <SelectValue placeholder="All batches" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All batches</SelectItem>
        {active.length > 0 && (
          <SelectGroup>
            <SelectLabel>Current</SelectLabel>
            {active.map((b) => (
              <SelectItem key={b.batch_id} value={b.batch_id}>
                {b.name} · {BATCH_STATUS_LABEL[b.status] ?? b.status}
              </SelectItem>
            ))}
          </SelectGroup>
        )}
        {previous.length > 0 && (
          <SelectGroup>
            <SelectLabel>Previous</SelectLabel>
            {previous.map((b) => (
              <SelectItem key={b.batch_id} value={b.batch_id}>
                {b.name} · {BATCH_STATUS_LABEL[b.status] ?? b.status}
              </SelectItem>
            ))}
          </SelectGroup>
        )}
      </SelectContent>
    </Select>
  );
}

// ---------------------------------------------------------------------------
// KPI tile (count-up), local to keep the analytics page untouched
// ---------------------------------------------------------------------------
type Accent = "navy" | "gold" | "live" | "danger" | "warning";
const ACCENT: Record<Accent, { bar: string; chip: string }> = {
  navy: { bar: "bg-gradient-navy", chip: "bg-gradient-navy text-primary-foreground" },
  gold: { bar: "bg-gradient-gold", chip: "bg-gradient-gold text-navy" },
  live: { bar: "bg-[oklch(0.6_0.16_150)]", chip: "bg-[oklch(0.93_0.06_160)] text-[oklch(0.35_0.12_160)]" },
  danger: { bar: "bg-red-400", chip: "bg-red-50 text-red-600" },
  warning: { bar: "bg-amber-400", chip: "bg-amber-50 text-amber-700" },
};

function Metric({
  label,
  value,
  icon: Icon,
  accent,
  suffix,
  money,
  live,
  loading,
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  accent: Accent;
  suffix?: string;
  money?: boolean;
  live?: boolean;
  loading?: boolean;
}) {
  const count = useCountUp(value, 900);
  const style = ACCENT[accent];
  const display = money ? inrShort(count) : `${count}${suffix ?? ""}`;
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-vkm">
      <span aria-hidden className={cn("absolute inset-x-0 top-0 h-[3px] opacity-80", style.bar)} />
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 truncate text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            {live && value > 0 && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[oklch(0.6_0.16_150)] animate-blink" />}
            {label}
          </p>
          {loading ? (
            <span className="mt-1 block h-7 w-16 animate-pulse rounded bg-secondary/60" />
          ) : (
            <p className="mt-1 text-2xl font-bold tracking-tight text-foreground tabular-nums">{display}</p>
          )}
        </div>
        <span className={cn("inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", style.chip)}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Live participant tracker
// ---------------------------------------------------------------------------
type TrackerFilter = "all" | "online" | "at_risk" | "pending";

function LiveTracker({ rows, loading, scopeLabel }: { rows: LiveParticipant[]; loading: boolean; scopeLabel: string }) {
  const [filter, setFilter] = useState<TrackerFilter>("all");
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows
      .filter((r) => {
        if (filter === "online" && !r.is_online_15m) return false;
        if (filter === "at_risk" && !r.at_risk) return false;
        if (filter === "pending" && Number(r.pending_proofs) === 0) return false;
        if (term && !(`${r.full_name ?? ""} ${r.business_name ?? ""}`.toLowerCase().includes(term))) return false;
        return true;
      })
      // At-risk first, then online, then most points.
      .sort((a, b) => Number(b.at_risk) - Number(a.at_risk) || Number(b.is_online_15m) - Number(a.is_online_15m) || Number(b.points) - Number(a.points));
  }, [rows, filter, q]);

  const counts = {
    all: rows.length,
    online: rows.filter((r) => r.is_online_15m).length,
    at_risk: rows.filter((r) => r.at_risk).length,
    pending: rows.filter((r) => Number(r.pending_proofs) > 0).length,
  };

  return (
    <SectionCard
      title={
        <span className="flex items-center gap-2">
          <Radio className="h-4 w-4 text-navy" /> Live participant tracker
        </span>
      }
      subtitle={`${scopeLabel} · updates live`}
      bodyClassName="p-0"
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 pb-3">
        {(["all", "online", "at_risk", "pending"] as TrackerFilter[]).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={cn(
              "app-press rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
              filter === f ? "bg-gradient-navy text-primary-foreground" : "bg-secondary/60 text-muted-foreground hover:text-foreground",
            )}
          >
            {f === "all" ? "All" : f === "at_risk" ? "At risk" : f === "online" ? "Online" : "Pending"}{" "}
            <span className="tabular-nums opacity-70">{counts[f]}</span>
          </button>
        ))}
        <div className="relative ml-auto">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search…"
            className="h-8 w-36 rounded-lg pl-8 text-sm"
          />
        </div>
      </div>

      <div className="max-h-[560px] divide-y divide-border overflow-y-auto">
        {loading ? (
          <div className="space-y-2 p-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-12 w-full animate-pulse rounded-xl bg-secondary/50" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            {rows.length === 0 ? "No participants in this scope." : "No participants match this filter."}
          </p>
        ) : (
          filtered.map((r) => <TrackerRow key={r.user_id} r={r} />)
        )}
      </div>
    </SectionCard>
  );
}

function TrackerRow({ r }: { r: LiveParticipant }) {
  const initials = (r.full_name || "?").split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase();
  const weekPct = r.total_weeks > 0 ? Math.round((r.current_week / r.total_weeks) * 100) : 0;
  return (
    <div className={cn("flex items-center gap-3 px-4 py-3 transition-colors hover:bg-secondary/30", r.at_risk && "border-l-2 border-l-red-400 bg-red-50/30")}>
      <div className="relative shrink-0">
        <Avatar className="h-9 w-9 border border-border">
          <AvatarImage src={r.avatar_url ?? undefined} />
          <AvatarFallback className="bg-gradient-navy text-[11px] font-semibold text-primary-foreground">{initials}</AvatarFallback>
        </Avatar>
        {r.is_online_15m && (
          <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card bg-[oklch(0.6_0.16_150)]" title="Active in the last 15 min" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-semibold text-foreground">{r.full_name ?? "—"}</p>
          {r.batch_name && <span className="shrink-0 rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">{r.batch_name}</span>}
        </div>
        {r.at_risk ? (
          <p className="truncate text-[11px] font-medium text-red-600">At risk · {r.weeks_approved}/{r.current_week} weeks approved</p>
        ) : (
          <p className="truncate text-[11px] text-muted-foreground">
            {r.business_name || "—"} · last seen {lastSeenLabel(r.last_active_at)}
          </p>
        )}
        {/* current-week mini bar */}
        <div className="mt-1 hidden h-1 w-28 overflow-hidden rounded-full bg-secondary sm:block">
          <div className="h-full rounded-full bg-gradient-navy" style={{ width: `${weekPct}%` }} />
        </div>
      </div>

      <div className="hidden shrink-0 flex-col items-center gap-0.5 sm:flex" title={`Week ${r.current_week} of ${r.total_weeks}`}>
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Week</span>
        <span className="text-sm font-bold tabular-nums text-foreground">{r.current_week}</span>
      </div>

      <HabitRing done={r.habits_done_today} />

      <div className="w-14 shrink-0 text-right">
        <p className="text-sm font-bold tabular-nums text-foreground">{Number(r.points).toLocaleString("en-IN")}</p>
        <p className="text-[10px] text-muted-foreground">points</p>
        {Number(r.pending_proofs) > 0 && (
          <span className="mt-0.5 inline-block rounded-full bg-amber-50 px-1.5 text-[10px] font-semibold text-amber-700">{r.pending_proofs} pending</span>
        )}
      </div>
    </div>
  );
}

// Six-dot "today's habits" ring — a distinctive at-a-glance completion mark.
function HabitRing({ done }: { done: number }) {
  const pct = Math.round((Math.min(6, done) / 6) * 100);
  const complete = done >= 6;
  return (
    <div
      className="relative hidden h-10 w-10 shrink-0 items-center justify-center rounded-full md:flex"
      style={{ background: `conic-gradient(${complete ? "#46B98A" : GOLD} ${pct}%, oklch(0.9 0.02 90) 0)` }}
      title={`${done}/6 habits today`}
    >
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-card text-[11px] font-bold tabular-nums text-foreground">
        {done}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Live activity feed (right rail)
// ---------------------------------------------------------------------------
function LiveFeed({ activity }: { activity: ReturnType<typeof useLiveActivity>["activity"] }) {
  return (
    <SectionCard
      title={
        <span className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-navy" /> Live activity
        </span>
      }
      subtitle="Real events as they happen"
      bodyClassName="p-0"
    >
      <div className="max-h-[560px] divide-y divide-border overflow-y-auto">
        {activity.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">No recent activity.</p>
        ) : (
          activity.map((a) => {
            const initials = (a.full_name || "?").split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase();
            return (
              <div key={a.id} className="flex items-center gap-3 px-4 py-2.5">
                <Avatar className="h-7 w-7 border border-border">
                  <AvatarImage src={a.avatar_url ?? undefined} />
                  <AvatarFallback className="bg-gradient-navy text-[10px] font-semibold text-primary-foreground">{initials}</AvatarFallback>
                </Avatar>
                <p className="min-w-0 flex-1 truncate text-sm text-foreground">
                  <span className="font-semibold">{a.full_name ?? "Someone"}</span>{" "}
                  <span className="text-muted-foreground">{describeActivity(a)}</span>
                </p>
                {a.points > 0 && (
                  <span className="shrink-0 rounded-full bg-gradient-gold px-1.5 py-0.5 text-[10px] font-bold text-navy">+{a.points}</span>
                )}
                <span className="shrink-0 text-[10px] text-muted-foreground">{timeAgo(a.awarded_at)}</span>
              </div>
            );
          })
        )}
      </div>
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// Trends
// ---------------------------------------------------------------------------
function TrendCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <SectionCard title={<span className="text-sm font-semibold">{title}</span>} subtitle={subtitle}>
      <div className="h-[180px] w-full min-w-0">{children}</div>
    </SectionCard>
  );
}

function AreaTrend({ data, id, color, pct }: { data: { label: string; v: number }[]; id: string; color: string; pct?: boolean }) {
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
        <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} interval={Math.max(0, Math.floor(data.length / 6))} />
        <YAxis tickLine={false} axisLine={false} width={30} tick={{ fontSize: 10 }} domain={pct ? [0, 100] : undefined} allowDecimals={false} tickFormatter={pct ? (v) => `${v}%` : undefined} />
        <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} formatter={(v: number) => [pct ? `${v}%` : v, ""]} />
        <Area type="monotone" dataKey="v" stroke={color} strokeWidth={2} fill={`url(#${id})`} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function BarTrend({ data, id, color }: { data: { label: string; v: number }[]; id: string; color: string }) {
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
        <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} interval={Math.max(0, Math.floor(data.length / 6))} />
        <YAxis tickLine={false} axisLine={false} width={30} tick={{ fontSize: 10 }} allowDecimals={false} />
        <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} cursor={{ fill: "oklch(0.9 0.01 90 / 0.4)" }} />
        <Bar dataKey="v" fill={`url(#${id})`} radius={[4, 4, 0, 0]} maxBarSize={18} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ---------------------------------------------------------------------------
// Batch health — current vs previous, clickable to scope the whole dashboard
// ---------------------------------------------------------------------------
function BatchHealth({ batches, selectedId, onSelect }: { batches: BatchRow[]; selectedId: string | null; onSelect: (v: string | null) => void }) {
  if (batches.length === 0) return null;
  return (
    <SectionCard
      title={<span className="flex items-center gap-2 text-sm font-semibold"><Layers3 className="h-4 w-4 text-muted-foreground" /> Batch health</span>}
      subtitle="Click a batch to scope the dashboard · current batches highlighted"
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {batches.map((b) => {
          const isActive = b.status === "active" || b.status === "upcoming";
          const isSelected = selectedId === b.batch_id;
          return (
            <button
              key={b.batch_id}
              type="button"
              onClick={() => onSelect(isSelected ? null : b.batch_id)}
              className={cn(
                "app-press rounded-2xl border p-4 text-left transition-all hover-lift",
                isSelected ? "border-gold ring-2 ring-gold/40" : "border-border",
                isActive ? "bg-gradient-navy text-primary-foreground" : "bg-card text-foreground",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <p className={cn("truncate text-sm font-semibold", isActive ? "text-primary-foreground" : "text-foreground")}>{b.name}</p>
                <span className={cn("shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold", isActive ? "bg-white/15 text-primary-foreground" : "bg-secondary text-muted-foreground")}>
                  {BATCH_STATUS_LABEL[b.status] ?? b.status}
                </span>
              </div>
              <p className={cn("mt-2 text-2xl font-bold tabular-nums", isActive ? "text-primary-foreground" : "text-foreground")}>
                {b.participant_count}
              </p>
              <p className={cn("text-[11px]", isActive ? "text-primary-foreground/70" : "text-muted-foreground")}>participants</p>
              <div className={cn("mt-2 flex items-center gap-3 text-[11px]", isActive ? "text-primary-foreground/80" : "text-muted-foreground")}>
                <span>Wk {b.avg_week ?? "—"}</span>
                <span>{b.avg_completion_pct}% done</span>
                {Number(b.at_risk_count) > 0 && (
                  <span className={cn("inline-flex items-center gap-1 font-semibold", isActive ? "text-amber-200" : "text-red-600")}>
                    <AlertTriangle className="h-3 w-3" /> {b.at_risk_count}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// System health strip — real signals only
// ---------------------------------------------------------------------------
function SystemHealthStrip({ overview }: { overview: ReturnType<typeof useAnalyticsOverview>["data"] }) {
  const items: { icon: ComponentType<{ className?: string }>; label: string; value: string; ok: boolean }[] = [
    { icon: ShieldCheck, label: "Database", value: overview ? "Connected" : "…", ok: !!overview },
    { icon: Trophy, label: "Active batches", value: String(overview?.kpis.active_batches ?? "—"), ok: true },
    { icon: LifeBuoy, label: "Open tickets", value: String(overview?.kpis.open_tickets ?? "—"), ok: (overview?.kpis.open_tickets ?? 0) === 0 },
    { icon: Radio, label: "Active · 15m", value: String(overview?.kpis.active_last_15m ?? "—"), ok: true },
    { icon: Mail, label: "Email log", value: "See Messaging", ok: true },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {items.map((it) => (
        <div key={it.label} className="flex items-center gap-2.5 rounded-xl border border-border bg-card px-3 py-2.5 shadow-vkm">
          <span className={cn("inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", it.ok ? "bg-[oklch(0.93_0.06_160)] text-[oklch(0.35_0.12_160)]" : "bg-amber-50 text-amber-700")}>
            <it.icon className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[11px] uppercase tracking-wide text-muted-foreground">{it.label}</p>
            <p className="truncate text-sm font-semibold text-foreground">{it.value}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
