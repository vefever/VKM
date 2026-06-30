import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "@tanstack/react-router";
import {
  TrendingUp,
  ListChecks,
  BookOpen,
  Search,
  Download,
  MapPin,
  Video,
  Star,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ChevronDown,
  ChevronsDownUp,
  ChevronsUpDown,
  ExternalLink,
  Upload,
  Play,
  Rocket,
  Sparkles,
  CalendarClock,
  ArrowRight,
  Loader2,
  Lock,
  type LucideIcon,
} from "lucide-react";
import { PageHeader } from "@/components/vkm/page-header";
import { SectionCard } from "@/components/vkm/section-card";
import { AnimatedCounter } from "@/components/vkm/animated-counter";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { safeHref } from "@/lib/safe-url";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  VKM_MILESTONES,
  type Phase,
  type ProgramWeek,
} from "@/lib/vkm/program";
import { useMyProofs, type MyWeek } from "@/components/coach/coach-data";
import { useEnrollment, weekFromStart } from "@/components/participant/enrollment-data";
import {
  ProgramPlanProvider,
  usePlan,
} from "@/components/participant/program-plan-data";
import { ProofAttachments } from "@/components/participant/proof-attachments";
import { TaskResources } from "@/components/participant/task-resources";
import {
  useWeekVideos,
  videoMapFromRows,
  type WeekVideoOverride,
} from "@/components/admin/class-videos-data";

// Local, per-week "did I engage" state (watched video / assignment done).
// Real proof approval still comes from the server; this just powers the
// immediate feedback loop and persists across reloads.
type WeekActivity = { watched?: boolean; assignmentDone?: boolean };
type ActivityMap = Record<number, WeekActivity>;
const ACTIVITY_KEY = "vkm.progress.activity.v1";

function loadActivity(): ActivityMap {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(ACTIVITY_KEY) ?? "{}") as ActivityMap;
  } catch {
    return {};
  }
}
function saveActivity(a: ActivityMap) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ACTIVITY_KEY, JSON.stringify(a));
  } catch {
    /* ignore quota / private-mode errors */
  }
}
function hasSubmission(s?: MyWeek) {
  return !!s && (s.proof_status !== "none" || !!s.proof_url || (s.proof_files?.length ?? 0) > 0);
}

type TabId = "tasks" | "journey" | "curriculum";
const TABS: { id: TabId; label: string; icon: LucideIcon }[] = [
  { id: "tasks", label: "Weekly Tasks", icon: ListChecks },
  { id: "journey", label: "Your Journey", icon: TrendingUp },
  { id: "curriculum", label: "Curriculum", icon: BookOpen },
];

const PHASE_COLOR: Record<Phase, string> = {
  Foundation: "#3b82f6",
  Systems: "#8b5cf6",
  Sell: "#f59e0b",
  Review: "#10b981",
};

type WeekStatus = "approved" | "pending" | "rejected" | "current" | "missed" | "upcoming";
const STATUS_META: Record<WeekStatus, { label: string; cls: string; dot: string }> = {
  approved: {
    label: "Approved",
    cls: "bg-[oklch(0.93_0.06_160)] text-[oklch(0.35_0.12_160)]",
    dot: "bg-[#10b981]",
  },
  pending: { label: "In review", cls: "bg-gold/15 text-[oklch(0.45_0.1_85)]", dot: "bg-[#f59e0b]" },
  rejected: {
    label: "Needs changes",
    cls: "bg-[oklch(0.93_0.06_25)] text-[oklch(0.45_0.16_25)]",
    dot: "bg-[#ef4444]",
  },
  current: { label: "This week", cls: "bg-gradient-navy text-primary-foreground", dot: "bg-navy" },
  missed: {
    label: "Catch up",
    cls: "bg-[oklch(0.95_0.03_70)] text-[oklch(0.47_0.09_70)]",
    dot: "bg-[oklch(0.7_0.12_70)]",
  },
  upcoming: {
    label: "Locked",
    cls: "bg-muted text-muted-foreground",
    dot: "bg-muted-foreground/40",
  },
};

// Plain-language explanation for each status (shown as a tooltip on the pill).
const STATUS_DESC: Record<WeekStatus, string> = {
  approved: "Coach approved — points earned",
  pending: "Submitted — waiting for your coach to review",
  rejected: "Coach asked for changes — update and resubmit",
  current: "This week's task — submit proof before Tuesday's class",
  missed: "Not submitted yet — you can still catch up",
  upcoming: "Opens as you reach this week",
};

function exportCsv(weeks: ProgramWeek[], currentWeek: number) {
  const header = ["Wk", "Phase", "Topic", "Mode", "Task", "Proof"];
  const rows = weeks
    .filter((w) => w.week <= currentWeek)
    .map((w) => [w.week, w.phase, w.topic, w.mode, w.task, w.proof]);
  const csv = [header, ...rows]
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "vkm-16-week-curriculum.csv";
  a.click();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Start Program — shown until the participant begins. Their 16-week (or custom)
// clock only starts on this action, so mid-week joiners start fresh at Week 1.
// ---------------------------------------------------------------------------
function StartProgramGate({
  totalWeeks,
  starting,
  onStart,
}: {
  totalWeeks: number;
  starting: boolean;
  onStart: () => void;
}) {
  const plan = usePlan();
  const [confirm, setConfirm] = useState(false);
  const firstWeek = plan.weeks[0];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-5"
    >
      <PageHeader
        eyebrow="Participant"
        title="Program Progress"
        description="Your 4-month transformation — Foundation → Systems → Sell → Review."
        icon={TrendingUp}
      />

      <div className="relative overflow-hidden rounded-3xl bg-gradient-navy p-6 text-primary-foreground shadow-vkm-float sm:p-8">
        <span
          aria-hidden
          className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-gradient-gold opacity-20 blur-3xl"
        />
        <span className="relative inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10">
          <Rocket className="h-6 w-6 text-gold" />
        </span>
        <h2 className="relative mt-4 text-2xl font-bold sm:text-3xl">
          Ready to begin your {totalWeeks}-week journey?
        </h2>
        <p className="relative mt-2 max-w-xl text-sm text-white/80 sm:text-base">
          Your program clock starts the day you press <span className="font-semibold">Start</span> —
          not before. Week 1 opens today and a new week unlocks every 7 days, all the way to Week{" "}
          {totalWeeks}. Joined mid-week? No problem — your journey is yours, from day one.
        </p>

        <div className="relative mt-4 flex flex-wrap gap-2">
          {plan.phases.map((p) => (
            <span
              key={p.name}
              className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/80 ring-1 ring-white/15"
            >
              {p.name} · {p.weeks.length}w
            </span>
          ))}
        </div>

        <ul className="relative mt-5 space-y-2 text-sm text-white/85">
          <li className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4 shrink-0 text-gold" /> Week 1 unlocks today —{" "}
            <span className="font-semibold">{firstWeek.topic}</span>
          </li>
          <li className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 shrink-0 text-gold" /> Earn 250 points a week as your coach
            approves your proof
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-gold" /> A fresh week opens automatically
            every 7 days
          </li>
        </ul>

        {!confirm ? (
          <Button
            onClick={() => setConfirm(true)}
            className="relative mt-6 w-full rounded-xl bg-gradient-gold py-6 text-base font-bold text-navy hover:opacity-90 sm:w-auto sm:px-8"
          >
            <Rocket className="h-5 w-5" /> Start my program <ArrowRight className="h-5 w-5" />
          </Button>
        ) : (
          <div className="relative mt-6 rounded-2xl bg-white/10 p-4 ring-1 ring-white/20">
            <p className="text-sm font-semibold">
              Start today? Week 1 begins now. You can't undo this yourself — your coach can reset it
              if needed.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                onClick={onStart}
                disabled={starting}
                className="flex-1 rounded-xl bg-gradient-gold font-bold text-navy hover:opacity-90"
              >
                {starting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}{" "}
                Yes, start now
              </Button>
              <Button
                variant="ghost"
                onClick={() => setConfirm(false)}
                className="rounded-xl text-white hover:bg-white/10 hover:text-white"
              >
                Not yet
              </Button>
            </div>
          </div>
        )}
      </div>

      <SectionCard
        title={`What's ahead — ${plan.length} weeks`}
        subtitle="A preview of your journey. Each week unlocks once you start."
      >
        <div className="grid gap-2 sm:grid-cols-2">
          {plan.weeks.map((w) => (
            <div
              key={w.week}
              className="flex items-center gap-2.5 rounded-xl border border-border bg-card p-2.5"
            >
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary/60 text-sm font-bold tabular-nums text-foreground">
                {w.week}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{w.topic}</p>
                <p className="text-[11px] text-muted-foreground">
                  {w.phase} · {w.mode}
                </p>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </motion.div>
  );
}

export function ProgramProgress() {
  return (
    <ProgramPlanProvider>
      <ProgramProgressInner />
    </ProgramPlanProvider>
  );
}

function ProgramProgressInner() {
  const [tab, setTab] = useState<TabId>("tasks");
  const plan = usePlan();
  const { weeks } = useMyProofs();
  const { user } = useAuth();
  // Per-participant clock — the program begins when THEY press Start.
  const {
    loading: enrLoading,
    error: enrError,
    started,
    starting,
    startedAt,
    startProgram,
  } = useEnrollment();

  // Unify the program clock on the plan length so added/removed weeks take
  // effect immediately for display and the current-week calculation.
  const totalWeeks = plan.length;
  const week = started ? weekFromStart(startedAt, plan.length) : 0;

  // Real points earned, summed from the participant's ledger.
  const [points, setPoints] = useState<number | null>(null);
  useEffect(() => {
    if (!user) return;
    let active = true;
    void supabase
      .from("points_ledger")
      .select("points")
      .eq("user_id", user.id)
      .then(({ data }) => {
        if (active) setPoints((data ?? []).reduce((n, r) => n + (r.points ?? 0), 0));
      });
    return () => {
      active = false;
    };
  }, [user]);

  const statusByWeek = useMemo(() => {
    const m = new Map<number, string>();
    weeks.forEach((w) => m.set(w.week_no, w.proof_status));
    return m;
  }, [weeks]);

  // Per-week submission record, for the task drill-downs.
  const subByWeek = useMemo(() => {
    const m = new Map<number, MyWeek>();
    weeks.forEach((w) => m.set(w.week_no, w));
    return m;
  }, [weeks]);

  // Admin-managed class videos (override the sample where set).
  const { rows: videoRows } = useWeekVideos();
  const videoByWeek = useMemo(() => videoMapFromRows(videoRows), [videoRows]);

  // Local engagement state (watched / assignment done), persisted.
  const [activity, setActivity] = useState<ActivityMap>(() => loadActivity());
  useEffect(() => saveActivity(activity), [activity]);
  function markStep(weekNo: number, key: keyof WeekActivity, value: boolean) {
    setActivity((a) => ({ ...a, [weekNo]: { ...a[weekNo], [key]: value } }));
  }

  function statusOf(wkNo: number): WeekStatus {
    const s = statusByWeek.get(wkNo);
    if (s === "approved") return "approved";
    if (s === "pending") return "pending";
    if (s === "rejected") return "rejected";
    if (wkNo === week) return "current";
    if (wkNo < week) return "missed";
    return "upcoming";
  }

  const weeksDone = weeks.filter((w) => w.proof_status === "approved").length;

  // Steps engaged across the whole program — powers the live feedback chip.
  const stepsDone = useMemo(() => {
    let n = 0;
    plan.weeks.forEach((w) => {
      if (activity[w.week]?.watched) n++;
      if (activity[w.week]?.assignmentDone) n++;
      if (hasSubmission(subByWeek.get(w.week))) n++;
    });
    return n;
  }, [activity, subByWeek, plan.weeks]);
  const totalSteps = plan.length * 3;

  // Roving-tabindex keyboard nav for the tablist (WAI-ARIA tabs pattern).
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  function onTabKeyDown(e: React.KeyboardEvent) {
    const idx = TABS.findIndex((tt) => tt.id === tab);
    let next = idx;
    if (e.key === "ArrowRight") next = (idx + 1) % TABS.length;
    else if (e.key === "ArrowLeft") next = (idx - 1 + TABS.length) % TABS.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = TABS.length - 1;
    else return;
    e.preventDefault();
    setTab(TABS[next].id);
    tabRefs.current[next]?.focus();
  }

  // Primary "where do I start?" action — jump to + scroll the current week.
  function continueCurrent() {
    setTab("tasks");
    setTimeout(() => {
      document
        .getElementById(`task-week-${week}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 140);
  }

  // Gate: while we don't know the enrollment, hold; before they start, show the
  // Start Program screen so their 16-week clock only begins on their action.
  if (enrLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (enrError) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 text-center">
        <AlertTriangle className="h-6 w-6 text-destructive" />
        <p className="text-sm font-medium text-foreground">Couldn’t load your program</p>
        <p className="max-w-sm text-xs text-muted-foreground">{enrError}</p>
      </div>
    );
  }
  if (!started) {
    return (
      <StartProgramGate
        totalWeeks={totalWeeks}
        starting={starting}
        onStart={() => void startProgram(plan.length)}
      />
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
        eyebrow="Participant"
        title="Program Progress"
        description="Your 4-month transformation — Foundation → Systems → Sell → Review."
        icon={TrendingUp}
      />

      <ProgressBanner
        currentWeek={week}
        totalWeeks={totalWeeks}
        weeksDone={weeksDone}
        points={points}
        statusOf={statusOf}
        stepsDone={stepsDone}
        totalSteps={totalSteps}
        currentTopic={plan.byNumber(week)?.topic ?? null}
        onContinue={continueCurrent}
      />

      {/* Tabs — real WAI-ARIA tablist with roving focus + sliding indicator */}
      <div
        role="tablist"
        aria-label="Program progress views"
        onKeyDown={onTabKeyDown}
        className="grid grid-cols-3 gap-1.5 rounded-2xl border border-border bg-card p-1.5 shadow-vkm"
      >
        {TABS.map((t, i) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`pp-tab-${t.id}`}
              aria-selected={active}
              aria-controls={`pp-panel-${t.id}`}
              tabIndex={active ? 0 : -1}
              onClick={() => setTab(t.id)}
              className={cn(
                "app-press relative flex items-center justify-center gap-1 rounded-xl px-2 py-2.5 text-center text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60 sm:gap-2 sm:py-2 sm:text-sm",
                "flex-col sm:flex-row",
                active ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {active && (
                <motion.span
                  layoutId="pp-tab-pill"
                  aria-hidden
                  className="absolute inset-0 rounded-xl bg-gradient-navy shadow-vkm"
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                />
              )}
              <Icon className="relative z-10 h-4 w-4 shrink-0" />
              <span className="relative z-10 leading-tight">{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* New panel renders immediately (no exit-wait gap) and gently fades in. */}
      <motion.div
        key={tab}
        role="tabpanel"
        id={`pp-panel-${tab}`}
        aria-labelledby={`pp-tab-${tab}`}
        tabIndex={0}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
        className="focus:outline-none"
      >
        {tab === "tasks" && (
          <WeeklyTasks
            statusOf={statusOf}
            currentWeek={week}
            submissions={subByWeek}
            activity={activity}
            markStep={markStep}
            videoByWeek={videoByWeek}
          />
        )}
        {tab === "journey" && (
          <Journey statusOf={statusOf} weeksDone={weeksDone} currentWeek={week} />
        )}
        {tab === "curriculum" && <Curriculum currentWeek={week} />}
      </motion.div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Weekly Tasks
// ---------------------------------------------------------------------------
function WeeklyTasks({
  statusOf,
  currentWeek,
  submissions,
  activity,
  markStep,
  videoByWeek,
}: {
  statusOf: (n: number) => WeekStatus;
  currentWeek: number;
  submissions: Map<number, MyWeek>;
  activity: ActivityMap;
  markStep: (weekNo: number, key: keyof WeekActivity, value: boolean) => void;
  videoByWeek: Map<number, WeekVideoOverride>;
}) {
  const plan = usePlan();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "current" | "missed" | "approved">("all");
  const [openWeeks, setOpenWeeks] = useState<Set<number>>(() => new Set([currentWeek]));

  const list = plan.weeks.filter((w) => {
    if (q.trim() && !`${w.topic} ${w.task}`.toLowerCase().includes(q.toLowerCase())) return false;
    return filter === "all" || statusOf(w.week) === filter;
  });

  const counts = { current: 0, missed: 0, approved: 0 };
  plan.weeks.forEach((w) => {
    const s = statusOf(w.week);
    if (s === "current") counts.current++;
    else if (s === "missed") counts.missed++;
    else if (s === "approved") counts.approved++;
  });
  const FILTERS = [
    { id: "all" as const, label: "All", count: plan.length },
    { id: "current" as const, label: "This week", count: counts.current },
    { id: "missed" as const, label: "Catch up", count: counts.missed },
    { id: "approved" as const, label: "Approved", count: counts.approved },
  ];

  function toggle(wkNo: number) {
    setOpenWeeks((s) => {
      const n = new Set(s);
      if (n.has(wkNo)) n.delete(wkNo);
      else n.add(wkNo);
      return n;
    });
  }
  const allOpen = list.length > 0 && list.every((w) => openWeeks.has(w.week));
  function toggleAll() {
    setOpenWeeks(allOpen ? new Set() : new Set(list.map((w) => w.week)));
  }
  function resume() {
    setOpenWeeks((s) => new Set(s).add(currentWeek));
    setTimeout(() => {
      document
        .getElementById(`task-week-${currentWeek}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 60);
  }

  return (
    <SectionCard
      title="Weekly Tasks"
      subtitle="One task + one proof each week — earn +250 points (Weeks 1–14)"
      action={
        <div className="relative hidden sm:block">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search…"
            className="h-9 w-48 rounded-xl pl-9"
          />
        </div>
      }
    >
      <div className="relative mb-3 sm:hidden">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search…"
          className="h-10 rounded-xl pl-9"
        />
      </div>

      {/* status filter — jump to what needs action */}
      <div className="mb-3 flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={cn(
              "app-press inline-flex min-h-9 shrink-0 items-center gap-1 rounded-full px-3.5 text-xs font-medium transition-colors",
              filter === f.id
                ? "bg-gradient-navy text-primary-foreground shadow-vkm"
                : "bg-secondary/60 text-muted-foreground hover:text-foreground",
            )}
          >
            {f.label} <span className="opacity-70">{f.count}</span>
          </button>
        ))}
      </div>

      {/* controls */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <Button size="sm" variant="outline" className="h-9 rounded-lg text-xs" onClick={resume}>
          <TrendingUp className="h-3.5 w-3.5" /> Resume Week {currentWeek}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-9 rounded-lg text-xs text-muted-foreground"
          onClick={toggleAll}
        >
          {allOpen ? (
            <>
              <ChevronsDownUp className="h-3.5 w-3.5" /> Collapse all
            </>
          ) : (
            <>
              <ChevronsUpDown className="h-3.5 w-3.5" /> Expand all
            </>
          )}
        </Button>
      </div>

      <div className="space-y-2.5">
        {list.map((w) => (
          <TaskCard
            key={w.week}
            wk={w}
            currentWeek={currentWeek}
            status={statusOf(w.week)}
            submission={submissions.get(w.week)}
            open={openWeeks.has(w.week)}
            onToggle={() => toggle(w.week)}
            activity={activity[w.week]}
            markStep={markStep}
            videoOverride={videoByWeek.get(w.week)}
          />
        ))}
        {list.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {q.trim() ? `No tasks match “${q}”.` : "Nothing in this filter right now."}
          </p>
        )}
      </div>

      <p className="mt-3 flex items-center gap-1.5 rounded-xl bg-secondary/60 px-3 py-2 text-xs text-muted-foreground">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-[oklch(0.5_0.11_80)]" />
        This week is Week {currentWeek}. Submit its proof before next Tuesday's class.
      </p>
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// Progress banner — real week / phase / % / points + phase stepper
// ---------------------------------------------------------------------------
function ProgressBanner({
  currentWeek,
  totalWeeks,
  weeksDone,
  points,
  statusOf,
  stepsDone,
  totalSteps,
  currentTopic,
  onContinue,
}: {
  currentWeek: number;
  totalWeeks: number;
  weeksDone: number;
  points: number | null;
  statusOf: (n: number) => WeekStatus;
  stepsDone: number;
  totalSteps: number;
  currentTopic: string | null;
  onContinue: () => void;
}) {
  const plan = usePlan();
  const pct = Math.round((weeksDone / plan.length) * 100);
  const phase = plan.byNumber(currentWeek)?.phase;

  return (
    <div className="overflow-hidden rounded-3xl bg-gradient-navy p-4 text-primary-foreground shadow-vkm-float sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-white/60">
            Program progress
          </p>
          <p className="mt-0.5 text-lg font-bold sm:text-xl">
            Week {currentWeek} of {totalWeeks}
            {phase && <span className="font-medium text-white/70"> · {phase}</span>}
          </p>
          <p className="text-xs text-white/70">
            {weeksDone === 0
              ? "Submit this week's proof to start earning approvals"
              : `${weeksDone} ${weeksDone === 1 ? "week" : "weeks"} approved`}
          </p>
        </div>
        <div
          className="shrink-0 rounded-2xl bg-white/10 px-3 py-1.5 text-center leading-none"
          title="Points you've earned. Submit proof → coach approves → +250 pts per week."
        >
          <p className="inline-flex items-center gap-1 text-lg font-bold tabular-nums sm:text-xl">
            <Star className="h-4 w-4 text-gold" />
            {points == null ? "—" : <AnimatedCounter value={points} duration={700} />}
          </p>
          <p className="mt-1 text-[9px] uppercase tracking-wide text-white/60">points</p>
        </div>
      </div>

      {/* Primary "where do I start?" action */}
      {currentTopic && (
        <button
          type="button"
          onClick={onContinue}
          className="app-press mt-3 flex w-full items-center justify-between gap-2 rounded-2xl bg-white/15 px-3 py-2.5 text-left ring-1 ring-white/20 transition-colors hover:bg-white/20"
        >
          <span className="min-w-0">
            <span className="block text-[10px] font-semibold uppercase tracking-wide text-white/60">
              Continue
            </span>
            <span className="block truncate text-sm font-semibold">
              Week {currentWeek}: {currentTopic}
            </span>
          </span>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-gradient-gold px-3 py-1.5 text-xs font-bold text-navy">
            <Play className="h-3.5 w-3.5 fill-current" /> Go
          </span>
        </button>
      )}

      {/* progress bar — 4 phase segments, width ∝ weeks, fills ∝ approvals */}
      <div className="mt-3 flex items-center gap-3">
        <div className="relative h-2.5 flex-1">
          <div className="flex h-full gap-0.5 overflow-hidden rounded-full">
            {plan.phases.map((ph) => {
              const total = ph.weeks.length;
              const done = ph.weeks.filter((wn) => statusOf(wn) === "approved").length;
              const fillPct = total ? (done / total) * 100 : 0;
              const color = PHASE_COLOR[ph.name];
              return (
                <div
                  key={ph.name}
                  className="relative h-full overflow-hidden"
                  style={{ flex: total, background: `${color}33` }}
                  title={`${ph.name}: ${done}/${total} approved`}
                >
                  <motion.div
                    className="absolute inset-y-0 left-0"
                    style={{ background: color }}
                    initial={{ width: 0 }}
                    animate={{ width: `${fillPct}%` }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                  />
                </div>
              );
            })}
          </div>
          {/* "you are here" marker at the current week */}
          <span
            aria-hidden
            title={`You are here — Week ${currentWeek}`}
            className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-navy bg-white shadow"
            style={{ left: `${((currentWeek - 0.5) / plan.length) * 100}%` }}
          />
        </div>
        <AnimatedCounter value={`${pct}%`} className="text-sm font-bold tabular-nums" />
      </div>
      <p className="mt-2 text-xs text-white/85 sm:text-sm">
        <AnimatedCounter value={stepsDone} className="font-bold text-white tabular-nums" /> of{" "}
        {totalSteps} steps done — each week: <span className="font-semibold text-white">watch</span>{" "}
        the class, <span className="font-semibold text-white">do</span> the assignment, and{" "}
        <span className="font-semibold text-white">submit proof</span>.
      </p>

      {/* phase stepper — 2×2 on phones, 4-up from sm */}
      <div className="mt-4 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        {plan.phases.map((ph) => {
          const done = ph.weeks.filter((wn) => statusOf(wn) === "approved").length;
          const complete = done === ph.weeks.length;
          const isCurrent = ph.name === phase;
          return (
            <div key={ph.name} className="flex flex-col items-center gap-1 text-center">
              <span
                className={cn(
                  "flex h-7 w-full items-center justify-center rounded-lg text-[11px] font-bold tabular-nums",
                  complete
                    ? "bg-gradient-gold text-navy"
                    : isCurrent
                      ? "animate-glow-pulse bg-white/25 text-white ring-1 ring-gold/60"
                      : "bg-white/10 text-white/60",
                )}
              >
                {complete ? <CheckCircle2 className="h-4 w-4" /> : `${done}/${ph.weeks.length}`}
              </span>
              <span
                className={cn(
                  "text-[10px] leading-tight",
                  isCurrent ? "font-semibold text-white" : "text-white/55",
                )}
              >
                {ph.name}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Task card — expandable drill-down (resources + submission)
// ---------------------------------------------------------------------------
function TaskCard({
  wk,
  currentWeek,
  status,
  submission,
  open,
  onToggle,
  activity,
  markStep,
  videoOverride,
}: {
  wk: ProgramWeek;
  currentWeek: number;
  status: WeekStatus;
  submission?: MyWeek;
  open: boolean;
  onToggle: () => void;
  activity?: WeekActivity;
  markStep: (weekNo: number, key: keyof WeekActivity, value: boolean) => void;
  videoOverride?: WeekVideoOverride;
}) {
  const meta = STATUS_META[status];
  const locked = status === "upcoming";
  const submitted = status === "pending" || status === "approved" || status === "rejected";
  const watched = !!activity?.watched;
  const assignmentDone = !!activity?.assignmentDone || submitted;

  return (
    <div
      id={`task-week-${wk.week}`}
      className={cn(
        "scroll-mt-24 overflow-hidden rounded-xl border bg-card transition-shadow hover:shadow-vkm-float",
        status === "current" ? "border-gold/50 ring-1 ring-gold/30" : "border-border",
      )}
    >
      {/* header toggle */}
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="app-press flex w-full items-center gap-3 p-3 text-left"
      >
        <span
          className={cn(
            "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold",
            status === "current"
              ? "bg-gradient-navy text-primary-foreground"
              : status === "approved"
                ? "bg-[#10b981] text-white"
                : "bg-secondary text-foreground",
          )}
        >
          {wk.week}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-foreground">{wk.topic}</p>
            <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              {wk.mode === "Offline" ? (
                <MapPin className="h-3 w-3" />
              ) : (
                <Video className="h-3 w-3" />
              )}
              {wk.phase}
            </span>
          </div>
          <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{wk.task}</p>
          {!locked && (
            <div className="mt-1 flex items-center gap-2.5">
              <ProgChip Icon={Video} on={watched} label="Video" />
              <ProgChip Icon={ListChecks} on={assignmentDone} label="Task" />
              <ProgChip Icon={Upload} on={submitted} label="Proof" />
            </div>
          )}
        </div>
        <span
          title={STATUS_DESC[status]}
          className={cn(
            "hidden shrink-0 cursor-help rounded-full px-2.5 py-0.5 text-xs font-medium sm:inline-flex",
            meta.cls,
          )}
        >
          {meta.label}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="space-y-3 border-t border-border p-3">
              {/* status pill + plain-language meaning (hidden in header on small screens) */}
              <div className="flex flex-wrap items-center gap-2 sm:hidden">
                <span
                  className={cn(
                    "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
                    meta.cls,
                  )}
                >
                  {meta.label}
                </span>
                <span className="text-[11px] text-muted-foreground">{STATUS_DESC[status]}</span>
              </div>

              {/* task detail */}
              <div className="rounded-lg bg-secondary/50 p-3 text-xs leading-relaxed">
                <p className="text-muted-foreground">
                  <span className="font-semibold text-foreground">Why it matters:</span> {wk.why}
                </p>
                <p className="mt-1 text-muted-foreground">
                  <span className="font-semibold text-foreground">This week's task:</span> {wk.task}
                </p>
                <p className="mt-1 text-muted-foreground">
                  <span className="font-semibold text-foreground">Proof required:</span> {wk.proof}
                </p>
              </div>

              {/* related resources — inline video / assignment / downloads */}
              <TaskResources
                wk={wk}
                currentWeek={currentWeek}
                locked={locked}
                watched={watched}
                assignmentDone={!!activity?.assignmentDone}
                submitted={submitted}
                onWatched={() => markStep(wk.week, "watched", true)}
                onToggleAssignment={(v) => markStep(wk.week, "assignmentDone", v)}
                videoOverride={videoOverride}
              />

              {/* submission */}
              <TaskSubmission wk={wk} status={status} submission={submission} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Collapsed-row progress: video / assignment / proof at a glance.
function ProgChip({ Icon, on, label }: { Icon: LucideIcon; on: boolean; label: string }) {
  return (
    <span
      title={`${label} ${on ? "done" : "to do"}`}
      className={cn(
        "inline-flex items-center gap-1 text-[10px] font-medium",
        on ? "text-[oklch(0.45_0.13_160)]" : "text-muted-foreground/60",
      )}
    >
      {on ? <CheckCircle2 className="h-3 w-3" /> : <Icon className="h-3 w-3" />}
      {label}
    </span>
  );
}

// Submission section inside a task drill-down — real proof state + actions.
function TaskSubmission({
  wk,
  status,
  submission,
}: {
  wk: ProgramWeek;
  status: WeekStatus;
  submission?: MyWeek;
}) {
  const canSubmit = status === "current" || status === "missed" || status === "rejected";
  const hasProof =
    !!submission && (!!submission.proof_url || (submission.proof_files?.length ?? 0) > 0);

  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Your submission
        </p>
        {status === "approved" ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-[oklch(0.45_0.13_160)]">
            <CheckCircle2 className="h-3.5 w-3.5" /> Approved
          </span>
        ) : status === "pending" ? (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" /> In review
          </span>
        ) : null}
      </div>

      {hasProof ? (
        <div className="mt-2 space-y-2">
          {safeHref(submission?.proof_url) && (
            <a
              href={safeHref(submission?.proof_url)}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-navy underline-offset-2 hover:underline"
            >
              <ExternalLink className="h-3.5 w-3.5" /> View submitted link
            </a>
          )}
          {(submission?.proof_files?.length ?? 0) > 0 && (
            <ProofAttachments files={submission!.proof_files} />
          )}
        </div>
      ) : (
        <p className="mt-1.5 text-xs text-muted-foreground">
          {status === "upcoming"
            ? `Opens in Week ${wk.week}.`
            : "No proof submitted yet for this week."}
        </p>
      )}

      {submission?.coach_note && status === "rejected" && (
        <p className="mt-2 rounded-lg bg-[oklch(0.96_0.03_25)] px-3 py-2 text-xs text-[oklch(0.45_0.16_25)]">
          <span className="font-semibold">Coach feedback:</span> {submission.coach_note}
        </p>
      )}

      {canSubmit && (
        <Button
          size="sm"
          className="mt-3 h-9 w-full rounded-lg bg-gradient-navy text-primary-foreground hover:opacity-90 sm:w-auto"
          asChild
        >
          <Link to="/participant/proof">
            <Upload className="h-4 w-4" />
            {status === "rejected" ? "Resubmit proof" : "Submit proof"}
          </Link>
        </Button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Your Journey
// ---------------------------------------------------------------------------
function Journey({
  statusOf,
  weeksDone,
  currentWeek,
}: {
  statusOf: (n: number) => WeekStatus;
  weeksDone: number;
  currentWeek: number;
}) {
  const plan = usePlan();
  const pct = Math.round((weeksDone / plan.length) * 100);
  return (
    <div className="space-y-4">
      <SectionCard>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-foreground">
              Week {currentWeek} of {plan.length}
            </p>
            <p className="text-xs text-muted-foreground">
              {weeksDone} weeks approved · {pct}% complete
            </p>
          </div>
          <span className="text-2xl font-bold text-foreground tabular-nums">{pct}%</span>
        </div>
        <Progress value={pct} className="mt-3 h-2" />
      </SectionCard>

      {/* Colour legend so the week chips are self-explanatory */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-1 text-[11px] text-muted-foreground">
        {[
          { cls: "bg-[#10b981]", label: "Done" },
          { cls: "bg-navy", label: "This week" },
          { cls: "bg-gold/60", label: "In review" },
          { cls: "bg-[oklch(0.7_0.12_70)]", label: "Catch up" },
          { cls: "bg-muted-foreground/40", label: "Locked" },
        ].map((l) => (
          <span key={l.label} className="inline-flex items-center gap-1">
            <span className={cn("h-2.5 w-2.5 rounded-sm", l.cls)} /> {l.label}
          </span>
        ))}
      </div>

      {/* Phases */}
      <div className="grid gap-3 sm:grid-cols-2">
        {plan.phases.map((ph) => {
          const done = ph.weeks.filter((wn) => statusOf(wn) === "approved").length;
          const color = PHASE_COLOR[ph.name];
          return (
            <SectionCard key={ph.name}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full" style={{ background: color }} />
                  <h3 className="text-sm font-semibold text-foreground">{ph.name}</h3>
                </div>
                <span className="text-xs text-muted-foreground">
                  {done}/{ph.weeks.length}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {ph.weeks.map((wn) => {
                  const st = statusOf(wn);
                  const meta = STATUS_META[st];
                  return (
                    <span
                      key={wn}
                      title={`Week ${wn} · ${meta.label}`}
                      className={cn(
                        "inline-flex h-8 w-8 items-center justify-center rounded-lg text-xs font-semibold",
                        st === "approved"
                          ? "bg-[#10b981] text-white"
                          : st === "current"
                            ? "bg-gradient-navy text-primary-foreground ring-2 ring-gold/50"
                            : st === "pending"
                              ? "bg-gold/20 text-[oklch(0.45_0.1_85)]"
                              : st === "rejected"
                                ? "bg-[oklch(0.93_0.06_25)] text-[oklch(0.45_0.16_25)]"
                                : st === "missed"
                                  ? "bg-[oklch(0.95_0.03_70)] text-[oklch(0.47_0.09_70)]"
                                  : "bg-muted text-muted-foreground/60",
                      )}
                    >
                      {wn}
                    </span>
                  );
                })}
              </div>
            </SectionCard>
          );
        })}
      </div>

      {/* Milestones */}
      <SectionCard title="Milestones" subtitle="Goal Setter → Growth Champion">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {VKM_MILESTONES.map((m) => {
            const unlocked = weeksDone >= m.unlockWeek;
            return (
              <div
                key={m.code}
                className={cn(
                  "flex items-center gap-3 rounded-2xl border p-3",
                  unlocked ? "border-gold/40 bg-gold/[0.06]" : "border-border bg-card",
                )}
              >
                <span
                  className={cn(
                    "inline-flex h-10 w-10 items-center justify-center rounded-xl",
                    unlocked ? "bg-gradient-gold text-navy" : "bg-muted text-muted-foreground",
                  )}
                >
                  <Star className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{m.name}</p>
                  <p className="text-xs text-muted-foreground">Week {m.unlockWeek}</p>
                </div>
              </div>
            );
          })}
        </div>
      </SectionCard>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 16-Week Curriculum — progressive disclosure (only current week and earlier)
// ---------------------------------------------------------------------------
function Curriculum({ currentWeek }: { currentWeek: number }) {
  const plan = usePlan();
  const [q, setQ] = useState("");
  const list = plan.weeks.filter((w) => {
    if (!q.trim()) return true;
    const text =
      w.week <= currentWeek ? `${w.topic} ${w.task} ${w.why}` : w.topic;
    return text.toLowerCase().includes(q.toLowerCase());
  });

  const unlockedCount = plan.weeks.filter((w) => w.week <= currentWeek).length;

  return (
    <SectionCard
      title="Curriculum"
      subtitle={`The full VK Mentorship path — ${unlockedCount} of ${plan.length} weeks unlocked`}
      action={
        <Button
          variant="outline"
          size="sm"
          className="rounded-xl"
          onClick={() => exportCsv(plan.weeks, currentWeek)}
        >
          <Download className="h-4 w-4" /> Export
        </Button>
      }
    >
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search topic, task, why…"
          className="h-10 rounded-xl pl-9"
        />
      </div>
      <div className="space-y-2.5">
        {list.map((w) => {
          const unlocked = w.week <= currentWeek;
          return (
            <div
              key={w.week}
              className={cn(
                "rounded-xl border p-3 transition-shadow",
                unlocked
                  ? "border-border bg-card hover:shadow-vkm-float"
                  : "border-border bg-card opacity-55",
              )}
            >
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold",
                    unlocked
                      ? "bg-secondary text-foreground"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {unlocked ? w.week : <Lock className="h-3.5 w-3.5" />}
                </span>
                <p
                  className={cn(
                    "text-sm font-semibold",
                    unlocked ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {w.topic}
                </p>
                {unlocked ? (
                  <>
                    <span
                      className="ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium text-white"
                      style={{ background: PHASE_COLOR[w.phase] }}
                    >
                      {w.phase}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                      {w.mode === "Offline" ? (
                        <MapPin className="h-3 w-3" />
                      ) : (
                        <Video className="h-3 w-3" />
                      )}
                      {w.mode}
                    </span>
                  </>
                ) : (
                  <span className="ml-auto text-[10px] text-muted-foreground">
                    Week {w.week}
                  </span>
                )}
              </div>

              {unlocked ? (
                <>
                  <p className="mt-2 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">Why:</span> {w.why}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">Task:</span> {w.task}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">Proof:</span> {w.proof}
                  </p>
                </>
              ) : (
                <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Lock className="h-3 w-3 shrink-0" />
                  Unlocks when you reach Week {w.week}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}
