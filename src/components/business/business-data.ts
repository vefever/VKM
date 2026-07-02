import { useCallback, useEffect, useMemo, useState } from "react";
import { format, startOfMonth } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { type BusinessBrain } from "@/components/coach/coach-data";

export type SnapshotStatus = "pending" | "approved" | "rejected";

export type BusinessSnapshot = {
  id: string;
  month: string; // YYYY-MM-DD (first of month)
  revenue_inr: number | null;
  mrr_inr: number | null;
  leads: number | null;
  deals: number | null;
  pipeline_inr: number | null;
  avg_deal_inr: number | null;
  closing_rate_pct: number | null;
  followup_pct: number | null;
  nps: number | null;
  note: string | null;
  reflection_win: string | null;
  reflection_blocker: string | null;
  status: SnapshotStatus;
  coach_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
};

export type SnapshotInput = Pick<
  BusinessSnapshot,
  | "revenue_inr"
  | "mrr_inr"
  | "leads"
  | "deals"
  | "pipeline_inr"
  | "avg_deal_inr"
  | "closing_rate_pct"
  | "followup_pct"
  | "nps"
  | "note"
  | "reflection_win"
  | "reflection_blocker"
>;

export type MetricKey = keyof Omit<SnapshotInput, "note" | "reflection_win" | "reflection_blocker">;

export function monthKey(d: Date): string {
  return format(startOfMonth(d), "yyyy-MM-dd");
}
export function monthLabel(iso: string): string {
  return format(new Date(`${iso}T00:00:00`), "MMMM yyyy");
}
export function monthShort(iso: string): string {
  return format(new Date(`${iso}T00:00:00`), "MMM");
}

const SELECT =
  "id, month, revenue_inr, mrr_inr, leads, deals, pipeline_inr, avg_deal_inr, closing_rate_pct, followup_pct, nps, note, reflection_win, reflection_blocker, status, coach_note, reviewed_by, reviewed_at, created_at";

// ---------------------------------------------------------------------------
// OWNER — profile (slow) + monthly snapshots (fast) + save path.
// ---------------------------------------------------------------------------
export function useBusinessData() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<BusinessBrain | null>(null);
  const [snapshots, setSnapshots] = useState<BusinessSnapshot[]>([]);
  const [reviewerName, setReviewerName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const currentMonth = useMemo(() => monthKey(new Date()), []);

  const load = useCallback(async () => {
    if (!user) return;
    const [{ data: brain }, { data: snaps }] = await Promise.all([
      supabase
        .from("business_brains")
        .select(
          "business_name, industry, location, years_running, current_mrr_inr, target_mrr_inr, team_size, top_products, lead_sources, monthly_leads, closing_rate_pct, avg_deal_inr, top_challenges, success_definition, website, legal_structure, business_model, founded_year, num_customers, pricing_model, usp, target_customer, main_competitors, social_handle, logo_url",
        )
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("business_snapshots")
        .select(SELECT)
        .eq("user_id", user.id)
        .order("month", { ascending: true }),
    ]);
    const rows = (snaps ?? []) as BusinessSnapshot[];
    setProfile((brain ?? null) as BusinessBrain | null);
    setSnapshots(rows);

    // Name of the coach who last reviewed — so "Reviewed by Soumya" can show.
    const reviewerId = [...rows].reverse().find((s) => s.reviewed_by)?.reviewed_by;
    if (reviewerId) {
      const { data: p } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", reviewerId)
        .maybeSingle();
      setReviewerName(p?.full_name ?? null);
    } else {
      setReviewerName(null);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
    if (!user) return;
    const ch = supabase
      .channel(`biz:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "business_snapshots",
          filter: `user_id=eq.${user.id}`,
        },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user, load]);

  const saveSnapshot = useCallback(
    async (monthISO: string, input: SnapshotInput) => {
      if (!user) return { error: "Not signed in" };
      const { error } = await supabase
        .from("business_snapshots")
        .upsert({ user_id: user.id, month: monthISO, ...input }, { onConflict: "user_id,month" });
      return { error: error?.message };
    },
    [user],
  );

  const latest = snapshots.length ? snapshots[snapshots.length - 1] : null;
  const previous = snapshots.length > 1 ? snapshots[snapshots.length - 2] : null;
  const byMonth = useMemo(() => {
    const m = new Map<string, BusinessSnapshot>();
    snapshots.forEach((s) => m.set(s.month, s));
    return m;
  }, [snapshots]);

  return {
    profile,
    snapshots,
    latest,
    previous,
    byMonth,
    currentMonth,
    reviewerName,
    loading,
    saveSnapshot,
    reload: load,
  };
}

// ---------------------------------------------------------------------------
// TEAM — the participant's own business team roster.
// ---------------------------------------------------------------------------
export type TeamMember = {
  id: string;
  name: string;
  role: string | null;
  department: string | null;
  email: string | null;
  phone: string | null;
  monthly_salary_inr: number | null;
  status: "active" | "inactive";
  joined_on: string | null;
  notes: string | null;
};
export type TeamMemberInput = Omit<TeamMember, "id">;

const TEAM_SELECT =
  "id, name, role, department, email, phone, monthly_salary_inr, status, joined_on, notes";

export function useTeamMembers() {
  const { user } = useAuth();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("team_members")
      .select(TEAM_SELECT)
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });
    setMembers((data ?? []) as TeamMember[]);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = useCallback(
    async (id: string | null, input: TeamMemberInput) => {
      if (!user) return { error: "Not signed in" };
      const { error } = id
        ? await supabase.from("team_members").update(input).eq("id", id)
        : await supabase.from("team_members").insert({ user_id: user.id, ...input });
      if (!error) await load();
      return { error: error?.message };
    },
    [user, load],
  );

  const remove = useCallback(
    async (id: string) => {
      await supabase.from("team_members").delete().eq("id", id);
      await load();
    },
    [load],
  );

  return { members, loading, save, remove, reload: load };
}

// month-over-month delta as a signed percentage, or null when not computable.
export function momDelta(curr: number | null, prev: number | null): number | null {
  if (curr == null || prev == null || prev === 0) return null;
  return Math.round(((curr - prev) / prev) * 100);
}

// ---------------------------------------------------------------------------
// STAFF — review queue for self-reported numbers.
// ---------------------------------------------------------------------------
export type SnapshotReviewItem = BusinessSnapshot & { user_id: string; name: string };

export function useSnapshotReviewQueue() {
  const { user } = useAuth();
  const [items, setItems] = useState<SnapshotReviewItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("business_snapshots")
      .select(`${SELECT}, user_id`)
      .eq("status", "pending")
      .order("created_at", { ascending: true });
    const rows = data ?? [];
    const ids = [...new Set(rows.map((r) => r.user_id))];
    const names: Record<string, string> = {};
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", ids);
      (profs ?? []).forEach((p) => (names[p.id] = p.full_name ?? "Participant"));
    }
    setItems(
      rows.map((r) => ({ ...(r as SnapshotReviewItem), name: names[r.user_id] ?? "Participant" })),
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const ch = supabase
      .channel("biz_review")
      .on("postgres_changes", { event: "*", schema: "public", table: "business_snapshots" }, () =>
        load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [load]);

  const review = useCallback(
    async (id: string, status: "approved" | "rejected", note: string) => {
      if (!user) return;
      setItems((prev) => prev.filter((i) => i.id !== id));
      await supabase
        .from("business_snapshots")
        .update({
          status,
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
          coach_note: note.trim() || null,
        })
        .eq("id", id);
    },
    [user],
  );

  return { items, loading, review };
}
