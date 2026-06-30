import { useEffect, useState } from "react";
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
  const [points, setPoints] = useState<number | null>(null);
  const [milestones, setMilestones] = useState<string[]>([]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    void Promise.all([
      supabase.from("points_ledger").select("points").eq("user_id", user.id),
      supabase.from("milestone_awards").select("milestone_code").eq("user_id", user.id),
    ]).then(([{ data: pts }, { data: ms }]) => {
      if (!active) return;
      setPoints((pts ?? []).reduce((n, r) => n + (r.points ?? 0), 0));
      setMilestones((ms ?? []).map((m) => m.milestone_code));
    });
    return () => {
      active = false;
    };
  }, [user]);

  const weeksDone = weeks.filter((w) => w.proof_status === "approved").length;

  return {
    points, // null while loading
    currentWeek: enr.currentWeek, // 0 if not started yet
    totalWeeks: enr.totalWeeks,
    started: enr.started,
    streak: habits.streak,
    todayDone: habits.todayDone,
    weeksDone,
    milestones, // unlocked milestone codes
    loading: enr.loading,
  };
}
