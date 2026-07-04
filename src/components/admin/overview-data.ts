import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { ActivityRow } from "@/components/admin/analytics-data";

// Re-export the analytics hooks the command center composes, so the page has a
// single data-layer import.
export {
  useAnalyticsOverview,
  useAnalyticsBatches,
  useLiveActivity,
  timeAgo,
  type ActivityRow,
  type BatchRow,
  type AnalyticsOverview,
} from "@/components/admin/analytics-data";

export type LiveParticipant = {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  business_name: string | null;
  mrr_inr: number | null;
  batch_id: string | null;
  batch_name: string | null;
  batch_status: string | null;
  started_at: string | null;
  total_weeks: number;
  current_week: number;
  enroll_status: string;
  points: number;
  weeks_approved: number;
  pending_proofs: number;
  last_proof_at: string | null;
  habits_done_today: number;
  focus_minutes_today: number;
  actions_done: number;
  actions_total: number;
  water_pct_today: number;
  open_tickets: number;
  habit_active_3d: boolean;
  last_active_at: string | null;
  is_online_15m: boolean;
  at_risk: boolean;
};

// The live participant roster for the whole platform (or one batch). Refetches
// every 20s AND the instant a habit tick or points award lands (realtime), so
// the tracker is genuinely live. Only the first load shows a skeleton — later
// refetches keep the current rows on screen (no flash), matching usePolledRpc.
export function useLiveParticipants(batchId: string | null) {
  const [rows, setRows] = useState<LiveParticipant[]>([]);
  const [loading, setLoading] = useState(true);
  const firstLoad = useRef(true);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("admin_live_participants", { _batch_id: batchId ?? undefined });
    if (!error && data) setRows(data as LiveParticipant[]);
    if (firstLoad.current) {
      firstLoad.current = false;
      setLoading(false);
    }
  }, [batchId]);

  useEffect(() => {
    firstLoad.current = true;
    setLoading(true);
    void load();
    const poll = setInterval(() => void load(), 20_000);

    // A burst of habit/points inserts collapses into one refetch.
    const nudge = () => {
      if (debounce.current) clearTimeout(debounce.current);
      debounce.current = setTimeout(() => void load(), 1200);
    };
    const ch = supabase
      .channel("admin-live-participants")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "habit_logs" }, nudge)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "points_ledger" }, nudge)
      .subscribe();

    return () => {
      clearInterval(poll);
      if (debounce.current) clearTimeout(debounce.current);
      void supabase.removeChannel(ch);
    };
  }, [load]);

  return { rows, loading, reload: load };
}

export type OverviewKpis = {
  participants: number;
  online: number;
  todayCompletionPct: number;
  atRisk: number;
  pendingProofs: number;
  openTickets: number;
  revenueInr: number;
};

// KPI tiles are derived straight from the live roster so they can never drift
// from the tracker below them (single source of truth).
export function deriveKpis(rows: LiveParticipant[]): OverviewKpis {
  const started = rows.filter((r) => r.enroll_status === "active" || !!r.started_at);
  const todayCompletionPct = started.length
    ? Math.round((started.reduce((n, r) => n + Math.min(6, r.habits_done_today), 0) / started.length / 6) * 100)
    : 0;
  return {
    participants: rows.length,
    online: rows.filter((r) => r.is_online_15m).length,
    todayCompletionPct,
    atRisk: rows.filter((r) => r.at_risk).length,
    pendingProofs: rows.reduce((n, r) => n + Number(r.pending_proofs), 0),
    openTickets: rows.reduce((n, r) => n + Number(r.open_tickets), 0),
    // Cohort business revenue = Σ each participant's current MRR.
    revenueInr: rows.reduce((n, r) => n + (Number(r.mrr_inr) || 0), 0),
  };
}

// ₹ short form: 4800000 → "₹48L", 250000 → "₹2.5L", 5000 → "₹5,000".
export function inrShort(n: number): string {
  if (!n) return "₹0";
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(n % 1e7 === 0 ? 0 : 1)}Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(n % 1e5 === 0 ? 0 : 1)}L`;
  return `₹${n.toLocaleString("en-IN")}`;
}

// ---------------------------------------------------------------------------
// Live activity feed decoding (shared with the analytics page's logic).
// ---------------------------------------------------------------------------
const HABIT_LABELS: Record<string, string> = {
  walking: "Walking 20 Min",
  water: "Drink Water (4L)",
  meditation: "Meditation",
  affirmation: "Affirmation",
  gratitude: "Gratitude Journal",
  todo: "Daily To-Do List",
};

export function describeActivity(row: ActivityRow): string {
  if (row.source === "habit" && row.reference) {
    const parts = row.reference.split(":"); // "habit:<day>:<habit_id>"
    const habitId = parts[2] ?? parts[1];
    return `completed ${HABIT_LABELS[habitId] ?? habitId ?? "a habit"}`;
  }
  const bySource: Record<string, string> = {
    attend: "marked attendance",
    task: "submitted a weekly task",
    revenue: "logged a revenue update",
    leads: "logged new leads",
    closing: "logged a closing update",
    bonus: "received a bonus",
    manual: "received a manual award",
  };
  return bySource[row.source] ?? "was awarded points";
}

export function lastSeenLabel(iso: string | null): string {
  if (!iso) return "never";
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}
