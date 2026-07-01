import { useEffect, useState } from "react";
import { differenceInCalendarDays } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { weekFromStart } from "@/components/participant/enrollment-data";

// One aggregated row per participant (from coach_cohort_overview, RLS-scoped to
// the calling coach's batches). Shared by the cohort table and the coach home.
export type RpcRow = {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  business_name: string | null;
  batch_id: string | null;
  batch_name: string | null;
  mrr_inr: number | null;
  points: number;
  weeks_approved: number;
  pending_proofs: number;
  last_proof_at: string | null;
  started_at: string | null;
  total_weeks: number;
  habit_active_3d: boolean;
  focus_minutes_today: number;
  actions_done: number;
  actions_total: number;
};

export type CohortRow = RpcRow & {
  name: string;
  started: boolean;
  currentWeek: number;
  behind: number;
  lastProofDays: number | null;
  atRisk: boolean;
  reasons: string[]; // plain-language: "2 weeks behind", "No proof this week"…
};

export function useCohort() {
  const [rows, setRows] = useState<CohortRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    // Rapid hydration logging in the last 24h → surfaces as an attention flag.
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    void Promise.all([
      supabase.rpc("coach_cohort_overview"),
      supabase.from("water_events").select("user_id").eq("rapid", true).gte("created_at", since),
    ]).then(([rpcRes, waterRes]) => {
      if (!active) return;
      const { data, error: err } = rpcRes;
      if (err) {
        setError(err.message);
        setLoading(false);
        return;
      }
      const rapidByUser = new Map<string, number>();
      ((waterRes.data ?? []) as { user_id: string }[]).forEach((w) =>
        rapidByUser.set(w.user_id, (rapidByUser.get(w.user_id) ?? 0) + 1),
      );
      const now = new Date();
      const mapped: CohortRow[] = ((data ?? []) as RpcRow[]).map((r) => {
        const startedAt = r.started_at ? new Date(r.started_at) : null;
        const started = !!startedAt;
        const currentWeek = weekFromStart(startedAt, r.total_weeks);
        const behind = started ? Math.max(0, currentWeek - Number(r.weeks_approved)) : 0;
        const lastProofDays = r.last_proof_at
          ? differenceInCalendarDays(now, new Date(r.last_proof_at))
          : null;
        const rapidWater = rapidByUser.get(r.user_id) ?? 0;
        const reasons: string[] = [];
        if (started && behind >= 2) reasons.push(`${behind} weeks behind`);
        if (!r.habit_active_3d) reasons.push("No habit activity in 3 days");
        if (started && (lastProofDays == null || lastProofDays > 7))
          reasons.push("No proof this week");
        if (rapidWater > 0)
          reasons.push(`Rapid water logging (${rapidWater}× in 24h)`);
        return {
          ...r,
          name: r.full_name ?? "Participant",
          started,
          currentWeek,
          behind,
          lastProofDays,
          atRisk: started && reasons.length > 0,
          reasons,
        };
      });
      setRows(mapped);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  return { rows, loading, error };
}
