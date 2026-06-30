import { useCallback, useEffect, useState } from "react";
import { differenceInCalendarDays, startOfDay, startOfToday } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export type Enrollment = {
  startedAt: Date | null;
  totalWeeks: number;
  status: "not_started" | "active" | "completed";
};

const DEFAULT_WEEKS = 16;

/**
 * The participant's current program week, relative to THEIR own start date.
 * Returns 0 before they've started. Day 0–6 = week 1, day 7–13 = week 2, …,
 * clamped to the program length.
 */
export function weekFromStart(startedAt: Date | null, totalWeeks = DEFAULT_WEEKS): number {
  if (!startedAt) return 0;
  const days = differenceInCalendarDays(startOfToday(), startOfDay(startedAt));
  return Math.min(totalWeeks, Math.max(1, Math.floor(days / 7) + 1));
}

export function useEnrollment() {
  const { user } = useAuth();
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error: err } = await supabase
        .from("program_enrollments")
        .select("started_at, total_weeks, status")
        .eq("user_id", user.id)
        .maybeSingle();
      if (err) throw err;
      setEnrollment({
        startedAt: data?.started_at ? new Date(data.started_at) : null,
        totalWeeks: data?.total_weeks ?? DEFAULT_WEEKS,
        status: (data?.status as Enrollment["status"]) ?? "not_started",
      });
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load your program");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const startProgram = useCallback(
    async (totalWeeks = enrollment?.totalWeeks ?? DEFAULT_WEEKS) => {
      if (!user) return;
      setStarting(true);
      const now = new Date();
      try {
        const { error } = await supabase.from("program_enrollments").upsert(
          {
            user_id: user.id,
            started_at: now.toISOString(),
            total_weeks: totalWeeks,
            status: "active",
            updated_at: now.toISOString(),
          },
          { onConflict: "user_id" },
        );
        if (error) throw error;
        setEnrollment({ startedAt: now, totalWeeks, status: "active" });
      } finally {
        setStarting(false);
      }
    },
    [user, enrollment?.totalWeeks],
  );

  const startedAt = enrollment?.startedAt ?? null;
  const totalWeeks = enrollment?.totalWeeks ?? DEFAULT_WEEKS;

  return {
    loading,
    starting,
    error,
    started: !!startedAt,
    startedAt,
    totalWeeks,
    status: enrollment?.status ?? "not_started",
    currentWeek: weekFromStart(startedAt, totalWeeks),
    startProgram,
    reload: load,
  };
}
