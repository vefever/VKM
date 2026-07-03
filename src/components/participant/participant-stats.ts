import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useEnrollment } from "@/components/participant/enrollment-data";
import { useHabitTracker } from "@/components/habits/habit-tracker";
import { useMyProofs } from "@/components/coach/coach-data";

/**
 * The single source of truth for a participant's headline numbers. Every page
 * that shows points / current week / streak / weeks-done should read from here
 * so the same metric never disagrees with itself across the portal.
 *
 *  - points     → summed from the real `points_ledger` (not a demo constant)
 *  - currentWeek→ per-participant, from their own enrollment start (0 = not started)
 *  - streak     → live from the habit tracker
 *  - weeksDone  → approved weekly proofs
 */
export function useParticipantStats() {
  const { user } = useAuth();
  const enr = useEnrollment();
  const habits = useHabitTracker();
  const { weeks } = useMyProofs();

  // This is the dashboard's headline-numbers hook — the most-revisited page
  // in the app — so caching it means going Dashboard → Habits → Dashboard
  // shows the points/milestones instantly instead of a fresh fetch each time.
  const { data } = useQuery({
    queryKey: ["participant-stats-totals", user?.id],
    queryFn: async () => {
      const [{ data: pts }, { data: ms }] = await Promise.all([
        supabase.from("points_ledger").select("points").eq("user_id", user!.id),
        supabase.from("milestone_awards").select("milestone_code").eq("user_id", user!.id),
      ]);
      return {
        points: (pts ?? []).reduce((n, r) => n + (r.points ?? 0), 0),
        milestones: (ms ?? []).map((m) => m.milestone_code),
      };
    },
    enabled: !!user,
    // Points/milestones change whenever a habit or proof is approved — keep
    // this fresher than the enrollment cache while still short-circuiting
    // rapid page-to-page navigation.
    staleTime: 30_000,
  });

  const weeksDone = weeks.filter((w) => w.proof_status === "approved").length;

  return {
    points: data?.points ?? null, // null while loading
    currentWeek: enr.currentWeek, // 0 if not started yet
    totalWeeks: enr.totalWeeks,
    started: enr.started,
    streak: habits.streak,
    todayDone: habits.todayDone,
    weeksDone,
    milestones: data?.milestones ?? [], // unlocked milestone codes
    loading: enr.loading,
  };
}
