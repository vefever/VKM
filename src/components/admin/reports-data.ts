import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// Reports load on-demand when the admin picks a scope + date range — never
// polled — to keep database load minimal (contrast with the live-polling
// Analytics dashboard).

export type Person = { user_id: string; full_name: string | null; avatar_url: string | null; roles: string[] };

export function usePeopleSearch(query: string) {
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      const { data } = await supabase.rpc("admin_people_search", { _q: query, _limit: 20 });
      if (!cancelled) {
        setPeople((data as Person[]) ?? []);
        setLoading(false);
      }
    }, 250); // debounce keystrokes
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query]);

  return { people, loading };
}

export type IndividualReport = {
  profile: {
    user_id: string;
    full_name: string | null;
    avatar_url: string | null;
    phone: string | null;
    is_alumni: boolean;
    email: string | null;
    joined_at: string | null;
    last_active_at: string | null;
    roles: string[];
  } | null;
  enrollment: { started_at: string | null; total_weeks: number; status: string } | null;
  batch_name: string | null;
  coaches: string[];
  total_points: number;
  business: {
    business_name: string | null;
    industry: string | null;
    location: string | null;
    current_mrr_inr: number | null;
    target_mrr_inr: number | null;
    monthly_leads: number | null;
    closing_rate_pct: number | null;
    team_size: number | null;
  } | null;
  milestones_count: number;
  milestones: { code: string; awarded_at: string }[];
  kpis: {
    points_range: number;
    weeks_approved: number;
    weeks_pending: number;
    weeks_rejected: number;
    proof_approval_rate: number;
    habit_completion_avg_pct: number;
    days_active_range: number;
    streak_current: number;
    focus_minutes_range: number;
    focus_sessions_range: number;
    water_adherence_pct: number;
    steps_avg: number;
    meetings_attended_range: number;
    tickets_raised_range: number;
  };
  habit_trend: { date: string; done: number; pct: number }[];
  points_trend: { date: string; points: number }[];
  proof_history: { week_no: number; proof_status: string; points: number; updated_at: string }[];
  recent_activity: { kind: string; label: string; ts: string }[];
};

export type RosterRow = {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  current_week: number;
  weeks_approved: number;
  points_range: number;
  completion_pct_range: number;
  at_risk: boolean;
};

export type BatchReport = {
  batch: { batch_id: string; name: string; status: string; start_date: string | null } | null;
  kpis: {
    participant_count: number;
    avg_completion_pct: number;
    points_range: number;
    at_risk_count: number;
    alumni_count: number;
    active_3d_pct: number;
    coach_count: number;
    unassigned_count: number;
  };
  top_performers: { full_name: string | null; points_range: number }[];
  habit_trend: { date: string; avg_completion_pct: number }[];
  roster: RosterRow[];
};

export type CoachReport = {
  coach: { user_id: string; full_name: string | null; avatar_url: string | null } | null;
  kpis: {
    participant_count: number;
    avg_completion_pct: number;
    points_awarded_range: number;
    reviews_range: number;
    approvals_range: number;
    approval_rate: number;
    avg_turnaround_h: number;
    notes_range: number;
    meetings_range: number;
    at_risk_count: number;
    active_3d_pct: number;
  };
  habit_trend: { date: string; avg_completion_pct: number }[];
  roster: RosterRow[];
};

export type MentorReport = {
  mentor: { user_id: string; full_name: string | null; avatar_url: string | null } | null;
  kpis: {
    proofs_reviewed_range: number;
    proofs_approved_range: number;
    proofs_rejected_range: number;
    meetings_hosted_range: number;
    tickets_resolved_range: number;
    batches_overseen: number;
    coaches_total: number;
  };
  review_trend: { date: string; reviews: number }[];
  recent_reviews: { kind: string; label: string; ts: string }[];
};

function useOnDemandReport<T>(
  fn: "admin_report_individual" | "admin_report_batch" | "admin_report_coach" | "admin_report_mentor",
  idArg: string,
  idKey: string,
  from: string,
  to: string,
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!idArg) {
      setData(null);
      return;
    }
    setLoading(true);
    const { data: d, error: e } = await supabase.rpc(fn, {
      [idKey]: idArg,
      _from: from,
      _to: to,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    if (e) setError(e.message);
    else {
      setData(d as T);
      setError(null);
    }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fn, idArg, idKey, from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, loading, error, reload: load };
}

export const useIndividualReport = (userId: string, from: string, to: string) =>
  useOnDemandReport<IndividualReport>("admin_report_individual", userId, "_user_id", from, to);

export const useBatchReport = (batchId: string, from: string, to: string) =>
  useOnDemandReport<BatchReport>("admin_report_batch", batchId, "_batch_id", from, to);

export const useCoachReport = (coachId: string, from: string, to: string) =>
  useOnDemandReport<CoachReport>("admin_report_coach", coachId, "_coach_id", from, to);

export const useMentorReport = (mentorId: string, from: string, to: string) =>
  useOnDemandReport<MentorReport>("admin_report_mentor", mentorId, "_mentor_id", from, to);

// Lightweight pickers — reuse the existing analytics RPCs (already return
// name-labeled lists) instead of adding new ones.
export function usePickerLists() {
  const [batches, setBatches] = useState<{ batch_id: string; name: string; status: string }[]>([]);
  const [coaches, setCoaches] = useState<{ coach_id: string; full_name: string | null }[]>([]);
  const [mentors, setMentors] = useState<{ mentor_id: string; full_name: string | null }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const [b, c, m] = await Promise.all([
        supabase.rpc("admin_analytics_batches"),
        supabase.rpc("admin_analytics_coaches"),
        supabase.rpc("admin_analytics_mentors"),
      ]);
      setBatches((b.data as typeof batches) ?? []);
      setCoaches((c.data as typeof coaches) ?? []);
      setMentors((m.data as typeof mentors) ?? []);
      setLoading(false);
    })();
  }, []);

  return { batches, coaches, mentors, loading };
}

export function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return fmtDate(d);
}
