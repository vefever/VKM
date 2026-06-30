import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  addDays,
  addWeeks,
  addMonths,
  subMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  parseISO,
  startOfMonth,
  startOfWeek,
  startOfToday,
} from "date-fns";
import {
  CalendarDays,
  CheckCircle2,
  Circle,
  CircleDot,
  Clock,
  AlertCircle,
  MapPin,
  Video,
  Gift,
  ChevronLeft,
  ChevronRight,
  CalendarRange,
  Rows3,
  Flag,
  ArrowRight,
  Loader2,
  type LucideIcon,
} from "lucide-react";
import { PageHeader } from "@/components/vkm/page-header";
import { SectionCard } from "@/components/vkm/section-card";
import { KpiTile } from "@/components/vkm/kpi-tile";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useSwipe } from "@/hooks/use-swipe";
import { useAuth } from "@/hooks/use-auth";
import { useMeetings, type Meeting } from "@/components/meetings/meetings-data";
import { useEnrollment } from "@/components/participant/enrollment-data";
import { useProgramPlan } from "@/components/participant/program-plan-data";
import { ZoomMeetingModal } from "@/components/meetings/zoom-meeting-modal";
import { VKM_PROGRAM, VKM_MILESTONES, type ProgramWeek } from "@/lib/vkm/program";

export const Route = createFileRoute("/_authenticated/participant/calendar")({
  head: () => ({ meta: [{ title: "Calendar · VKM" }] }),
  component: CalendarPage,
});

// ---------------------------------------------------------------------------
// Per-user data: real weekly_progress rows shape the calendar status.
// ---------------------------------------------------------------------------
type ProofStatus = "none" | "pending" | "approved" | "rejected";
type WeekProgress = { attended: boolean; task_done: boolean; proof_status: ProofStatus };

const EMPTY_PROGRESS: WeekProgress = { attended: false, task_done: false, proof_status: "none" };

// ---------------------------------------------------------------------------
// Status model
// ---------------------------------------------------------------------------
type StatusKey = "done" | "review" | "current" | "upcoming" | "missed";

const STATUS: Record<
  StatusKey,
  { label: string; short: string; icon: LucideIcon; chip: string; dot: string; text: string; ring: string }
> = {
  done: {
    label: "Marked as done",
    short: "Done",
    icon: CheckCircle2,
    chip: "bg-[oklch(0.93_0.06_160)] text-[oklch(0.35_0.12_160)]",
    dot: "bg-[oklch(0.6_0.15_160)]",
    text: "text-[oklch(0.45_0.13_160)]",
    ring: "ring-[oklch(0.6_0.15_160)]",
  },
  review: {
    label: "Proof in review",
    short: "In review",
    icon: Clock,
    chip: "bg-[oklch(0.95_0.08_85)] text-[oklch(0.4_0.12_70)]",
    dot: "bg-[oklch(0.7_0.13_80)]",
    text: "text-[oklch(0.45_0.12_70)]",
    ring: "ring-[oklch(0.7_0.13_80)]",
  },
  current: {
    label: "In progress — due this week",
    short: "This week",
    icon: CircleDot,
    chip: "bg-gradient-gold text-navy",
    dot: "bg-gradient-gold",
    text: "text-gold",
    ring: "ring-gold",
  },
  upcoming: {
    label: "Upcoming",
    short: "Upcoming",
    icon: Circle,
    chip: "bg-muted text-foreground/70",
    dot: "bg-muted-foreground/50",
    text: "text-muted-foreground",
    ring: "ring-border",
  },
  missed: {
    label: "Yet to do",
    short: "Yet to do",
    icon: AlertCircle,
    chip: "bg-[oklch(0.93_0.06_25)] text-[oklch(0.4_0.16_25)]",
    dot: "bg-[oklch(0.6_0.18_25)]",
    text: "text-[oklch(0.5_0.18_25)]",
    ring: "ring-[oklch(0.6_0.18_25)]",
  },
};

function statusOf(week: number, p: WeekProgress, currentWeek: number): StatusKey {
  if (p.task_done && p.proof_status === "approved") return "done";
  if (p.proof_status === "pending") return "review";
  if (week === currentWeek) return "current";
  if (week > currentWeek) return "upcoming";
  return "missed";
}

// ---------------------------------------------------------------------------
// Derived schedule type
// ---------------------------------------------------------------------------
type ClassDay = ProgramWeek & {
  date: Date;
  progress: WeekProgress;
  status: StatusKey;
  milestone?: (typeof VKM_MILESTONES)[number];
};

// Real per-user weekly_progress, keyed by week_no.
function useWeeklyProgress() {
  const { user } = useAuth();
  const [map, setMap] = useState<Map<number, WeekProgress>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    let active = true;
    void supabase
      .from("weekly_progress")
      .select("week_no, attended, task_done, proof_status")
      .eq("user_id", user.id)
      .then(({ data }) => {
        if (!active) return;
        const m = new Map<number, WeekProgress>();
        (data ?? []).forEach((r) =>
          m.set(r.week_no, {
            attended: !!r.attended,
            task_done: !!r.task_done,
            proof_status: (r.proof_status as ProofStatus) ?? "none",
          }),
        );
        setMap(m);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user]);

  return { map, loading };
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
function CalendarPage() {
  const enr = useEnrollment();
  const plan = useProgramPlan();
  const { map: progress, loading: progressLoading } = useWeeklyProgress();

  const totalWeeks = plan.length;
  const currentWeek = Math.min(totalWeeks, Math.max(1, enr.currentWeek || 1));

  // Anchor the schedule to the Tuesday of the participant's own start week
  // (their Day 1), so every class date is relative to when THEY started.
  const week1Tuesday = useMemo(() => {
    const base = enr.startedAt ?? startOfToday();
    return addDays(startOfWeek(base, { weekStartsOn: 0 }), 2);
  }, [enr.startedAt]);

  const schedule = useMemo<ClassDay[]>(
    () =>
      plan.weeks.map((w) => {
        const p = progress.get(w.week) ?? EMPTY_PROGRESS;
        return {
          ...w,
          date: addWeeks(week1Tuesday, w.week - 1),
          progress: p,
          status: statusOf(w.week, p, currentWeek),
          milestone: VKM_MILESTONES.find((m) => m.unlockWeek === w.week),
        };
      }),
    [plan.weeks, progress, week1Tuesday, currentWeek],
  );

  const byDate = useMemo(
    () => new Map(schedule.map((c) => [format(c.date, "yyyy-MM-dd"), c])),
    [schedule],
  );

  const doneCount = schedule.filter((c) => c.status === "done").length;
  const attended = schedule.filter((c) => c.progress.attended).length;
  const points = schedule.reduce(
    (sum, c) => sum + (c.progress.attended ? 10 : 0) + (c.status === "done" ? 40 : 0),
    0,
  );

  const [view, setView] = useState<"month" | "agenda">("month");
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(startOfToday()));

  // Keep the selection in sync with the current week once data is ready.
  useEffect(() => {
    setSelectedWeek(currentWeek);
    const cur = schedule[currentWeek - 1];
    if (cur) setViewMonth(startOfMonth(cur.date));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentWeek, schedule.length]);

  const selected = schedule[selectedWeek - 1] ?? schedule[0];

  function selectWeek(week: number) {
    setSelectedWeek(week);
    const c = schedule[week - 1];
    if (c) setViewMonth(startOfMonth(c.date));
  }

  if ((enr.loading || progressLoading || plan.loading) && schedule.length === 0) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!selected) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6"
    >
      <PageHeader
        eyebrow={VKM_PROGRAM.title}
        title="Your Class Calendar"
        description="Every Tuesday with VK, mapped week-by-week. Track what's done and what's still on you."
        icon={CalendarDays}
        actions={
          <>
            <div className="flex items-center rounded-full border border-border bg-card p-0.5">
              <ViewToggle active={view === "month"} onClick={() => setView("month")} icon={CalendarRange} label="Month" />
              <ViewToggle active={view === "agenda"} onClick={() => setView("agenda")} icon={Rows3} label="Agenda" />
            </div>
            <Button variant="outline" className="rounded-full" onClick={() => selectWeek(currentWeek)}>
              Today
            </Button>
          </>
        }
      />

      {/* KPIs — all from real data */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <KpiTile label="Current week" value={`Week ${currentWeek}`} delta={`${selected.phase} phase`} trend="flat" icon={CalendarDays} accent="navy" spotlight={false} />
        <KpiTile label="Weeks done" value={`${doneCount} / ${totalWeeks}`} delta={`${totalWeeks ? Math.round((doneCount / totalWeeks) * 100) : 0}% complete`} trend="up" icon={CheckCircle2} accent="success" spotlight={false} />
        <KpiTile label="Classes attended" value={`${attended}`} delta={`+${attended * 10} pts`} trend="up" icon={Video} accent="gold" spotlight={false} />
        <KpiTile label="Points earned" value={String(points)} delta="attend + proof" trend="up" icon={Flag} accent="navy" spotlight={false} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {view === "month" ? (
          <MonthView
            viewMonth={viewMonth}
            byDate={byDate}
            onPrev={() => setViewMonth((m) => subMonths(m, 1))}
            onNext={() => setViewMonth((m) => addMonths(m, 1))}
            selectedWeek={selectedWeek}
            onSelect={selectWeek}
          />
        ) : (
          <AgendaView schedule={schedule} selectedWeek={selectedWeek} onSelect={selectWeek} />
        )}

        <DetailPanel day={selected} />
      </div>

      <UpcomingMeetings current={selected} currentWeek={currentWeek} />
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Upcoming meetings — the standing Tuesday class plus live 1:1 Zoom calls.
// ---------------------------------------------------------------------------
function UpcomingMeetings({ current, currentWeek }: { current: ClassDay; currentWeek: number }) {
  const { user } = useAuth();
  const { meetings, loading } = useMeetings();
  const [joining, setJoining] = useState<Meeting | null>(null);
  const userName = (user?.user_metadata?.full_name as string) || user?.email?.split("@")[0] || "Guest";

  const now = new Date();
  const zoomCalls = meetings.filter(
    (m) =>
      m.status !== "cancelled" &&
      new Date(parseISO(m.start_time).getTime() + m.duration_min * 60000) > now,
  );

  return (
    <SectionCard title="Upcoming meetings" subtitle="Your live class and the 1:1 Zoom calls your coach scheduled">
      <div className="space-y-2.5">
        <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-navy text-primary-foreground">
            <Video className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">Tuesday Class with VK</p>
            <p className="truncate text-xs text-muted-foreground">Wk {currentWeek}: {current.topic}</p>
          </div>
          <div className="shrink-0 text-right">
            <Badge variant="secondary" className="rounded-full text-[10px]">Class</Badge>
            <p className="mt-1 text-[11px] font-medium text-muted-foreground">Tuesday · 7:00 pm</p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
        ) : zoomCalls.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border bg-muted/30 px-3 py-4 text-center text-xs text-muted-foreground">
            No 1:1 Zoom calls scheduled yet — your coach will set one up.
          </p>
        ) : (
          zoomCalls.map((m) => (
            <div key={m.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#2D8CFF]/15 text-[#2D8CFF]">
                <Video className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">{m.topic}</p>
                <p className="truncate text-xs text-muted-foreground">
                  with {m.hostName} · {format(parseISO(m.start_time), "EEE d MMM, h:mm a")} · {m.duration_min}m
                </p>
              </div>
              <Button size="sm" onClick={() => setJoining(m)} className="shrink-0 rounded-lg bg-[#2D8CFF] text-white hover:bg-[#2D8CFF]/90">
                <Video className="h-4 w-4" /> Join
              </Button>
            </div>
          ))
        )}
      </div>

      <AnimatePresence>
        {joining && (
          <ZoomMeetingModal
            meetingId={joining.id}
            topic={joining.topic}
            userName={userName}
            joinUrl={joining.join_url}
            onClose={() => setJoining(null)}
          />
        )}
      </AnimatePresence>
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// Month grid
// ---------------------------------------------------------------------------
function MonthView({
  viewMonth,
  byDate,
  onPrev,
  onNext,
  selectedWeek,
  onSelect,
}: {
  viewMonth: Date;
  byDate: Map<string, ClassDay>;
  onPrev: () => void;
  onNext: () => void;
  selectedWeek: number;
  onSelect: (week: number) => void;
}) {
  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(viewMonth), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(viewMonth), { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [viewMonth]);

  const swipe = useSwipe({ onLeft: onNext, onRight: onPrev });

  return (
    <SectionCard
      title={format(viewMonth, "MMMM yyyy")}
      subtitle="Class Tuesdays are highlighted"
      action={
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" className="h-10 w-10 rounded-lg" onClick={onPrev}><ChevronLeft className="h-5 w-5" /></Button>
          <Button size="icon" variant="ghost" className="h-10 w-10 rounded-lg" onClick={onNext}><ChevronRight className="h-5 w-5" /></Button>
        </div>
      }
      bodyClassName="p-3 md:p-4"
    >
      <div className="grid grid-cols-7 gap-1 md:gap-2" {...swipe}>
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="pb-1 text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <span className="hidden sm:inline">{d}</span>
            <span className="sm:hidden">{d[0]}</span>
          </div>
        ))}

        {days.map((day) => {
          const cls = byDate.get(format(day, "yyyy-MM-dd"));
          const inMonth = isSameMonth(day, viewMonth);
          const today = isToday(day);
          const isSelected = cls?.week === selectedWeek;
          const s = cls ? STATUS[cls.status] : null;

          return (
            <button
              key={day.toISOString()}
              type="button"
              disabled={!cls}
              onClick={() => cls && onSelect(cls.week)}
              className={cn(
                "relative flex min-h-[58px] flex-col rounded-xl border p-1.5 text-left transition-all md:min-h-[88px] md:p-2",
                cls ? "cursor-pointer border-border bg-card hover:-translate-y-0.5 hover:shadow-vkm" : "border-transparent",
                !inMonth && "opacity-40",
                isSelected && cls && cn("ring-2 ring-offset-1 ring-offset-card", s?.ring),
              )}
            >
              <span className={cn("inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium tabular-nums", today ? "bg-gradient-navy text-primary-foreground shadow-vkm" : "text-foreground/80")}>
                {format(day, "d")}
              </span>

              {cls && s && (
                <span className="mt-1 flex min-w-0 flex-1 flex-col gap-1">
                  <span className={cn("inline-flex items-center gap-1 self-start rounded-md px-1.5 py-0.5 text-[10px] font-semibold leading-none", s.chip)}>
                    W{cls.week}
                    {cls.mode === "Offline" ? <MapPin className="h-2.5 w-2.5" /> : <Video className="h-2.5 w-2.5" />}
                  </span>
                  <span className="hidden truncate text-[11px] leading-tight text-muted-foreground md:block">{cls.topic}</span>
                  <span className="mt-auto flex items-center gap-1">
                    <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} />
                    <span className={cn("hidden text-[10px] font-medium md:inline", s.text)}>{s.short}</span>
                    {cls.milestone && <Gift className="ml-auto h-3 w-3 text-gold" />}
                  </span>
                </span>
              )}
            </button>
          );
        })}
      </div>

      <Legend />
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// Agenda (list) view
// ---------------------------------------------------------------------------
function AgendaView({
  schedule,
  selectedWeek,
  onSelect,
}: {
  schedule: ClassDay[];
  selectedWeek: number;
  onSelect: (week: number) => void;
}) {
  return (
    <SectionCard title={`${schedule.length}-Week Agenda`} subtitle="Foundation → Systems → Sell → Review" bodyClassName="p-0">
      <ul className="divide-y divide-border">
        {schedule.map((c) => {
          const s = STATUS[c.status];
          const Icon = s.icon;
          const active = c.week === selectedWeek;
          return (
            <li key={c.week}>
              <button
                type="button"
                onClick={() => onSelect(c.week)}
                className={cn("flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50", active && "bg-muted/60")}
              >
                <span className="flex w-12 shrink-0 flex-col items-center">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{format(c.date, "MMM")}</span>
                  <span className="text-lg font-semibold leading-none tabular-nums">{format(c.date, "d")}</span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-foreground">W{c.week} · {c.topic}</span>
                    {c.milestone && <Gift className="h-3.5 w-3.5 shrink-0 text-gold" />}
                  </span>
                  <span className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                    {c.mode === "Offline" ? <MapPin className="h-3 w-3" /> : <Video className="h-3 w-3" />}
                    {c.mode} · {c.phase}
                  </span>
                </span>
                <span className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium", s.chip)}>
                  <Icon className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{s.short}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// Detail side panel
// ---------------------------------------------------------------------------
function DetailPanel({ day }: { day: ClassDay }) {
  const s = STATUS[day.status];
  const Icon = s.icon;
  const isDone = day.status === "done";

  return (
    <div className="space-y-4">
      <SectionCard accent bodyClassName="p-0">
        <div className="bg-gradient-navy p-5 text-primary-foreground">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary-foreground/70">Week {day.week} · {day.phase}</span>
            <Badge variant="outline" className="rounded-full border-white/25 text-primary-foreground">
              {day.mode === "Offline" ? <MapPin className="h-3 w-3" /> : <Video className="h-3 w-3" />}
              {day.mode}
            </Badge>
          </div>
          <h3 className="mt-2 text-xl font-semibold leading-tight">{day.topic}</h3>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-primary-foreground/70">
            <CalendarDays className="h-3.5 w-3.5" />
            {format(day.date, "EEEE, d MMMM yyyy")} · 1–2 hrs
          </p>
        </div>

        <div className="p-5">
          <div className={cn("flex items-center gap-3 rounded-xl px-4 py-3", s.chip)}>
            <Icon className="h-5 w-5" />
            <div>
              <p className="text-sm font-semibold leading-tight">{s.label}</p>
              <p className="text-xs opacity-80">
                {isDone
                  ? "Task complete · proof approved · +40 pts"
                  : day.status === "review"
                    ? "Proof submitted — coach is reviewing"
                    : day.status === "current"
                      ? "Submit your proof to earn +40 pts"
                      : day.status === "missed"
                        ? "This task is still open — catch up with your coach"
                        : "Unlocks when this week begins"}
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <CheckRow label="Attended class" ok={day.progress.attended} />
            <CheckRow label="Task done" ok={day.progress.task_done} />
          </div>

          <dl className="mt-4 space-y-3">
            <Field label="Why it matters" value={day.why} />
            <Field label="Your task" value={day.task} />
            <Field label="Proof to submit" value={day.proof} />
          </dl>

          {day.milestone && (
            <div className="mt-4 flex items-start gap-3 rounded-xl border border-gold/40 bg-gradient-to-br from-[oklch(0.97_0.02_85)] to-[oklch(0.95_0.04_75)] p-3">
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-gold text-navy">
                <Gift className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-semibold text-navy">Milestone: {day.milestone.name}</p>
                <p className="text-xs text-foreground/70">{day.milestone.handover}</p>
              </div>
            </div>
          )}

          {isDone ? (
            <Button variant="outline" className="mt-5 w-full rounded-xl" asChild>
              <Link to="/participant/proof">View submitted proof</Link>
            </Button>
          ) : day.status === "upcoming" ? (
            <Button variant="outline" className="mt-5 w-full rounded-xl" disabled>
              Opens {format(day.date, "d MMM")}
            </Button>
          ) : (
            <Button className="mt-5 w-full rounded-xl bg-gradient-navy text-primary-foreground hover:opacity-90" asChild>
              <Link to="/participant/proof">
                Submit proof (+40 pts) <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          )}
        </div>
      </SectionCard>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small pieces
// ---------------------------------------------------------------------------
function ViewToggle({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: LucideIcon; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex min-h-9 items-center gap-1.5 rounded-full px-3.5 text-xs font-medium transition-colors",
        active ? "bg-gradient-navy text-primary-foreground shadow-vkm" : "text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon className="h-3.5 w-3.5" /> {label}
    </button>
  );
}

function CheckRow({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className={cn("flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium", ok ? "border-[oklch(0.85_0.08_160)] bg-[oklch(0.96_0.03_160)] text-[oklch(0.4_0.12_160)]" : "border-border bg-muted/40 text-muted-foreground")}>
      {ok ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
      {label}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-gold">{label}</dt>
      <dd className="mt-0.5 text-sm text-foreground">{value}</dd>
    </div>
  );
}

function Legend() {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border pt-3">
      {(Object.keys(STATUS) as StatusKey[]).map((k) => (
        <span key={k} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className={cn("h-2 w-2 rounded-full", STATUS[k].dot)} />
          {STATUS[k].label}
        </span>
      ))}
    </div>
  );
}
