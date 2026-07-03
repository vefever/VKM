import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type RpcName = keyof Database["public"]["Functions"];

export type AnalyticsOverview = {
  kpis: {
    total_participants: number;
    total_coaches: number;
    total_mentors: number;
    total_admins: number;
    active_batches: number;
    new_signups_7d: number;
    new_signups_30d: number;
    active_last_15m: number;
    completion_today_pct: number;
    at_risk_count: number;
    open_tickets: number;
  };
  signup_trend: { date: string; count: number }[];
  habit_trend: { date: string; active_participants: number; avg_completion_pct: number }[];
  points_trend: { date: string; points: number }[];
};

export type CoachRow = {
  coach_id: string;
  full_name: string | null;
  avatar_url: string | null;
  participant_count: number;
  avg_completion_pct: number;
  at_risk_count: number;
  points_awarded_30d: number;
  last_active_at: string | null;
};

export type BatchRow = {
  batch_id: string;
  name: string;
  status: string;
  participant_count: number;
  avg_week: number | null;
  avg_completion_pct: number;
  at_risk_count: number;
};

export type MentorRow = {
  mentor_id: string;
  full_name: string | null;
  avatar_url: string | null;
  proofs_reviewed_30d: number;
  tickets_handled_30d: number;
  last_active_at: string | null;
};

export type ActivityRow = {
  id: string;
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  source: string;
  reference: string | null;
  points: number;
  batch_id: string | null;
  awarded_at: string;
};

// Generic "poll an RPC on an interval, keep the previous render on refetch"
// hook — per dataviz guidance, a background refresh must never flash a
// skeleton; only the very first load shows the loading state.
function usePolledRpc<T>(fn: RpcName, intervalMs: number, args?: Record<string, unknown>) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const firstLoad = useRef(true);

  const load = useCallback(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: d, error: e } = await supabase.rpc(fn, args as any);
    if (e) {
      setError(e.message);
    } else {
      setData(d as T);
      setError(null);
    }
    if (firstLoad.current) {
      firstLoad.current = false;
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fn]);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), intervalMs);
    return () => clearInterval(id);
  }, [load, intervalMs]);

  return { data, loading, error, reload: load };
}

export function useAnalyticsOverview() {
  return usePolledRpc<AnalyticsOverview>("admin_analytics_overview", 20_000);
}

export function useAnalyticsCoaches() {
  const { data, loading, error } = usePolledRpc<CoachRow[]>("admin_analytics_coaches", 30_000);
  return { coaches: data ?? [], loading, error };
}

export function useAnalyticsBatches() {
  const { data, loading, error } = usePolledRpc<BatchRow[]>("admin_analytics_batches", 30_000);
  return { batches: data ?? [], loading, error };
}

export function useAnalyticsMentors() {
  const { data, loading, error } = usePolledRpc<MentorRow[]>("admin_analytics_mentors", 30_000);
  return { mentors: data ?? [], loading, error };
}

// Live activity feed: polls the existing get_leaderboard_activity() RPC (fast
// interval) AND subscribes to realtime INSERTs on points_ledger / habit_logs so
// a fresh event appears the instant it happens, not just on the next poll tick.
export function useLiveActivity(limit = 30) {
  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const rowsRef = useRef<ActivityRow[]>([]);
  rowsRef.current = rows;

  const load = useCallback(async () => {
    const { data } = await supabase.rpc("get_leaderboard_activity", { _limit: limit });
    if (data) setRows(data as ActivityRow[]);
    setLoading(false);
  }, [limit]);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), 10_000);

    // Push-update: any new points_ledger row (habit tick, proof approval,
    // manual award, …) refetches immediately instead of waiting for the poll.
    const channel = supabase
      .channel("admin-analytics-activity")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "points_ledger" },
        () => void load(),
      )
      .subscribe();

    return () => {
      clearInterval(id);
      void supabase.removeChannel(channel);
    };
  }, [load]);

  return { activity: rows, loading };
}

export function timeAgo(iso: string | null): string {
  if (!iso) return "never";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) return "just now";
  const min = Math.floor(ms / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  return new Date(iso).toLocaleDateString();
}
