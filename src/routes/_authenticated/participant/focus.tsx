import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { motion, Reorder } from "framer-motion";
import { format } from "date-fns";
import { toast } from "sonner";
import { useEnrollment } from "@/components/participant/enrollment-data";
import {
  Target,
  CheckCircle2,
  Circle,
  Plus,
  X,
  Play,
  Pause,
  RotateCcw,
  Timer,
  Flame,
  Upload,
  Bot,
  CalendarDays,
  MessageCircle,
  Sparkles,
  ArrowRight,
  ListChecks,
  Trophy,
  GripVertical,
  type LucideIcon,
} from "lucide-react";
import { PageHeader } from "@/components/vkm/page-header";
import { SectionCard } from "@/components/vkm/section-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { weekByNumber, isOfflineWeek, type ProgramWeek } from "@/lib/vkm/program";
import { HABITS, HABIT_CATEGORIES, useHabitTracker } from "@/components/habits/habit-tracker";
import { haptic } from "@/lib/haptics";
import { IconBadge } from "@/components/vkm/icon-badge";
import { useFocusSessions, useDailyActions } from "@/components/participant/focus-data";

export const Route = createFileRoute("/_authenticated/participant/focus")({
  head: () => ({ meta: [{ title: "Today's Focus · VKM" }] }),
  component: FocusPage,
});

const FALLBACK_WEEK = weekByNumber(1)!;
const TODAY_KEY = format(new Date(), "yyyy-MM-dd");

// The participant's CURRENT program week — relative to THEIR own start (not the
// global cohort week), so a fresh starter sees Week 1, not the calendar week.
function useProgramWeek() {
  const { currentWeek } = useEnrollment();
  const weekNo = Math.max(1, currentWeek || 1);
  return { weekNo, w: weekByNumber(weekNo) ?? FALLBACK_WEEK };
}

// ---------------------------------------------------------------------------
// Tiny localStorage-backed state (SSR-safe: hydrates after mount)
// ---------------------------------------------------------------------------
function usePersistentState<T>(key: string, initial: T) {
  const [state, setState] = useState<T>(initial);
  const loaded = useRef(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) setState(JSON.parse(raw) as T);
    } catch {
      /* ignore */
    }
    loaded.current = true;
  }, [key]);
  useEffect(() => {
    if (!loaded.current) return;
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch {
      /* ignore */
    }
  }, [key, state]);
  return [state, setState] as const;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
type Task = { id: string; text: string; done: boolean };

function seedTaskTexts(w: ProgramWeek): string[] {
  return [
    `Apply Week ${w.week} task — ${w.task}`,
    "Run today's daily OMM (1-minute discipline log)",
    "Update the Master Tracker (attendance + proof)",
  ];
}

function FocusPage() {
  const { w } = useProgramWeek();
  const { tasks, setTasks } = useDailyActions(() => seedTaskTexts(w));
  const doneCount = tasks.filter((t) => t.done).length;
  const pct = tasks.length ? Math.round((doneCount / tasks.length) * 100) : 0;

  const habits = useHabitTracker();

  const [sessionsState, addSession] = useFocusSessions();
  const totalFocusMinutes = sessionsState.sessions.reduce(
    (sum: number, s: any) => sum + (s.minutes || 0),
    0,
  );

  const [reflection, setReflection] = usePersistentState("vkm.focus.reflection.v1", {
    date: TODAY_KEY,
    wins: "",
    blockers: "",
  });

  const currentSessions = sessionsState;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="min-w-0 space-y-6"
    >
      <PageHeader
        eyebrow="Participant"
        title="Today's Focus"
        description={`${format(new Date(), "EEEE, d MMMM")} · Week ${w.week} — ${w.topic}. One clear day at a time.`}
        icon={Target}
        actions={
          <>
            <Button variant="outline" className="rounded-full" asChild>
              <Link to="/participant/calendar">
                <CalendarDays className="h-4 w-4" /> Calendar
              </Link>
            </Button>
            <Button className="rounded-full bg-gradient-navy shadow-vkm" asChild>
              <Link to="/participant/proof">
                <Upload className="h-4 w-4" /> Submit proof
              </Link>
            </Button>
          </>
        }
      />

      {/* KPIs */}
      <div className="grid min-w-0 grid-cols-3 gap-2.5 sm:gap-4">
        <FocusStat
          icon={ListChecks}
          accent="bg-[oklch(0.71_0.14_160)] text-white"
          label="To-do"
          value={`${doneCount}/${tasks.length}`}
          sub={pct === 100 ? "All done 🎉" : `${pct}% done`}
        />
        <FocusStat
          icon={Timer}
          accent="bg-gradient-navy text-primary-foreground"
          label="Focus"
          value={String(currentSessions.count)}
          sub={`${totalFocusMinutes}m deep work`}
        />
        <FocusStat
          icon={Flame}
          accent="bg-gradient-gold text-navy"
          label="Habits"
          value={`${habits.todayDone}/${HABITS.length}`}
          sub={`${habits.streak}d streak`}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* Main column — the "do" content: priority hero → today's work → habits */}
        <div className="min-w-0 space-y-6">
          <ThisWeekHero />
          <TodaysWork
            sessions={currentSessions}
            addSession={addSession}
            tasks={tasks}
            setTasks={setTasks}
            doneCount={doneCount}
            pct={pct}
          />
          <DailyHabitsCard t={habits} />
        </div>

        {/* Right rail — light, glanceable context */}
        <div className="min-w-0 space-y-6">
          <AiNudge />
          <QuickAccess />
        </div>
      </div>

      {/* New: Daily Reflection */}
      <DailyReflection reflection={reflection} setReflection={setReflection} pct={pct} />
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// This Week hero
// ---------------------------------------------------------------------------
// Compact stat card for the Focus header row — mobile-friendly (short label,
// no-wrap value, icon top-right) so it never truncates like the old KpiTile did.
function FocusStat({
  icon: Icon,
  accent,
  label,
  value,
  sub,
}: {
  icon: LucideIcon;
  accent: string;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-border bg-card p-3 shadow-vkm sm:p-4">
      <div className="flex items-start justify-between gap-1.5">
        <span className="text-[10px] font-semibold uppercase leading-tight tracking-wide text-muted-foreground sm:text-[11px]">
          {label}
        </span>
        <span
          className={cn(
            "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg sm:h-8 sm:w-8",
            accent,
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-1.5 whitespace-nowrap text-xl font-bold tracking-tight text-foreground tabular-nums sm:text-2xl">
        {value}
      </p>
      <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{sub}</p>
    </div>
  );
}

function ThisWeekHero() {
  const { weekNo, w } = useProgramWeek();
  const pct = Math.round(((weekNo - 1) / 16) * 100);
  return (
    <div className="overflow-hidden rounded-3xl bg-gradient-navy p-6 text-primary-foreground shadow-vkm-float md:p-7">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary-foreground/70">
            Your #1 priority · Week {w.week} · {w.mode}
            {isOfflineWeek(w.week) ? " — coach visits in person" : ""}
          </p>
          <h2 className="mt-2 text-2xl font-semibold leading-tight">{w.task}</h2>
          <p className="mt-2 max-w-xl text-sm text-primary-foreground/75">
            <span className="font-medium text-primary-foreground">Why:</span> {w.why}
          </p>
          <p className="mt-1 max-w-xl text-sm text-primary-foreground/75">
            <span className="font-medium text-primary-foreground">Proof:</span> {w.proof}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button className="rounded-xl bg-gradient-gold text-navy hover:opacity-90" asChild>
              <Link to="/participant/proof">
                Submit proof (+40 pts) <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button
              variant="outline"
              className="rounded-xl border-white/25 bg-white/5 text-primary-foreground hover:bg-white/10"
              asChild
            >
              <Link to="/participant/advisor">
                <Bot className="h-4 w-4" /> Ask AI Advisor
              </Link>
            </Button>
          </div>
        </div>
        <div className="relative hidden shrink-0 sm:block">
          <svg viewBox="0 0 120 120" className="h-24 w-24 -rotate-90">
            <circle
              cx="60"
              cy="60"
              r="50"
              fill="none"
              stroke="oklch(1 0 0 / 0.15)"
              strokeWidth="10"
            />
            <motion.circle
              cx="60"
              cy="60"
              r="50"
              fill="none"
              stroke="oklch(0.78 0.13 85)"
              strokeWidth="10"
              strokeLinecap="round"
              initial={{ strokeDasharray: `0 ${2 * Math.PI * 50}` }}
              animate={{ strokeDasharray: `${(pct / 100) * 2 * Math.PI * 50} ${2 * Math.PI * 50}` }}
              transition={{ duration: 1, ease: "easeOut" }}
            />
          </svg>
          <span className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xl font-semibold">{pct}%</span>
            <span className="text-[10px] text-primary-foreground/60">journey</span>
          </span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Today's Work — one panel that fuses the focus sprint + the Top 3 actions
// ---------------------------------------------------------------------------
function TodaysWork({
  sessions,
  addSession,
  tasks,
  setTasks,
  doneCount,
  pct,
}: {
  sessions: { count: number; sessions: any[] };
  addSession: (minutes: number, note?: string) => void;
  tasks: Task[];
  setTasks: (u: (t: Task[]) => Task[]) => void;
  doneCount: number;
  pct: number;
}) {
  return (
    <SectionCard title="Today's Work" subtitle="Start a focus sprint, then close your priorities">
      <div className="grid gap-6 lg:grid-cols-[224px_minmax(0,1fr)]">
        <div className="flex justify-center border-b border-border pb-6 lg:block lg:border-b-0 lg:border-r lg:pb-0 lg:pr-6">
          <FocusTimer sessions={sessions} addSession={addSession} />
        </div>
        <div className="min-w-0">
          <TodayChecklist tasks={tasks} setTasks={setTasks} doneCount={doneCount} pct={pct} />
        </div>
      </div>
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// Today's editable checklist (used inside TodaysWork card)
// ---------------------------------------------------------------------------
function TodayChecklist({
  tasks,
  setTasks,
  doneCount,
  pct,
}: {
  tasks: Task[];
  setTasks: (u: (t: Task[]) => Task[]) => void;
  doneCount: number;
  pct: number;
}) {
  const [draft, setDraft] = useState("");
  const { w } = useProgramWeek();

  const suggestions = [
    `Apply Week ${w.week} task`,
    "Daily OMM + discipline log",
    "Update Master Tracker + attendance",
    "Outreach / lead generation block",
    "Review AI Advisor insights",
  ];

  function addSuggestion(text: string) {
    if (tasks.some((t) => t.text.toLowerCase().includes(text.toLowerCase().slice(0, 10)))) return;
    setTasks((t) => [...t, { id: `t-${Date.now()}`, text, done: false }]);
  }

  function add() {
    const text = draft.trim();
    if (!text) return;
    setTasks((t) => [...t, { id: `t-${Date.now()}`, text, done: false }]);
    setDraft("");
  }
  function toggle(id: string) {
    setTasks((t) => t.map((x) => (x.id === id ? { ...x, done: !x.done } : x)));
  }
  function remove(id: string) {
    setTasks((t) => t.filter((x) => x.id !== id));
  }

  return (
    <>
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-foreground">Focus actions today</p>
          <p className="text-xs text-muted-foreground">
            {doneCount} of {tasks.length} done
          </p>
        </div>
        <Badge variant="outline" className="rounded-full">
          {pct}%
        </Badge>
      </div>
      <Progress value={pct} className="mb-4 h-1.5" />

      <Reorder.Group
        axis="y"
        values={tasks}
        onReorder={(next) => setTasks(() => next)}
        className="space-y-2"
      >
        {tasks.map((t) => (
          <Reorder.Item
            key={t.id}
            value={t}
            whileDrag={{ scale: 1.03, boxShadow: "0 10px 28px oklch(0 0 0 / 0.14)" }}
            className="group flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-border bg-card px-3 py-2.5 transition-colors hover:bg-muted/40 sm:flex-nowrap"
          >
            <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-muted-foreground/40 active:cursor-grabbing" />
            <button type="button" onClick={() => toggle(t.id)} className="shrink-0">
              {t.done ? (
                <CheckCircle2 className="h-5 w-5 text-[oklch(0.55_0.14_160)]" />
              ) : (
                <Circle className="h-5 w-5 text-muted-foreground transition-colors group-hover:text-foreground" />
              )}
            </button>
            <span
              className={cn(
                "min-w-0 flex-1 basis-full text-sm sm:basis-auto",
                t.done ? "text-muted-foreground line-through" : "text-foreground",
              )}
            >
              {t.text}
            </span>
            <span
              className={cn(
                "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium",
                t.done
                  ? "bg-[oklch(0.93_0.06_160)] text-[oklch(0.35_0.12_160)]"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {t.done ? "Marked as done" : "Yet to do"}
            </span>
            <button
              type="button"
              onClick={() => remove(t.id)}
              className="shrink-0 rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
            >
              <X className="h-4 w-4" />
            </button>
          </Reorder.Item>
        ))}
      </Reorder.Group>

      {tasks.length === 0 && (
        <p className="rounded-xl border border-dashed border-border py-6 text-center text-sm text-muted-foreground">
          Your day is wide open — add 1–3 outcomes you'll ship today.
        </p>
      )}

      {/* Quick suggestions for common focus items */}
      <div className="mt-3">
        <div className="mb-1.5 text-[10px] font-medium text-muted-foreground">Quick add:</div>
        <div className="mb-2 flex flex-wrap gap-1.5">
          {[
            `Apply Week ${w.week} task`,
            "Daily OMM discipline log",
            "Update Master Tracker",
            "Outreach / leads block",
          ].map((s, i) => (
            <button
              key={i}
              onClick={() => {
                if (!tasks.some((t) => t.text.includes(s.slice(0, 12)))) {
                  setTasks((t) => [...t, { id: `t-${Date.now()}`, text: s, done: false }]);
                }
              }}
              className="rounded-full border border-border bg-card px-2.5 py-0.5 text-[10px] hover:bg-muted"
            >
              + {s}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="Custom action…"
            className="h-10 min-w-0 flex-1 rounded-xl"
          />
          <Button
            onClick={add}
            className="h-10 shrink-0 rounded-xl bg-gradient-navy text-primary-foreground hover:opacity-90"
          >
            <Plus className="h-4 w-4" /> Add
          </Button>
        </div>
      </div>

      {pct === 100 && tasks.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-3 flex items-center gap-2 rounded-xl bg-gradient-gold/80 px-4 py-2.5 text-sm font-medium text-navy"
        >
          <Sparkles className="h-4 w-4" /> All actions done — that's a winning day. Log your proof
          to lock in points.
        </motion.div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Daily habits — live, synced with the Daily Habits tracker (Supabase realtime)
// ---------------------------------------------------------------------------
function DailyHabitsCard({ t }: { t: ReturnType<typeof useHabitTracker> }) {
  return (
    <SectionCard
      title="Daily habits"
      subtitle={`${t.todayDone}/${HABITS.length} done today · tap to log`}
      action={
        <Button size="sm" variant="ghost" className="rounded-full" asChild>
          <Link to="/participant/habits">Open tracker</Link>
        </Button>
      }
    >
      <div className="space-y-3.5">
        {HABIT_CATEGORIES.map((cat) => {
          const items = HABITS.filter((h) => h.category === cat);
          const done = items.filter((h) => t.isDone(t.programDay, h.id)).length;
          return (
            <div key={cat}>
              <div className="mb-1.5 flex items-center gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {cat}
                </span>
                <span className="text-[11px] tabular-nums text-muted-foreground">
                  {done}/{items.length}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 [&_button]:w-full">
                {items.map((h) => {
                  const Icon = h.icon;
                  const isDone = t.isDone(t.programDay, h.id);
                  return (
                    <button
                      key={h.id}
                      type="button"
                      title={`${h.name} · ${t.habitCount(h.id)}/${t.config.totalDays} days`}
                      onClick={() =>
                        h.id === "water"
                          ? toast(
                              "“Drink Water” completes from the Hydration tracker — open it to log glasses.",
                            )
                          : t.toggleToday(h.id)
                      }
                      className={cn(
                        "app-press flex flex-col items-center gap-1 rounded-xl border p-2 text-center transition-all",
                        isDone
                          ? "border-transparent text-white shadow-vkm"
                          : "border-border bg-card hover:bg-muted/40",
                      )}
                      style={
                        isDone
                          ? { background: `linear-gradient(135deg, ${h.from}, ${h.to})` }
                          : undefined
                      }
                    >
                      <Icon
                        className={cn("h-4 w-4", isDone ? "text-white" : "text-muted-foreground")}
                      />
                      <span
                        className={cn(
                          "line-clamp-1 text-[10px] font-medium leading-tight",
                          isDone ? "text-white" : "text-foreground",
                        )}
                      >
                        {h.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// Focus timer (Pomodoro) — sessions persist via useFocusSessions (DB-backed).
// ---------------------------------------------------------------------------
const PRESETS = [15, 25, 50];

type Sessions = { date: string; count: number };

function FocusTimer({
  sessions,
  addSession,
}: {
  sessions: { count: number; sessions: any[] };
  addSession: (minutes: number, note?: string) => void;
}) {
  const [duration, setDuration] = useState(25 * 60);
  const [left, setLeft] = useState(25 * 60);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setLeft((l) => Math.max(0, l - 1)), 1000);
    return () => clearInterval(id);
  }, [running]);

  const [pendingNote, setPendingNote] = useState("");

  useEffect(() => {
    if (left === 0 && running) {
      setRunning(false);
      haptic("success");
      const minutes = Math.round(duration / 60);
      addSession(minutes, pendingNote.trim() || undefined);
      setLeft(duration);
      setPendingNote("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left]);

  function pick(mins: number) {
    setRunning(false);
    setDuration(mins * 60);
    setLeft(mins * 60);
  }
  function reset() {
    setRunning(false);
    setLeft(duration);
  }

  const pct = duration ? ((duration - left) / duration) * 100 : 0;
  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");

  const inner = (
    <div className="flex flex-col items-center">
      <div className="relative h-40 w-40">
        <svg viewBox="0 0 120 120" className="h-40 w-40 -rotate-90">
          <circle
            cx="60"
            cy="60"
            r="52"
            fill="none"
            stroke="oklch(0.92 0.01 250)"
            strokeWidth="9"
          />
          <circle
            cx="60"
            cy="60"
            r="52"
            fill="none"
            stroke={running ? "oklch(0.78 0.13 85)" : "oklch(0.45 0.08 250)"}
            strokeWidth="9"
            strokeLinecap="round"
            strokeDasharray={`${(pct / 100) * 2 * Math.PI * 52} ${2 * Math.PI * 52}`}
            className="transition-all duration-500"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-4xl font-semibold tabular-nums tracking-tight text-foreground">
            {mm}:{ss}
          </span>
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
            {running ? "in focus" : "ready"}
          </span>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <Button
          onClick={() => {
            if (!running) haptic("medium");
            setRunning((r) => !r);
          }}
          className="app-press h-11 w-32 rounded-xl bg-gradient-navy text-primary-foreground hover:opacity-90"
        >
          {running ? (
            <>
              <Pause className="h-4 w-4" /> Pause
            </>
          ) : (
            <>
              <Play className="h-4 w-4" /> Start
            </>
          )}
        </Button>
        <Button variant="outline" size="icon" className="h-11 w-11 rounded-xl" onClick={reset}>
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>

      <div className="mt-3 flex items-center gap-2">
        {PRESETS.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => pick(m)}
            className={cn(
              "app-press inline-flex h-9 min-w-[44px] items-center justify-center rounded-full px-4 text-xs font-medium transition-colors",
              duration === m * 60
                ? "bg-gradient-navy text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground",
            )}
          >
            {m}m
          </button>
        ))}
      </div>

      <div className="mt-3 w-full max-w-[220px]">
        <Input
          value={pendingNote}
          onChange={(e) => setPendingNote(e.target.value)}
          placeholder="Quick note for this session (optional)"
          className="h-8 text-xs rounded-xl"
        />
      </div>

      <p className="mt-2 text-xs text-muted-foreground">
        {sessions.count} sessions ·{" "}
        {Math.round(sessions.sessions.reduce((sum: number, s: any) => sum + (s.minutes || 0), 0))}m
        total today
      </p>

      {/* Recent focus notes */}
      {sessions.sessions.length > 0 && (
        <div className="mt-3 w-full max-w-[260px] text-left text-[10px]">
          <div className="mb-1 font-medium text-muted-foreground">Recent sessions</div>
          {[...sessions.sessions]
            .reverse()
            .slice(0, 2)
            .map((s: any, idx: number) => (
              <div key={idx} className="truncate text-muted-foreground/80">
                {s.minutes}m {s.note ? `— ${s.note}` : ""}
              </div>
            ))}
        </div>
      )}
    </div>
  );

  return inner;
}

// ---------------------------------------------------------------------------
// Quick access launcher
// ---------------------------------------------------------------------------
const QUICK: { to: string; label: string; icon: LucideIcon; accent: string }[] = [
  {
    to: "/participant/proof",
    label: "Submit proof",
    icon: Upload,
    accent: "bg-gradient-navy text-primary-foreground",
  },
  {
    to: "/participant/advisor",
    label: "AI Advisor",
    icon: Bot,
    accent: "bg-gradient-gold text-navy",
  },
  {
    to: "/participant/omm",
    label: "Log OMM",
    icon: Flame,
    accent: "bg-[oklch(0.7_0.13_150)] text-white",
  },
  {
    to: "/participant/calendar",
    label: "Calendar",
    icon: CalendarDays,
    accent: "bg-[oklch(0.5_0.08_250)] text-white",
  },
  {
    to: "/participant/weekly-tasks",
    label: "Weekly tasks",
    icon: ListChecks,
    accent: "bg-[oklch(0.62_0.12_300)] text-white",
  },
  {
    to: "/participant/chat",
    label: "Message coach",
    icon: MessageCircle,
    accent: "bg-[oklch(0.65_0.13_200)] text-white",
  },
];

function QuickAccess() {
  return (
    <SectionCard title="Quick access" subtitle="Jump straight to it">
      <div className="grid grid-cols-3 gap-2.5">
        {QUICK.map((q) => {
          const Icon = q.icon;
          return (
            <Link
              key={q.to}
              to={q.to}
              className="group flex flex-col items-center gap-2 rounded-2xl border border-border bg-card p-3 text-center transition-all hover:-translate-y-0.5 hover:shadow-vkm"
            >
              <span
                className={cn(
                  "inline-flex h-10 w-10 items-center justify-center rounded-xl shadow-vkm transition-transform group-hover:scale-105",
                  q.accent,
                )}
              >
                <Icon className="h-5 w-5" />
              </span>
              <span className="text-[11px] font-medium leading-tight text-foreground">
                {q.label}
              </span>
            </Link>
          );
        })}
      </div>
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// AI nudge
// ---------------------------------------------------------------------------
function AiNudge() {
  const { w } = useProgramWeek();
  return (
    <SectionCard
      title="AI Business Advisor"
      subtitle="Today's nudge"
      action={
        <Button size="sm" variant="ghost" className="rounded-full" asChild>
          <Link to="/participant/advisor">Open</Link>
        </Button>
      }
    >
      <div className="rounded-2xl bg-secondary p-4">
        <div className="flex items-start gap-3">
          <IconBadge icon={Bot} accent="gold" />
          <p className="text-sm text-muted-foreground">
            You're on Week {w.week} ({w.topic}). Ask your advisor to{" "}
            <span className="font-medium text-foreground">
              pressure-test your 5 lead stages and 3-day follow-up cadence
            </span>{" "}
            before the offline visit.
          </p>
        </div>
      </div>
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// Daily Reflection - new feature for end-of-day close
// ---------------------------------------------------------------------------
function DailyReflection({
  reflection,
  setReflection,
  pct,
}: {
  reflection: { date: string; wins: string; blockers: string };
  setReflection: React.Dispatch<React.SetStateAction<any>>;
  pct: number;
}) {
  const isToday = reflection.date === TODAY_KEY;
  const [localWins, setLocalWins] = useState(isToday ? reflection.wins : "");
  const [localBlockers, setLocalBlockers] = useState(isToday ? reflection.blockers : "");

  useEffect(() => {
    if (reflection.date !== TODAY_KEY) {
      setLocalWins("");
      setLocalBlockers("");
    }
  }, [reflection.date]);

  // Live save reflection
  useEffect(() => {
    if (
      localWins !== (isToday ? reflection.wins : "") ||
      localBlockers !== (isToday ? reflection.blockers : "")
    ) {
      const t = setTimeout(() => {
        setReflection((prev: any) => ({
          ...prev,
          date: TODAY_KEY,
          wins: localWins,
          blockers: localBlockers,
        }));
      }, 400);
      return () => clearTimeout(t);
    }
  }, [localWins, localBlockers]);

  const save = () => {
    setReflection((prev: any) => ({
      ...prev,
      date: TODAY_KEY,
      wins: localWins,
      blockers: localBlockers,
    }));
    toast.success("Reflection saved");
  };

  return (
    <SectionCard
      title="Close the Loop"
      subtitle="Quick end-of-day reflection (saves automatically)"
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            3 Wins today
          </label>
          <textarea
            value={localWins}
            onChange={(e) => setLocalWins(e.target.value)}
            onBlur={save}
            placeholder="What moved the needle?"
            className="mt-1.5 w-full min-h-[72px] rounded-xl border border-input bg-background p-3 text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            1 Lesson or Blocker
          </label>
          <textarea
            value={localBlockers}
            onChange={(e) => setLocalBlockers(e.target.value)}
            onBlur={save}
            placeholder="What slowed you down?"
            className="mt-1.5 w-full min-h-[72px] rounded-xl border border-input bg-background p-3 text-sm"
          />
        </div>
      </div>

      {pct === 100 && (
        <div className="mt-4 rounded-xl bg-gradient-gold/90 px-4 py-3 text-sm font-medium text-navy">
          Strong day. Consider submitting your proof to bank the points.
        </div>
      )}
    </SectionCard>
  );
}
