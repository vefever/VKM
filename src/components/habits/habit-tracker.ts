import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { addDays, differenceInCalendarDays, format, startOfDay, startOfToday } from "date-fns";
import {
  Footprints,
  Brain,
  Sparkles,
  NotebookPen,
  Droplets,
  ListChecks,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useEnrollment, fetchBatchStartDate } from "@/components/participant/enrollment-data";
import { type Attachment } from "@/components/chat/chat-data";
import {
  fetchExemptionDaySets,
  type ExemptionDaySets,
} from "@/components/habits/habit-exemptions-data";

// Habits whose completion is proven by their own tracker (steps / hydration /
// workout minutes) and therefore auto-complete without a manual file upload.
export const TRACKER_HABITS = new Set(["walking", "water"]);

export type HabitCategory = "Body" | "Mind" | "Business";
export const HABIT_CATEGORIES: HabitCategory[] = ["Body", "Mind", "Business"];

export type HabitDef = {
  id: string;
  name: string;
  category: HabitCategory;
  icon: LucideIcon;
  accent: string;
  from: string;
  to: string;
  why?: string;
  // When true, a proof file is optional — the participant can just "Mark as
  // done" and it counts as completed for the date (e.g. Affirmation, an
  // internal practice with nothing to photograph). Completion still records to
  // habit_logs so coach/mentor/admin see it as done.
  optionalProof?: boolean;
};

// Research-backed daily system for busy business owners — Body / Mind / Business.
export const HABITS: HabitDef[] = [
  // ---- Body ----
  {
    id: "walking",
    name: "Walking 20 Min",
    category: "Body",
    icon: Footprints,
    accent: "#10b981",
    from: "#10b981",
    to: "#34d399",
    why: "Movement boosts focus & energy",
  },
  {
    id: "water",
    name: "Drink Water (4L)",
    category: "Body",
    icon: Droplets,
    accent: "#06b6d4",
    from: "#06b6d4",
    to: "#22d3ee",
    why: "Hydration sharpens decisions",
  },
  // ---- Mind ----
  {
    id: "meditation",
    name: "Meditation",
    category: "Mind",
    icon: Brain,
    accent: "#8b5cf6",
    from: "#8b5cf6",
    to: "#a78bfa",
    why: "Calm mind, clear priorities",
  },
  {
    id: "affirmation",
    name: "Affirmation",
    category: "Mind",
    icon: Sparkles,
    accent: "#f59e0b",
    from: "#f59e0b",
    to: "#fbbf24",
    why: "Prime a winning mindset",
    optionalProof: true,
  },
  {
    id: "gratitude",
    name: "Gratitude Journal",
    category: "Mind",
    icon: NotebookPen,
    accent: "#ec4899",
    from: "#ec4899",
    to: "#f472b6",
    why: "Perspective beats burnout",
  },
  // ---- Business ----
  {
    id: "todo",
    name: "Daily To-Do List",
    category: "Business",
    icon: ListChecks,
    accent: "#3b82f6",
    from: "#3b82f6",
    to: "#60a5fa",
    why: "Plan the day's key tasks",
  },
];

// Legacy cohort anchor. NOT a source of truth — a programme's start comes from
// its batch (batches.start_date, via fetchBatchStartDate). This is only a
// last-resort default for helpers called without an anchor, and it is stale by
// design: Batch 16 now starts 2026-07-01. Never use it to label a date the user
// will read — a wrong date is worse than no date.
export const START_ISO = "2026-04-27";
export const START_DATE = new Date(`${START_ISO}T00:00:00`);

export type TrackerConfig = {
  weeks: number;
  daysPerWeek: number;
  totalDays: number;
  pointsPerTick: number;
  stepGoal: number;
};
export const DEFAULT_CONFIG: TrackerConfig = {
  weeks: 16,
  daysPerWeek: 7,
  totalDays: 112,
  pointsPerTick: 10,
  stepGoal: 4000,
};

// Date helpers accept an anchor (the participant's own start) and fall back to
// the cohort START_DATE for staff/demo contexts that don't have an enrollment.
export function endDate(totalDays: number, anchor: Date = START_DATE): Date {
  return addDays(anchor, totalDays - 1);
}
export function dateForDay(day: number, anchor: Date = START_DATE): Date {
  return addDays(anchor, day - 1);
}
// The participant's current program day, relative to their batch's start date.
// Returns 0 until the programme has actually begun; Day 1 on the start date,
// then one per calendar day, clamped to the program length.
//
// A start date in the FUTURE returns 0, not Day 1. The old Math.max(diff, 1)
// floor is what let Batch 17 participants tick habits and bank points days
// before their programme started.
export function currentProgramDay(totalDays: number, startedAt: Date | null): number {
  if (!startedAt) return 0;
  const diff = differenceInCalendarDays(startOfToday(), startOfDay(startedAt)) + 1;
  if (diff < 1) return 0;
  return Math.min(diff, totalDays);
}

export type DoneMap = Record<string, true>;
// "regulated" = an approved exemption (missed but excused — bridges the streak).
// "requested" = a pending exemption on a missed day (awaiting staff decision).
export type DayState =
  | "completed"
  | "inprogress"
  | "today"
  | "missed"
  | "upcoming"
  | "regulated"
  | "requested";
const dkey = (day: number, habitId: string) => `${day}:${habitId}`;

const EMPTY_EXEMPT: ExemptionDaySets = { approved: new Set(), pending: new Set() };

// ---------------------------------------------------------------------------
// Admin-editable program settings (singleton row).
//
// This is read by every habit hook (self tracker, staff viewer, exemption card).
// It used to fetch the row AND open a realtime channel on every mount, so a
// single habits page fired several identical round trips + websocket channels.
// It's now a React Query singleton: one cached fetch shared across the whole app
// (settings change rarely — an admin action — so a 5-minute stale window is
// plenty; no per-mount channel).
// ---------------------------------------------------------------------------
function toConfig(d: {
  habit_weeks: number;
  habit_days_per_week: number;
  habit_points_per_tick: number;
  step_goal: number;
}): TrackerConfig {
  return {
    weeks: d.habit_weeks,
    daysPerWeek: d.habit_days_per_week,
    totalDays: d.habit_weeks * d.habit_days_per_week,
    pointsPerTick: d.habit_points_per_tick,
    stepGoal: d.step_goal,
  };
}

export function useProgramSettings() {
  const { data, isLoading } = useQuery({
    queryKey: ["program_settings"],
    queryFn: async () => {
      const { data } = await supabase
        .from("program_settings")
        .select("*")
        .eq("id", 1)
        .maybeSingle();
      return data ? toConfig(data) : DEFAULT_CONFIG;
    },
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
  });
  return { config: data ?? DEFAULT_CONFIG, loading: isLoading };
}

// ---------------------------------------------------------------------------
// Shared derivations from a done-map.
// ---------------------------------------------------------------------------
function computeDerived(
  done: DoneMap,
  totalDays: number,
  programDay: number,
  exempt: ExemptionDaySets = EMPTY_EXEMPT,
) {
  const isDone = (day: number, habitId: string) => !!done[dkey(day, habitId)];
  const dayCount = (day: number) => HABITS.reduce((n, h) => n + (isDone(day, h.id) ? 1 : 0), 0);
  const habitCount = (habitId: string) => {
    let n = 0;
    for (let d = 1; d <= totalDays; d++) if (isDone(d, habitId)) n++;
    return n;
  };
  const totalTicks = Object.keys(done).length;
  const todayDone = dayCount(programDay);

  let completedDays = 0;
  for (let d = 1; d <= totalDays; d++) if (dayCount(d) === HABITS.length) completedDays++;

  // Streak: an approved-exempt ("regulated") day counts exactly like a completed
  // day — it keeps the streak going AND adds to it (16 → 17), matching that the
  // member also receives the full day's habit points once staff approve.
  let streak = 0;
  for (let d = programDay; d >= 1; d--) {
    if (dayCount(d) === HABITS.length || exempt.approved.has(d)) {
      streak++;
      continue;
    }
    if (d === programDay) continue; // today may still be in progress
    break;
  }

  // Excused days are worth a full 6/6 day of habit ticks (points parity).
  const exemptTicks = exempt.approved.size * HABITS.length;

  const dayState = (day: number): DayState => {
    if (exempt.approved.has(day)) return "regulated";
    if (day === programDay) return "today";
    const c = dayCount(day);
    if (c === HABITS.length) return "completed";
    if (c > 0) return "inprogress";
    if (exempt.pending.has(day)) return "requested";
    if (day < programDay) return "missed";
    return "upcoming";
  };

  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = programDay - 6 + i;
    return { day: d, value: d >= 1 ? dayCount(d) : 0 };
  });

  return {
    isDone,
    dayCount,
    habitCount,
    dayState,
    totalTicks,
    exemptTicks,
    todayDone,
    completedDays,
    streak,
    last7,
  };
}

// ---------------------------------------------------------------------------
// Self tracker — read + write own logs, live-synced.
// ---------------------------------------------------------------------------
export function useHabitTracker() {
  const { user } = useAuth();
  const { config } = useProgramSettings();
  const enrollment = useEnrollment();
  const programDay = currentProgramDay(config.totalDays, enrollment.startedAt);
  const [done, setDone] = useState<DoneMap>({});
  const [proofs, setProofs] = useState<Record<string, Attachment[]>>({});
  const [exempt, setExempt] = useState<ExemptionDaySets>(EMPTY_EXEMPT);
  const [loading, setLoading] = useState(true);

  const doneRef = useRef(done);
  doneRef.current = done;

  useEffect(() => {
    if (!user) return;
    let active = true;

    (async () => {
      const [{ data }, ex] = await Promise.all([
        supabase.from("habit_logs").select("habit_id, day_no, proof_files").eq("user_id", user.id),
        fetchExemptionDaySets(user.id),
      ]);
      if (!active) return;
      const m: DoneMap = {};
      const pm: Record<string, Attachment[]> = {};
      (data ?? []).forEach((r) => {
        const k = dkey(r.day_no, r.habit_id);
        m[k] = true;
        pm[k] = (r.proof_files ?? []) as Attachment[];
      });
      setDone(m);
      setProofs(pm);
      setExempt(ex);
      setLoading(false);
    })();

    // Keep the grid/streak live when an exemption is approved/added.
    const exCh = supabase
      .channel(`hx:self:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "habit_exemptions",
          filter: `user_id=eq.${user.id}`,
        },
        () => void fetchExemptionDaySets(user.id).then((e) => setExempt(e)),
      )
      .subscribe();

    const channel = supabase
      .channel(`habit_logs:${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "habit_logs", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const r = payload.new as { day_no: number; habit_id: string; proof_files?: Attachment[] };
          const k = dkey(r.day_no, r.habit_id);
          setDone((p) => ({ ...p, [k]: true }));
          setProofs((p) => ({ ...p, [k]: (r.proof_files ?? []) as Attachment[] }));
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "habit_logs", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const r = payload.old as { day_no: number; habit_id: string };
          setDone((p) => {
            const n = { ...p };
            delete n[dkey(r.day_no, r.habit_id)];
            return n;
          });
        },
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
      supabase.removeChannel(exCh);
    };
  }, [user]);

  const toggleToday = useCallback(
    async (habitId: string, files: Attachment[] = []) => {
      if (!user || programDay < 1) return; // no logging before the program has started
      const day = programDay;
      const k = dkey(day, habitId);
      const was = !!doneRef.current[k];

      setDone((prev) => {
        const n = { ...prev };
        if (was) delete n[k];
        else n[k] = true;
        return n;
      });
      // Remember the proofs we're about to replace, so a rejected write can be
      // rolled back to exactly what was there.
      let priorProofs: Attachment[] = [];
      setProofs((prev) => {
        priorProofs = prev[k] ?? [];
        const n = { ...prev };
        if (was) delete n[k];
        else n[k] = files;
        return n;
      });

      // supabase-js does NOT throw on a rejected write — an RLS denial or a
      // constraint violation comes back as { error }. Catching only thrown
      // errors meant a refused tick still looked completed: the habit stayed
      // ticked, no points were awarded, and nothing corrected until a reload.
      // Roll the optimistic update back and say so instead.
      let failure: string | null = null;
      try {
        if (was) {
          const { error } = await supabase
            .from("habit_logs")
            .delete()
            .eq("user_id", user.id)
            .eq("habit_id", habitId)
            .eq("day_no", day);
          if (error) failure = error.message;
        } else {
          const { error } = await supabase.from("habit_logs").insert({
            user_id: user.id,
            habit_id: habitId,
            day_no: day,
            log_date: format(startOfToday(), "yyyy-MM-dd"),
            points: config.pointsPerTick,
            proof_files: files,
          });
          if (error) failure = error.message;
        }
      } catch (e) {
        failure = (e as Error).message;
      }

      if (failure) {
        setDone((prev) => {
          const n = { ...prev };
          if (was) n[k] = true;
          else delete n[k];
          return n;
        });
        setProofs((prev) => {
          const n = { ...prev };
          if (was) n[k] = priorProofs;
          else delete n[k];
          return n;
        });
        toast.error(was ? "Couldn't undo that habit" : "Couldn't save that habit", {
          description: failure,
        });
      }
    },
    [user, programDay, config.pointsPerTick],
  );

  const proofsFor = useCallback(
    (day: number, habitId: string) => proofs[dkey(day, habitId)] ?? [],
    [proofs],
  );

  const d = computeDerived(done, config.totalDays, programDay, exempt);
  return {
    config,
    programDay,
    loading,
    enrLoading: enrollment.loading,
    started: enrollment.started,
    starting: enrollment.starting,
    startedAt: enrollment.startedAt,
    currentWeek: enrollment.currentWeek,
    startProgram: enrollment.startProgram,
    toggleToday,
    proofsFor,
    points: (d.totalTicks + d.exemptTicks) * config.pointsPerTick,
    ...d,
  };
}

// ---------------------------------------------------------------------------
// Read-only viewer for staff (coach / mentor / admin) — another user's data.
// ---------------------------------------------------------------------------
export function useParticipantHabits(userId: string | null) {
  const { config } = useProgramSettings();
  const [startedAt, setStartedAt] = useState<Date | null>(null);
  const programDay = currentProgramDay(config.totalDays, startedAt);
  const [done, setDone] = useState<DoneMap>({});
  const [proofs, setProofs] = useState<Record<string, Attachment[]>>({});
  const [steps, setSteps] = useState(0);
  const [waterMl, setWaterMl] = useState(0);
  const [waterGoal, setWaterGoal] = useState(4000);
  const [waterEvents, setWaterEvents] = useState<WaterEvent[]>([]);
  const [workoutMinutes, setWorkoutMinutes] = useState(0);
  const [exempt, setExempt] = useState<ExemptionDaySets>(EMPTY_EXEMPT);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setDone({});
      setProofs({});
      setSteps(0);
      setWaterMl(0);
      setWaterEvents([]);
      setWorkoutMinutes(0);
      setExempt(EMPTY_EXEMPT);
      setStartedAt(null);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    const today = format(startOfToday(), "yyyy-MM-dd");

    const load = async () => {
      const [
        { data: logs },
        { data: stepRow },
        { data: waterRow },
        { data: workouts },
        { data: events },
        { data: enr },
        batchStart,
      ] = await Promise.all([
        supabase.from("habit_logs").select("habit_id, day_no, proof_files").eq("user_id", userId),
        supabase
          .from("daily_steps")
          .select("steps")
          .eq("user_id", userId)
          .eq("log_date", today)
          .maybeSingle(),
        supabase
          .from("daily_water")
          .select("ml, goal_ml")
          .eq("user_id", userId)
          .eq("log_date", today)
          .maybeSingle(),
        supabase.from("workout_logs").select("minutes").eq("user_id", userId).eq("log_date", today),
        supabase
          .from("water_events")
          .select("id, ml, reason, rapid, created_at")
          .eq("user_id", userId)
          .eq("log_date", today)
          .order("created_at", { ascending: false }),
        supabase
          .from("program_enrollments")
          .select("started_at")
          .eq("user_id", userId)
          .maybeSingle(),
        // The batch start date is the source of truth for when a programme
        // begins (see fetchBatchStartDate). Reading only the enrollment row here
        // let the staff view compute a different day number from the
        // participant's own view — the exact disagreement that stamped Batch 16
        // proofs with the wrong day and made them vanish from the tracker.
        fetchBatchStartDate(userId),
      ]);
      if (!active) return;
      const m: DoneMap = {};
      const pm: Record<string, Attachment[]> = {};
      (logs ?? []).forEach((r) => {
        const k = dkey(r.day_no, r.habit_id);
        m[k] = true;
        pm[k] = (r.proof_files ?? []) as Attachment[];
      });
      setExempt(await fetchExemptionDaySets(userId));
      setDone(m);
      setProofs(pm);
      setSteps(stepRow?.steps ?? 0);
      setWaterMl(waterRow?.ml ?? 0);
      setWaterGoal(waterRow?.goal_ml ?? 4000);
      setWaterEvents((events ?? []) as WaterEvent[]);
      setWorkoutMinutes((workouts ?? []).reduce((n, w) => n + (w.minutes ?? 0), 0));
      // Batch start wins, exactly as the participant-side hook resolves it.
      setStartedAt(batchStart ?? (enr?.started_at ? new Date(enr.started_at) : null));
      setLoading(false);
    };
    load();

    const ch = supabase
      .channel(`habits:view:${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "habit_logs", filter: `user_id=eq.${userId}` },
        () => load(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "daily_water", filter: `user_id=eq.${userId}` },
        () => load(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "workout_logs", filter: `user_id=eq.${userId}` },
        () => load(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "water_events", filter: `user_id=eq.${userId}` },
        () => load(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "habit_exemptions", filter: `user_id=eq.${userId}` },
        () => load(),
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(ch);
    };
  }, [userId, config.totalDays]);

  const d = computeDerived(done, config.totalDays, programDay, exempt);
  const proofsFor = (day: number, habitId: string) => proofs[dkey(day, habitId)] ?? [];
  // Habits the participant completed on the current program day that carry proof.
  const todayProofs = HABITS.map((h) => ({ habit: h, files: proofsFor(programDay, h.id) })).filter(
    (x) => x.files.length > 0,
  );
  return {
    config,
    programDay,
    startedAt,
    loading,
    steps,
    waterMl,
    waterGoal,
    waterEvents,
    workoutMinutes,
    proofsFor,
    todayProofs,
    points: (d.totalTicks + d.exemptTicks) * config.pointsPerTick,
    ...d,
  };
}

// ---------------------------------------------------------------------------
// Daily steps — persisted (debounced), RLS-scoped to self.
// ---------------------------------------------------------------------------
export function useDailySteps(programDay: number, goal: number) {
  const { user } = useAuth();
  const [steps, setSteps] = useState(0);
  const todayDate = format(startOfToday(), "yyyy-MM-dd");
  const saveTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!user) return;
    let active = true;
    supabase
      .from("daily_steps")
      .select("steps")
      .eq("user_id", user.id)
      .eq("log_date", todayDate)
      .maybeSingle()
      .then(({ data }) => {
        if (active && data) setSteps(data.steps);
      });
    return () => {
      active = false;
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        saveTimer.current = undefined;
      }
    };
  }, [user, todayDate]);

  const persist = useCallback(
    (value: number) => {
      // Nothing is tracked before the batch start date staff set.
      if (!user || programDay < 1) return;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(() => {
        void supabase
          .from("daily_steps")
          .upsert(
            { user_id: user.id, log_date: todayDate, day_no: programDay, steps: value, goal },
            { onConflict: "user_id,log_date" },
          )
          .then(({ error }) => {
            if (error) console.error("[steps] daily_steps upsert failed:", error.message);
          });
      }, 1500);
    },
    [user, todayDate, programDay, goal],
  );

  const addStep = useCallback(
    (count = 1) => {
      setSteps((s) => {
        const v = s + count;
        persist(v);
        return v;
      });
    },
    [persist],
  );

  const setStepsManual = useCallback(
    (value: number) => {
      const v = Math.max(0, Math.floor(value));
      setSteps(v);
      persist(v);
    },
    [persist],
  );

  return { steps, goal, addStep, setSteps: setStepsManual };
}

// ---------------------------------------------------------------------------
// Daily water (ml) — every change is an audited event.
//
// There is deliberately NO cooldown and no timing check. People drink away from
// their phone and log the catch-up later, which the old 30-minute `rapid` flag
// treated as suspicious and reported to their coach. Glasses can be logged one
// at a time or several at once, whenever suits. The `rapid` column is kept for
// historical rows but is no longer set.
// ---------------------------------------------------------------------------
export const GLASS_ML = 250;
export const WATER_GOAL_ML = 4000;
export const WATER_COOLDOWN_MS = 30 * 60 * 1000;

export type WaterEvent = {
  id: string;
  ml: number;
  reason: string | null;
  rapid: boolean;
  created_at: string;
};

export function useDailyWater(programDay: number) {
  const { user } = useAuth();
  const [ml, setMl] = useState(0);
  const [lastAddAt, setLastAddAt] = useState<number | null>(null);
  const goalMl = WATER_GOAL_ML;
  const todayDate = format(startOfToday(), "yyyy-MM-dd");
  const mlRef = useRef(0);
  mlRef.current = ml;
  // Timestamp of the last "add" — used to auto-flag a glass logged within the
  // 30-min window as `rapid` (no hard lock; staff get alerted instead).
  const lastAddRef = useRef<number | null>(null);

  useEffect(() => {
    if (!user) return;
    let active = true;
    (async () => {
      const [{ data: row }, { data: lastEvent }] = await Promise.all([
        supabase
          .from("daily_water")
          .select("ml")
          .eq("user_id", user.id)
          .eq("log_date", todayDate)
          .maybeSingle(),
        supabase
          .from("water_events")
          .select("created_at")
          .eq("user_id", user.id)
          .eq("log_date", todayDate)
          .gt("ml", 0)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      if (!active) return;
      if (row) setMl(row.ml);
      if (lastEvent) {
        const t = new Date(lastEvent.created_at).getTime();
        setLastAddAt(t);
        lastAddRef.current = t;
      }
    })();
    return () => {
      active = false;
    };
  }, [user, todayDate]);

  // Persist the running total + record one audited event. NOTE: supabase-js
  // query builders are lazy — the request only fires when the promise is
  // consumed, so we MUST attach `.then` (not fire-and-forget) or nothing saves.
  const writeEvent = useCallback(
    (delta: number, total: number, reason: string | null, rapid: boolean) => {
      // Nothing is tracked before the batch start date staff set.
      if (!user || programDay < 1) return;
      void supabase
        .from("daily_water")
        .upsert(
          { user_id: user.id, log_date: todayDate, day_no: programDay, ml: total, goal_ml: goalMl },
          { onConflict: "user_id,log_date" },
        )
        .then(({ error }) => {
          if (error) console.error("[water] daily_water upsert failed:", error.message);
        });
      void supabase
        .from("water_events")
        .insert({
          user_id: user.id,
          log_date: todayDate,
          day_no: programDay,
          ml: delta,
          reason,
          rapid,
        })
        .then(({ error }) => {
          if (error) console.error("[water] water_events insert failed:", error.message);
        });
    },
    [user, todayDate, programDay, goalMl],
  );

  /**
   * Log one or more glasses at once.
   *
   * Someone who drank four glasses while away from their phone had to tap four
   * separate times, and each tap after the first was flagged `rapid` and
   * reported to their coach — punishing honest catch-up logging. A count is now
   * written as ONE audited event rather than N, so the trail stays truthful
   * without the row churn, and nothing is flagged for timing.
   */
  const addGlasses = useCallback(
    (count = 1) => {
      const n = Math.max(1, Math.round(count));
      const now = Date.now();
      lastAddRef.current = now;
      const total = mlRef.current + n * GLASS_ML;
      mlRef.current = total;
      setMl(total);
      setLastAddAt(now);
      writeEvent(n * GLASS_ML, total, null, false);
    },
    [writeEvent],
  );

  const addGlass = useCallback(() => addGlasses(1), [addGlasses]);

  /** Jump straight to a total, so tapping the 6th glass logs all six at once. */
  const setGlasses = useCallback(
    (target: number) => {
      const clamped = Math.max(0, Math.round(target));
      const total = clamped * GLASS_ML;
      const delta = total - mlRef.current;
      if (delta === 0) return;
      mlRef.current = total;
      setMl(total);
      setLastAddAt(Date.now());
      writeEvent(delta, total, null, false);
    },
    [writeEvent],
  );

  const removeGlass = useCallback(() => {
    const total = Math.max(0, mlRef.current - GLASS_ML);
    if (total === mlRef.current) return;
    mlRef.current = total;
    setMl(total);
    writeEvent(-GLASS_ML, total, null, false);
  }, [writeEvent]);

  return {
    ml,
    goalMl,
    lastAddAt,
    cooldownMs: WATER_COOLDOWN_MS,
    addGlass,
    addGlasses,
    setGlasses,
    removeGlass,
  };
}

// ---------------------------------------------------------------------------
// Workout / gym sessions — persisted, RLS-scoped to self.
// ---------------------------------------------------------------------------
export type Workout = { id: string; kind: string; minutes: number };

export function useWorkouts(programDay: number) {
  const { user } = useAuth();
  const [items, setItems] = useState<Workout[]>([]);
  const todayDate = format(startOfToday(), "yyyy-MM-dd");

  useEffect(() => {
    if (!user) return;
    let active = true;
    supabase
      .from("workout_logs")
      .select("id, kind, minutes")
      .eq("user_id", user.id)
      .eq("log_date", todayDate)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (active) setItems((data ?? []) as Workout[]);
      });
    return () => {
      active = false;
    };
  }, [user, todayDate]);

  const addWorkout = useCallback(
    async (kind: string, minutes: number) => {
      // Nothing is tracked before the batch start date staff set.
      if (!user || programDay < 1) return;
      const { data } = await supabase
        .from("workout_logs")
        .insert({ user_id: user.id, log_date: todayDate, day_no: programDay, kind, minutes })
        .select("id, kind, minutes")
        .single();
      if (data) setItems((prev) => [data as Workout, ...prev]);
    },
    [user, todayDate, programDay],
  );

  const removeWorkout = useCallback(
    async (id: string) => {
      setItems((prev) => prev.filter((w) => w.id !== id));
      if (user) await supabase.from("workout_logs").delete().eq("id", id);
    },
    [user],
  );

  const totalMinutes = items.reduce((n, w) => n + w.minutes, 0);
  return { items, totalMinutes, addWorkout, removeWorkout };
}
