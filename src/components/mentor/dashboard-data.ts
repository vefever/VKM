import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCohort } from "@/components/coach/cohort-data";
import { stageFor } from "@/lib/vkm/program";

export type BatchPipelineRow = { batch_id: string; batch_name: string; count: number };
export type TopPerformer = { user_id: string; name: string; business: string | null; points: number; stage: string };

type LeaderboardRow = {
  user_id: string;
  full_name: string;
  business_name: string | null;
  batch_id: string;
  points: number;
};

// Composes the mentor dashboard from existing, already-scoped sources:
//  - coach_cohort_overview() (org-wide for a mentor, via useCohort()) for
//    participant/completion/at-risk figures
//  - batches + batch_members + profiles.is_alumni (RLS already permits a
//    mentor to read all of these directly, no new RPC needed) for active
//    batch counts and graduation rate
//  - get_leaderboard() for points/ranking, filtered to active batches
// No section here is invented — every number traces back to a real table.
export function useMentorDashboardData() {
  const { rows: cohortRows, loading: cohortLoading } = useCohort();
  const [activeBatches, setActiveBatches] = useState<{ id: string; name: string }[]>([]);
  const [graduation, setGraduation] = useState<{ alumni: number; total: number }>({ alumni: 0, total: 0 });
  const [leaderboardRows, setLeaderboardRows] = useState<LeaderboardRow[]>([]);
  const [loadingExtra, setLoadingExtra] = useState(true);

  useEffect(() => {
    let active = true;
    void Promise.all([
      supabase.from("batches").select("id, name").eq("status", "active"),
      supabase.from("batch_members").select("user_id").eq("role", "participant"),
      supabase.from("profiles").select("id, is_alumni"),
      supabase.rpc("get_leaderboard"),
    ]).then(([batchesRes, membersRes, profilesRes, lbRes]) => {
      if (!active) return;
      setActiveBatches((batchesRes.data ?? []) as { id: string; name: string }[]);

      const alumniIds = new Set(
        ((profilesRes.data ?? []) as { id: string; is_alumni: boolean }[])
          .filter((p) => p.is_alumni)
          .map((p) => p.id),
      );
      const memberIds = new Set(((membersRes.data ?? []) as { user_id: string }[]).map((m) => m.user_id));
      const alumniCount = [...memberIds].filter((id) => alumniIds.has(id)).length;
      setGraduation({ alumni: alumniCount, total: memberIds.size });

      setLeaderboardRows((lbRes.data ?? []) as LeaderboardRow[]);
      setLoadingExtra(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const loading = cohortLoading || loadingExtra;
  const activeBatchIds = new Set(activeBatches.map((b) => b.id));

  const completionPct = (weeksApproved: number, totalWeeks: number) =>
    totalWeeks > 0 ? (weeksApproved / totalWeeks) * 100 : 0;

  const activeParticipants = cohortRows.filter(
    (r) => r.started && r.batch_id && activeBatchIds.has(r.batch_id),
  );
  const avgCompletionPct = activeParticipants.length
    ? Math.round(
        activeParticipants.reduce((sum, r) => sum + completionPct(r.weeks_approved, r.total_weeks), 0) /
          activeParticipants.length,
      )
    : 0;

  const graduationRatePct = graduation.total > 0 ? Math.round((graduation.alumni / graduation.total) * 100) : 0;

  const pipeline: BatchPipelineRow[] = activeBatches
    .map((b) => ({
      batch_id: b.id,
      batch_name: b.name,
      count: cohortRows.filter((r) => r.batch_id === b.id).length,
    }))
    .sort((a, b) => b.count - a.count);

  const topPerformers: TopPerformer[] = [...leaderboardRows]
    .filter((r) => activeBatchIds.has(r.batch_id))
    .sort((a, b) => b.points - a.points)
    .slice(0, 3)
    .map((r) => ({
      user_id: r.user_id,
      name: r.full_name,
      business: r.business_name,
      points: r.points,
      stage: stageFor(r.points).name,
    }));

  const atRiskCount = cohortRows.filter(
    (r) => r.atRisk && r.batch_id && activeBatchIds.has(r.batch_id),
  ).length;

  let lowestCompletionBatch: { name: string; pct: number } | null = null;
  for (const b of activeBatches) {
    const inBatch = cohortRows.filter((r) => r.batch_id === b.id && r.started);
    if (inBatch.length === 0) continue;
    const pct = Math.round(
      inBatch.reduce((sum, r) => sum + completionPct(r.weeks_approved, r.total_weeks), 0) / inBatch.length,
    );
    if (!lowestCompletionBatch || pct < lowestCompletionBatch.pct) lowestCompletionBatch = { name: b.name, pct };
  }

  // Within striking distance of the top stage (Growth Champion starts at 8500).
  const nearGraduationCount = cohortRows.filter((r) => r.points >= 7500 && r.points < 8500).length;

  return {
    loading,
    kpis: {
      activeBatches: activeBatches.length,
      activeParticipants: activeParticipants.length,
      avgCompletionPct,
      graduationRatePct,
    },
    pipeline,
    topPerformers,
    signals: { atRiskCount, lowestCompletionBatch, nearGraduationCount },
  };
}
