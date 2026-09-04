import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Every table holding a participant's PROGRAMME PROGRESS.
 *
 * Deliberately excludes anything that is theirs rather than the programme's:
 * profile, business brain, vision board, uploaded files, chat and support
 * history all survive a reset. Resetting a programme should put someone back to
 * day zero, not erase who they are.
 */
const PROGRESS_TABLES = [
  "habit_logs",
  "habit_exemptions",
  "daily_actions",
  "daily_steps",
  "daily_water",
  "water_events",
  "workout_logs",
  "focus_sessions",
  "weekly_progress",
  "points_ledger",
  "milestone_awards",
  "monthly_results",
] as const;

export type ResetSummary = { table: string; deleted: number }[];

/**
 * Wipe a participant's programme progress and re-anchor them to their batch's
 * start date, so they begin fresh on the day staff actually set.
 *
 * Super-admin only, and irreversible — the caller is expected to confirm first.
 */
export const resetParticipantProgram = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { email?: string; clearEnrollment?: boolean }) => ({
    // Addressed by email, like the other admin user actions — the users table
    // lists invites, which carry an email but no auth id.
    email: String(input?.email ?? "")
      .trim()
      .toLowerCase(),
    // true = remove the enrollment entirely (they must start the programme
    // again); false = keep it, re-anchored to the batch start date.
    clearEnrollment: !!input?.clearEnrollment,
  }))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "super_admin",
    });
    if (!isAdmin) throw new Error("Forbidden: super admins only");
    if (!data.email) throw new Error("No user selected.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Same resolution the other admin user actions use — profiles has no email
    // column; the address lives on the auth user.
    const { data: uid, error: rErr } = await context.supabase.rpc("admin_resolve_user_id", {
      _email: data.email,
    });
    if (rErr) throw new Error(rErr.message);
    if (!uid) throw new Error("No account for that email — they haven't signed in yet.");
    const targetId = uid as string;

    const summary: ResetSummary = [];
    for (const table of PROGRESS_TABLES) {
      const { count: before } = await supabaseAdmin
        .from(table)
        .select("*", { count: "exact", head: true })
        .eq("user_id", targetId);
      if (!before) continue;
      const { error } = await supabaseAdmin.from(table).delete().eq("user_id", targetId);
      if (error) throw new Error(`${table}: ${error.message}`);
      summary.push({ table, deleted: before });
    }

    // Habit-proof approval notices refer to logs that no longer exist.
    await supabaseAdmin
      .from("notifications")
      .delete()
      .eq("user_id", targetId)
      .ilike("title", "%habit proof%");

    // Re-anchor to the batch start date — the single source of truth for when a
    // programme begins. Someone with no batch date keeps a null start, which
    // every date helper already reads as "not started".
    const { data: rows } = await supabaseAdmin
      .from("batch_members")
      .select("batches(start_date)")
      .eq("user_id", targetId)
      .eq("role", "participant");
    const dates = (rows ?? [])
      .map(
        (r) =>
          (r as unknown as { batches: { start_date: string | null } | null }).batches?.start_date,
      )
      .filter((d): d is string => !!d)
      .sort((a, b) => b.localeCompare(a));
    const batchStart = dates[0] ?? null;

    if (data.clearEnrollment) {
      await supabaseAdmin.from("program_enrollments").delete().eq("user_id", targetId);
    } else {
      await supabaseAdmin
        .from("program_enrollments")
        .update({
          started_at: batchStart ? `${batchStart}T00:00:00+05:30` : null,
          status: "active",
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", targetId);
    }

    return {
      ok: true as const,
      summary,
      totalDeleted: summary.reduce((n, s) => n + s.deleted, 0),
      batchStart,
      enrollmentCleared: data.clearEnrollment,
    };
  });
