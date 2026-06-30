import { useCallback, useEffect, useRef, useState } from "react";
import { addDays, differenceInCalendarDays, format, startOfToday } from "date-fns";
import {
  Footprints,
  Brain,
  Sparkles,
  NotebookPen,
  Droplets,
  ListChecks,
  type LucideIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { type Attachment } from "@/components/chat/chat-data";

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

export const START_ISO = "2026-04-27"; // Batch 16 program start
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

export function endDate(totalDays: number): Date {
  return addDays(START_DATE, totalDays - 1);
}
export function currentProgramDay(totalDays: number): number {
  const diff = differenceInCalendarDays(startOfToday(), START_DATE) + 1;
  return Math.min(Math.max(diff, 1), totalDays);
}
export function dateForDay(day: number): Date {
  return addDays(START_DATE, day - 1);
}

export type DoneMap = Record<string, true>;
export type DayState = "completed" | "inprogress" | "today" | "missed" | "upcoming";
const dkey = (day: number, habitId: string) => `${day}:${habitId}`;

// ---------------------------------------------------------------------------
// Admin-editable program settings (singleton row), live-synced.
// ---------------------------------------------------------------------------
export function useProgramSettings() {
  const [config, setConfig] = useState<TrackerConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const apply = (d: {
      habit_weeks: number;
      habit_days_per_week: number;
      habit_points_per_tick: number;
      step_goal: number;
    }) =>
      setConfig({
        weeks: d.habit_weeks,
        daysPerWeek: d.habit_days_per_week,
        totalDays: d.habit_weeks * d.habit_days_per_week,
        pointsPerTick: d.habit_points_per_tick,
        stepGoal: d.step_goal,
      });

    supabase
      .from("program_settings")
      .select("*")
      .eq("id", 1)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        if (data) apply(data);
        setLoading(false);
      });

    const ch = supabase
      .channel("program_settings")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "program_settings" },
        (p) => apply(p.new as Parameters<typeof apply>[0]),
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(ch);
    };
  }, []);

  return { config, loading };
}

// ---------------------------------------------------------------------------
// Shared derivations from a done-map.
// ---------------------------------------------------------------------------
function computeDerived(done: DoneMap, totalDays: number, programDay: number) {
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

  let streak = 0;
  for (let d = programDay; d >= 1; d--) {
    if (dayCount(d) === HABITS.length) streak++;
    else if (d === programDay) continue;
    else break;
  }

  const dayState = (day: number): DayState => {
    if (day === programDay) return "today";
    const c = dayCount(day);
    if (c === HABITS.length) return "completed";
    if (c > 0) return "inprogress";
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
  const programDay = currentProgramDay(config.totalDays);
  const [done, setDone] = useState<DoneMap>({});
  const [proofs, setProofs] = useState<Record<string, Attachment[]>>({});
  const [loading, setLoading] = useState(true);

  const doneRef = useRef(done);
  doneRef.current = done;

  useEffect(() => {
    if (!user) return;
    let active = true;

    (async () => {
      const { data } = await supabase
        .from("habit_logs")
        .select("habit_id, day_no, proof_files")
        .eq("user_id", user.id);
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
      setLoading(false);
    })();

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
    };
  }, [user]);

  const toggleToday = useCallback(
    async (habitId: string, files: Attachment[] = []) => {
      if (!user) return;
      const day = programDay;
      const k = dkey(day, habitId);
      const was = !!doneRef.current[k];

      setDone((prev) => {
        const n = { ...prev };
        if (was) delete n[k];
        else n[k] = true;
        return n;
      });
      setProofs((prev) => {
        const n = { ...prev };
        if (was) delete n[k];
        else n[k] = files;
        return n;
      });

      try {
        if (was) {
          await supabase
            .from("habit_logs")
            .delete()
            .eq("user_id", user.id)
            .eq("habit_id", habitId)
            .eq("day_no", day);
        } else {
          await supabase.from("habit_logs").insert({
            user_id: user.id,
            habit_id: habitId,
            day_no: day,
            log_date: format(startOfToday(), "yyyy-MM-dd"),
            points: config.pointsPerTick,
            proof_files: files,
          });
        }
      } catch {
        /* realtime / next load reconciles */
      }
    },
    [user, programDay, config.pointsPerTick],
  );

  const proofsFor = useCallback(
    (day: number, habitId: string) => proofs[dkey(day, habitId)] ?? [],
    [proofs],
  );

  const d = computeDerived(done, config.totalDays, programDay);
  return {
    config,
    programDay,
    loading,
    toggleToday,
    proofsFor,
    points: d.totalTicks * config.pointsPerTick,
    ...d,
  };
}

// ---------------------------------------------------------------------------
// Read-only viewer for staff (coach / mentor / admin) — another user's data.
// ---------------------------------------------------------------------------
export function useParticipantHabits(userId: string | null) {
  const { config } = useProgramSettings();
  const programDay = currentProgramDay(config.totalDays);
  const [done, setDone] = useState<DoneMap>({});
  const [proofs, setProofs] = useState<Record<string, Attachment[]>>({});
  const [steps, setSteps] = useState(0);
  const [waterMl, setWaterMl] = useState(0);
  const [waterGoal, setWaterGoal] = useState(4000);
  const [waterEvents, setWaterEvents] = useState<WaterEvent[]>([]);
  const [workoutMinutes, setWorkoutMinutes] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setDone({});
      setProofs({});
      setSteps(0);
      setWaterMl(0);
      setWaterEvents([]);
      setWorkoutMinutes(0);
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
      ]);
      if (!active) return;
      const m: DoneMap = {};
      const pm: Record<string, Attachment[]> = {};
      (logs ?? []).forEach((r) => {
        const k = dkey(r.day_no, r.habit_id);
        m[k] = true;
        pm[k] = (r.proof_files ?? []) as Attachment[];
      });
      setDone(m);
      setProofs(pm);
      setSteps(stepRow?.steps ?? 0);
      setWaterMl(waterRow?.ml ?? 0);
      setWaterGoal(waterRow?.goal_ml ?? 4000);
      setWaterEvents((events ?? []) as WaterEvent[]);
      setWorkoutMinutes((workouts ?? []).reduce((n, w) => n + (w.minutes ?? 0), 0));
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
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(ch);
    };
  }, [userId, config.totalDays]);

  const d = computeDerived(done, config.totalDays, programDay);
  const proofsFor = (day: number, habitId: string) => proofs[dkey(day, habitId)] ?? [];
  // Habits the participant completed on the current program day that carry proof.
  const todayProofs = HABITS.map((h) => ({ habit: h, files: proofsFor(programDay, h.id) })).filter(
    (x) => x.files.length > 0,
  );
  return {
    config,
    programDay,
    loading,
    steps,
    waterMl,
    waterGoal,
    waterEvents,
    workoutMinutes,
    proofsFor,
    todayProofs,
    points: d.totalTicks * config.pointsPerTick,
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
      if (!user) return;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(() => {
        supabase
          .from("daily_steps")
          .upsert(
            { user_id: user.id, log_date: todayDate, day_no: programDay, steps: value, goal },
            { onConflict: "user_id,log_date" },
          );
      }, 1500);
    },
    [user, todayDate, programDay, goal],
  );

  const addStep = useCallback((count = 1) => {
    setSteps((s) => {
      const v = s + count;
      persist(v);
      return v;
    });
  }, [persist]);

  const setStepsManual = useCallback((value: number) => {
    const v = Math.max(0, Math.floor(value));
    setSteps(v);
    persist(v);
  }, [persist]);

  return { steps, goal, addStep, setSteps: setStepsManual };
}

// ---------------------------------------------------------------------------
// Daily water (ml) — each glass is an audited event (anti-fraud).
// A 30-minute cooldown is recommended between glasses; logging sooner is
// allowed but requires a reason and is flagged `rapid` for staff review.
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
      if (lastEvent) setLastAddAt(new Date(lastEvent.created_at).getTime());
    })();
    return () => {
      active = false;
    };
  }, [user, todayDate]);

  // Persist the running total + record one audited event.
  const writeEvent = useCallback(
    (delta: number, total: number, reason: string | null, rapid: boolean) => {
      if (!user) return;
      supabase
        .from("daily_water")
        .upsert(
          { user_id: user.id, log_date: todayDate, day_no: programDay, ml: total, goal_ml: goalMl },
          { onConflict: "user_id,log_date" },
        );
      supabase.from("water_events").insert({
        user_id: user.id,
        log_date: todayDate,
        day_no: programDay,
        ml: delta,
        reason,
        rapid,
      });
    },
    [user, todayDate, programDay, goalMl],
  );

  const addGlass = useCallback(
    (reason?: string) => {
      const total = mlRef.current + GLASS_ML;
      mlRef.current = total;
      setMl(total);
      setLastAddAt(Date.now());
      writeEvent(GLASS_ML, total, reason?.trim() || null, !!reason);
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

  return { ml, goalMl, lastAddAt, cooldownMs: WATER_COOLDOWN_MS, addGlass, removeGlass };
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
      if (!user) return;
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
