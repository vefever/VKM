import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type InviteRole = "participant" | "coach" | "mentor";

function genToken(): string {
  // 32 bytes (256 bits) of CSPRNG entropy, base64url-encoded with no truncation
  // — every byte contributes to the token so guessing is computationally infeasible.
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function genTempPassword(): string {
  // Human-friendly 12-char temp password: 4 lowercase + 4 digits + 4 lowercase
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

async function sendInviteEmailBestEffort(args: {
  to: string;
  name: string;
  role: InviteRole;
  inviteUrl: string;
  tempPassword: string;
  expiresAt: string;
}) {
  // Best-effort: POST to the transactional email route if it exists.
  // Silently no-op if email infra hasn't been scaffolded yet — admin always
  // gets the invite link + temp password in the UI as a fallback.
  try {
    const origin = process.env.APP_ORIGIN || "";
    if (!origin) return { sent: false, reason: "no-origin" };
    const res = await fetch(`${origin}/api/email/transactional/send`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        templateName: "user-invite",
        recipientEmail: args.to,
        idempotencyKey: `invite-${args.to}-${args.inviteUrl.slice(-12)}`,
        templateData: {
          name: args.name,
          role: args.role,
          inviteUrl: args.inviteUrl,
          tempPassword: args.tempPassword,
          expiresAt: new Date(args.expiresAt).toLocaleString(),
        },
      }),
    });
    return { sent: res.ok, reason: res.ok ? "ok" : `http_${res.status}` };
  } catch (err) {
    return { sent: false, reason: (err as Error).message };
  }
}

export const createInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: {
    email: string; name: string; role: InviteRole;
    phone?: string; batch?: string; origin: string;
  }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Must be super_admin
    const { data: isAdmin, error: roleErr } = await supabase
      .rpc("has_role", { _user_id: userId, _role: "super_admin" });
    if (roleErr) throw new Error(roleErr.message);
    if (!isAdmin) throw new Error("Forbidden: only super admins can invite users");

    const email = data.email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error("Invalid email");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Block if there's already an active pending invite for this email
    const { data: existing } = await supabaseAdmin
      .from("user_invites")
      .select("id, status, revoked_at, expires_at")
      .ilike("email", email)
      .eq("status", "pending")
      .is("revoked_at", null)
      .gt("expires_at", new Date().toISOString())
      .limit(1)
      .maybeSingle();
    if (existing) throw new Error("An active invite already exists for this email");

    const token = genToken();
    const tempPassword = genTempPassword();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    // Create auth user with temp password (email pre-confirmed so they can sign in immediately)
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name: data.name, invited: true },
    });

    let authUserId = created?.user?.id;

    if (createErr || !authUserId) {
      // Likely user exists — look them up and update password
      const msg = (createErr?.message || "").toLowerCase();
      if (!msg.includes("already") && !msg.includes("registered")) {
        throw new Error(createErr?.message || "Could not create user");
      }
      // Find existing by email via paginated listUsers
      const list = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
      const found = list.data.users.find((u) => (u.email || "").toLowerCase() === email);
      if (!found) throw new Error("User already exists but could not be located");
      authUserId = found.id;
      const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(authUserId, {
        password: tempPassword,
        email_confirm: true,
      });
      if (updErr) throw new Error(updErr.message);
    }

    // Ensure profile + role + force-reset flag
    await supabaseAdmin.from("profiles").upsert({
      id: authUserId,
      full_name: data.name,
      phone: data.phone || null,
      must_reset_password: true,
    });
    await supabaseAdmin.from("user_roles")
      .upsert({ user_id: authUserId, role: data.role }, { onConflict: "user_id,role" });

    // Insert invite record
    const { data: invite, error: invErr } = await supabaseAdmin
      .from("user_invites")
      .insert({
        email,
        name: data.name,
        role: data.role,
        phone: data.phone || null,
        batch: data.batch || null,
        token,
        temp_password: tempPassword,
        expires_at: expiresAt,
        invited_by: userId,
        status: "pending",
      })
      .select()
      .single();
    if (invErr) throw new Error(invErr.message);

    // --- Wire the user into the real cohort + community systems ---------------
    // A free-text batch label on the invite isn't enough: coaches are scoped to
    // their batch via batch_members, and the community directory reads
    // member_profiles. Link both here so imported/invited users actually show up.
    const batchName = data.batch?.trim();
    if (batchName) {
      // Find-or-create the batch by name (case-insensitive) so "Batch 12" isn't
      // duplicated as "batch 12".
      let batchId: string | null = null;
      const { data: existingBatch } = await supabaseAdmin
        .from("batches")
        .select("id")
        .ilike("name", batchName)
        .limit(1)
        .maybeSingle();
      if (existingBatch) {
        batchId = existingBatch.id;
      } else {
        const { data: newBatch } = await supabaseAdmin
          .from("batches")
          .insert({ name: batchName, status: "active" })
          .select("id")
          .single();
        batchId = newBatch?.id ?? null;
      }
      if (batchId) {
        await supabaseAdmin
          .from("batch_members")
          .upsert(
            { batch_id: batchId, user_id: authUserId, role: data.role },
            { onConflict: "batch_id,user_id,role", ignoreDuplicates: true },
          );
      }
    }

    // Participants get a public community profile so peers can find them. Use
    // ignoreDuplicates so we never overwrite a member who set their own privacy.
    if (data.role === "participant") {
      await supabaseAdmin.from("member_profiles").upsert(
        {
          user_id: authUserId,
          batch_label: batchName || null,
          status: "active",
          is_public: true,
        },
        { onConflict: "user_id", ignoreDuplicates: true },
      );
    }

    const inviteUrl = `${data.origin.replace(/\/$/, "")}/invite/${token}`;

    const emailResult = await sendInviteEmailBestEffort({
      to: email, name: data.name, role: data.role,
      inviteUrl, tempPassword, expiresAt,
    });

    return { invite, inviteUrl, tempPassword, emailSent: emailResult.sent };
  });

export const listInvites = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase
      .rpc("has_role", { _user_id: userId, _role: "super_admin" });
    if (!isAdmin) throw new Error("Forbidden");
    const { data, error } = await supabase
      .from("user_invites")
      .select("id, email, name, role, phone, batch, token, status, expires_at, accepted_at, revoked_at, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const revokeInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase
      .rpc("has_role", { _user_id: userId, _role: "super_admin" });
    if (!isAdmin) throw new Error("Forbidden");
    const { error } = await supabase
      .from("user_invites")
      .update({ revoked_at: new Date().toISOString(), status: "revoked" })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const resendInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { id: string; origin: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase
      .rpc("has_role", { _user_id: userId, _role: "super_admin" });
    if (!isAdmin) throw new Error("Forbidden");

    const { data: inv, error } = await supabase
      .from("user_invites").select("*").eq("id", data.id).single();
    if (error || !inv) throw new Error("Invite not found");
    if (inv.status !== "pending") throw new Error("Invite is not pending");

    const inviteUrl = `${data.origin.replace(/\/$/, "")}/invite/${inv.token}`;
    const result = await sendInviteEmailBestEffort({
      to: inv.email, name: inv.name, role: inv.role as InviteRole,
      inviteUrl, tempPassword: inv.temp_password, expiresAt: inv.expires_at,
    });
    return { ok: true, emailSent: result.sent, inviteUrl };
  });

export const getInviteByToken = createServerFn({ method: "GET" })
  .validator((input: { token: string }) => input)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: inv } = await supabaseAdmin
      .from("user_invites")
      .select("email, name, role, batch, expires_at, status, revoked_at")
      .eq("token", data.token)
      .maybeSingle();
    if (!inv) return null;
    const expired = new Date(inv.expires_at).getTime() < Date.now();
    return {
      email: inv.email,
      name: inv.name,
      role: inv.role,
      batch: inv.batch,
      expiresAt: inv.expires_at,
      status: inv.status,
      isExpired: expired,
      isRevoked: !!inv.revoked_at,
      isUsable: inv.status === "pending" && !inv.revoked_at && !expired,
    };
  });

export type InviteAcceptResult = {
  id: string;
  email: string;
  name: string;
  role: InviteRole;
  status: string;
  accepted_at: string;
};

export const acceptInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { token: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: invite, error } = await context.supabase
      .rpc("accept_invite_by_token", { _token: data.token });
    if (error) throw new Error(error.message);
    return invite as InviteAcceptResult;
  });

export const clearMustResetFlag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await context.supabase
      .from("profiles")
      .update({ must_reset_password: false })
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
