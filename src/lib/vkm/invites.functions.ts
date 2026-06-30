import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

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

const ROLE_COPY: Record<InviteRole, { label: string; line: string }> = {
  participant: {
    label: "Participant",
    line: "You've been invited to join the VK Mentorship program — your 4-month business transformation starts here.",
  },
  coach: {
    label: "Growth Coach",
    line: "You've been invited to VK Mentorship as a Growth Coach — you'll guide participants to implement and grow.",
  },
  mentor: {
    label: "Mentor",
    line: "You've been invited to VK Mentorship as a Mentor — leading classes and overseeing the cohort.",
  },
};

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Branded, email-client-safe HTML (tables + inline styles) matching the app's
// navy/gold identity. Returns subject + html + plain-text fallback.
function buildInviteEmail(args: {
  name: string;
  role: InviteRole;
  inviteUrl: string;
  tempPassword: string;
  expiresAt: string;
}): { subject: string; html: string; text: string } {
  const role = ROLE_COPY[args.role];
  const firstName = esc((args.name || "there").trim().split(/\s+/)[0]);
  const expires = new Date(args.expiresAt).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const subject = `You're invited to VK Mentorship — ${role.label}`;

  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"></head>
<body style="margin:0;padding:0;background:#f4f1ea;font-family:Segoe UI,Helvetica,Arial,sans-serif;color:#1a2230;">
  <span style="display:none;max-height:0;overflow:hidden;opacity:0;">Your VK Mentorship invitation &amp; temporary password — set your new password on first sign-in.</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1ea;padding:28px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 30px rgba(11,37,69,.10);">
        <!-- Header -->
        <tr><td style="background:#0B2545;padding:26px 32px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
            <td style="font-size:18px;font-weight:700;letter-spacing:3px;color:#ffffff;">VK <span style="color:#E7B53C;">MENTORSHIP</span></td>
            <td align="right" style="font-size:11px;letter-spacing:2px;color:#9fb0c6;text-transform:uppercase;">Invitation</td>
          </tr></table>
          <div style="height:3px;width:54px;background:#E7B53C;border-radius:3px;margin-top:14px;"></div>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:32px;">
          <p style="margin:0 0 4px;font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:#C79A1E;font-weight:700;">Role · ${esc(role.label)}</p>
          <h1 style="margin:4px 0 10px;font-size:24px;line-height:1.25;color:#0B2545;">Hi ${firstName}, welcome aboard.</h1>
          <p style="margin:0 0 22px;font-size:15px;line-height:1.6;color:#41506a;">${esc(role.line)}</p>

          <!-- CTA -->
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;"><tr>
            <td align="center" bgcolor="#0B2545" style="border-radius:12px;">
              <a href="${esc(args.inviteUrl)}" target="_blank" style="display:inline-block;padding:14px 30px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:12px;background:#0B2545;">Accept your invitation →</a>
            </td>
          </tr></table>

          <!-- Credentials -->
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f9fb;border:1px solid #e4e7ec;border-radius:12px;">
            <tr><td style="padding:16px 18px;">
              <p style="margin:0 0 10px;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#5b6675;font-weight:700;">Your sign-in details</p>
              <p style="margin:0 0 6px;font-size:14px;color:#1a2230;"><strong style="color:#5b6675;font-weight:600;">Temporary password:</strong>
                <span style="font-family:Consolas,monospace;font-size:15px;color:#0B2545;background:#fff;border:1px solid #e4e7ec;border-radius:6px;padding:2px 8px;">${esc(args.tempPassword)}</span></p>
              <p style="margin:0;font-size:12.5px;color:#5b6675;">You'll be asked to set your own password the first time you sign in.</p>
            </td></tr>
          </table>

          <p style="margin:20px 0 0;font-size:12.5px;color:#8a93a3;">This invitation link expires on <strong style="color:#41506a;">${esc(expires)}</strong>. If the button doesn't work, copy and paste this link:<br>
            <a href="${esc(args.inviteUrl)}" style="color:#3b6fb0;word-break:break-all;">${esc(args.inviteUrl)}</a></p>
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding:18px 32px;border-top:1px solid #eef1f5;background:#fbfcfd;">
          <p style="margin:0;font-size:11.5px;color:#9aa3b2;">VK Mentorship — the operating system for business transformation.<br>If you weren't expecting this invitation, you can safely ignore this email.</p>
        </td></tr>
      </table>
      <p style="margin:14px 0 0;font-size:11px;color:#b3bccb;">© VK Mentorship</p>
    </td></tr>
  </table>
</body></html>`;

  const text = [
    `Hi ${firstName},`,
    "",
    role.line,
    "",
    `Accept your invitation: ${args.inviteUrl}`,
    `Temporary password: ${args.tempPassword}`,
    "You'll set your own password on first sign-in.",
    "",
    `This link expires on ${expires}.`,
    "",
    "— VK Mentorship",
  ].join("\n");

  return { subject, html, text };
}

// Sends the invite email through the configured provider via the `messaging`
// edge function (super_admin gated). Best-effort: the admin always also gets the
// link + temp password in the UI, so a missing/disabled provider never blocks.
async function sendInviteEmail(supabase: SupabaseClient<Database>, args: {
  to: string;
  name: string;
  role: InviteRole;
  inviteUrl: string;
  tempPassword: string;
  expiresAt: string;
}): Promise<{ sent: boolean; reason: string }> {
  try {
    const { subject, html, text } = buildInviteEmail(args);
    const { data, error } = await supabase.functions.invoke("messaging", {
      body: { action: "send_email", to: args.to, subject, html, text },
    });
    if (error) return { sent: false, reason: (error as Error).message || "invoke-failed" };
    const ok = !!(data as { ok?: boolean } | null)?.ok;
    return { sent: ok, reason: ok ? "ok" : (data as { error?: string } | null)?.error || "not-sent" };
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

    const emailResult = await sendInviteEmail(supabase, {
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
    const result = await sendInviteEmail(supabase, {
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
