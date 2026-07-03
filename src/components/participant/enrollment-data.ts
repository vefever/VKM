import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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

async function fetchEnrollment(userId: string): Promise<Enrollment> {
  const { data, error } = await supabase
    .from("program_enrollments")
    .select("started_at, total_weeks, status")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return {
    startedAt: data?.started_at ? new Date(data.started_at) : null,
    totalWeeks: data?.total_weeks ?? DEFAULT_WEEKS,
    status: (data?.status as Enrollment["status"]) ?? "not_started",
  };
}

// This is read on nearly every participant page (habits, progress, business,
// focus, calendar, proof submission…) but changes only via an explicit
// "start program" action or an admin edit — a prime case where the old
// useEffect+useState pattern re-fetched from zero on every single page visit.
// useQuery caches it per-user so navigating between those pages is instant
// after the first load, while still refreshing in the background eventually.
export function useEnrollment() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = ["enrollment", user?.id] as const;

  const {
    data: enrollment,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey,
    queryFn: () => fetchEnrollment(user!.id),
    enabled: !!user,
    staleTime: 5 * 60_000,
  });

  const startMutation = useMutation({
    mutationFn: async (totalWeeks: number) => {
      if (!user) throw new Error("Not signed in");
      const now = new Date();
      const { error: err } = await supabase.from("program_enrollments").upsert(
        {
          user_id: user.id,
          started_at: now.toISOString(),
          total_weeks: totalWeeks,
          status: "active",
          updated_at: now.toISOString(),
        },
        { onConflict: "user_id" },
      );
      if (err) throw err;
      return { startedAt: now, totalWeeks, status: "active" as const };
    },
    onSuccess: (next) => {
      queryClient.setQueryData(queryKey, next);
    },
  });

  const startProgram = useCallback(
    (totalWeeks = enrollment?.totalWeeks ?? DEFAULT_WEEKS) => startMutation.mutateAsync(totalWeeks),
    [startMutation, enrollment?.totalWeeks],
  );

  const startedAt = enrollment?.startedAt ?? null;
  const totalWeeks = enrollment?.totalWeeks ?? DEFAULT_WEEKS;

  return {
    loading: isLoading,
    starting: startMutation.isPending,
    error: error ? (error instanceof Error ? error.message : "Could not load your program") : null,
    started: !!startedAt,
    startedAt,
    totalWeeks,
    status: enrollment?.status ?? "not_started",
    currentWeek: weekFromStart(startedAt, totalWeeks),
    startProgram,
    reload: refetch,
  };
}
