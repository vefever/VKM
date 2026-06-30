import { useState, useMemo } from "react";
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
  type CoachReport,
  type ParticipantInteraction,
  type ScoreLabel,
} from "@/components/coach/coach-performance-data";

// ─── Helpers ─────────────────────────────────────────────────────────────────
const SCORE_COLORS: Record<ScoreLabel, string> = {
  Excellent: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  Good: "bg-[#2D8CFF]/15 text-[#2D8CFF]",
  Developing: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  Low: "bg-destructive/15 text-destructive",
  Inactive: "bg-secondary text-muted-foreground",
};

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
    return (
      <img src={src} alt={name} className={cn("shrink-0 rounded-full object-cover", s)} />
    );
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

// ─── Main export ─────────────────────────────────────────────────────────────
/**
 * selfOnly=true  → coach viewing their own performance (scoped to their user_id)
 * selfOnly=false → mentor / admin viewing all coaches
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

  // Scope to current user when coach is viewing their own page
  const coaches = selfOnly && user?.id
    ? allCoaches.filter((c) => c.id === user.id)
    : allCoaches;
  const interactions = selfOnly && user?.id
    ? allInteractions.filter((p) => p.coachId === user.id)
    : allInteractions;

  // KPIs over the visible set
  const kpis = useMemo(() => {
    const totalReviews = coaches.reduce((n, c) => n + c.reviews, 0);
    const totalApproved = coaches.reduce((n, c) => n + c.approved, 0);
    const avgApproval =
      totalReviews > 0 ? Math.round((totalApproved / totalReviews) * 100) : 0;
    const tatCoaches = coaches.filter((c) => c.avgTurnaroundH != null);
    const avgTat =
      tatCoaches.length > 0
        ? tatCoaches.reduce((n, c) => n + c.avgTurnaroundH!, 0) / tatCoaches.length
        : null;
    const totalNotes = coaches.reduce((n, c) => n + c.notesCount, 0);
    const atRisk = interactions.filter((i) => i.atRisk).length;
    return { totalReviews, avgApproval, avgTat, totalNotes, atRisk };
  }, [coaches, interactions]);

  // Tab config differs between self-view and all-coaches-view
  type TabKey = "scoreboard" | "drill" | "map";
  const tabs: { key: TabKey; label: string }[] = selfOnly
    ? [
        { key: "drill", label: "My Performance" },
        { key: "map", label: "My Participants" },
      ]
    : [
        { key: "scoreboard", label: "Coach Scoreboard" },
        { key: "drill", label: "Coach Drill-down" },
        { key: "map", label: "Participant Map" },
      ];

  const [tab, setTab] = useState<TabKey>(tabs[0].key);

  // KPI tile config
  const kpiTiles = selfOnly
    ? [
        {
          label: "Participants",
          value: String(coaches[0]?.participants ?? 0),
          icon: Users,
          color: "text-[#2D8CFF]",
        },
        {
          label: "Proofs reviewed",
          value: String(kpis.totalReviews),
          icon: CheckCircle2,
          color: "text-emerald-500",
        },
        {
          label: "Approval rate",
          value: `${kpis.avgApproval}%`,
          icon: TrendingUp,
          color: kpis.avgApproval >= 70 ? "text-emerald-500" : "text-amber-500",
        },
        {
          label: "Avg turnaround",
          value: tatLabel(kpis.avgTat),
          icon: Clock,
          color: tatColor(kpis.avgTat),
        },
        {
          label: "Coaching notes",
          value: String(coaches[0]?.notesCount ?? 0),
          icon: FileText,
          color: "text-purple-500",
        },
        {
          label: "Participants at risk",
          value: String(kpis.atRisk),
          icon: AlertTriangle,
          color: kpis.atRisk > 0 ? "text-destructive" : "text-emerald-500",
        },
      ]
    : [
        {
          label: "Coaches",
          value: String(coaches.length),
          icon: Users,
          color: "text-[#2D8CFF]",
        },
        {
          label: "Proofs reviewed",
          value: String(kpis.totalReviews),
          icon: CheckCircle2,
          color: "text-emerald-500",
        },
        {
          label: "Avg approval",
          value: `${kpis.avgApproval}%`,
          icon: TrendingUp,
          color: kpis.avgApproval >= 70 ? "text-emerald-500" : "text-amber-500",
        },
        {
          label: "Avg turnaround",
          value: tatLabel(kpis.avgTat),
          icon: Clock,
          color: tatColor(kpis.avgTat),
        },
        {
          label: "Coaching notes",
          value: String(kpis.totalNotes),
          icon: FileText,
          color: "text-purple-500",
        },
        {
          label: "At risk",
          value: String(kpis.atRisk),
          icon: AlertTriangle,
          color: kpis.atRisk > 0 ? "text-destructive" : "text-emerald-500",
        },
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
            : "Live oversight — how every coach delivers across reviews, engagement depth, and participant health."
        }
        icon={Gauge}
      />

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {kpiTiles.map(({ label, value, icon: Icon, color }) => (
          <div
            key={label}
            className="flex flex-col gap-1.5 rounded-xl border border-border bg-card px-4 py-3"
          >
            <div className="flex items-center gap-1.5">
              <Icon className={cn("h-3.5 w-3.5", color)} />
              <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {label}
              </span>
            </div>
            <p className="text-2xl font-bold tabular-nums text-foreground">{value}</p>
          </div>
        ))}
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 rounded-xl border border-border bg-card p-1.5">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              tab === t.key
                ? "bg-gradient-navy text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "scoreboard" && (
        <ScoreboardTab
          coaches={coaches}
          loading={cLoading}
          error={cError}
          interactions={interactions}
        />
      )}
      {tab === "drill" && (
        <DrillTab
          coaches={coaches}
          interactions={interactions}
          loading={cLoading || pLoading}
          lockedCoachId={selfOnly ? (user?.id ?? undefined) : undefined}
        />
      )}
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
type SortKey = "reviews" | "approvalRate" | "avgTurnaroundH" | "notesCount" | "score";

function ScoreboardTab({
  coaches,
  loading,
  error,
  interactions,
}: {
  coaches: CoachReport[];
  loading: boolean;
  error: string | null;
  interactions: ParticipantInteraction[];
}) {
  const [sort, setSort] = useState<SortKey>("reviews");
  const [expanded, setExpanded] = useState<string | null>(null);

  const maxReviews = Math.max(1, ...coaches.map((c) => c.reviews));

  const sorted = useMemo(() => {
    return [...coaches].sort((a, b) => {
      if (sort === "avgTurnaroundH") {
        const av = a.avgTurnaroundH ?? Infinity;
        const bv = b.avgTurnaroundH ?? Infinity;
        return av - bv; // lower is better
      }
      return (b[sort] as number) - (a[sort] as number);
    });
  }, [coaches, sort]);

  if (loading) return <TableSkeleton />;
  if (error) return <ErrorBanner message={error} />;
  if (coaches.length === 0)
    return (
      <div className="py-16 text-center text-sm text-muted-foreground">
        No coaches found in the system yet.
      </div>
    );

  return (
    <SectionCard
      title="Coach scorecard"
      subtitle={`${coaches.length} coaches · ranked by ${sort.replace(/([A-Z])/g, " $1").toLowerCase()}`}
      bodyClassName="p-0"
      action={
        <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
          <SelectTrigger className="h-8 w-44 rounded-lg text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="reviews">Reviews</SelectItem>
            <SelectItem value="approvalRate">Approval %</SelectItem>
            <SelectItem value="avgTurnaroundH">Fastest response</SelectItem>
            <SelectItem value="notesCount">Coaching notes</SelectItem>
            <SelectItem value="score">Overall score</SelectItem>
          </SelectContent>
        </Select>
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3">Coach</th>
              <th className="px-3 py-3 text-right">Participants</th>
              <th className="px-3 py-3">Reviews</th>
              <th className="px-3 py-3 text-center">Approval %</th>
              <th className="px-3 py-3 text-right">Turnaround</th>
              <th className="px-3 py-3 text-right">Notes</th>
              <th className="px-3 py-3 text-right">Meetings</th>
              <th className="px-3 py-3 text-right">Notifs</th>
              <th className="px-3 py-3 text-right">Last active</th>
              <th className="px-4 py-3 text-center">Score</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((c, i) => {
              const isOpen = expanded === c.id;
              const coachParticipants = interactions.filter((p) => p.coachId === c.id);
              return (
                <>
                  <tr
                    key={c.id}
                    className={cn(
                      "border-b border-border last:border-0 transition-colors hover:bg-muted/30",
                      isOpen && "bg-muted/40",
                    )}
                  >
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setExpanded(isOpen ? null : c.id)}
                        className="flex items-center gap-2.5 text-left"
                      >
                        {isOpen ? (
                          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                        <Avatar name={c.name} src={c.avatar} size="sm" />
                        <div>
                          <p className="font-semibold text-foreground">{c.name}</p>
                          <p className="text-[10px] text-muted-foreground">
                            #{i + 1} · {c.participants} participants
                          </p>
                        </div>
                      </button>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">
                      {c.participants}
                    </td>
                    <td className="px-3 py-3">
                      <MiniBar
                        value={c.reviews}
                        max={maxReviews}
                        color={approvalColor(c.approvalRate)}
                      />
                    </td>
                    <td className="px-3 py-3 text-center">
                      <div className="flex flex-col items-center gap-0.5">
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-xs font-semibold",
                            c.approvalRate >= 80
                              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                              : c.approvalRate >= 60
                                ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                                : "bg-destructive/15 text-destructive",
                          )}
                        >
                          {c.approvalRate}%
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {c.approved}✓ {c.rejected}✗
                        </span>
                      </div>
                    </td>
                    <td className={cn("px-3 py-3 text-right tabular-nums font-medium", tatColor(c.avgTurnaroundH))}>
                      {tatLabel(c.avgTurnaroundH)}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">
                      {c.notesCount}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">
                      {c.meetingsCount}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">
                      {c.notifsCount}
                    </td>
                    <td className="px-3 py-3 text-right text-xs">
                      <RelTime
                        iso={
                          c.lastReviewAt && c.lastNoteAt
                            ? new Date(c.lastReviewAt) > new Date(c.lastNoteAt)
                              ? c.lastReviewAt
                              : c.lastNoteAt
                            : (c.lastReviewAt ?? c.lastNoteAt)
                        }
                      />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <ScoreBadge score={c.score} label={c.scoreLabel} />
                    </td>
                  </tr>

                  {/* Expanded participant list */}
                  {isOpen && (
                    <tr key={`${c.id}-expand`} className="border-b border-border bg-muted/20">
                      <td colSpan={10} className="px-4 pb-4 pt-2">
                        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          {c.name}'s participants ({coachParticipants.length})
                        </p>
                        {coachParticipants.length === 0 ? (
                          <p className="text-xs text-muted-foreground">
                            No participants assigned yet.
                          </p>
                        ) : (
                          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                            {coachParticipants.map((p) => (
                              <MiniParticipantCard key={p.participantId} p={p} />
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </>
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
    <div
      className={cn(
        "rounded-xl border border-border bg-card p-3",
        p.atRisk && "border-amber-500/30 bg-amber-500/5",
      )}
    >
      <div className="mb-2 flex items-center gap-2">
        <Avatar name={p.participantName} src={p.participantAvatar} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold text-foreground">{p.participantName}</p>
          <p className="text-[10px] text-muted-foreground">{p.batchName}</p>
        </div>
        {p.atRisk && (
          <span className="text-[10px] font-semibold text-amber-600">At risk</span>
        )}
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
  loading,
  lockedCoachId,
}: {
  coaches: CoachReport[];
  interactions: ParticipantInteraction[];
  loading: boolean;
  lockedCoachId?: string;
}) {
  const [coachId, setCoachId] = useState<string>(lockedCoachId ?? "");
  // Keep in sync if the locked ID arrives after the data loads
  const effectiveId = lockedCoachId ?? coachId;
  const coach = coaches.find((c) => c.id === effectiveId) ?? null;
  const coachParticipants = interactions.filter((p) => p.coachId === effectiveId);
  const atRiskCount = coachParticipants.filter((p) => p.atRisk).length;

  if (loading) return <TableSkeleton />;

  return (
    <div className="space-y-4">
      {/* Only show the selector if not locked to a specific coach */}
      {!lockedCoachId && (
      <div className="flex items-center gap-3">
        <Select value={coachId} onValueChange={setCoachId}>
          <SelectTrigger className="w-56 rounded-xl">
            <SelectValue placeholder="Select a coach…" />
          </SelectTrigger>
          <SelectContent>
            {coaches.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {coach && (
          <span className="text-sm text-muted-foreground">
            {coach.participants} participants · score {coach.score}/100
          </span>
        )}
      </div>
      )}

      {!coach ? (
        <div className="flex flex-col items-center gap-3 py-20 text-center">
          <Gauge className="h-10 w-10 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">
            {lockedCoachId ? "Loading your performance data…" : "Select a coach above to see their detailed performance"}
          </p>
        </div>
      ) : (
        <>
          {/* Coach profile card */}
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <div className="flex items-center gap-3">
                <Avatar name={coach.name} src={coach.avatar} size="lg" />
                <div>
                  <h2 className="text-lg font-bold text-foreground">{coach.name}</h2>
                  <div className="mt-0.5 flex items-center gap-2">
                    <ScoreBadge score={coach.score} label={coach.scoreLabel} />
                  </div>
                </div>
              </div>

              <div className="grid flex-1 grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  {
                    icon: Users,
                    label: "Participants",
                    value: String(coach.participants),
                    sub: `${atRiskCount} at risk`,
                    warn: atRiskCount > 0,
                  },
                  {
                    icon: CheckCircle2,
                    label: "Reviews done",
                    value: String(coach.reviews),
                    sub: `${coach.approvalRate}% approved`,
                    warn: coach.approvalRate < 60,
                  },
                  {
                    icon: FileText,
                    label: "Coaching notes",
                    value: String(coach.notesCount),
                    sub: coach.participants > 0
                      ? `${(coach.notesCount / coach.participants).toFixed(1)} per participant`
                      : "—",
                    warn: false,
                  },
                  {
                    icon: Clock,
                    label: "Avg turnaround",
                    value: tatLabel(coach.avgTurnaroundH),
                    sub:
                      coach.avgTurnaroundH == null
                        ? "No reviews yet"
                        : coach.avgTurnaroundH <= 24
                          ? "Excellent"
                          : coach.avgTurnaroundH <= 48
                            ? "Good"
                            : "Needs improvement",
                    warn: coach.avgTurnaroundH != null && coach.avgTurnaroundH > 48,
                  },
                ].map(({ icon: Icon, label, value, sub, warn }) => (
                  <div key={label} className="rounded-xl bg-secondary/50 p-3">
                    <div className="mb-1 flex items-center gap-1.5">
                      <Icon className={cn("h-3.5 w-3.5", warn ? "text-amber-500" : "text-muted-foreground")} />
                      <span className="text-[11px] text-muted-foreground">{label}</span>
                    </div>
                    <p className="text-xl font-bold tabular-nums text-foreground">{value}</p>
                    <p className={cn("text-[11px]", warn ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground")}>
                      {sub}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Engagement row */}
            <div className="mt-4 grid grid-cols-3 gap-3 border-t border-border pt-4 sm:grid-cols-6">
              {[
                { icon: Video, label: "Meetings", value: coach.meetingsCount },
                { icon: Bell, label: "Notifications sent", value: coach.notifsCount },
                { icon: Star, label: "Visits", value: coach.visitsCount },
                { icon: MessageSquare, label: "Notes written", value: coach.notesCount },
                {
                  icon: Calendar,
                  label: "Last review",
                  value: coach.lastReviewAt ? format(parseISO(coach.lastReviewAt), "MMM d") : "—",
                },
                {
                  icon: FileText,
                  label: "Last note",
                  value: coach.lastNoteAt ? format(parseISO(coach.lastNoteAt), "MMM d") : "—",
                },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="text-center">
                  <Icon className="mx-auto mb-1 h-4 w-4 text-muted-foreground" />
                  <p className="text-base font-bold text-foreground">{value}</p>
                  <p className="text-[10px] text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Participants grid */}
          <SectionCard
            title="Assigned participants"
            subtitle={`${coachParticipants.length} total · ${atRiskCount} at risk`}
          >
            {coachParticipants.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No participants assigned to this coach yet.
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {coachParticipants.map((p) => (
                  <ParticipantDetailCard key={p.participantId} p={p} />
                ))}
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
    <div
      className={cn(
        "rounded-xl border border-border bg-card p-4",
        p.atRisk && "border-amber-500/40",
      )}
    >
      <div className="mb-3 flex items-center gap-2.5">
        <Avatar name={p.participantName} src={p.participantAvatar} size="md" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{p.participantName}</p>
          <p className="text-[11px] text-muted-foreground">{p.batchName}</p>
        </div>
        {p.atRisk ? (
          <span className="shrink-0 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-600">
            At risk
          </span>
        ) : (
          <span className="shrink-0 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">
            On track
          </span>
        )}
      </div>

      {/* Progress bar */}
      <div className="mb-3">
        <div className="mb-1 flex justify-between text-[11px] text-muted-foreground">
          <span>
            Week {p.weeksApproved}/{p.totalWeeks} approved
          </span>
          <span>{progressPct}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
          <div
            className={cn(
              "h-full rounded-full",
              progressPct >= 80
                ? "bg-emerald-500"
                : progressPct >= 50
                  ? "bg-[#2D8CFF]"
                  : "bg-amber-400",
            )}
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Interaction stats */}
      <div className="grid grid-cols-4 gap-1 text-center">
        <Stat n={String(p.reviewsReceived)} label="Reviews" />
        <Stat n={String(p.coachingNotes)} label="Notes" />
        <Stat n={String(p.meetingsCount)} label="Meetings" />
        <Stat
          n={p.daysSinceContact != null ? `${p.daysSinceContact}d` : "—"}
          label="Last touch"
        />
      </div>
    </div>
  );
}

// ─── Participant Map tab ──────────────────────────────────────────────────────
type MapSort =
  | "name"
  | "weeksApproved"
  | "totalPoints"
  | "reviewsReceived"
  | "coachingNotes"
  | "daysSinceContact";

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
      r = r.filter(
        (p) =>
          p.participantName.toLowerCase().includes(search.toLowerCase()) ||
          p.coachName.toLowerCase().includes(search.toLowerCase()),
      );
    if (filterCoach !== "all") r = r.filter((p) => p.coachId === filterCoach);
    if (filterRisk === "risk") r = r.filter((p) => p.atRisk);
    if (filterRisk === "ok") r = r.filter((p) => !p.atRisk);
    return [...r].sort((a, b) => {
      let va: number | string, vb: number | string;
      if (sort === "name") {
        va = a.participantName;
        vb = b.participantName;
        return dir * va.localeCompare(vb);
      }
      if (sort === "daysSinceContact") {
        va = a.daysSinceContact ?? 9999;
        vb = b.daysSinceContact ?? 9999;
      } else {
        va = a[sort] as number;
        vb = b[sort] as number;
      }
      return dir * ((va as number) - (vb as number));
    });
  }, [rows, search, filterCoach, filterRisk, sort, dir]);

  const atRiskCount = filtered.filter((r) => r.atRisk).length;

  if (loading) return <TableSkeleton />;
  if (error) return <ErrorBanner message={error} />;

  function SortTh({
    k,
    label,
    right,
  }: {
    k: MapSort;
    label: string;
    right?: boolean;
  }) {
    const active = sort === k;
    return (
      <th
        className={cn(
          "cursor-pointer select-none px-3 py-3 hover:text-foreground",
          right ? "text-right" : "text-left",
          active ? "text-foreground" : "",
        )}
        onClick={() => toggleSort(k)}
      >
        <span className="inline-flex items-center gap-1">
          {label}
          {active ? (
            dir === -1 ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />
          ) : (
            <Minus className="h-3 w-3 opacity-30" />
          )}
        </span>
      </th>
    );
  }

  return (
    <div className="space-y-3">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={lockedCoachId ? "Search participant…" : "Search participant or coach…"}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-xl pl-8"
          />
        </div>
        {!lockedCoachId && (
        <Select value={filterCoach} onValueChange={setFilterCoach}>
          <SelectTrigger className="w-44 rounded-xl">
            <SelectValue placeholder="All coaches" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All coaches</SelectItem>
            {coaches.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        )}
        <div className="flex rounded-xl border border-border overflow-hidden">
          {(["all", "risk", "ok"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setFilterRisk(v)}
              className={cn(
                "px-3 py-1.5 text-xs font-medium transition-colors",
                filterRisk === v
                  ? "bg-gradient-navy text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {v === "all" ? "All" : v === "risk" ? "At risk" : "On track"}
            </button>
          ))}
        </div>
        <span className="text-xs text-muted-foreground">
          {filtered.length} participants · {atRiskCount} at risk
        </span>
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
                  <tr
                    key={p.participantId}
                    className={cn(
                      "border-b border-border last:border-0 transition-colors hover:bg-muted/30",
                      p.atRisk && "bg-amber-500/[0.04]",
                    )}
                  >
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
                    <td className="px-3 py-3 text-right tabular-nums font-medium text-foreground">
                      {p.totalPoints.toLocaleString()}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">
                      {p.reviewsReceived}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <span
                        className={cn(
                          "tabular-nums",
                          p.coachingNotes === 0
                            ? "font-semibold text-amber-600"
                            : "text-muted-foreground",
                        )}
                      >
                        {p.coachingNotes}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">
                      {p.meetingsCount}
                    </td>
                    <td className="px-3 py-3 text-right text-xs">
                      {p.daysSinceContact != null ? (
                        <span
                          className={cn(
                            p.daysSinceContact > 14
                              ? "font-semibold text-destructive"
                              : p.daysSinceContact > 7
                                ? "text-amber-600 dark:text-amber-400"
                                : "text-muted-foreground",
                          )}
                        >
                          {p.daysSinceContact === 0 ? "Today" : `${p.daysSinceContact}d ago`}
                        </span>
                      ) : (
                        <span className="font-semibold text-destructive">Never</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {p.atRisk ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-400">
                          <AlertTriangle className="h-2.5 w-2.5" /> At risk
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                          <CheckCircle2 className="h-2.5 w-2.5" /> On track
                        </span>
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
      <span
        className={cn(
          "rounded-full px-2.5 py-0.5 text-xs font-semibold",
          SCORE_COLORS[label],
        )}
      >
        {label}
      </span>
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
