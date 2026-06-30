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
    void supabase.rpc("coach_cohort_overview").then(({ data, error: err }) => {
      if (!active) return;
      if (err) {
        setError(err.message);
        setLoading(false);
        return;
      }
      const now = new Date();
      const mapped: CohortRow[] = ((data ?? []) as RpcRow[]).map((r) => {
        const startedAt = r.started_at ? new Date(r.started_at) : null;
        const started = !!startedAt;
        const currentWeek = weekFromStart(startedAt, r.total_weeks);
        const behind = started ? Math.max(0, currentWeek - Number(r.weeks_approved)) : 0;
        const lastProofDays = r.last_proof_at
          ? differenceInCalendarDays(now, new Date(r.last_proof_at))
          : null;
        const reasons: string[] = [];
        if (started && behind >= 2) reasons.push(`${behind} weeks behind`);
        if (!r.habit_active_3d) reasons.push("No habit activity in 3 days");
        if (started && (lastProofDays == null || lastProofDays > 7))
          reasons.push("No proof this week");
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
