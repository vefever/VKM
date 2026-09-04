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
 * The participant's current program week, relative to their batch's start date.
 * Returns 0 before the program starts. Day 0–6 = week 1, day 7–13 = week 2, …,
 * clamped to the program length.
 *
 * A start date in the FUTURE returns 0, not week 1. The old Math.max(1, …) floor
 * meant a batch starting next week already read as week 1, which is how Batch 17
 * participants were able to log habits days before their programme began.
 */
export function weekFromStart(startedAt: Date | null, totalWeeks = DEFAULT_WEEKS): number {
  if (!startedAt) return 0;
  const days = differenceInCalendarDays(startOfToday(), startOfDay(startedAt));
  if (days < 0) return 0;
  return Math.min(totalWeeks, Math.floor(days / 7) + 1);
}

/**
 * The start date set by staff on the participant's batch.
 *
 * This is the single source of truth for when a programme begins: an admin,
 * coach or mentor sets it when creating the batch, and every date the
 * participant sees is measured from it. Returns null when they have no batch, or
 * the batch has no date set yet.
 */
export async function fetchBatchStartDate(userId: string): Promise<Date | null> {
  const { data } = await supabase
    .from("batch_members")
    .select("batches(start_date)")
    .eq("user_id", userId)
    .eq("role", "participant");
  const dates = (data ?? [])
    .map(
      (r) =>
        (r as unknown as { batches: { start_date: string | null } | null }).batches?.start_date,
    )
    .filter((d): d is string => !!d);
  if (!dates.length) return null;
  // Newest batch wins if someone is in more than one.
  dates.sort((a, b) => b.localeCompare(a));
  return new Date(`${dates[0]}T00:00:00`);
}

async function fetchEnrollment(userId: string): Promise<Enrollment> {
  const [{ data, error }, batchStart] = await Promise.all([
    supabase
      .from("program_enrollments")
      .select("started_at, total_weeks, status")
      .eq("user_id", userId)
      .maybeSingle(),
    fetchBatchStartDate(userId),
  ]);
  if (error) throw error;
  return {
    // The batch's start date wins over whatever is stored on the enrollment row.
    // Staff move a batch's start date and every participant should follow it,
    // rather than being stranded on the date they happened to first log in.
    startedAt: batchStart ?? (data?.started_at ? new Date(data.started_at) : null),
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
      // The programme starts on the date staff set on the batch — not the moment
      // the participant happened to press the button. Falls back to now only for
      // someone with no batch or no date set on it.
      const start = (await fetchBatchStartDate(user.id)) ?? now;
      const { error: err } = await supabase.from("program_enrollments").upsert(
        {
          user_id: user.id,
          started_at: start.toISOString(),
          total_weeks: totalWeeks,
          status: "active",
          updated_at: now.toISOString(),
        },
        { onConflict: "user_id" },
      );
      if (err) throw err;
      return { startedAt: start, totalWeeks, status: "active" as const };
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
