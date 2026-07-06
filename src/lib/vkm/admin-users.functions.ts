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
// Bulk-assign a batch to many participants at once (find-or-create once, then
// swap each participant's membership + keep invite/community labels in sync).
// ---------------------------------------------------------------------------
export const adminBulkSetBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { emails: string[]; batch: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertSuperAdmin(supabase, userId);

    const batchName = data.batch.trim();
    if (!batchName) throw new Error("Batch name is required");
    if (!data.emails.length) return { count: 0, batch: batchName };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Find-or-create the batch once (case-insensitive).
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

    let count = 0;
    for (const email of data.emails) {
      const { data: uid } = await supabase.rpc("admin_resolve_user_id", { _email: email });
      if (!uid) continue;
      const userUid = uid as string;
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
      await supabaseAdmin.from("user_invites").update({ batch: batchName }).ilike("email", email);
      await supabaseAdmin
        .from("member_profiles")
        .update({ batch_label: batchName })
        .eq("user_id", userUid);
      count++;
    }
    return { ok: true, batch: batchName, count };
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
    // `?impersonated=1` lets the app skip the forced password-reset gate for this
    // support session (see _authenticated/route.tsx), so the admin lands in the
    // member's app instead of their onboarding reset screen.
    const redirectTo = `${SITE_URL}/app?impersonated=1`;
    const { data: link, error } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: data.email,
      options: { redirectTo },
    });
    if (error) throw new Error(error.message);
    // Route the one-time link through OUR domain — /auth-confirm verifies the
    // token client-side — instead of exposing the raw Supabase project URL
    // (https://<ref>.supabase.co/auth/v1/verify?…). Same one-time token, our brand.
    const tokenHash = link?.properties?.hashed_token;
    if (!tokenHash) throw new Error("Could not generate a login link");
    const actionLink = `${SITE_URL}/auth-confirm?token_hash=${tokenHash}&type=magiclink&next=${encodeURIComponent("/app?impersonated=1")}`;
    return { actionLink };
  });

// ---------------------------------------------------------------------------
// Staff "log in as participant" (support / troubleshooting). Available to
// super_admin, mentor AND coach — but ONLY onto PARTICIPANT accounts (never
// another staff member, so no privilege escalation), and a coach is limited to
// participants assigned to them. Returns a one-time magic link the staffer opens
// (ideally in a private window). This is a NEW, role-scoped entry point and does
// NOT change the existing admin-only impersonateUser().
// ---------------------------------------------------------------------------
export const staffLoginAsParticipant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { participantId: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const targetId = data.participantId;
    if (!targetId) throw new Error("Missing participant");
    if (targetId === userId) throw new Error("You're already signed in as yourself");

    // Caller must be staff (coach / mentor / super_admin).
    const [{ data: isAdmin }, { data: isMentor }, { data: isCoach }] = await Promise.all([
      supabase.rpc("has_role", { _user_id: userId, _role: "super_admin" }),
      supabase.rpc("has_role", { _user_id: userId, _role: "mentor" }),
      supabase.rpc("has_role", { _user_id: userId, _role: "coach" }),
    ]);
    if (!isAdmin && !isMentor && !isCoach) throw new Error("Forbidden: staff only");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // The target must be a participant and must NOT hold any staff role — you
    // can never impersonate another coach/mentor/admin.
    const { data: roleRows, error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", targetId);
    if (roleErr) throw new Error(roleErr.message);
    const roles = (roleRows ?? []).map((r) => r.role as string);
    if (roles.some((r) => r === "coach" || r === "mentor" || r === "super_admin")) {
      throw new Error("You can only log in as a participant, not another staff member");
    }
    if (!roles.includes("participant")) throw new Error("That account isn't a participant");

    // Coaches are limited to their own assigned participants (mentor/admin: any).
    if (!isAdmin && !isMentor) {
      const { data: assigned } = await supabaseAdmin
        .from("coach_assignments")
        .select("participant_id")
        .eq("coach_id", userId)
        .eq("participant_id", targetId)
        .maybeSingle();
      if (!assigned) throw new Error("You can only log in as a participant assigned to you");
    }

    // Resolve their email (service role) and mint a one-time login link.
    const { data: userRes, error: uErr } = await supabaseAdmin.auth.admin.getUserById(targetId);
    if (uErr) throw new Error(uErr.message);
    const email = userRes?.user?.email;
    if (!email) throw new Error("Participant email not found");

    const { data: link, error } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email,
      // `?impersonated=1` tells the app to skip the forced-reset gate for this
      // support session, so staff land in the participant's app (not onboarding).
      options: { redirectTo: `${SITE_URL}/app?impersonated=1` },
    });
    if (error) throw new Error(error.message);
    // Route the one-time link through OUR domain — /auth-confirm verifies the
    // token client-side — instead of exposing the raw Supabase project URL
    // (https://<ref>.supabase.co/auth/v1/verify?…). Same one-time token, our brand.
    const tokenHash = link?.properties?.hashed_token;
    if (!tokenHash) throw new Error("Could not generate a login link");
    const actionLink = `${SITE_URL}/auth-confirm?token_hash=${tokenHash}&type=magiclink&next=${encodeURIComponent("/app?impersonated=1")}`;
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
// Bulk add / remove one coach across many participants (by email). Participants
// can have several coaches, so this adds/removes rather than replaces.
// ---------------------------------------------------------------------------
export const adminBulkSetCoach = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { emails: string[]; coachId: string; action: "add" | "remove" }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertSuperAdmin(supabase, userId);
    if (!data.emails.length || !data.coachId) return { count: 0 };
    // Retype the client (not an extracted method) so the RPC — not yet in the
    // generated types — can be called with `this` still bound to the client.
    const sb = supabase as unknown as {
      rpc: (
        fn: string,
        args: Record<string, unknown>,
      ) => Promise<{ data: number | null; error: { message: string } | null }>;
    };
    const fn = data.action === "remove" ? "admin_bulk_remove_coach" : "admin_bulk_add_coach";
    const { data: count, error } = await sb.rpc(fn, {
      _emails: data.emails,
      _coach_id: data.coachId,
    });
    if (error) throw new Error(error.message);
    return { count: count ?? 0 };
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
// Add / remove one coach for a participant. Participants can have several
// coaches at once, so these are additive (not a single-slot replace).
// ---------------------------------------------------------------------------
export const adminAddUserCoach = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { participantEmail: string; coachId: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertSuperAdmin(supabase, userId);
    if (!data.coachId) throw new Error("A coach is required");

    const { data: uid, error: rErr } = await supabase.rpc("admin_resolve_user_id", {
      _email: data.participantEmail,
    });
    if (rErr) throw new Error(rErr.message);
    if (!uid) throw new Error("Participant not found for that email");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("coach_assignments").upsert(
      {
        participant_id: uid as string,
        coach_id: data.coachId,
        assigned_by: userId,
        assigned_at: new Date().toISOString(),
      },
      { onConflict: "participant_id,coach_id", ignoreDuplicates: true },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminRemoveUserCoach = createServerFn({ method: "POST" })
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

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("coach_assignments")
      .delete()
      .eq("participant_id", uid as string)
      .eq("coach_id", data.coachId);
    if (error) throw new Error(error.message);
    return { ok: true };
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
    is_co_admin: boolean | null;
  } | null;
  assigned_coaches: { coach_id: string; name: string | null; email: string | null }[];
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
