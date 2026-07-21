import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { profileDisplayMap } from "@/lib/profiles-display";

export type ExemptionReason = "fever" | "health" | "travel" | "family" | "other";
export const EXEMPTION_REASONS: { id: ExemptionReason; label: string }[] = [
  { id: "fever", label: "Fever / illness" },
  { id: "health", label: "Health / medical" },
  { id: "travel", label: "Travel" },
  { id: "family", label: "Family / personal" },
  { id: "other", label: "Other" },
];
export const MONTHLY_EXEMPTION_LIMIT = 3;

export type HabitExemption = {
  id: string;
  user_id: string;
  day_no: number;
  exempt_date: string;
  reason: string;
  note: string | null;
  status: "pending" | "approved" | "rejected";
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
};

export type ExemptionDaySets = { approved: Set<number>; pending: Set<number> };

/** Approved (regulated) + pending day numbers for a user — feeds the streak/grid. */
export async function fetchExemptionDaySets(userId: string): Promise<ExemptionDaySets> {
  const { data } = await supabase
    .from("habit_exemptions")
    .select("day_no, status")
    .eq("user_id", userId)
    .in("status", ["approved", "pending"]);
  const approved = new Set<number>();
  const pending = new Set<number>();
  for (const r of data ?? []) {
    if (r.status === "approved") approved.add(r.day_no);
    else if (r.status === "pending") pending.add(r.day_no);
  }
  return { approved, pending };
}

function monthKey(d: string | Date): string {
  const dt = typeof d === "string" ? new Date(d) : d;
  return `${dt.getFullYear()}-${dt.getMonth()}`;
}

/**
 * The signed-in participant's own exemption requests + submit/cancel, with the
 * monthly quota derived client-side (the DB enforces the hard cap too).
 */
export function useMyExemptions() {
  const { user } = useAuth();
  const [rows, setRows] = useState<HabitExemption[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("habit_exemptions")
      .select("*")
      .eq("user_id", user.id)
      .order("day_no", { ascending: false });
    setRows((data ?? []) as HabitExemption[]);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    void load();
    const ch = supabase
      .channel(`hx:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "habit_exemptions",
          filter: `user_id=eq.${user.id}`,
        },
        () => load(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [user, load]);

  const thisMonth = monthKey(new Date());
  const usedThisMonth = rows.filter(
    (r) => r.status !== "rejected" && monthKey(r.exempt_date) === thisMonth,
  ).length;
  const remaining = Math.max(0, MONTHLY_EXEMPTION_LIMIT - usedThisMonth);

  const submit = useCallback(
    async (dayNo: number, exemptDate: string, reason: ExemptionReason, note: string) => {
      if (!user) throw new Error("Not signed in");
      const { error } = await supabase.from("habit_exemptions").insert({
        user_id: user.id,
        day_no: dayNo,
        exempt_date: exemptDate,
        reason,
        note: note.trim() || null,
      });
      if (error) throw error;
      await load();
    },
    [user, load],
  );

  const cancel = useCallback(
    async (id: string) => {
      const { error } = await supabase.from("habit_exemptions").delete().eq("id", id);
      if (error) throw error;
      await load();
    },
    [load],
  );

  return {
    rows,
    loading,
    usedThisMonth,
    remaining,
    limit: MONTHLY_EXEMPTION_LIMIT,
    submit,
    cancel,
    reload: load,
  };
}

export type ExemptionReviewItem = HabitExemption & { name: string; avatar_url: string | null };

/** Staff review queue: pending exemption requests across all members. */
export function useExemptionReviewQueue() {
  const [items, setItems] = useState<ExemptionReviewItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("habit_exemptions")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: true });
    const rows = (data ?? []) as HabitExemption[];
    const display = rows.length
      ? await profileDisplayMap([...new Set(rows.map((r) => r.user_id))], "Participant")
      : {};
    setItems(
      rows.map((r) => ({
        ...r,
        name: display[r.user_id]?.name ?? "Participant",
        avatar_url: display[r.user_id]?.avatar ?? null,
      })),
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
    const ch = supabase
      .channel("hx:queue")
      .on("postgres_changes", { event: "*", schema: "public", table: "habit_exemptions" }, () =>
        load(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [load]);

  const decide = useCallback(
    async (id: string, status: "approved" | "rejected") => {
      // reviewed_by / reviewed_at are stamped by the DB guard trigger.
      const { error } = await supabase.from("habit_exemptions").update({ status }).eq("id", id);
      if (error) throw error;
      await load();
    },
    [load],
  );

  return { items, loading, decide, reload: load };
}
