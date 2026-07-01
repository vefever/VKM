import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

const SITE_URL = "https://vkmentorship.com";

// All functions here are super-admin only. The gate is re-checked server-side on
// every call (never trust the client), then privileged work runs via the
// service-role admin client.

async function assertSuperAdmin(supabase: SupabaseClient<Database>, userId: string) {
  const { data: isAdmin } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "super_admin",
  });
  if (!isAdmin) throw new Error("Forbidden: super admins only");
}

function genTempPassword(): string {
  const a = "abcdefghjkmnpqrstuvwxyz";
  const d = "23456789";
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < 12; i++) {
    const src = i < 4 || i >= 8 ? a : d;
    out += src[bytes[i] % src.length];
  }
  return "VKM-" + out.slice(0, 4) + "-" + out.slice(4, 8) + "-" + out.slice(8);
}

// ---------------------------------------------------------------------------
// Full per-user detail payload (identity, login info, performance, activity).
// ---------------------------------------------------------------------------
export const getUserDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((input: { email: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertSuperAdmin(supabase, userId);
    const { data: detail, error } = await supabase.rpc("admin_user_detail", {
      _email: data.email,
    });
    if (error) throw new Error(error.message);
    return detail as AdminUserDetail;
  });

// ---------------------------------------------------------------------------
// Reset a member's password from the admin side → returns a new temp password
// and forces a reset on their next login.
// ---------------------------------------------------------------------------
export const adminResetPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { email: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertSuperAdmin(supabase, userId);

    const { data: uid, error: rErr } = await supabase.rpc("admin_resolve_user_id", {
      _email: data.email,
    });
    if (rErr) throw new Error(rErr.message);
    if (!uid) throw new Error("Account not found for that email");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const tempPassword = genTempPassword();
    const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(uid as string, {
      password: tempPassword,
      email_confirm: true,
    });
    if (updErr) throw new Error(updErr.message);

    await supabaseAdmin
      .from("profiles")
      .update({ must_reset_password: true })
      .eq("id", uid as string);

    return { tempPassword };
  });

// ---------------------------------------------------------------------------
// Move a member to a different batch (find-or-create the batch, swap their
// participant membership, and keep the invite label + community profile in sync).
// ---------------------------------------------------------------------------
export const adminSetUserBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { email: string; batch: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertSuperAdmin(supabase, userId);

    const batchName = data.batch.trim();
    if (!batchName) throw new Error("Batch name is required");

    const { data: uid, error: rErr } = await supabase.rpc("admin_resolve_user_id", {
      _email: data.email,
    });
    if (rErr) throw new Error(rErr.message);
    if (!uid) throw new Error("Account not found for that email");
    const userUid = uid as string;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Find-or-create the batch by name (case-insensitive).
    let batchId: string | null = null;
    const { data: existing } = await supabaseAdmin
      .from("batches")
      .select("id")
      .ilike("name", batchName)
      .limit(1)
      .maybeSingle();
    if (existing) batchId = existing.id;
    else {
      const { data: nb, error: bErr } = await supabaseAdmin
        .from("batches")
        .insert({ name: batchName, status: "active" })
        .select("id")
        .single();
      if (bErr) throw new Error(bErr.message);
      batchId = nb?.id ?? null;
    }
    if (!batchId) throw new Error("Could not resolve batch");

    // Swap participant membership: drop old participant rows, add the new one.
    await supabaseAdmin
      .from("batch_members")
      .delete()
      .eq("user_id", userUid)
      .eq("role", "participant");
    await supabaseAdmin
      .from("batch_members")
      .upsert(
        { batch_id: batchId, user_id: userUid, role: "participant" },
        { onConflict: "batch_id,user_id,role", ignoreDuplicates: true },
      );

    // Keep the invite label + community directory label in sync.
    await supabaseAdmin
      .from("user_invites")
      .update({ batch: batchName })
      .ilike("email", data.email);
    await supabaseAdmin
      .from("member_profiles")
      .update({ batch_label: batchName })
      .eq("user_id", userUid);

    return { ok: true, batch: batchName };
  });

// ---------------------------------------------------------------------------
// Login as a member (impersonation) — returns a one-time magic-link the admin
// can open (ideally in a private window) to sign in as that member.
// ---------------------------------------------------------------------------
export const impersonateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { email: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertSuperAdmin(supabase, userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const redirectTo = `${SITE_URL}/app`;
    const { data: link, error } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: data.email,
      options: { redirectTo },
    });
    if (error) throw new Error(error.message);
    const actionLink = link?.properties?.action_link;
    if (!actionLink) throw new Error("Could not generate a login link");
    return { actionLink };
  });

// ---------------------------------------------------------------------------
// Map of participant email → assigned coach (for the directory column).
// ---------------------------------------------------------------------------
export const getCoachAssignments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertSuperAdmin(supabase, userId);
    const { data, error } = await supabase.rpc("admin_coach_map");
    if (error) throw new Error(error.message);
    return (data ?? []) as { participant_email: string; coach_id: string | null; coach_name: string | null; coach_email: string | null }[];
  });

// ---------------------------------------------------------------------------
// Bulk assign / unassign many participants (by email) to one coach at once.
// ---------------------------------------------------------------------------
export const adminBulkAssignCoach = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { emails: string[]; coachId: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertSuperAdmin(supabase, userId);
    if (!data.emails.length) return { count: 0 };
    const { data: count, error } = await supabase.rpc("admin_bulk_assign_coach", {
      _emails: data.emails,
      // _coach_id is nullable in SQL (null = unassign); the generated type omits null.
      _coach_id: (data.coachId || null) as string,
    });
    if (error) throw new Error(error.message);
    return { count: (count as number) ?? 0 };
  });

// ---------------------------------------------------------------------------
// Coaches available to assign (super-admin picker).
// ---------------------------------------------------------------------------
export const adminListCoaches = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertSuperAdmin(supabase, userId);
    const { data, error } = await supabase.rpc("admin_list_coaches");
    if (error) throw new Error(error.message);
    return (data ?? []) as { id: string; full_name: string | null; email: string; participant_count: number }[];
  });

// ---------------------------------------------------------------------------
// Assign / reassign / unassign a participant's coach. Empty coachId = unassign.
// ---------------------------------------------------------------------------
export const adminSetUserCoach = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { participantEmail: string; coachId: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertSuperAdmin(supabase, userId);

    const { data: uid, error: rErr } = await supabase.rpc("admin_resolve_user_id", {
      _email: data.participantEmail,
    });
    if (rErr) throw new Error(rErr.message);
    if (!uid) throw new Error("Participant not found for that email");
    const participantId = uid as string;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (!data.coachId) {
      // Unassign.
      await supabaseAdmin.from("coach_assignments").delete().eq("participant_id", participantId);
      return { ok: true, assigned: false };
    }

    await supabaseAdmin.from("coach_assignments").upsert(
      {
        participant_id: participantId,
        coach_id: data.coachId,
        assigned_by: userId,
        assigned_at: new Date().toISOString(),
      },
      { onConflict: "participant_id" },
    );
    return { ok: true, assigned: true };
  });

// ---------------------------------------------------------------------------
// Emails of currently-blocked (banned) users, so the directory can flag them
// and offer the right Block/Unblock action per row. Small user base → a single
// listUsers page is plenty.
// ---------------------------------------------------------------------------
export const adminListBlocked = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertSuperAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (error) throw new Error(error.message);
    const now = Date.now();
    const blocked: string[] = [];
    for (const u of data.users) {
      const bannedUntil = (u as { banned_until?: string | null }).banned_until;
      if (u.email && bannedUntil && new Date(bannedUntil).getTime() > now) {
        blocked.push(u.email.toLowerCase());
      }
    }
    return blocked;
  });

// ---------------------------------------------------------------------------
// Block / unblock (ban) a member. A blocked user keeps all their data but can't
// sign in until unblocked. Super admins can't be blocked, and you can't block
// yourself.
// ---------------------------------------------------------------------------
export const adminSetUserBlocked = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { email: string; blocked: boolean }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertSuperAdmin(supabase, userId);

    const { data: uid, error: rErr } = await supabase.rpc("admin_resolve_user_id", {
      _email: data.email,
    });
    if (rErr) throw new Error(rErr.message);
    if (!uid) throw new Error("Account not found for that email");
    const targetId = uid as string;

    if (targetId === userId) throw new Error("You can't block your own account");
    const { data: targetIsAdmin } = await supabase.rpc("has_role", {
      _user_id: targetId,
      _role: "super_admin",
    });
    if (targetIsAdmin) throw new Error("You can't block another super admin");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // GoTrue: a duration bans; "none" lifts the ban. ~100 years = effectively permanent.
    const { error } = await supabaseAdmin.auth.admin.updateUserById(targetId, {
      ban_duration: data.blocked ? "876000h" : "none",
    });
    if (error) throw new Error(error.message);
    return { ok: true, blocked: data.blocked };
  });

// ---------------------------------------------------------------------------
// Permanently delete a member: their auth account (which cascade-deletes all of
// their own rows) plus any invite records keyed to their email. Irreversible.
// Super admins can't be deleted, and you can't delete yourself.
// ---------------------------------------------------------------------------
export const adminDeleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { email: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertSuperAdmin(supabase, userId);

    const email = data.email.trim().toLowerCase();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: uid, error: rErr } = await supabase.rpc("admin_resolve_user_id", {
      _email: email,
    });
    if (rErr) throw new Error(rErr.message);
    const targetId = (uid as string | null) ?? null;

    if (targetId) {
      if (targetId === userId) throw new Error("You can't delete your own account");
      const { data: targetIsAdmin } = await supabase.rpc("has_role", {
        _user_id: targetId,
        _role: "super_admin",
      });
      if (targetIsAdmin) throw new Error("You can't delete another super admin");

      // Almost every user table cascades on auth.users delete. A handful of
      // "actor" columns don't (they point at whoever awarded/reviewed/assigned/
      // created a row for SOMEONE ELSE). Detach those first so a stray reference
      // can't block the delete. Best-effort — a failure here shouldn't abort.
      await Promise.allSettled([
        supabaseAdmin.from("points_ledger").update({ awarded_by: null }).eq("awarded_by", targetId),
        supabaseAdmin.from("milestone_awards").update({ awarded_by: null }).eq("awarded_by", targetId),
        supabaseAdmin.from("weekly_progress").update({ coach_id: null }).eq("coach_id", targetId),
        supabaseAdmin.from("business_snapshots").update({ reviewed_by: null }).eq("reviewed_by", targetId),
        supabaseAdmin.from("coach_assignments").update({ assigned_by: null }).eq("assigned_by", targetId),
        supabaseAdmin.from("programs").update({ created_by: null }).eq("created_by", targetId),
      ]);

      const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(targetId);
      if (delErr) throw new Error(delErr.message);
    }

    // Invite rows are keyed by email (not FK-linked to the auth user), so remove
    // them explicitly — this also clears the row for invites never accepted.
    await supabaseAdmin.from("user_invites").delete().ilike("email", email);

    return { ok: true, deletedAuthUser: !!targetId };
  });

export type AdminUserDetail = {
  user_id: string;
  email: string;
  profile: {
    full_name: string | null;
    avatar_url: string | null;
    phone: string | null;
    must_reset_password: boolean | null;
  } | null;
  assigned_coach: { coach_id: string; name: string | null; email: string | null } | null;
  auth: {
    last_sign_in_at: string | null;
    created_at: string | null;
    email_confirmed_at: string | null;
    phone: string | null;
    is_banned: boolean;
  };
  roles: string[];
  batches: { batch_id: string; name: string; role: string }[];
  performance: {
    points: number;
    weeks_approved: number;
    weeks_pending: number;
    milestones: number;
    habit_days_30: number;
    focus_minutes_total: number;
    focus_minutes_7d: number;
    actions_done_today: number;
    mrr_inr: number | null;
    monthly_leads: number | null;
    business_name: string | null;
  };
  last_active_at: string | null;
  recent_activity: { kind: string; label: string; ts: string }[];
};
