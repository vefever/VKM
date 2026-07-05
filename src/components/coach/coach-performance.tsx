import { useState, useMemo, Fragment } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/use-auth";
import { format, parseISO } from "date-fns";
import {
  Gauge,
  CheckCircle2,
  Users,
  Clock,
  Loader2,
  AlertTriangle,
  FileText,
  Video,
  Bell,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronDown,
  ChevronRight,
  Search,
  AlertCircle,
  Star,
  MessageSquare,
  Calendar,
  Activity,
  LogIn,
  Radar,
  Layers3,
  GitCompareArrows,
  FileSpreadsheet,
  FileDown,
  Target,
} from "lucide-react";
import { PageHeader } from "@/components/vkm/page-header";
import { SectionCard } from "@/components/vkm/section-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  useCoachReport,
  useParticipantInteractions,
  useCoachDailyActivity,
  useCoachBatchBreakdown,
  DIM_LABELS,
  type CoachReport,
  type ParticipantInteraction,
  type CoachDailyActivity,
  type CoachBatchRow,
  type ScoreLabel,
  type ScoreDims,
} from "@/components/coach/coach-performance-data";
import { exportReportExcel, exportReportPdf } from "@/lib/vkm/report-export";
import { buildCoachReportSpec, buildScoreboardSpec } from "@/lib/vkm/coach-report-export";

// ─── Helpers ─────────────────────────────────────────────────────────────────
const SCORE_COLORS: Record<ScoreLabel, string> = {
  Excellent: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  Good: "bg-[#2D8CFF]/15 text-[#2D8CFF]",
  Developing: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  Low: "bg-destructive/15 text-destructive",
  Inactive: "bg-secondary text-muted-foreground",
};

const DIM_KEYS = Object.keys(DIM_LABELS) as (keyof ScoreDims)[];

function dimColor(v: number) {
  if (v >= 80) return "bg-emerald-500";
  if (v >= 60) return "bg-[#2D8CFF]";
  if (v >= 40) return "bg-amber-400";
  return "bg-destructive/70";
}

function tatColor(h: number | null) {
  if (h == null) return "text-muted-foreground";
  if (h <= 12) return "text-emerald-600 dark:text-emerald-400";
  if (h <= 24) return "text-[#2D8CFF]";
  if (h <= 48) return "text-amber-600 dark:text-amber-400";
  return "text-destructive";
}
function tatLabel(h: number | null) {
  if (h == null) return "—";
  if (h < 1) return "<1h";
  if (h < 24) return `${Math.round(h)}h`;
  return `${(h / 24).toFixed(1)}d`;
}

function approvalColor(rate: number) {
  if (rate >= 80) return "bg-emerald-500";
  if (rate >= 60) return "bg-amber-400";
  return "bg-destructive/70";
}

function Avatar({
  name,
  src,
  size = "md",
}: {
  name: string;
  src: string | null;
  size?: "sm" | "md" | "lg";
}) {
  const s = size === "sm" ? "h-7 w-7 text-xs" : size === "lg" ? "h-10 w-10 text-sm" : "h-8 w-8 text-xs";
  if (src)
    return <img src={src} alt={name} className={cn("shrink-0 rounded-full object-cover", s)} />;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-navy font-semibold text-primary-foreground",
        s,
      )}
    >
      {name[0]?.toUpperCase()}
    </span>
  );
}

function RelTime({ iso }: { iso: string | null }) {
  if (!iso) return <span className="text-muted-foreground">—</span>;
  const d = parseISO(iso);
  const now = new Date();
  const diffH = (now.getTime() - d.getTime()) / 3_600_000;
  const diffD = diffH / 24;
  const text =
    diffH < 1 ? "just now"
    : diffH < 24 ? `${Math.round(diffH)}h ago`
    : diffD < 7 ? `${Math.round(diffD)}d ago`
    : format(d, "MMM d");
  const stale = diffD > 14;
  return <span className={stale ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}>{text}</span>;
}

function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-secondary">
        <div className={cn("h-full rounded-full", color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="tabular-nums text-foreground">{value}</span>
    </div>
  );
}

// Horizontal dimension bars — the "why" behind a score. Optionally overlays a
// second coach's value (compare mode).
function DimensionBars({
  dims,
  compareDims,
  names,
}: {
  dims: ScoreDims;
  compareDims?: ScoreDims;
  names?: [string, string];
}) {
  return (
    <div className="space-y-2.5">
      {DIM_KEYS.map((k) => (
        <div key={k}>
          <div className="mb-1 flex items-center justify-between text-[11px]">
            <span className="font-medium text-foreground">{DIM_LABELS[k]}</span>
            <span className="tabular-nums text-muted-foreground">
              {compareDims ? (
                <>
                  <span className="text-[#2D8CFF]">{dims[k]}</span>
                  <span className="mx-1">vs</span>
                  <span className="text-gold">{compareDims[k]}</span>
                </>
              ) : (
                `${dims[k]}/100`
              )}
            </span>
          </div>
          {compareDims ? (
            <div className="space-y-1">
              <Bar v={dims[k]} className="bg-[#2D8CFF]" />
              <Bar v={compareDims[k]} className="bg-gold" />
            </div>
          ) : (
            <Bar v={dims[k]} className={dimColor(dims[k])} />
          )}
        </div>
      ))}
      {compareDims && names && (
        <div className="flex items-center gap-4 pt-1 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#2D8CFF]" /> {names[0]}</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-gold" /> {names[1]}</span>
        </div>
      )}
    </div>
  );
}
function Bar({ v, className }: { v: number; className: string }) {
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
      <div className={cn("h-full rounded-full transition-all", className)} style={{ width: `${Math.max(2, v)}%` }} />
    </div>
  );
}

// 30-day activity heatmap (GitHub-style) — the coach's daily work rhythm.
function ActivityHeatmap({ rows }: { rows: CoachDailyActivity[] }) {
  const max = Math.max(1, ...rows.map((r) => r.total));
  function cellColor(total: number) {
    if (total === 0) return "bg-secondary";
    const intensity = total / max;
    if (intensity > 0.66) return "bg-emerald-500";
    if (intensity > 0.33) return "bg-emerald-500/60";
    return "bg-emerald-500/30";
  }
  // Chunk into weeks of 7 for a grid of columns.
  const weeks: CoachDailyActivity[][] = [];
  for (let i = 0; i < rows.length; i += 7) weeks.push(rows.slice(i, i + 7));
  const activeDays = rows.filter((r) => r.total > 0).length;
  const totalActions = rows.reduce((n, r) => n + r.total, 0);
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-[11px] text-muted-foreground">
        <span>{activeDays} active days · {totalActions} actions in {rows.length}d</span>
        <span className="flex items-center gap-1">
          Less
          <span className="h-2.5 w-2.5 rounded-sm bg-secondary" />
          <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500/30" />
          <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500/60" />
          <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />
          More
        </span>
      </div>
      <div className="flex gap-1 overflow-x-auto pb-1">
        {weeks.map((w, wi) => (
          <div key={wi} className="flex flex-col gap-1">
            {w.map((d) => (
              <div
                key={d.day}
                title={`${format(parseISO(d.day), "MMM d")} · ${d.reviews} reviews, ${d.notes} notes, ${d.meetings} mtgs, ${d.messages} msgs`}
                className={cn("h-3.5 w-3.5 rounded-sm", cellColor(d.total))}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function ExportButtons({
  onExcel,
  onPdf,
  busy,
}: {
  onExcel: () => void;
  onPdf: () => void;
  busy?: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Button variant="outline" size="sm" className="h-8 rounded-lg text-xs" onClick={onExcel} disabled={busy}>
        <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
      </Button>
      <Button variant="outline" size="sm" className="h-8 rounded-lg text-xs" onClick={onPdf} disabled={busy}>
        <FileDown className="h-3.5 w-3.5" /> PDF
      </Button>
    </div>
  );
}

// ─── Main export ─────────────────────────────────────────────────────────────
/**
 * selfOnly=true  → coach viewing their own performance (scoped to their user_id)
 * selfOnly=false → mentor / admin viewing all coaches (full judging toolkit)
 */
export function CoachPerformance({
  eyebrow = "Mentor · VK",
  selfOnly = false,
}: {
  eyebrow?: string;
  selfOnly?: boolean;
}) {
  const { user } = useAuth();
  const { coaches: allCoaches, loading: cLoading, error: cError } = useCoachReport();
  const { rows: allInteractions, loading: pLoading, error: pError } = useParticipantInteractions();
  const { rows: batchRows, loading: bLoading } = useCoachBatchBreakdown();

  // Scope to current user when a coach views their own page
  const coaches = selfOnly && user?.id ? allCoaches.filter((c) => c.id === user.id) : allCoaches;
  const interactions = selfOnly && user?.id ? allInteractions.filter((p) => p.coachId === user.id) : allInteractions;

  const kpis = useMemo(() => {
    const totalReviews = coaches.reduce((n, c) => n + c.reviews, 0);
    const totalApproved = coaches.reduce((n, c) => n + c.approved, 0);
    const avgApproval = totalReviews > 0 ? Math.round((totalApproved / totalReviews) * 100) : 0;
    const tatCoaches = coaches.filter((c) => c.avgTurnaroundH != null);
    const avgTat = tatCoaches.length > 0 ? tatCoaches.reduce((n, c) => n + c.avgTurnaroundH!, 0) / tatCoaches.length : null;
    const avgCoverage = coaches.length ? Math.round(coaches.reduce((n, c) => n + c.coveragePct, 0) / coaches.length) : 0;
    const avgScore = coaches.length ? Math.round(coaches.reduce((n, c) => n + c.score, 0) / coaches.length) : 0;
    const atRisk = new Set(interactions.filter((i) => i.atRisk).map((i) => i.participantId)).size;
    return { totalReviews, avgApproval, avgTat, avgCoverage, avgScore, atRisk };
  }, [coaches, interactions]);

  type TabKey = "scoreboard" | "drill" | "compare" | "batch" | "map";
  const tabs: { key: TabKey; label: string; icon: typeof Gauge }[] = selfOnly
    ? [
        { key: "drill", label: "My Performance", icon: Gauge },
        { key: "map", label: "My Participants", icon: Users },
      ]
    : [
        { key: "scoreboard", label: "Scoreboard", icon: Gauge },
        { key: "drill", label: "Drill-down", icon: Radar },
        { key: "compare", label: "Compare", icon: GitCompareArrows },
        { key: "batch", label: "Batch-wise", icon: Layers3 },
        { key: "map", label: "Participant Map", icon: Users },
      ];

  const [tab, setTab] = useState<TabKey>(tabs[0].key);

  const kpiTiles = selfOnly
    ? [
        { label: "Score", value: `${coaches[0]?.score ?? 0}`, icon: Gauge, color: "text-[#2D8CFF]" },
        { label: "Participants", value: String(coaches[0]?.participants ?? 0), icon: Users, color: "text-[#2D8CFF]" },
        { label: "Proofs reviewed", value: String(kpis.totalReviews), icon: CheckCircle2, color: "text-emerald-500" },
        { label: "Approval rate", value: `${kpis.avgApproval}%`, icon: TrendingUp, color: kpis.avgApproval >= 70 ? "text-emerald-500" : "text-amber-500" },
        { label: "Coverage (7d)", value: `${coaches[0]?.coveragePct ?? 0}%`, icon: Target, color: "text-purple-500" },
        { label: "At risk", value: String(kpis.atRisk), icon: AlertTriangle, color: kpis.atRisk > 0 ? "text-destructive" : "text-emerald-500" },
      ]
    : [
        { label: "Coaches", value: String(coaches.length), icon: Users, color: "text-[#2D8CFF]" },
        { label: "Avg score", value: `${kpis.avgScore}`, icon: Gauge, color: kpis.avgScore >= 70 ? "text-emerald-500" : "text-amber-500" },
        { label: "Proofs reviewed", value: String(kpis.totalReviews), icon: CheckCircle2, color: "text-emerald-500" },
        { label: "Avg approval", value: `${kpis.avgApproval}%`, icon: TrendingUp, color: kpis.avgApproval >= 70 ? "text-emerald-500" : "text-amber-500" },
        { label: "Avg turnaround", value: tatLabel(kpis.avgTat), icon: Clock, color: tatColor(kpis.avgTat) },
        { label: "Avg coverage", value: `${kpis.avgCoverage}%`, icon: Target, color: kpis.avgCoverage >= 70 ? "text-emerald-500" : "text-amber-500" },
      ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-5"
    >
      <PageHeader
        eyebrow={eyebrow}
        title={selfOnly ? "My Performance" : "Coach Performance"}
        description={
          selfOnly
            ? "Your delivery stats, participant health, and engagement depth — your live coaching report."
            : "Judge every coach on real data — reviews, responsiveness, daily rhythm, coverage, and the outcomes their participants actually achieve."
        }
        icon={Gauge}
      />

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {kpiTiles.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="flex flex-col gap-1.5 rounded-xl border border-border bg-card px-4 py-3">
            <div className="flex items-center gap-1.5">
              <Icon className={cn("h-3.5 w-3.5", color)} />
              <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
            </div>
            <p className="text-2xl font-bold tabular-nums text-foreground">{value}</p>
          </div>
        ))}
      </div>

      {/* Tab bar */}
      <div className="flex flex-wrap gap-1 rounded-xl border border-border bg-card p-1.5">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              tab === t.key ? "bg-gradient-navy text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <t.icon className="h-3.5 w-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === "scoreboard" && (
        <ScoreboardTab coaches={coaches} loading={cLoading} error={cError} interactions={interactions} batchRows={batchRows} />
      )}
      {tab === "drill" && (
        <DrillTab
          coaches={coaches}
          interactions={interactions}
          batchRows={batchRows}
          loading={cLoading || pLoading}
          lockedCoachId={selfOnly ? (user?.id ?? undefined) : undefined}
        />
      )}
      {tab === "compare" && <CompareTab coaches={coaches} loading={cLoading} />}
      {tab === "batch" && <BatchTab rows={batchRows} loading={bLoading} />}
      {tab === "map" && (
        <ParticipantMapTab
          rows={interactions}
          coaches={coaches}
          loading={pLoading}
          error={pError}
          lockedCoachId={selfOnly ? (user?.id ?? undefined) : undefined}
        />
      )}
    </motion.div>
  );
}

// ─── Scoreboard tab ───────────────────────────────────────────────────────────
type SortKey = "reviews" | "approvalRate" | "avgTurnaroundH" | "coveragePct" | "activeDays30" | "avgProgressPct" | "score";

function ScoreboardTab({
  coaches,
  loading,
  error,
  interactions,
  batchRows,
}: {
  coaches: CoachReport[];
  loading: boolean;
  error: string | null;
  interactions: ParticipantInteraction[];
  batchRows: CoachBatchRow[];
}) {
  const [sort, setSort] = useState<SortKey>("score");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const maxReviews = Math.max(1, ...coaches.map((c) => c.reviews));

  const sorted = useMemo(() => {
    return [...coaches].sort((a, b) => {
      if (sort === "avgTurnaroundH") {
        const av = a.avgTurnaroundH ?? Infinity;
        const bv = b.avgTurnaroundH ?? Infinity;
        return av - bv;
      }
      return (b[sort] as number) - (a[sort] as number);
    });
  }, [coaches, sort]);

  async function doExport(kind: "excel" | "pdf") {
    setBusy(true);
    try {
      const spec = buildScoreboardSpec(coaches);
      if (kind === "excel") await exportReportExcel(spec, "coach-scoreboard");
      else await exportReportPdf(spec, "coach-scoreboard");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <TableSkeleton />;
  if (error) return <ErrorBanner message={error} />;
  if (coaches.length === 0)
    return <div className="py-16 text-center text-sm text-muted-foreground">No coaches found in the system yet.</div>;

  return (
    <SectionCard
      title="Coach scorecard"
      subtitle={`${coaches.length} coaches · ranked by ${sort.replace(/([A-Z])/g, " $1").toLowerCase()}`}
      bodyClassName="p-0"
      action={
        <div className="flex items-center gap-2">
          <ExportButtons onExcel={() => doExport("excel")} onPdf={() => doExport("pdf")} busy={busy} />
          <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
            <SelectTrigger className="h-8 w-40 rounded-lg text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="score">Overall score</SelectItem>
              <SelectItem value="reviews">Reviews</SelectItem>
              <SelectItem value="approvalRate">Approval %</SelectItem>
              <SelectItem value="avgTurnaroundH">Fastest response</SelectItem>
              <SelectItem value="coveragePct">Coverage %</SelectItem>
              <SelectItem value="activeDays30">Active days</SelectItem>
              <SelectItem value="avgProgressPct">Participant progress</SelectItem>
            </SelectContent>
          </Select>
        </div>
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1040px] text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3">Coach</th>
              <th className="px-3 py-3 text-right">Parts.</th>
              <th className="px-3 py-3">Reviews</th>
              <th className="px-3 py-3 text-center">Approval</th>
              <th className="px-3 py-3 text-right">Turnaround</th>
              <th className="px-3 py-3 text-right">Active d</th>
              <th className="px-3 py-3 text-right">Coverage</th>
              <th className="px-3 py-3 text-right">Progress</th>
              <th className="px-3 py-3 text-right">At-risk</th>
              <th className="px-3 py-3 text-right">Last login</th>
              <th className="px-4 py-3 text-center">Score</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((c, i) => {
              const isOpen = expanded === c.id;
              const coachParticipants = interactions.filter((p) => p.coachId === c.id);
              const coachBatches = batchRows.filter((b) => b.coachId === c.id);
              return (
                <Fragment key={c.id}>
                  <tr className={cn("border-b border-border last:border-0 transition-colors hover:bg-muted/30", isOpen && "bg-muted/40")}>
                    <td className="px-4 py-3">
                      <button onClick={() => setExpanded(isOpen ? null : c.id)} className="flex items-center gap-2.5 text-left">
                        {isOpen ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                        <Avatar name={c.name} src={c.avatar} size="sm" />
                        <div>
                          <p className="font-semibold text-foreground">{c.name}</p>
                          <p className="text-[10px] text-muted-foreground">#{i + 1} · {c.reviews7d} reviews this week</p>
                        </div>
                      </button>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">{c.participants}</td>
                    <td className="px-3 py-3"><MiniBar value={c.reviews} max={maxReviews} color={approvalColor(c.approvalRate)} /></td>
                    <td className="px-3 py-3 text-center">
                      <div className="flex flex-col items-center gap-0.5">
                        <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold",
                          c.approvalRate >= 80 ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                          : c.approvalRate >= 60 ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                          : "bg-destructive/15 text-destructive")}>
                          {c.approvalRate}%
                        </span>
                        <span className="text-[10px] text-muted-foreground">{c.approved}✓ {c.rejected}✗</span>
                      </div>
                    </td>
                    <td className={cn("px-3 py-3 text-right tabular-nums font-medium", tatColor(c.avgTurnaroundH))}>{tatLabel(c.avgTurnaroundH)}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">{c.activeDays30}<span className="text-[10px]">/30</span></td>
                    <td className="px-3 py-3 text-right">
                      <span className={cn("tabular-nums font-medium", c.coveragePct >= 70 ? "text-emerald-600 dark:text-emerald-400" : c.coveragePct >= 40 ? "text-amber-600 dark:text-amber-400" : "text-destructive")}>
                        {c.coveragePct}%
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">{c.avgProgressPct}%</td>
                    <td className="px-3 py-3 text-right">
                      <span className={cn("tabular-nums font-medium", c.atRiskCount > 0 ? "text-destructive" : "text-emerald-600 dark:text-emerald-400")}>{c.atRiskCount}</span>
                    </td>
                    <td className="px-3 py-3 text-right text-xs"><RelTime iso={c.lastLoginAt} /></td>
                    <td className="px-4 py-3 text-center"><ScoreBadge score={c.score} label={c.scoreLabel} /></td>
                  </tr>

                  {isOpen && (
                    <tr key={`${c.id}-expand`} className="border-b border-border bg-muted/20">
                      <td colSpan={11} className="px-4 pb-4 pt-3">
                        <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
                          <div className="rounded-xl border border-border bg-card p-3">
                            <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                              <Radar className="h-3.5 w-3.5" /> Score breakdown
                            </p>
                            <DimensionBars dims={c.dims} />
                          </div>
                          <div>
                            {coachBatches.length > 0 && (
                              <div className="mb-3">
                                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Batch-wise</p>
                                <div className="flex flex-wrap gap-2">
                                  {coachBatches.map((b) => (
                                    <span key={`${b.batchId}`} className="rounded-lg border border-border bg-card px-2.5 py-1 text-[11px]">
                                      <span className="font-semibold text-foreground">{b.batchName}</span>
                                      <span className="text-muted-foreground"> · {b.participants}p · {b.avgProgressPct}% · {b.atRiskCount} risk</span>
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                              {c.name}'s participants ({coachParticipants.length})
                            </p>
                            {coachParticipants.length === 0 ? (
                              <p className="text-xs text-muted-foreground">No participants assigned yet.</p>
                            ) : (
                              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                                {coachParticipants.map((p) => <MiniParticipantCard key={p.participantId} p={p} />)}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}

function MiniParticipantCard({ p }: { p: ParticipantInteraction }) {
  return (
    <div className={cn("rounded-xl border border-border bg-card p-3", p.atRisk && "border-amber-500/30 bg-amber-500/5")}>
      <div className="mb-2 flex items-center gap-2">
        <Avatar name={p.participantName} src={p.participantAvatar} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold text-foreground">{p.participantName}</p>
          <p className="text-[10px] text-muted-foreground">{p.batchName}</p>
        </div>
        {p.atRisk && <span className="text-[10px] font-semibold text-amber-600">At risk</span>}
      </div>
      <div className="grid grid-cols-3 gap-1 text-center">
        <Stat n={`W${p.weeksApproved}/${p.totalWeeks}`} label="Progress" />
        <Stat n={String(p.coachingNotes)} label="Notes" />
        <Stat n={p.daysSinceContact != null ? `${p.daysSinceContact}d` : "—"} label="Last touch" />
      </div>
    </div>
  );
}

function Stat({ n, label }: { n: string; label: string }) {
  return (
    <div>
      <p className="text-xs font-bold text-foreground">{n}</p>
      <p className="text-[9px] text-muted-foreground">{label}</p>
    </div>
  );
}

// ─── Coach Drill-down tab ────────────────────────────────────────────────────
function DrillTab({
  coaches,
  interactions,
  batchRows,
  loading,
  lockedCoachId,
}: {
  coaches: CoachReport[];
  interactions: ParticipantInteraction[];
  batchRows: CoachBatchRow[];
  loading: boolean;
  lockedCoachId?: string;
}) {
  const [coachId, setCoachId] = useState<string>(lockedCoachId ?? "");
  const [busy, setBusy] = useState(false);
  const effectiveId = lockedCoachId ?? coachId;
  const coach = coaches.find((c) => c.id === effectiveId) ?? null;
  const coachParticipants = interactions.filter((p) => p.coachId === effectiveId);
  const coachBatches = batchRows.filter((b) => b.coachId === effectiveId);
  const atRiskCount = coachParticipants.filter((p) => p.atRisk).length;
  const { rows: daily, loading: dailyLoading } = useCoachDailyActivity(effectiveId || null, 30);

  async function doExport(kind: "excel" | "pdf") {
    if (!coach) return;
    setBusy(true);
    try {
      const spec = buildCoachReportSpec(coach, interactions, daily, batchRows);
      const fname = `coach-report-${coach.name.replace(/\s+/g, "-").toLowerCase()}`;
      if (kind === "excel") await exportReportExcel(spec, fname);
      else await exportReportPdf(spec, fname);
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <TableSkeleton />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {!lockedCoachId ? (
          <div className="flex items-center gap-3">
            <Select value={coachId} onValueChange={setCoachId}>
              <SelectTrigger className="w-56 rounded-xl">
                <SelectValue placeholder="Select a coach…" />
              </SelectTrigger>
              <SelectContent>
                {coaches.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            {coach && <span className="text-sm text-muted-foreground">{coach.participants} participants · score {coach.score}/100</span>}
          </div>
        ) : (
          <div />
        )}
        {coach && <ExportButtons onExcel={() => doExport("excel")} onPdf={() => doExport("pdf")} busy={busy} />}
      </div>

      {!coach ? (
        <div className="flex flex-col items-center gap-3 py-20 text-center">
          <Gauge className="h-10 w-10 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">
            {lockedCoachId ? "Loading your performance data…" : "Select a coach above to see their detailed performance"}
          </p>
        </div>
      ) : (
        <>
          {/* Coach profile + score dims */}
          <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center gap-3">
                <Avatar name={coach.name} src={coach.avatar} size="lg" />
                <div>
                  <h2 className="text-lg font-bold text-foreground">{coach.name}</h2>
                  <div className="mt-0.5 flex items-center gap-2">
                    <ScoreBadge score={coach.score} label={coach.scoreLabel} />
                    <span className="text-xs text-muted-foreground">Last login <RelTime iso={coach.lastLoginAt} /></span>
                  </div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { icon: Users, label: "Participants", value: String(coach.participants), sub: `${atRiskCount} at risk`, warn: atRiskCount > 0 },
                  { icon: CheckCircle2, label: "Reviews", value: String(coach.reviews), sub: `${coach.approvalRate}% approved`, warn: coach.approvalRate < 60 },
                  { icon: Clock, label: "Turnaround", value: tatLabel(coach.avgTurnaroundH), sub: coach.avgTurnaroundH == null ? "No reviews" : coach.avgTurnaroundH <= 24 ? "Excellent" : coach.avgTurnaroundH <= 48 ? "Good" : "Slow", warn: coach.avgTurnaroundH != null && coach.avgTurnaroundH > 48 },
                  { icon: Target, label: "Coverage 7d", value: `${coach.coveragePct}%`, sub: `${coach.contacted7d}/${coach.participants} touched`, warn: coach.coveragePct < 50 },
                ].map(({ icon: Icon, label, value, sub, warn }) => (
                  <div key={label} className="rounded-xl bg-secondary/50 p-3">
                    <div className="mb-1 flex items-center gap-1.5">
                      <Icon className={cn("h-3.5 w-3.5", warn ? "text-amber-500" : "text-muted-foreground")} />
                      <span className="text-[11px] text-muted-foreground">{label}</span>
                    </div>
                    <p className="text-xl font-bold tabular-nums text-foreground">{value}</p>
                    <p className={cn("text-[11px]", warn ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground")}>{sub}</p>
                  </div>
                ))}
              </div>

              {/* Engagement row */}
              <div className="mt-4 grid grid-cols-3 gap-3 border-t border-border pt-4 sm:grid-cols-6">
                {[
                  { icon: Video, label: "Meetings", value: coach.meetingsCount },
                  { icon: MessageSquare, label: "Chat msgs", value: coach.chatMessages },
                  { icon: FileText, label: "Notes", value: coach.notesCount },
                  { icon: Bell, label: "Notifs", value: coach.notifsCount },
                  { icon: Star, label: "Visits", value: coach.visitsCount },
                  { icon: LogIn, label: "Login days", value: coach.loginDays30 },
                ].map(({ icon: Icon, label, value }) => (
                  <div key={label} className="text-center">
                    <Icon className="mx-auto mb-1 h-4 w-4 text-muted-foreground" />
                    <p className="text-base font-bold text-foreground">{value}</p>
                    <p className="text-[10px] text-muted-foreground">{label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-5">
              <p className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <Radar className="h-3.5 w-3.5" /> Score breakdown
              </p>
              <DimensionBars dims={coach.dims} />
            </div>
          </div>

          {/* Activity heatmap */}
          <SectionCard
            title={<span className="flex items-center gap-2 text-sm font-semibold"><Activity className="h-4 w-4 text-muted-foreground" /> Daily activity — last 30 days</span>}
            subtitle="Every square is a day; greener = more reviews, notes, meetings & messages"
          >
            {dailyLoading ? (
              <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : (
              <ActivityHeatmap rows={daily} />
            )}
          </SectionCard>

          {/* Batch-wise for this coach */}
          {coachBatches.length > 0 && (
            <SectionCard title={<span className="flex items-center gap-2 text-sm font-semibold"><Layers3 className="h-4 w-4 text-muted-foreground" /> Batch-wise performance</span>} bodyClassName="p-0">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[600px] text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      <th className="px-4 py-2.5">Batch</th>
                      <th className="px-3 py-2.5 text-right">Participants</th>
                      <th className="px-3 py-2.5 text-right">Reviews</th>
                      <th className="px-3 py-2.5 text-right">Approval %</th>
                      <th className="px-3 py-2.5 text-right">Avg progress</th>
                      <th className="px-3 py-2.5 text-right">At-risk</th>
                    </tr>
                  </thead>
                  <tbody>
                    {coachBatches.map((b) => (
                      <tr key={`${b.batchId}`} className="border-b border-border last:border-0">
                        <td className="px-4 py-2.5 font-medium text-foreground">{b.batchName}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">{b.participants}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">{b.reviewsTotal}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{b.approvalRate}%</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{b.avgProgressPct}%</td>
                        <td className={cn("px-3 py-2.5 text-right tabular-nums font-medium", b.atRiskCount > 0 ? "text-destructive" : "text-muted-foreground")}>{b.atRiskCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          )}

          {/* Participants */}
          <SectionCard title="Assigned participants" subtitle={`${coachParticipants.length} total · ${atRiskCount} at risk`}>
            {coachParticipants.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No participants assigned to this coach yet.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {coachParticipants.map((p) => <ParticipantDetailCard key={p.participantId} p={p} />)}
              </div>
            )}
          </SectionCard>
        </>
      )}
    </div>
  );
}

function ParticipantDetailCard({ p }: { p: ParticipantInteraction }) {
  const progressPct = p.totalWeeks > 0 ? Math.round((p.weeksApproved / p.totalWeeks) * 100) : 0;
  return (
    <div className={cn("rounded-xl border border-border bg-card p-4", p.atRisk && "border-amber-500/40")}>
      <div className="mb-3 flex items-center gap-2.5">
        <Avatar name={p.participantName} src={p.participantAvatar} size="md" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{p.participantName}</p>
          <p className="text-[11px] text-muted-foreground">{p.batchName}</p>
        </div>
        {p.atRisk ? (
          <span className="shrink-0 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-600">At risk</span>
        ) : (
          <span className="shrink-0 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">On track</span>
        )}
      </div>
      <div className="mb-3">
        <div className="mb-1 flex justify-between text-[11px] text-muted-foreground">
          <span>Week {p.weeksApproved}/{p.totalWeeks} approved</span>
          <span>{progressPct}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
          <div className={cn("h-full rounded-full", progressPct >= 80 ? "bg-emerald-500" : progressPct >= 50 ? "bg-[#2D8CFF]" : "bg-amber-400")} style={{ width: `${progressPct}%` }} />
        </div>
      </div>
      <div className="grid grid-cols-4 gap-1 text-center">
        <Stat n={String(p.reviewsReceived)} label="Reviews" />
        <Stat n={String(p.coachingNotes)} label="Notes" />
        <Stat n={String(p.meetingsCount)} label="Meetings" />
        <Stat n={p.daysSinceContact != null ? `${p.daysSinceContact}d` : "—"} label="Last touch" />
      </div>
    </div>
  );
}

// ─── Compare tab (coach vs coach) ─────────────────────────────────────────────
function CompareTab({ coaches, loading }: { coaches: CoachReport[]; loading: boolean }) {
  const [aId, setAId] = useState<string>(coaches[0]?.id ?? "");
  const [bId, setBId] = useState<string>(coaches[1]?.id ?? "");
  const a = coaches.find((c) => c.id === aId) ?? null;
  const b = coaches.find((c) => c.id === bId) ?? null;

  if (loading) return <TableSkeleton />;
  if (coaches.length < 2)
    return <div className="py-16 text-center text-sm text-muted-foreground">Need at least two coaches to compare.</div>;

  const metrics: { label: string; a: number | string; b: number | string; aWins?: boolean; bWins?: boolean }[] =
    a && b
      ? [
          { label: "Overall score", a: a.score, b: b.score, aWins: a.score > b.score, bWins: b.score > a.score },
          { label: "Participants", a: a.participants, b: b.participants },
          { label: "Reviews", a: a.reviews, b: b.reviews, aWins: a.reviews > b.reviews, bWins: b.reviews > a.reviews },
          { label: "Approval %", a: `${a.approvalRate}%`, b: `${b.approvalRate}%`, aWins: a.approvalRate > b.approvalRate, bWins: b.approvalRate > a.approvalRate },
          { label: "Turnaround", a: tatLabel(a.avgTurnaroundH), b: tatLabel(b.avgTurnaroundH), aWins: (a.avgTurnaroundH ?? 1e9) < (b.avgTurnaroundH ?? 1e9), bWins: (b.avgTurnaroundH ?? 1e9) < (a.avgTurnaroundH ?? 1e9) },
          { label: "Active days (30d)", a: a.activeDays30, b: b.activeDays30, aWins: a.activeDays30 > b.activeDays30, bWins: b.activeDays30 > a.activeDays30 },
          { label: "Coverage %", a: `${a.coveragePct}%`, b: `${b.coveragePct}%`, aWins: a.coveragePct > b.coveragePct, bWins: b.coveragePct > a.coveragePct },
          { label: "Avg progress %", a: `${a.avgProgressPct}%`, b: `${b.avgProgressPct}%`, aWins: a.avgProgressPct > b.avgProgressPct, bWins: b.avgProgressPct > a.avgProgressPct },
          { label: "At-risk (lower better)", a: a.atRiskCount, b: b.atRiskCount, aWins: a.atRiskCount < b.atRiskCount, bWins: b.atRiskCount < a.atRiskCount },
        ]
      : [];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Select value={aId} onValueChange={setAId}>
          <SelectTrigger className="rounded-xl"><SelectValue placeholder="Coach A" /></SelectTrigger>
          <SelectContent>{coaches.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={bId} onValueChange={setBId}>
          <SelectTrigger className="rounded-xl"><SelectValue placeholder="Coach B" /></SelectTrigger>
          <SelectContent>{coaches.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      {a && b && a.id !== b.id ? (
        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <SectionCard title={<span className="flex items-center gap-2 text-sm font-semibold"><Radar className="h-4 w-4 text-muted-foreground" /> Dimensions</span>}>
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2"><Avatar name={a.name} src={a.avatar} size="sm" /><span className="text-xs font-semibold text-[#2D8CFF]">{a.name}</span></div>
              <div className="flex items-center gap-2"><span className="text-xs font-semibold text-gold">{b.name}</span><Avatar name={b.name} src={b.avatar} size="sm" /></div>
            </div>
            <DimensionBars dims={a.dims} compareDims={b.dims} names={[a.name, b.name]} />
          </SectionCard>

          <SectionCard title="Head-to-head" bodyClassName="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-3 text-left">Metric</th>
                    <th className="px-4 py-3 text-right text-[#2D8CFF]">{a.name}</th>
                    <th className="px-4 py-3 text-right text-gold">{b.name}</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.map((m) => (
                    <tr key={m.label} className="border-b border-border last:border-0">
                      <td className="px-4 py-2.5 text-muted-foreground">{m.label}</td>
                      <td className={cn("px-4 py-2.5 text-right tabular-nums font-medium", m.aWins ? "text-emerald-600 dark:text-emerald-400" : "text-foreground")}>
                        {m.a}{m.aWins && <TrendingUp className="ml-1 inline h-3 w-3" />}
                      </td>
                      <td className={cn("px-4 py-2.5 text-right tabular-nums font-medium", m.bWins ? "text-emerald-600 dark:text-emerald-400" : "text-foreground")}>
                        {m.b}{m.bWins && <TrendingUp className="ml-1 inline h-3 w-3" />}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </div>
      ) : (
        <div className="py-16 text-center text-sm text-muted-foreground">Pick two different coaches to compare.</div>
      )}
    </div>
  );
}

// ─── Batch-wise tab ───────────────────────────────────────────────────────────
function BatchTab({ rows, loading }: { rows: CoachBatchRow[]; loading: boolean }) {
  // Aggregate per batch for the summary cards (hook must run before any return).
  const byBatch = useMemo(() => {
    const map = new Map<string, { name: string; participants: number; atRisk: number; progressSum: number; coaches: number }>();
    for (const r of rows) {
      const key = r.batchId ?? "none";
      const e = map.get(key) ?? { name: r.batchName, participants: 0, atRisk: 0, progressSum: 0, coaches: 0 };
      e.participants += r.participants;
      e.atRisk += r.atRiskCount;
      e.progressSum += r.avgProgressPct * r.participants;
      e.coaches += 1;
      map.set(key, e);
    }
    return [...map.values()].map((e) => ({
      ...e,
      avgProgress: e.participants > 0 ? Math.round(e.progressSum / e.participants) : 0,
    }));
  }, [rows]);

  if (loading) return <TableSkeleton />;
  if (rows.length === 0)
    return <div className="py-16 text-center text-sm text-muted-foreground">No batch assignments yet.</div>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {byBatch.map((b) => (
          <div key={b.name} className="rounded-xl border border-border bg-card p-4">
            <p className="truncate text-sm font-semibold text-foreground">{b.name}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{b.avgProgress}%</p>
            <p className="text-[11px] text-muted-foreground">{b.participants} participants · {b.coaches} coach(es)</p>
            <p className={cn("text-[11px] font-medium", b.atRisk > 0 ? "text-destructive" : "text-emerald-600 dark:text-emerald-400")}>{b.atRisk} at risk</p>
          </div>
        ))}
      </div>

      <SectionCard title="Coach × batch matrix" subtitle={`${rows.length} coach–batch pairings`} bodyClassName="p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3">Coach</th>
                <th className="px-3 py-3">Batch</th>
                <th className="px-3 py-3 text-right">Participants</th>
                <th className="px-3 py-3 text-right">Reviews</th>
                <th className="px-3 py-3 text-right">Approval %</th>
                <th className="px-3 py-3 text-right">Avg progress</th>
                <th className="px-3 py-3 text-right">At-risk</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${r.coachId}-${r.batchId}`} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-2.5 font-medium text-foreground">{r.coachName}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{r.batchName}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">{r.participants}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">{r.reviewsTotal}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{r.approvalRate}%</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{r.avgProgressPct}%</td>
                  <td className={cn("px-3 py-2.5 text-right tabular-nums font-medium", r.atRiskCount > 0 ? "text-destructive" : "text-muted-foreground")}>{r.atRiskCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}

// ─── Participant Map tab ──────────────────────────────────────────────────────
type MapSort = "name" | "weeksApproved" | "totalPoints" | "reviewsReceived" | "coachingNotes" | "daysSinceContact";

function ParticipantMapTab({
  rows,
  coaches,
  loading,
  error,
  lockedCoachId,
}: {
  rows: ParticipantInteraction[];
  coaches: CoachReport[];
  loading: boolean;
  error: string | null;
  lockedCoachId?: string;
}) {
  const [search, setSearch] = useState("");
  const [filterCoach, setFilterCoach] = useState(lockedCoachId ?? "all");
  const [filterRisk, setFilterRisk] = useState<"all" | "risk" | "ok">("all");
  const [sort, setSort] = useState<MapSort>("name");
  const [dir, setDir] = useState<1 | -1>(1);

  function toggleSort(key: MapSort) {
    if (sort === key) setDir((d) => (d === 1 ? -1 : 1));
    else { setSort(key); setDir(key === "name" ? 1 : -1); }
  }

  const filtered = useMemo(() => {
    let r = rows;
    if (search)
      r = r.filter((p) => p.participantName.toLowerCase().includes(search.toLowerCase()) || p.coachName.toLowerCase().includes(search.toLowerCase()));
    if (filterCoach !== "all") r = r.filter((p) => p.coachId === filterCoach);
    if (filterRisk === "risk") r = r.filter((p) => p.atRisk);
    if (filterRisk === "ok") r = r.filter((p) => !p.atRisk);
    return [...r].sort((a, b) => {
      let va: number | string, vb: number | string;
      if (sort === "name") { va = a.participantName; vb = b.participantName; return dir * va.localeCompare(vb); }
      if (sort === "daysSinceContact") { va = a.daysSinceContact ?? 9999; vb = b.daysSinceContact ?? 9999; }
      else { va = a[sort] as number; vb = b[sort] as number; }
      return dir * ((va as number) - (vb as number));
    });
  }, [rows, search, filterCoach, filterRisk, sort, dir]);

  const atRiskCount = filtered.filter((r) => r.atRisk).length;

  if (loading) return <TableSkeleton />;
  if (error) return <ErrorBanner message={error} />;

  function SortTh({ k, label, right }: { k: MapSort; label: string; right?: boolean }) {
    const active = sort === k;
    return (
      <th className={cn("cursor-pointer select-none px-3 py-3 hover:text-foreground", right ? "text-right" : "text-left", active ? "text-foreground" : "")} onClick={() => toggleSort(k)}>
        <span className="inline-flex items-center gap-1">
          {label}
          {active ? (dir === -1 ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />) : <Minus className="h-3 w-3 opacity-30" />}
        </span>
      </th>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder={lockedCoachId ? "Search participant…" : "Search participant or coach…"} value={search} onChange={(e) => setSearch(e.target.value)} className="rounded-xl pl-8" />
        </div>
        {!lockedCoachId && (
          <Select value={filterCoach} onValueChange={setFilterCoach}>
            <SelectTrigger className="w-44 rounded-xl"><SelectValue placeholder="All coaches" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All coaches</SelectItem>
              {coaches.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <div className="flex rounded-xl border border-border overflow-hidden">
          {(["all", "risk", "ok"] as const).map((v) => (
            <button key={v} onClick={() => setFilterRisk(v)} className={cn("px-3 py-1.5 text-xs font-medium transition-colors", filterRisk === v ? "bg-gradient-navy text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
              {v === "all" ? "All" : v === "risk" ? "At risk" : "On track"}
            </button>
          ))}
        </div>
        <span className="text-xs text-muted-foreground">{filtered.length} participants · {atRiskCount} at risk</span>
      </div>

      <SectionCard title="Participant ↔ Coach interaction map" bodyClassName="p-0">
        {filtered.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">No participants match.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <SortTh k="name" label="Participant" />
                  <th className="px-3 py-3 text-left">Coach</th>
                  <th className="px-3 py-3 text-left">Batch</th>
                  <SortTh k="weeksApproved" label="Weeks ✓" right />
                  <SortTh k="totalPoints" label="Points" right />
                  <SortTh k="reviewsReceived" label="Reviews rcvd" right />
                  <SortTh k="coachingNotes" label="Notes" right />
                  <th className="px-3 py-3 text-right">Meetings</th>
                  <SortTh k="daysSinceContact" label="Last contact" right />
                  <th className="px-3 py-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={`${p.participantId}-${p.coachId ?? "none"}`} className={cn("border-b border-border last:border-0 transition-colors hover:bg-muted/30", p.atRisk && "bg-amber-500/[0.04]")}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Avatar name={p.participantName} src={p.participantAvatar} size="sm" />
                        <span className="font-medium text-foreground">{p.participantName}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-muted-foreground">{p.coachName}</td>
                    <td className="px-3 py-3 text-muted-foreground">{p.batchName}</td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      <span className="font-medium text-foreground">{p.weeksApproved}</span>
                      <span className="text-muted-foreground">/{p.totalWeeks}</span>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums font-medium text-foreground">{p.totalPoints.toLocaleString()}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">{p.reviewsReceived}</td>
                    <td className="px-3 py-3 text-right">
                      <span className={cn("tabular-nums", p.coachingNotes === 0 ? "font-semibold text-amber-600" : "text-muted-foreground")}>{p.coachingNotes}</span>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">{p.meetingsCount}</td>
                    <td className="px-3 py-3 text-right text-xs">
                      {p.daysSinceContact != null ? (
                        <span className={cn(p.daysSinceContact > 14 ? "font-semibold text-destructive" : p.daysSinceContact > 7 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground")}>
                          {p.daysSinceContact === 0 ? "Today" : `${p.daysSinceContact}d ago`}
                        </span>
                      ) : (
                        <span className="font-semibold text-destructive">Never</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {p.atRisk ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-400"><AlertTriangle className="h-2.5 w-2.5" /> At risk</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400"><CheckCircle2 className="h-2.5 w-2.5" /> On track</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}

// ─── Shared sub-components ────────────────────────────────────────────────────
function ScoreBadge({ score, label }: { score: number; label: ScoreLabel }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", SCORE_COLORS[label])}>{label}</span>
      <span className="text-[10px] tabular-nums text-muted-foreground">{score}/100</span>
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <AlertCircle className="h-8 w-8 text-destructive/60" />
      <p className="text-sm font-medium text-foreground">Couldn't load performance data</p>
      <p className="max-w-sm text-xs text-muted-foreground">{message}</p>
    </div>
  );
}
