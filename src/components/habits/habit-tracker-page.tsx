import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { toast } from "sonner";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, XAxis, Tooltip } from "recharts";
import {
  CalendarDays,
  Trophy,
  Flame,
  Check,
  CheckCircle2,
  ChevronDown,
  Upload,
  Footprints,
  Loader2,
  Play,
  Square,
  Apple,
  Activity,
  X,
} from "lucide-react";
import { SectionCard } from "@/components/vkm/section-card";
import { AnimatedCounter } from "@/components/vkm/animated-counter";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useEnrollment } from "@/components/participant/enrollment-data";
import {
  HABITS,
  HABIT_CATEGORIES,
  START_DATE,
  endDate,
  dateForDay,
  useHabitTracker,
  useDailySteps,
  useDailyWater,
  type TrackerConfig,
  type HabitCategory,
  type HabitDef,
} from "@/components/habits/habit-tracker";
import { HabitGrid } from "@/components/habits/habit-grid";
import { WaterTracker } from "@/components/habits/water-tracker";
import { usePedometer } from "@/components/habits/use-pedometer";
import { uploadAttachment } from "@/components/chat/chat-data";
import {
  LocalPreviewTile,
  ProofAttachments,
  FilePickerZone,
} from "@/components/participant/proof-attachments";
import { haptic } from "@/lib/haptics";
import { flyPoints } from "@/lib/fly-points";

export function HabitTrackerPage() {
  const t = useHabitTracker();
  const steps = useDailySteps(t.programDay, t.config.stepGoal);
  const ped = usePedometer(steps.addStep);
  const water = useDailyWater(t.programDay);
  const [proofHabit, setProofHabit] = useState<HabitDef | null>(null);

  const walkingHabit = HABITS.find((h) => h.id === "walking");

  // "water" completes only from the Hydration tracker (anti-fraud); every other
  // habit opens the proof sheet — a file is mandatory to mark it done.
  function openHabit(h: HabitDef) {
    if (h.id === "water") {
      toast("“Drink Water” completes from the Hydration tracker — log your glasses above.");
      return;
    }
    setProofHabit(h);
  }

  // Auto-complete habits when their tracker goal is met.
  const walkAuto = useRef(false);
  const waterAuto = useRef(false);
  useEffect(() => {
    if (!walkAuto.current && steps.steps >= steps.goal && !t.isDone(t.programDay, "walking")) {
      walkAuto.current = true;
      t.toggleToday("walking");
    }
  }, [steps.steps, steps.goal, t]);
  useEffect(() => {
    if (!waterAuto.current && water.ml >= water.goalMl && !t.isDone(t.programDay, "water")) {
      waterAuto.current = true;
      t.toggleToday("water");
    }
  }, [water.ml, water.goalMl, t]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-5"
    >
      <Header config={t.config} syncing={t.loading} />
      <InfoBanner config={t.config} />

      {/* One summary — today's score, streak, and 16-week program progress. */}
      <SummaryHeader t={t} />

      {/* Today's action zone — Steps + Hydration side-by-side on desktop. */}
      <div className="grid gap-5 lg:grid-cols-2">
        <StepsCard
          steps={steps.steps}
          goal={steps.goal}
          ped={ped}
          onAddSteps={steps.addStep}
          onSetSteps={steps.setSteps}
          walkingDone={t.isDone(t.programDay, "walking")}
          onUploadProof={() => walkingHabit && openHabit(walkingHabit)}
        />
        <WaterTracker
          ml={water.ml}
          goalMl={water.goalMl}
          lastAddAt={water.lastAddAt}
          cooldownMs={water.cooldownMs}
          addGlass={water.addGlass}
          removeGlass={water.removeGlass}
        />
      </div>

      {/* Single habit-completion surface (grouped Body / Mind / Business). */}
      <SectionCard
        title="Today's habits"
        subtitle="Tap a habit, attach proof, mark it done"
        action={
          <span className="text-xs text-muted-foreground">
            {t.todayDone} / {HABITS.length} done
          </span>
        }
      >
        <HabitTiles t={t} onOpen={openHabit} />
      </SectionCard>

      {/* Reference material — collapsed by default to keep the page short. */}
      <AnalyticsZone t={t} />

      <AnimatePresence>
        {proofHabit && (
          <HabitProofModal habit={proofHabit} t={t} onClose={() => setProofHabit(null)} />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

type Tracker = ReturnType<typeof useHabitTracker>;
type Ped = ReturnType<typeof usePedometer>;

// ---------------------------------------------------------------------------
function Header({ config, syncing }: { config: TrackerConfig; syncing: boolean }) {
  const { currentWeek } = useEnrollment();
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-gold">
          Week {Math.max(1, currentWeek)}
          {syncing && (
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> syncing…
            </span>
          )}
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
          Lifestyle Changes &amp; OMM
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Daily discipline, habits, clarity ({config.weeks} weeks)
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {format(START_DATE, "MMM d")} — {format(endDate(config.totalDays), "MMM d")}
        </p>
      </div>
      <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-[#8b5cf6]/30 bg-[#8b5cf6]/10 px-3 py-1 text-xs font-semibold text-[#7c3aed]">
        Foundation · Online
      </span>
    </div>
  );
}

function InfoBanner({ config }: { config: TrackerConfig }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-gold/30 bg-gold/[0.08] px-4 py-2.5 text-sm text-foreground">
      <CalendarDays className="h-4 w-4 shrink-0 text-[oklch(0.5_0.11_80)]" />
      <span>
        Daily habits — tap a tile, attach proof, mark done.{" "}
        <span className="font-medium">{config.pointsPerTick} pts</span> per tick · {config.weeks}{" "}
        weeks total.
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Steps card (live in-app pedometer)
// ---------------------------------------------------------------------------
function StepsCard({
  steps,
  goal,
  ped,
  onAddSteps,
  onSetSteps,
  walkingDone,
  onUploadProof,
}: {
  steps: number;
  goal: number;
  ped: Ped;
  onAddSteps: (count?: number) => void;
  onSetSteps?: (value: number) => void;
  walkingDone: boolean;
  onUploadProof: () => void;
}) {
  const pct = Math.min(Math.round((steps / goal) * 100), 100);
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-vkm">
      <div className="flex items-center gap-5">
        <div className="relative h-[112px] w-[112px] shrink-0">
          <Ring value={steps} max={goal} color="#10b981">
            <span className="text-2xl font-bold tabular-nums text-foreground">{steps}</span>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              steps
            </span>
          </Ring>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#10b981] text-white">
              <Footprints className="h-4 w-4" />
            </span>
            <h3 className="text-base font-semibold text-foreground">Steps today</h3>
            {ped.status === "tracking" && (
              <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-[#10b981]/15 px-2 py-0.5 text-[10px] font-semibold text-[#0d7a55]">
                <span className="h-1.5 w-1.5 animate-glow-pulse rounded-full bg-[#10b981]" /> Live
              </span>
            )}
            {ped.status === "calibrating" && (
              <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-[oklch(0.95_0.08_85)] px-2 py-0.5 text-[10px] font-semibold text-[oklch(0.45_0.12_70)]">
                <span className="h-1.5 w-1.5 animate-glow-pulse rounded-full bg-[oklch(0.7_0.13_80)]" />{" "}
                Calibrating…
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {ped.status === "calibrating"
              ? "Walk a few steps so we can lock onto your rhythm…"
              : `${pct}% of your ${goal.toLocaleString()} goal · auto-completes Walking 20 Min.`}
          </p>

          <div className="mt-3 flex items-center gap-2">
            {ped.status === "tracking" || ped.status === "calibrating" ? (
              <Button variant="outline" className="min-h-11 rounded-xl" onClick={ped.stop}>
                <Square className="h-4 w-4" /> Stop tracking
              </Button>
            ) : ped.status === "unsupported" ? (
              <p className="text-xs text-muted-foreground">
                Step sensor not available. Use manual correction below.
              </p>
            ) : (
              <div className="space-y-1.5">
                <Button
                  className="min-h-11 rounded-xl bg-[#10b981] text-white hover:opacity-90"
                  onClick={ped.start}
                >
                  <Play className="h-4 w-4" /> Enable live step tracking
                </Button>
                {ped.status === "denied" && (
                  <p className="text-xs text-destructive">
                    Motion access denied — allow in browser settings for accurate tracking.
                  </p>
                )}
              </div>
            )}

            {/* Manual correction — critical for PWA accuracy */}
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                className="min-h-11 rounded-xl"
                onClick={() => {
                  onAddSteps(100);
                  toast.success("+100 steps");
                }}
              >
                +100
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="min-h-11 rounded-xl text-xs"
                onClick={() => {
                  if (onSetSteps) onSetSteps(Math.max(0, Math.floor(steps * 0.75)));
                  toast("Corrected");
                }}
              >
                -25%
              </Button>
            </div>
          </div>
        </div>
      </div>
      {/* Walking task — synced to the step goal */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-secondary/40 px-3 py-2.5">
        <div className="flex items-center gap-2 text-sm">
          {walkingDone ? (
            <>
              <CheckCircle2 className="h-4 w-4 shrink-0 text-[#10b981]" />
              <span className="font-medium text-foreground">“Walking 20 Min” completed today</span>
            </>
          ) : (
            <>
              <Footprints className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="text-muted-foreground">
                Hit {goal.toLocaleString()} steps to auto-complete “Walking 20 Min”.
              </span>
            </>
          )}
        </div>
        {!walkingDone && (
          <Button
            size="sm"
            variant="outline"
            className="rounded-lg text-xs"
            onClick={onUploadProof}
          >
            <Upload className="h-4 w-4" /> Walked elsewhere? Upload proof
          </Button>
        )}
      </div>

      {/* Connect health apps */}
      <div className="mt-3 border-t border-border pt-3">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Connect a health app
        </p>
        <div className="flex flex-wrap gap-2">
          <HealthConnectButton
            icon={<Apple className="h-4 w-4" />}
            label="Apple Health"
            onClick={() =>
              toast("Apple Health sync is coming via the VKM mobile app", {
                description: "On the web, your live in-app step tracker is the active source.",
              })
            }
          />
          <HealthConnectButton
            icon={<Activity className="h-4 w-4" />}
            label="Google Fit"
            onClick={() =>
              toast("Google Fit sync is coming via the VKM mobile app", {
                description: "Google retired the Fit web API; in-app step tracking works now.",
              })
            }
          />
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Live tracking (PWA) uses advanced accelerometer analysis (peak+valley + cadence filter)
          similar to fitness apps. Best results when phone is in pocket or armband. Use +50 for
          corrections. Data syncs live to coach.
        </p>
      </div>
    </div>
  );
}

function HealthConnectButton({
  icon,
  label,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary/60"
    >
      {icon} {label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Rings
// ---------------------------------------------------------------------------
function Ring({
  value,
  max,
  color,
  children,
  dot,
  boxClassName = "h-[120px] w-[120px]",
}: {
  value: number;
  max: number;
  color: string;
  children: ReactNode;
  dot?: boolean;
  boxClassName?: string;
}) {
  const size = 120;
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = max > 0 ? Math.min(value / max, 1) : 0;
  const angle = -90 + pct * 360;
  const rad = (angle * Math.PI) / 180;
  const dx = size / 2 + r * Math.cos(rad);
  const dy = size / 2 + r * Math.sin(rad);
  return (
    <div className={cn("relative", boxClassName)}>
      <svg viewBox={`0 0 ${size} ${size}`} className="h-full w-full -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="oklch(0.92 0.01 250)"
          strokeWidth={stroke}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c - pct * c }}
          transition={{ duration: 1, ease: "easeOut" }}
        />
        {dot && pct > 0 && <circle cx={dx} cy={dy} r={6} fill={color} className="rotate-90" />}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        {children}
      </div>
    </div>
  );
}

function SummaryHeader({ t }: { t: Tracker }) {
  const progressPct = Math.round((t.completedDays / t.config.totalDays) * 100);
  const box = "h-[88px] w-[88px] sm:h-[112px] sm:w-[112px]";
  return (
    <SectionCard
      title="Today"
      action={
        <span className="text-xs text-muted-foreground">
          {format(dateForDay(t.programDay), "EEE, MMM d")}
        </span>
      }
    >
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <RingStat label="Done today">
          <Ring
            value={t.todayDone}
            max={HABITS.length}
            color="oklch(0.71 0.14 160)"
            boxClassName={box}
          >
            <AnimatedCounter
              value={`${t.todayDone}/${HABITS.length}`}
              className="text-lg font-bold text-foreground sm:text-2xl"
            />
          </Ring>
        </RingStat>
        <RingStat label="Streak">
          <Ring value={t.streak} max={30} color="oklch(0.78 0.13 85)" boxClassName={box}>
            <AnimatedCounter
              value={t.streak}
              className="text-lg font-bold text-foreground sm:text-2xl"
            />
            <span className="text-[10px] text-muted-foreground sm:text-xs">days</span>
          </Ring>
        </RingStat>
        <RingStat label="Program">
          <Ring
            value={t.completedDays}
            max={t.config.totalDays}
            color="oklch(0.5 0.18 300)"
            dot
            boxClassName={box}
          >
            <AnimatedCounter
              value={`${progressPct}%`}
              className="text-lg font-bold text-foreground sm:text-2xl"
            />
            <span className="text-[10px] text-muted-foreground sm:text-xs">
              {t.config.weeks} wks
            </span>
          </Ring>
        </RingStat>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-border pt-3 text-sm font-medium text-[oklch(0.5_0.11_80)]">
        <span className="flex items-center gap-1.5">
          <CalendarDays className="h-4 w-4" /> Day {t.programDay} of {t.config.totalDays}
        </span>
        <span className="flex items-center gap-1.5">
          <Flame className={cn("h-4 w-4 text-[#f59e0b]", t.streak >= 1 && "animate-glow-pulse")} />{" "}
          {t.streak}-day streak
        </span>
        <span className="flex items-center gap-1.5">
          <Trophy className="h-4 w-4" /> <AnimatedCounter value={t.points} duration={700} /> pts
        </span>
      </div>
    </SectionCard>
  );
}

function RingStat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col items-center">
      {children}
      <p className="mt-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Habit tiles
// ---------------------------------------------------------------------------
const CATEGORY_META: Record<HabitCategory, { label: string; color: string }> = {
  Body: { label: "Body", color: "#10b981" },
  Mind: { label: "Mind", color: "#8b5cf6" },
  Business: { label: "Business", color: "#3b82f6" },
};

function HabitTiles({ t, onOpen }: { t: Tracker; onOpen: (h: HabitDef) => void }) {
  return (
    <div className="space-y-4">
      {HABIT_CATEGORIES.map((cat) => {
        const habits = HABITS.filter((h) => h.category === cat);
        const meta = CATEGORY_META[cat];
        const done = habits.filter((h) => t.isDone(t.programDay, h.id)).length;
        return (
          <div key={cat}>
            <div className="mb-2 flex items-center gap-2">
              <span
                className="h-3.5 w-3.5 rounded-full ring-1 ring-inset ring-black/5 transition-[background] duration-500"
                style={{
                  background: `conic-gradient(${meta.color} ${(done / habits.length) * 360}deg, ${meta.color}33 0deg)`,
                }}
                aria-hidden
              />
              <span className="text-xs font-semibold uppercase tracking-wider text-foreground">
                {meta.label}
              </span>
              <span className="text-[11px] text-muted-foreground">
                {done}/{habits.length}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {habits.map((h, i) => {
                const Icon = h.icon;
                const doneToday = t.isDone(t.programDay, h.id);
                return (
                  <motion.button
                    key={h.id}
                    type="button"
                    onClick={() => onOpen(h)}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: i * 0.03 }}
                    whileTap={{ scale: 0.96 }}
                    title={h.why}
                    className={cn(
                      "app-press relative flex min-h-[112px] flex-col items-center gap-2 overflow-hidden rounded-2xl border p-3 text-center transition-all hover:-translate-y-0.5 hover:shadow-vkm",
                      doneToday
                        ? "border-transparent text-white shadow-vkm"
                        : "border-border bg-card",
                    )}
                  >
                    {/* #24 — fill animates in on completion */}
                    <AnimatePresence>
                      {doneToday && (
                        <motion.span
                          aria-hidden
                          initial={{ opacity: 0, scale: 0.6 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ type: "spring", stiffness: 300, damping: 22 }}
                          className="absolute inset-0 rounded-2xl"
                          style={{ background: `linear-gradient(135deg, ${h.from}, ${h.to})` }}
                        />
                      )}
                    </AnimatePresence>
                    {doneToday && (
                      <span
                        className="absolute right-1.5 top-1.5 z-10 inline-flex h-5 w-5 items-center justify-center rounded-full bg-white"
                        style={{ color: h.accent }}
                      >
                        <Check className="h-3.5 w-3.5" />
                      </span>
                    )}
                    <span
                      className={cn(
                        "relative z-10 inline-flex h-11 w-11 items-center justify-center rounded-xl shadow-vkm",
                        doneToday ? "bg-white/20 text-white" : "text-white",
                      )}
                      style={
                        doneToday
                          ? undefined
                          : { background: `linear-gradient(135deg, ${h.from}, ${h.to})` }
                      }
                    >
                      <Icon className="h-5 w-5" />
                    </span>
                    <span
                      className={cn(
                        "relative z-10 text-[11px] font-medium leading-tight sm:text-xs",
                        doneToday ? "text-white" : "text-foreground",
                      )}
                    >
                      {h.name}
                    </span>
                    <span
                      className={cn(
                        "relative z-10 text-[11px] tabular-nums",
                        doneToday ? "text-white/80" : "text-muted-foreground",
                      )}
                    >
                      {t.habitCount(h.id)} / {t.config.totalDays}
                    </span>
                  </motion.button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Last 7 days chart
// ---------------------------------------------------------------------------
function WeekChart({ t }: { t: Tracker }) {
  const [showGrid, setShowGrid] = useState(true);
  const data = t.last7.map((d) => ({
    label: d.day >= 1 ? format(dateForDay(d.day), "EEE") : "",
    value: d.value,
  }));
  return (
    <SectionCard
      title="Habits · Last 7 days"
      action={
        <button
          type="button"
          onClick={() => setShowGrid((s) => !s)}
          className="inline-flex min-h-11 items-center gap-1 rounded-full border border-border px-3 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          {showGrid ? "Hide gridlines" : "Show gridlines"}
        </button>
      }
    >
      <p className="mb-1 text-center text-[11px] text-muted-foreground sm:hidden">
        Tap a point to see that day’s count.
      </p>
      <div className="h-[180px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 8, left: 8, bottom: 0 }}>
            <defs>
              <linearGradient id="omm-area" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
              </linearGradient>
            </defs>
            {showGrid && (
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="oklch(0.88 0.015 90)" />
            )}
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 12, fill: "oklch(0.48 0.025 260)" }}
            />
            <Tooltip
              cursor={{ stroke: "#f59e0b", strokeWidth: 1, strokeDasharray: "3 3" }}
              contentStyle={{
                borderRadius: 12,
                border: "1px solid oklch(0.9 0.01 90)",
                fontSize: 12,
                boxShadow: "0 8px 24px oklch(0 0 0 / 0.12)",
              }}
              formatter={(v: number) => [`${v} / ${HABITS.length} habits`, "Done"]}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="#f59e0b"
              strokeWidth={2.5}
              fill="url(#omm-area)"
              dot={{ r: 3, fill: "#f59e0b" }}
              activeDot={{ r: 6 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// History & analytics — reference material, collapsed by default.
// ---------------------------------------------------------------------------
function AnalyticsZone({ t }: { t: Tracker }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="app-press flex min-h-11 w-full items-center justify-between rounded-2xl border border-border bg-card px-4 py-3 shadow-vkm"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Activity className="h-4 w-4 text-muted-foreground" /> History &amp; analytics
        </span>
        <ChevronDown
          className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="space-y-4 overflow-hidden"
          >
            <WeekChart t={t} />
            <HabitGrid
              config={t.config}
              dayState={t.dayState}
              title="Habit Tracker"
              isDone={t.isDone}
              proofsFor={t.proofsFor}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Habit proof sheet — mandatory file(s) to mark a habit done; staff see them.
// ---------------------------------------------------------------------------
type StagedFile = { id: string; file: File; url: string };

function HabitProofModal({
  habit,
  t,
  onClose,
}: {
  habit: HabitDef;
  t: Tracker;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const Icon = habit.icon;
  const doneToday = t.isDone(t.programDay, habit.id);
  const existing = t.proofsFor(t.programDay, habit.id);
  const [staged, setStaged] = useState<StagedFile[]>([]);
  const [busy, setBusy] = useState(false);

  function onFiles(files: FileList | null) {
    if (!files) return;
    const add = Array.from(files).map((f) => ({
      id: `${f.name}-${f.size}-${f.lastModified}`,
      file: f,
      url: URL.createObjectURL(f),
    }));
    setStaged((s) => [...s, ...add]);
  }
  function removeStaged(id: string) {
    setStaged((s) => {
      const target = s.find((x) => x.id === id);
      if (target) URL.revokeObjectURL(target.url);
      return s.filter((x) => x.id !== id);
    });
  }

  async function markDone() {
    if (staged.length === 0) {
      toast.error("Attach at least one proof file to mark this habit done.");
      return;
    }
    if (!user) return;
    setBusy(true);
    try {
      const attachments = await Promise.all(staged.map((s) => uploadAttachment(user.id, s.file)));
      await t.toggleToday(habit.id, attachments);
      staged.forEach((s) => URL.revokeObjectURL(s.url));
      haptic("success");
      flyPoints(t.config.pointsPerTick);
      toast.success(`${habit.name} marked done`, {
        description: `+${t.config.pointsPerTick} pts · proof saved for your coach.`,
      });
      onClose();
    } catch (e) {
      toast.error("Upload failed", { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function markNotDone() {
    setBusy(true);
    await t.toggleToday(habit.id); // deletes today's log
    setBusy(false);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 24 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md overflow-hidden rounded-t-3xl bg-card shadow-vkm-float sm:rounded-3xl"
      >
        <div className="flex items-center gap-3 border-b border-border p-4">
          <span
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-white"
            style={{ background: `linear-gradient(135deg, ${habit.from}, ${habit.to})` }}
          >
            <Icon className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">{habit.name}</p>
            <p className="text-[11px] text-muted-foreground">Day {t.programDay} · proof required</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 p-4">
          {doneToday ? (
            <>
              <p className="inline-flex items-center gap-1.5 text-sm font-medium text-[oklch(0.45_0.13_160)]">
                <Check className="h-4 w-4" /> Completed today
              </p>
              {existing.length > 0 ? (
                <ProofAttachments files={existing} />
              ) : (
                <p className="text-sm text-muted-foreground">
                  Auto-completed from your tracker — no file attached.
                </p>
              )}
              <Button
                variant="outline"
                disabled={busy}
                onClick={markNotDone}
                className="w-full rounded-xl border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}{" "}
                Mark not done
              </Button>
            </>
          ) : (
            <>
              <FilePickerZone onFiles={onFiles} />
              <p className="text-[11px] text-muted-foreground">
                A photo, video or document is required.
              </p>
              {staged.length > 0 && (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {staged.map((s) => (
                    <LocalPreviewTile
                      key={s.id}
                      file={s.file}
                      url={s.url}
                      uploading={busy}
                      onRemove={() => removeStaged(s.id)}
                    />
                  ))}
                </div>
              )}
              <Button
                disabled={busy || staged.length === 0}
                onClick={markDone}
                className="w-full rounded-xl bg-[#10b981] text-white hover:opacity-90"
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}{" "}
                Mark done (+{t.config.pointsPerTick})
              </Button>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
