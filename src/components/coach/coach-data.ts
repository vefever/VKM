import { useCallback, useEffect, useState } from "react";
import { differenceInCalendarDays, startOfToday } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { type Attachment } from "@/components/chat/chat-data";
import { profilesDisplayFor } from "@/lib/profiles-display";
import { weekFromStart } from "@/components/participant/enrollment-data";

// Program week derived from the Batch-16 start (matches the habit tracker anchor).
const PROGRAM_START = new Date("2026-04-27T00:00:00");
export function currentWeekNo(): number {
  const day = differenceInCalendarDays(startOfToday(), PROGRAM_START) + 1;
  return Math.min(16, Math.max(1, Math.ceil(day / 7)));
}

// ---------------------------------------------------------------------------
// Full participant profile — personal + business + program progress.
// ---------------------------------------------------------------------------
export type ParticipantProfile = {
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  created_at: string | null;
};
export type BusinessBrain = {
  business_name: string | null;
  industry: string | null;
  location: string | null;
  years_running: number | null;
  current_mrr_inr: number | null;
  target_mrr_inr: number | null;
  team_size: number | null;
  top_products: string | null;
  lead_sources: string | null;
  monthly_leads: number | null;
  closing_rate_pct: number | null;
  avg_deal_inr: number | null;
  top_challenges: string | null;
  success_definition: string | null;
  website: string | null;
  legal_structure: string | null;
  business_model: string | null;
  founded_year: number | null;
  num_customers: number | null;
  pricing_model: string | null;
  usp: string | null;
  target_customer: string | null;
  main_competitors: string | null;
  social_handle: string | null;
  logo_url: string | null;
};
export type WeekRow = {
  id: string;
  week_no: number;
  attended: boolean;
  task_done: boolean;
  proof_url: string | null;
  proof_files: Attachment[];
  proof_note: string | null;
  coach_note: string | null;
  proof_status: string;
  points: number;
  reviewed_at: string | null;
  created_at: string;
};

export function useParticipantProfile(userId: string | null) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<ParticipantProfile | null>(null);
  const [brain, setBrain] = useState<BusinessBrain | null>(null);
  const [weeks, setWeeks] = useState<WeekRow[]>([]);
  const [points, setPoints] = useState(0);
  const [milestones, setMilestones] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!userId) return;
    const [{ data: prof }, { data: br }, { data: wp }, { data: ledger }, { data: ms }] =
      await Promise.all([
        supabase
          .from("profiles")
          .select("full_name, avatar_url, phone, created_at")
          .eq("id", userId)
          .maybeSingle(),
        supabase
          .from("business_brains")
          .select(
            "business_name, industry, location, years_running, current_mrr_inr, target_mrr_inr, team_size, top_products, lead_sources, monthly_leads, closing_rate_pct, avg_deal_inr, top_challenges, success_definition, website, legal_structure, business_model, founded_year, num_customers, pricing_model, usp, target_customer, main_competitors, social_handle, logo_url",
          )
          .eq("user_id", userId)
          .maybeSingle(),
        supabase
          .from("weekly_progress")
          .select(
            "id, week_no, attended, task_done, proof_url, proof_files, proof_note, coach_note, proof_status, points, reviewed_at, created_at",
          )
          .eq("user_id", userId),
        supabase.from("points_ledger").select("points").eq("user_id", userId),
        supabase.from("milestone_awards").select("milestone_code").eq("user_id", userId),
      ]);
    setProfile((prof ?? null) as ParticipantProfile | null);
    setBrain((br ?? null) as BusinessBrain | null);
    setWeeks((wp ?? []) as WeekRow[]);
    setPoints((ledger ?? []).reduce((n, l) => n + (l.points ?? 0), 0));
    setMilestones((ms ?? []).map((m) => m.milestone_code));
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    load();
    const ch = supabase
      .channel(`pp:${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "weekly_progress", filter: `user_id=eq.${userId}` },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [userId, load]);

  const reviewWeek = useCallback(
    async (id: string, status: "approved" | "rejected", note: string) => {
      if (!user) return;
      setWeeks((prev) =>
        prev.map((w) =>
          w.id === id
            ? { ...w, proof_status: status, coach_note: note.trim() || null, attended: true }
            : w,
        ),
      );
      await supabase
        .from("weekly_progress")
        .update({
          proof_status: status,
          coach_id: user.id,
          reviewed_at: new Date().toISOString(),
          coach_note: note.trim() || null,
          attended: true,
        })
        .eq("id", id);
    },
    [user],
  );

  return { profile, brain, weeks, points, milestones, loading, reviewWeek };
}

// ---------------------------------------------------------------------------
// STAFF — a participant's monthly business-snapshot history (read-only; the
// review/approve flow lives in snapshot-review.tsx's staff queue, not here).
// Type mirrors business-data.ts's BusinessSnapshot verbatim — defined locally
// (not imported) since business-data.ts already imports BusinessBrain FROM
// this file, and importing back would create a circular module dependency.
// ---------------------------------------------------------------------------
export type BusinessSnapshot = {
  id: string;
  month: string;
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
  status: "pending" | "approved" | "rejected";
  coach_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
};

const SNAPSHOT_SELECT =
  "id, month, revenue_inr, mrr_inr, leads, deals, pipeline_inr, avg_deal_inr, closing_rate_pct, followup_pct, nps, note, reflection_win, reflection_blocker, status, coach_note, reviewed_by, reviewed_at, created_at";

export function useParticipantSnapshots(userId: string | null) {
  const [snapshots, setSnapshots] = useState<BusinessSnapshot[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase
      .from("business_snapshots")
      .select(SNAPSHOT_SELECT)
      .eq("user_id", userId)
      .order("month", { ascending: true });
    setSnapshots((data ?? []) as BusinessSnapshot[]);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    load();
    const ch = supabase
      .channel(`ps_snap:${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "business_snapshots", filter: `user_id=eq.${userId}` },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [userId, load]);

  return { snapshots, loading };
}

// ---------------------------------------------------------------------------
// COACH / STAFF — read a participant's own team roster (RLS-scoped to the
// participants they coach).
// ---------------------------------------------------------------------------
export type ParticipantTeamMember = {
  id: string;
  name: string;
  role: string | null;
  department: string | null;
  monthly_salary_inr: number | null;
  status: string;
};

export function useParticipantTeam(userId: string | null) {
  const [members, setMembers] = useState<ParticipantTeamMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setMembers([]);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    void supabase
      .from("team_members")
      .select("id, name, role, department, monthly_salary_inr, status")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        if (!active) return;
        setMembers((data ?? []) as ParticipantTeamMember[]);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [userId]);

  return { members, loading };
}

async function namesFor(ids: string[]): Promise<Record<string, string>> {
  if (ids.length === 0) return {};
  const { data } = await supabase.from("profiles").select("id, full_name").in("id", ids);
  const map: Record<string, string> = {};
  (data ?? []).forEach((p) => {
    map[p.id] = p.full_name ?? "Participant";
  });
  return map;
}

// ---------------------------------------------------------------------------
// PARTICIPANT — submit / resubmit a weekly proof
// ---------------------------------------------------------------------------
export type MyWeek = {
  week_no: number;
  proof_url: string | null;
  proof_files: Attachment[];
  proof_status: string;
  coach_note: string | null;
};

export function useMyProofs() {
  const { user } = useAuth();
  const [weeks, setWeeks] = useState<MyWeek[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("weekly_progress")
      .select("week_no, proof_url, proof_files, proof_status, coach_note")
      .eq("user_id", user.id)
      .order("week_no", { ascending: true });
    setWeeks((data ?? []) as MyWeek[]);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
    if (!user) return;
    const ch = supabase
      .channel(`my_proofs:${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "weekly_progress", filter: `user_id=eq.${user.id}` },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user, load]);

  const submit = useCallback(
    async (weekNo: number, url: string, note: string, files: Attachment[] = []) => {
      if (!user) return { error: "Not signed in" };
      const { error } = await supabase.from("weekly_progress").upsert(
        {
          user_id: user.id,
          week_no: weekNo,
          proof_url: url.trim() || null,
          proof_note: note.trim() || null,
          proof_files: files,
          task_done: true,
        },
        { onConflict: "user_id,week_no" },
      );
      return { error: error?.message };
    },
    [user],
  );

  return { weeks, loading, submit };
}

// ---------------------------------------------------------------------------
// COACH — pending proof queue + review action
// ---------------------------------------------------------------------------
export type PendingProof = {
  id: string;
  user_id: string;
  name: string;
  week_no: number;
  proof_url: string | null;
  proof_files: Attachment[];
  proof_note: string | null;
  created_at: string;
};

export function useProofQueue() {
  const { user } = useAuth();
  const [items, setItems] = useState<PendingProof[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const { data, error: err } = await supabase
      .from("weekly_progress")
      .select("id, user_id, week_no, proof_url, proof_files, proof_note, created_at")
      .eq("proof_status", "pending")
      .eq("task_done", true)
      .order("created_at", { ascending: true });
    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }
    const rows = data ?? [];
    const names = await namesFor([...new Set(rows.map((r) => r.user_id))]);
    setItems(
      rows.map((r) => ({
        ...r,
        proof_files: (r.proof_files ?? []) as Attachment[],
        name: names[r.user_id] ?? "Participant",
      })),
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    void load().catch((e) => {
      setError(e instanceof Error ? e.message : "Could not load the review queue");
      setLoading(false);
    });
    const ch = supabase
      .channel("proof_queue")
      .on("postgres_changes", { event: "*", schema: "public", table: "weekly_progress" }, () =>
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
      // optimistic remove from queue
      setItems((prev) => prev.filter((i) => i.id !== id));
      await supabase
        .from("weekly_progress")
        .update({
          proof_status: status,
          coach_id: user.id,
          reviewed_at: new Date().toISOString(),
          coach_note: note.trim() || null,
          attended: true,
        })
        .eq("id", id);
    },
    [user],
  );

  // Softer than reject: keep the proof PENDING but send the participant the note.
  const requestChanges = useCallback(
    async (item: PendingProof, note: string) => {
      if (!user) return;
      await supabase
        .from("weekly_progress")
        .update({ coach_id: user.id, coach_note: note.trim() || null })
        .eq("id", item.id);
      await supabase.rpc("notify_participant", {
        _user_id: item.user_id,
        _title: `Changes requested on Week ${item.week_no}`,
        _body: note.trim() || "Please review and resubmit your proof.",
        _link: "/participant/proof",
      });
    },
    [user],
  );

  // Undo an approval/rejection — revert to pending (also removes awarded points).
  const unreview = useCallback(
    async (id: string) => {
      await supabase
        .from("weekly_progress")
        .update({ proof_status: "pending", reviewed_at: null })
        .eq("id", id);
      void load();
    },
    [load],
  );

  return { items, loading, error, review, requestChanges, unreview, reload: load };
}

// ---------------------------------------------------------------------------
// COACH — daily-habit proof feed (read-only evidence across participants)
// ---------------------------------------------------------------------------
export type HabitProofItem = {
  id: string;
  user_id: string;
  name: string;
  habit_id: string;
  day_no: number;
  log_date: string;
  files: Attachment[];
  created_at: string;
  proof_status: "pending" | "approved" | "rejected";
  coach_note: string | null;
};

export function useHabitProofFeed(limit = 60) {
  const [items, setItems] = useState<HabitProofItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("habit_logs")
      .select("id, user_id, habit_id, day_no, log_date, proof_files, proof_status, coach_note, created_at")
      .eq("proof_status" as "id", "pending") // reviewed ones move to History (col not in generated types)
      .neq("proof_files", "[]")
      .order("created_at", { ascending: false })
      .limit(limit)
      // proof_status/coach_note aren't in the generated types yet — assert the shape.
      .returns<
        {
          id: string;
          user_id: string;
          habit_id: string;
          day_no: number;
          log_date: string;
          proof_files: Attachment[] | null;
          proof_status: string;
          coach_note: string | null;
          created_at: string;
        }[]
      >();
    const rows = (data ?? []).filter((r) => ((r.proof_files as Attachment[]) ?? []).length > 0);
    const names = await namesFor([...new Set(rows.map((r) => r.user_id))]);
    setItems(
      rows.map((r) => ({
        id: r.id,
        user_id: r.user_id,
        name: names[r.user_id] ?? "Participant",
        habit_id: r.habit_id,
        day_no: r.day_no,
        log_date: r.log_date,
        files: (r.proof_files ?? []) as Attachment[],
        created_at: r.created_at,
        proof_status: (r.proof_status as HabitProofItem["proof_status"]) ?? "pending",
        coach_note: (r.coach_note as string | null) ?? null,
      })),
    );
    setLoading(false);
  }, [limit]);

  useEffect(() => {
    void load().catch(() => setLoading(false));
    const ch = supabase
      .channel("habit_proof_feed")
      .on("postgres_changes", { event: "*", schema: "public", table: "habit_logs" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [load]);

  // Staff approve/reject a habit proof (RPC gates on is_staff; only touches the
  // review fields). Optimistic — the realtime channel reconciles.
  const reviewHabit = useCallback(
    async (id: string, status: "approved" | "rejected", note: string) => {
      // Once reviewed it leaves the pending queue (moves to History).
      setItems((prev) => prev.filter((i) => i.id !== id));
      const sb = supabase as unknown as {
        rpc: (
          fn: string,
          args: Record<string, unknown>,
        ) => Promise<{ error: { message: string } | null }>;
      };
      const { error } = await sb.rpc("review_habit_proof", {
        _log_id: id,
        _status: status,
        _note: note,
      });
      if (error) {
        void load();
        throw new Error(error.message);
      }
    },
    [load],
  );

  return { items, loading, reviewHabit };
}

// ---------------------------------------------------------------------------
// COACH — participants overview (week reached, points, latest status)
// ---------------------------------------------------------------------------
export type ParticipantRow = {
  id: string;
  name: string;
  avatar_url: string | null;
  weeksDone: number;
  points: number;
  pending: number;
  atRisk: boolean;
  batchId: string | null;
  batchName: string | null;
};

export function useParticipantsOverview() {
  const [rows, setRows] = useState<ParticipantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      // Assignment-scoped: a coach gets only their assigned participants;
      // mentor/super_admin get everyone (enforced inside my_participants()).
      const { data: mine } = await supabase.rpc("my_participants");
      const ids = (mine ?? []).map((r) => r.user_id);
      if (ids.length === 0) {
        if (active) {
          setRows([]);
          setLoading(false);
        }
        return;
      }
      const [display, { data: wp }, { data: ledger }, { data: bm }, { data: enr }] =
        await Promise.all([
          profilesDisplayFor(ids),
          supabase.from("weekly_progress").select("user_id, proof_status").in("user_id", ids),
          supabase.from("points_ledger").select("user_id, points").in("user_id", ids),
          supabase.from("batch_members").select("user_id, batch_id").in("user_id", ids).eq("role", "participant"),
          supabase.from("program_enrollments").select("user_id, started_at, total_weeks").in("user_id", ids),
        ]);
      if (!active) return;

      // Each participant's OWN program week (relative to when THEY started) —
      // never the global cohort clock, which made new/Batch-16 users look behind.
      const enrByUser = new Map<string, { startedAt: Date | null; totalWeeks: number }>();
      (enr ?? []).forEach((e) =>
        enrByUser.set(e.user_id, {
          startedAt: e.started_at ? new Date(e.started_at) : null,
          totalWeeks: (e.total_weeks as number | null) ?? 16,
        }),
      );

      // Resolve each participant's batch (first membership) + its name.
      const userBatch = new Map<string, string>();
      (bm ?? []).forEach((r) => {
        if (r.batch_id && !userBatch.has(r.user_id)) userBatch.set(r.user_id, r.batch_id);
      });
      const batchIds = [...new Set([...userBatch.values()])];
      const batchName = new Map<string, string>();
      if (batchIds.length > 0) {
        const { data: batches } = await supabase.from("batches").select("id, name").in("id", batchIds);
        if (!active) return;
        (batches ?? []).forEach((b) => batchName.set(b.id, b.name));
      }
      const out = ids.map((id) => {
        const weeks = (wp ?? []).filter((w) => w.user_id === id);
        const weeksDone = weeks.filter((w) => w.proof_status === "approved").length;
        const pending = weeks.filter((w) => w.proof_status === "pending").length;
        const points = (ledger ?? [])
          .filter((l) => l.user_id === id)
          .reduce((n, l) => n + (l.points ?? 0), 0);
        // At risk = started 3+ weeks ago AND 2+ approved weeks behind their own
        // current week. Before week 3 nobody is flagged (they've barely begun).
        const e = enrByUser.get(id);
        const myWeek = weekFromStart(e?.startedAt ?? null, e?.totalWeeks ?? 16);
        const atRisk = !!e?.startedAt && myWeek >= 3 && weeksDone < myWeek - 2;
        const prof = display.get(id);
        const batchId = userBatch.get(id) ?? null;
        return {
          id,
          name: prof?.name ?? "Participant",
          avatar_url: prof?.avatar ?? null,
          weeksDone,
          points,
          pending,
          atRisk,
          batchId,
          batchName: batchId ? (batchName.get(batchId) ?? null) : null,
        };
      });
      out.sort((a, b) => b.points - a.points);
      setRows(out);
      setLoading(false);
    })().catch((e) => {
      if (!active) return;
      setError(e instanceof Error ? e.message : "Could not load participants");
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  return { rows, loading, error };
}

// ---------------------------------------------------------------------------
// MENTOR / ADMIN — coach performance (from review activity)
// ---------------------------------------------------------------------------
export type CoachStat = {
  id: string;
  name: string;
  reviews: number;
  approved: number;
  rejected: number;
  participants: number;
  approvalRate: number;
  avgTurnaroundH: number | null;
};

export function useCoachPerformance() {
  const [stats, setStats] = useState<CoachStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "coach");
      const coachIds = (roles ?? []).map((r) => r.user_id);
      const [names, { data: reviewed }] = await Promise.all([
        namesFor(coachIds),
        supabase
          .from("weekly_progress")
          .select("coach_id, user_id, proof_status, reviewed_at, created_at")
          .not("coach_id", "is", null)
          .not("reviewed_at", "is", null),
      ]);
      if (!active) return;
      const byCoach = new Map<string, typeof reviewed>();
      (reviewed ?? []).forEach((r) => {
        if (!r.coach_id) return;
        const arr = byCoach.get(r.coach_id) ?? [];
        arr.push(r);
        byCoach.set(r.coach_id, arr);
      });
      const ids = [...new Set([...coachIds, ...byCoach.keys()])];
      const out: CoachStat[] = ids.map((id) => {
        const rows = byCoach.get(id) ?? [];
        const approved = rows.filter((r) => r.proof_status === "approved").length;
        const rejected = rows.filter((r) => r.proof_status === "rejected").length;
        const reviews = rows.length;
        const participants = new Set(rows.map((r) => r.user_id)).size;
        const turns = rows
          .map((r) =>
            r.reviewed_at && r.created_at
              ? (new Date(r.reviewed_at).getTime() - new Date(r.created_at).getTime()) / 3_600_000
              : null,
          )
          .filter((n): n is number => n != null && n >= 0);
        const avgTurnaroundH = turns.length
          ? Math.round((turns.reduce((a, b) => a + b, 0) / turns.length) * 10) / 10
          : null;
        return {
          id,
          name: names[id] ?? "Coach",
          reviews,
          approved,
          rejected,
          participants,
          approvalRate: reviews ? Math.round((approved / reviews) * 100) : 0,
          avgTurnaroundH,
        };
      });
      out.sort((a, b) => b.reviews - a.reviews);
      setStats(out);
      setLoading(false);
    })().catch((e) => {
      if (!active) return;
      setError(e instanceof Error ? e.message : "Could not load coach performance");
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  return { stats, loading, error };
}

// ---------------------------------------------------------------------------
// COACH — proof review history (approved + rejected, filterable by batch/user)
// ---------------------------------------------------------------------------
export type HistoryProof = {
  id: string;
  kind: "weekly" | "habit";
  user_id: string;
  name: string;
  avatar_url: string | null;
  week_no: number; // weekly proofs; 0 for habits
  day_no?: number; // habit proofs
  habit_id?: string; // habit proofs
  proof_status: "approved" | "rejected";
  proof_url: string | null;
  proof_files: Attachment[];
  proof_note: string | null;
  coach_note: string | null;
  reviewed_at: string | null;
  attended: boolean;
  points: number;
  batch_id: string | null;
  batch_name: string | null;
  created_at: string;
};

export function useProofHistory() {
  const [items, setItems] = useState<HistoryProof[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [weeklyRes, habitRes] = await Promise.all([
      supabase
        .from("weekly_progress")
        .select(
          "id, user_id, week_no, proof_status, proof_url, proof_files, proof_note, coach_note, reviewed_at, attended, points, batch_id, created_at",
        )
        .in("proof_status", ["approved", "rejected"])
        .order("reviewed_at", { ascending: false }),
      supabase
        .from("habit_logs")
        .select("id, user_id, habit_id, day_no, proof_files, coach_note, reviewed_at, proof_status, created_at")
        .in("proof_status", ["approved", "rejected"])
        .order("reviewed_at", { ascending: false })
        .returns<
          {
            id: string;
            user_id: string;
            habit_id: string;
            day_no: number;
            proof_files: Attachment[] | null;
            coach_note: string | null;
            reviewed_at: string | null;
            proof_status: string;
            created_at: string;
          }[]
        >(),
    ]);

    const wrows = weeklyRes.data ?? [];
    const hrows = habitRes.data ?? [];
    const userIds = [...new Set([...wrows.map((r) => r.user_id), ...hrows.map((r) => r.user_id)])];
    const batchIds = [...new Set(wrows.map((r) => r.batch_id).filter(Boolean))] as string[];

    const [display, batchRes] = await Promise.all([
      profilesDisplayFor(userIds),
      batchIds.length > 0
        ? supabase.from("batches").select("id, name").in("id", batchIds)
        : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    ]);

    const batchMap: Record<string, string> = {};
    ((batchRes as { data: { id: string; name: string }[] | null }).data ?? []).forEach((b) => {
      batchMap[b.id] = b.name;
    });

    const weekly: HistoryProof[] = wrows.map((r) => {
      const prof = display.get(r.user_id);
      return {
        ...r,
        kind: "weekly",
        proof_files: (r.proof_files ?? []) as Attachment[],
        proof_status: r.proof_status as "approved" | "rejected",
        name: prof?.name ?? "Participant",
        avatar_url: prof?.avatar ?? null,
        batch_name: r.batch_id ? (batchMap[r.batch_id] ?? null) : null,
      };
    });
    const habit: HistoryProof[] = hrows.map((r) => {
      const prof = display.get(r.user_id);
      return {
        id: r.id,
        kind: "habit",
        user_id: r.user_id,
        name: prof?.name ?? "Participant",
        avatar_url: prof?.avatar ?? null,
        week_no: 0,
        day_no: r.day_no,
        habit_id: r.habit_id,
        proof_status: r.proof_status as "approved" | "rejected",
        proof_url: null,
        proof_files: (r.proof_files ?? []) as Attachment[],
        proof_note: null,
        coach_note: r.coach_note ?? null,
        reviewed_at: r.reviewed_at ?? null,
        attended: false,
        points: 0,
        batch_id: null,
        batch_name: null,
        created_at: r.created_at,
      };
    });

    const all = [...weekly, ...habit].sort(
      (a, b) => (b.reviewed_at ? +new Date(b.reviewed_at) : 0) - (a.reviewed_at ? +new Date(a.reviewed_at) : 0),
    );
    setItems(all);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load().catch(() => setLoading(false));
    const ch = supabase
      .channel("proof_history")
      .on("postgres_changes", { event: "*", schema: "public", table: "weekly_progress" }, () =>
        load(),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "habit_logs" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [load]);

  return { items, loading };
}
