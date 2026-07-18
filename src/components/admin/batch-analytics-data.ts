import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type BatchParticipant = {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  my_week: number;
  weeks_done: number;
  total_weeks: number;
  pending_proofs: number;
  points: number;
  habits_today: number;
  at_risk: boolean;
  last_active_at: string | null;
  coaches: { coach_id: string; full_name: string | null; reviews_30d: number }[];
};

export type BatchCoach = {
  coach_id: string;
  full_name: string | null;
  avatar_url: string | null;
  participants: number;
  at_risk: number;
  avg_habits_today: number;
  reviews_30d: number;
  last_active_at: string | null;
};

export type BatchMentor = {
  mentor_id: string;
  full_name: string | null;
  avatar_url: string | null;
  reviews_30d: number;
  habit_reviews_30d: number;
  last_active_at: string | null;
};

export type BatchAnalytics = {
  batch: {
    id: string;
    name: string;
    status: string;
    start_date: string | null;
    program_id: string | null;
  } | null;
  summary: {
    members: number;
    active_7d: number;
    avg_progress_pct: number;
    at_risk: number;
    pending_proofs: number;
    total_points: number;
  };
  participants: BatchParticipant[];
  coaches: BatchCoach[];
  mentors: BatchMentor[];
  trends: {
    habit_14d: { date: string; pct: number }[];
    points_30d: { date: string; points: number }[];
  };
};

/**
 * Everything about ONE batch in a single round trip: summary, its participants
 * (with their assigned coaches), the coaches serving it, mentors with
 * batch-scoped numbers, and batch-scoped trends.
 *
 * `batchId === null` is meaningful — it returns participants in no batch.
 * Pass `enabled: false` while no selection has been made yet.
 */
export function useBatchAnalytics(batchId: string | null, enabled = true) {
  const [data, setData] = useState<BatchAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!enabled) return;
    // Omitting the arg hits the function's `default null`, which is exactly the
    // "participants in no batch" case — so null and undefined agree here.
    const { data: d, error: e } = await supabase.rpc("admin_batch_analytics", {
      _batch_id: batchId ?? undefined,
    });
    if (e) {
      setError(e.message);
    } else {
      setData(d as unknown as BatchAnalytics);
      setError(null);
    }
    setLoading(false);
  }, [batchId, enabled]);

  useEffect(() => {
    setLoading(true);
    void load();
    const t = setInterval(() => void load(), 30_000);
    return () => clearInterval(t);
  }, [load]);

  return { data, loading, error, reload: load };
}
