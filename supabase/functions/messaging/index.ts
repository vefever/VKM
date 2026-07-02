// VKM messaging edge function — sends Email / SMS / WhatsApp via the provider
// configured in `messaging_settings`, and issues email-OTP login codes.
//
// Actions (POST JSON { action, ... }):
//   request_otp { email }                       — pre-auth; emails a login code
//   send_email  { to, subject, html, text }     — super_admin
//   send_sms    { to, body }                     — super_admin
//   send_whatsapp { to, body }                   — super_admin
//   test        { channel, to }                  — super_admin
//
// Secrets are read from messaging_settings.config with the service role.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Origin allow-list: set ALLOWED_ORIGINS (comma-separated) in the function's
// secrets to lock CORS down to your app's origin(s). Left unset, it falls back
// to "*" so existing deployments keep working until configured.
const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

function corsFor(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") || "";
  let allow = "*";
  if (ALLOWED_ORIGINS.length > 0) {
    allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  }
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

const json = (body: unknown, status = 200, cors: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// These are auto-injected by Supabase into every deployed function. If a custom
// secret override blanked one out, every admin call silently fails with an
// opaque 500 — surface that precise cause instead.
const ADMIN_ENV_OK = !!SUPABASE_URL && !!SERVICE_KEY;
const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

type Setting = { provider: string | null; enabled: boolean; config: Record<string, string> };

async function loadSetting(id: string): Promise<Setting> {
  const { data } = await admin
    .from("messaging_settings")
    .select("provider, enabled, config")
    .eq("id", id)
    .maybeSingle();
  return { provider: data?.provider ?? null, enabled: !!data?.enabled, config: data?.config ?? {} };
}

type AdminCheck = { ok: boolean; reason: "ok" | "no-auth" | "invalid-token" | "not-admin" | "error" };

// Returns WHY admin auth failed so the caller can give the user an actionable
// message. The single biggest cause of the client-side "Edge Function returned a
// non-2xx status code" is a stale/expired browser session: the app still looks
// logged-in but the access token no longer validates here, so getUser() returns
// no user. We surface that as a clear "sign back in" instead of an opaque error.
async function checkAdmin(req: Request): Promise<AdminCheck> {
  try {
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) return { ok: false, reason: "no-auth" };
    const { data, error } = await admin.auth.getUser(token);
    if (error || !data.user) return { ok: false, reason: "invalid-token" };
    const { data: roles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id)
      .eq("role", "super_admin");
    return (roles?.length ?? 0) > 0
      ? { ok: true, reason: "ok" }
      : { ok: false, reason: "not-admin" };
  } catch (e) {
    console.error("checkAdmin failed:", (e as Error).message);
    return { ok: false, reason: "error" };
  }
}

// Any staff member (coach / mentor / super_admin) — used for the meeting
// scheduler's bulk invite emails (not just super admins).
async function checkStaff(req: Request): Promise<{ ok: boolean; userId?: string }> {
  try {
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) return { ok: false };
    const { data, error } = await admin.auth.getUser(token);
    if (error || !data.user) return { ok: false };
    const { data: roles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id)
      .in("role", ["coach", "mentor", "super_admin"]);
    return (roles?.length ?? 0) > 0 ? { ok: true, userId: data.user.id } : { ok: false };
  } catch {
    return { ok: false };
  }
}

// All platform member emails (lowercased) from auth.users — profiles has no
// email column, so this is the source of truth. Paginated.
async function memberEmailSet(): Promise<Set<string>> {
  const set = new Set<string>();
  for (let page = 1; page <= 20; page++) {
    const { data } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    const users = data?.users ?? [];
    for (const u of users) if (u.email) set.add(u.email.trim().toLowerCase());
    if (users.length < 1000) break;
  }
  return set;
}

// Record a reminder delivery (idempotent via the unique key) for audit + to skip
// duplicate sends on a re-run.
async function logReminder(
  userId: string,
  date: string,
  channel: string,
  status: string,
  detail?: string,
) {
  try {
    await admin.from("reminder_log").upsert(
      {
        user_id: userId,
        target_date: date,
        channel,
        status,
        detail: detail ?? null,
        created_at: new Date().toISOString(),
      },
      { onConflict: "user_id,target_date,channel" },
    );
  } catch (e) {
    console.error("logReminder failed:", (e as Error).message);
  }
}

// Throttle the pre-auth OTP endpoint. Returns a reason string when the request
// should be blocked, or null to allow. Records each allowed attempt. Fails OPEN
// (returns null) on any DB error so an outage can't lock everyone out of login.
async function otpRateLimited(email: string, ip: string): Promise<string | null> {
  const now = Date.now();
  const emailBucket = `email:${email}`;
  const ipBucket = `ip:${ip}`;
  const hourAgo = new Date(now - 3_600_000).toISOString();
  const win45s = new Date(now - 45_000).toISOString();
  const countSince = async (bucket: string, since: string) => {
    const { count } = await admin
      .from("otp_requests")
      .select("*", { count: "exact", head: true })
      .eq("bucket", bucket)
      .gte("created_at", since);
    return count ?? 0;
  };
  try {
    if ((await countSince(emailBucket, win45s)) >= 1) return "email-45s";
    if ((await countSince(emailBucket, hourAgo)) >= 6) return "email-hour";
    if (ip !== "unknown" && (await countSince(ipBucket, hourAgo)) >= 30) return "ip-hour";
    await admin.from("otp_requests").insert([{ bucket: emailBucket }, { bucket: ipBucket }]);
    await admin.from("otp_requests").delete().lt("created_at", hourAgo); // opportunistic GC
    return null;
  } catch (e) {
    console.error("otpRateLimited error:", (e as Error).message);
    return null; // fail open
  }
}

// ---------------------------------------------------------------------------
// Email providers
// ---------------------------------------------------------------------------
async function sendEmail(to: string, subject: string, html: string, text?: string) {
  const s = await loadSetting("email");
  if (!s.enabled) throw new Error("Email provider is not enabled");
  const c = s.config;
  const fromEmail = c.fromEmail || c.from;
  const fromName = c.fromName || "VK Mentorship";
  if (!fromEmail) throw new Error("Sender email (fromEmail) is not configured");

  if (s.provider === "resend") {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${c.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: `${fromName} <${fromEmail}>`, to: [to], subject, html, text }),
    });
    if (!r.ok) throw new Error(`Resend: ${await r.text()}`);
    return;
  }

  if (s.provider === "mailersend") {
    if (!c.apiKey) throw new Error("MailerSend API token is not configured");
    const r = await fetch("https://api.mailersend.com/v1/email", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${c.apiKey.trim()}`,
        "Content-Type": "application/json",
        "X-Requested-With": "XMLHttpRequest",
      },
      body: JSON.stringify({
        from: { email: fromEmail, name: fromName },
        to: [{ email: to }],
        subject,
        html,
        text: text || stripHtml(html),
      }),
    });
    // 202 Accepted (queued) is the success case; 200/201 are fine too.
    if (r.status === 202 || r.ok) return;
    throw new Error(mailerSendError(r.status, await r.text().catch(() => "")));
  }

  if (s.provider === "ses") {
    await sendSes(c, fromEmail, to, subject, html, text || stripHtml(html));
    return;
  }

  if (s.provider === "zeptomail") {
    // Zoho ZeptoMail transactional API. Region 'in' (India DC) or 'com' (global).
    const region = (c.region || "in").trim().replace(/^\.+/, "");
    const raw = (c.apiKey || "").trim();
    const token = raw.toLowerCase().startsWith("zoho-enczapikey") ? raw : `Zoho-enczapikey ${raw}`;
    const r = await fetch(`https://api.zeptomail.${region}/v1.1/email`, {
      method: "POST",
      headers: { Authorization: token, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        from: { address: fromEmail, name: fromName },
        to: [{ email_address: { address: to } }],
        subject,
        htmlbody: html,
        textbody: text || stripHtml(html),
      }),
    });
    if (!r.ok) throw new Error(`ZeptoMail: ${await r.text()}`);
    return;
  }

  throw new Error(`Unknown email provider: ${s.provider}`);
}

const stripHtml = (h: string) =>
  h
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

// Turn MailerSend's HTTP error into an actionable, human message. Their failures
// are JSON: { message, errors: { "from.email": ["..."] } }. We flatten the field
// errors and add the fix for the two setups that trip people up the most —
// an unverified sender domain, and a bad/over-scoped API token.
function mailerSendError(status: number, raw: string): string {
  let detail = (raw || "").trim();
  try {
    const j = JSON.parse(raw);
    if (j?.errors && typeof j.errors === "object") {
      detail = Object.values(j.errors as Record<string, string[]>)
        .flat()
        .join(" ");
    } else if (j?.message) {
      detail = j.message;
    }
  } catch {
    /* not JSON — keep the raw text */
  }
  if (status === 401 || status === 403) {
    return `MailerSend rejected the API token (HTTP ${status}). In MailerSend → Integrations / API tokens, create a token with Email "Full access", then paste it in the From-token field. ${detail}`.trim();
  }
  if (status === 422 && /verif|domain|trial|approve/i.test(detail)) {
    return `MailerSend won't send from this sender yet: ${detail} Fix: in MailerSend add and verify your sending domain (Domains → DNS records), then set "From email" to an address on that domain. Trial accounts can only send from the test domain (…@*.mlsender.net) and only to your own account email.`;
  }
  return `MailerSend error (HTTP ${status}): ${detail || "unknown error"}`;
}

// --- Amazon SES v2 via SigV4 (no SDK) -------------------------------------
async function sendSes(
  c: Record<string, string>,
  from: string,
  to: string,
  subject: string,
  html: string,
  text: string,
) {
  const region = c.region || "us-east-1";
  const host = `email.${region}.amazonaws.com`;
  const path = "/v2/email/outbound-emails";
  const payload = JSON.stringify({
    FromEmailAddress: from,
    Destination: { ToAddresses: [to] },
    Content: {
      Simple: {
        Subject: { Data: subject },
        Body: { Html: { Data: html }, Text: { Data: text } },
      },
    },
  });
  const headers = await sigv4(
    "POST",
    host,
    path,
    payload,
    region,
    "ses",
    c.accessKeyId,
    c.secretAccessKey,
  );
  const r = await fetch(`https://${host}${path}`, { method: "POST", headers, body: payload });
  if (!r.ok) throw new Error(`SES: ${await r.text()}`);
}

async function sha256hex(data: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(data));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function hmac(key: ArrayBuffer | Uint8Array, data: string): Promise<ArrayBuffer> {
  const k = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  return crypto.subtle.sign("HMAC", k, new TextEncoder().encode(data));
}
async function sigv4(
  method: string,
  host: string,
  path: string,
  payload: string,
  region: string,
  service: string,
  accessKey: string,
  secretKey: string,
): Promise<Record<string, string>> {
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = await sha256hex(payload);
  const canonicalHeaders = `host:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
  const canonicalRequest = `${method}\n${path}\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;
  const scope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${scope}\n${await sha256hex(canonicalRequest)}`;
  const kDate = await hmac(new TextEncoder().encode("AWS4" + secretKey), dateStamp);
  const kRegion = await hmac(kDate, region);
  const kService = await hmac(kRegion, service);
  const kSigning = await hmac(kService, "aws4_request");
  const sigBuf = await hmac(kSigning, stringToSign);
  const signature = [...new Uint8Array(sigBuf)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return {
    "Content-Type": "application/json",
    "X-Amz-Date": amzDate,
    "x-amz-content-sha256": payloadHash,
    Authorization: `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
  };
}

// ---------------------------------------------------------------------------
// SMS / WhatsApp
// ---------------------------------------------------------------------------
async function sendSms(to: string, body: string) {
  const s = await loadSetting("sms");
  if (!s.enabled) throw new Error("SMS provider is not enabled");
  if (s.provider === "twilio") return twilio(s.config, to, body, false);
  if (s.provider === "msg91") {
    const r = await fetch("https://control.msg91.com/api/v5/flow/", {
      method: "POST",
      headers: { authkey: s.config.apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ template_id: s.config.templateId, recipients: [{ mobiles: to }] }),
    });
    if (!r.ok) throw new Error(`MSG91: ${await r.text()}`);
    return;
  }
  throw new Error(`Unknown SMS provider: ${s.provider}`);
}

// Optional template (Meta): unsolicited WhatsApp (outside the 24h service window)
// must use a pre-approved template, not free text. When `tpl` is given and the
// provider is Meta, we send a template message; body params fill {{1}}, {{2}}…
async function sendWhatsapp(
  to: string,
  body: string,
  tpl?: { name: string; lang: string; params?: string[] },
) {
  const s = await loadSetting("whatsapp");
  if (!s.enabled) throw new Error("WhatsApp provider is not enabled");
  if (s.provider === "twilio") return twilio(s.config, to, body, true);
  if (s.provider === "meta") {
    const payload =
      tpl && tpl.name
        ? {
            messaging_product: "whatsapp",
            to,
            type: "template",
            template: {
              name: tpl.name,
              language: { code: tpl.lang || "en" },
              ...(tpl.params && tpl.params.length
                ? {
                    components: [
                      {
                        type: "body",
                        parameters: tpl.params.map((t) => ({ type: "text", text: t })),
                      },
                    ],
                  }
                : {}),
            },
          }
        : { messaging_product: "whatsapp", to, type: "text", text: { body } };
    const r = await fetch(`https://graph.facebook.com/v20.0/${s.config.phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${s.config.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    if (!r.ok) throw new Error(`Meta WhatsApp: ${await r.text()}`);
    return;
  }
  throw new Error(`Unknown WhatsApp provider: ${s.provider}`);
}

async function twilio(c: Record<string, string>, to: string, body: string, whatsapp: boolean) {
  const from = whatsapp ? `whatsapp:${c.fromNumber}` : c.fromNumber;
  const dest = whatsapp ? `whatsapp:${to}` : to;
  const form = new URLSearchParams({ From: from, To: dest, Body: body });
  const r = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${c.accountSid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: "Basic " + btoa(`${c.accountSid}:${c.authToken}`),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    },
  );
  if (!r.ok) throw new Error(`Twilio: ${await r.text()}`);
}

// ---------------------------------------------------------------------------
// Daily task reminders
// ---------------------------------------------------------------------------
const HABIT_NAMES = [
  "Walking 20 Min",
  "Drink Water (4L)",
  "Meditation",
  "Affirmation",
  "Gratitude Journal",
  "Daily To-Do List",
];
const APP_URL = "https://vkmentorship.com/participant/habits";

type AutomationCfg = {
  daily_reminders_enabled?: boolean;
  email_enabled?: boolean;
  whatsapp_enabled?: boolean;
  email_subject?: string;
  email_heading?: string;
  email_intro?: string;
  whatsapp_message?: string;
  whatsapp_template_name?: string;
  whatsapp_template_lang?: string;
  cron_secret?: string;
};

async function loadAutomation(): Promise<AutomationCfg> {
  const { data } = await admin
    .from("messaging_settings")
    .select("config")
    .eq("id", "automation")
    .maybeSingle();
  return ((data?.config as AutomationCfg) ?? {}) as AutomationCfg;
}

function fillVars(tpl: string, v: { name: string; done: number; remaining: number }): string {
  return tpl
    .replaceAll("{name}", v.name)
    .replaceAll("{done}", String(v.done))
    .replaceAll("{remaining}", String(v.remaining));
}

// Modern, email-client-safe (table + inline CSS) reminder. Navy/gold theme.
function renderReminderEmail(cfg: AutomationCfg, name: string, done: number): {
  subject: string;
  html: string;
  text: string;
} {
  const remaining = Math.max(0, 6 - done);
  const heading = cfg.email_heading || "Keep your streak alive";
  const intro =
    cfg.email_intro ||
    "You still have tasks left for today. A few focused minutes now keeps your momentum going.";
  const subject = fillVars(cfg.email_subject || "Finish today's tasks ⏰", { name, done, remaining });

  const dots = Array.from({ length: 6 }, (_, i) => {
    const filled = i < done;
    return `<td style="padding:0 4px"><div style="width:34px;height:34px;border-radius:50%;background:${
      filled ? "#1f8f4e" : "#eceff3"
    };color:${filled ? "#ffffff" : "#9aa3af"};font:600 13px/34px system-ui,Arial;text-align:center">${
      filled ? "✓" : i + 1
    }</div></td>`;
  }).join("");

  const habitRows = HABIT_NAMES.map(
    (h, i) => `<tr><td style="padding:6px 0;font:400 14px/1.4 system-ui,Arial;color:#1e2430">
        <span style="display:inline-block;width:18px;color:${i < done ? "#1f8f4e" : "#c9ccd3"}">${
      i < done ? "✓" : "○"
    }</span>${h}</td></tr>`,
  ).join("");

  const html = `<!doctype html><html><body style="margin:0;background:#f4f6f9;padding:24px 12px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #e6e9ef">
    <tr><td style="background:#0B2545;padding:26px 28px">
      <div style="font:700 18px/1.2 system-ui,Arial;color:#ffffff">VK Mentorship</div>
      <div style="font:600 12px/1.4 system-ui,Arial;color:#C9A227;letter-spacing:.14em;text-transform:uppercase;margin-top:4px">Daily reminder</div>
    </td></tr>
    <tr><td style="height:4px;background:linear-gradient(90deg,#C9A227,#e6c65a)"></td></tr>
    <tr><td style="padding:28px">
      <p style="font:400 15px/1.5 system-ui,Arial;color:#1e2430;margin:0 0 4px">Hi ${escapeHtml(name)},</p>
      <h1 style="font:700 22px/1.25 system-ui,Arial;color:#0B2545;margin:0 0 10px">${escapeHtml(heading)}</h1>
      <p style="font:400 15px/1.55 system-ui,Arial;color:#4b5563;margin:0 0 18px">${escapeHtml(intro)}</p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 6px"><tr>${dots}</tr></table>
      <p style="font:600 13px/1.4 system-ui,Arial;color:#0B2545;margin:6px 0 18px">${done} of 6 done · <span style="color:#C9A227">${remaining} left today</span></p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;background:#f8f6f0;border-radius:12px;padding:8px 16px;margin:0 0 22px"><tr><td>
        <table role="presentation" cellpadding="0" cellspacing="0">${habitRows}</table>
      </td></tr></table>
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto"><tr><td style="border-radius:12px;background:#0B2545">
        <a href="${APP_URL}" style="display:inline-block;padding:13px 30px;font:600 15px/1 system-ui,Arial;color:#ffffff;text-decoration:none;border-radius:12px">Complete today's tasks →</a>
      </td></tr></table>
      <p style="font:400 12px/1.5 system-ui,Arial;color:#9aa3af;text-align:center;margin:20px 0 0">You're receiving this because your daily habits aren't finished yet. Keep going — consistency is everything. 💪</p>
    </td></tr>
    <tr><td style="background:#f4f6f9;padding:16px 28px;font:400 11px/1.5 system-ui,Arial;color:#9aa3af;text-align:center">VK Mentorship · Venu Kalyan Mentorship</td></tr>
  </table></body></html>`;

  const text = `Hi ${name}, ${heading}. ${intro} You've done ${done} of 6 tasks — ${remaining} left today. Finish them: ${APP_URL}`;
  return { subject, html, text };
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

// Normalise a phone to E.164-ish (Meta/Twilio want digits, no spaces). Assumes
// India (+91) when a bare 10-digit number is given.
function normalizePhone(raw: string): string | null {
  const d = String(raw || "").replace(/[^\d+]/g, "");
  if (!d) return null;
  if (d.startsWith("+")) return d;
  if (d.length === 10) return `+91${d}`;
  if (d.length === 12 && d.startsWith("91")) return `+${d}`;
  return `+${d}`;
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------
Deno.serve(async (req) => {
  const cors = corsFor(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { action, ...p } = await req.json();

    if (action === "request_otp") {
      const enabled = (await loadSetting("general")).config?.otp_login_enabled;
      if (!enabled) return json({ ok: false, error: "OTP login is disabled" }, 403, cors);
      const email = String(p.email || "")
        .trim()
        .toLowerCase();
      if (!email) return json({ ok: false, error: "Email required" }, 400, cors);

      // Rate limit (anti-abuse): throttle per-email and per-IP. Return ok on a
      // block so account existence / throttle state can't be probed — we just
      // skip the send. Windows: ≤1 email/45s, ≤6 email/hour, ≤30 per IP/hour.
      const ip =
        req.headers.get("cf-connecting-ip") ||
        req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        "unknown";
      const rl = await otpRateLimited(email, ip);
      if (rl) {
        console.warn(`request_otp throttled (${rl})`);
        return json({ ok: true }, 200, cors);
      }

      // Generate Supabase's own OTP (valid for client verifyOtp), email it ourselves.
      const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
      // Don't leak whether the account exists.
      if (!error && data?.properties?.email_otp) {
        const code = data.properties.email_otp;
        const html = `<div style="font-family:system-ui,sans-serif;max-width:480px">
          <h2 style="color:#0B2545">Your VK Mentorship login code</h2>
          <p>Enter this code to sign in. It expires shortly.</p>
          <p style="font-size:32px;font-weight:700;letter-spacing:6px;color:#0B2545">${code}</p>
          <p style="color:#667">If you didn't request this, you can ignore this email.</p></div>`;
        try {
          await sendEmail(email, "Your VKM login code", html, `Your VKM login code: ${code}`);
        } catch (e) {
          // Pre-auth path — never leak provider/internal error details to the caller.
          console.error("request_otp sendEmail failed:", (e as Error).message);
          return json({ ok: false, error: "Could not send login code. Try again later." }, 500, cors);
        }
      }
      // Always return ok so account existence + provider state can't be probed.
      return json({ ok: true }, 200, cors);
    }

    // Daily task reminders — invoked by pg_cron (with the shared x-cron-secret)
    // or manually by a super admin ("Run now"). Emails + WhatsApps every active
    // participant who hasn't finished all 6 of today's (IST) habits.
    if (action === "run_reminders") {
      const cfg = await loadAutomation();
      const secret = req.headers.get("x-cron-secret") || "";
      const bySecret = !!cfg.cron_secret && secret === cfg.cron_secret;
      const byAdmin = (await checkAdmin(req)).ok;
      if (!bySecret && !byAdmin) return json({ ok: false, error: "Forbidden" }, 403, cors);

      if (!cfg.daily_reminders_enabled && !p.force) {
        return json({ ok: true, skipped: "disabled" }, 200, cors);
      }

      // "Today" in IST — matches how habit_logs.log_date is stored.
      const istNow = new Date(Date.now() + 5.5 * 3600 * 1000);
      const target = istNow.toISOString().slice(0, 10);

      const { data: targets, error: tErr } = await admin.rpc("reminder_targets", {
        _target: target,
      });
      if (tErr) return json({ ok: false, error: tErr.message }, 500, cors);

      // Who already got a reminder today (idempotent re-runs).
      const { data: already } = await admin
        .from("reminder_log")
        .select("user_id, channel, status")
        .eq("target_date", target)
        .eq("status", "sent");
      const sentKey = new Set((already ?? []).map((r) => `${r.user_id}:${r.channel}`));

      const emailOn = cfg.email_enabled !== false;
      const waOn = cfg.whatsapp_enabled === true;
      let email = { sent: 0, failed: 0, skipped: 0 };
      let whatsapp = { sent: 0, failed: 0, skipped: 0 };

      for (const t of (targets ?? []) as Array<{
        user_id: string;
        full_name: string;
        email: string | null;
        phone: string | null;
        done: number;
      }>) {
        const name = t.full_name || "there";
        const remaining = Math.max(0, 6 - (t.done || 0));

        if (emailOn && t.email && !sentKey.has(`${t.user_id}:email`)) {
          try {
            const { subject, html, text } = renderReminderEmail(cfg, name, t.done || 0);
            await sendEmail(t.email, subject, html, text);
            email.sent++;
            await logReminder(t.user_id, target, "email", "sent");
          } catch (e) {
            email.failed++;
            await logReminder(t.user_id, target, "email", "failed", (e as Error).message);
          }
        }

        if (waOn && t.phone && !sentKey.has(`${t.user_id}:whatsapp`)) {
          const phone = normalizePhone(t.phone);
          if (!phone) {
            whatsapp.skipped++;
          } else {
            try {
              const msg = fillVars(
                cfg.whatsapp_message ||
                  "Hi {name}! You have {remaining} of 6 tasks left today. Finish them: " + APP_URL,
                { name, done: t.done || 0, remaining },
              );
              const tpl = cfg.whatsapp_template_name
                ? {
                    name: cfg.whatsapp_template_name,
                    lang: cfg.whatsapp_template_lang || "en",
                    params: [name, String(remaining)],
                  }
                : undefined;
              await sendWhatsapp(phone, msg, tpl);
              whatsapp.sent++;
              await logReminder(t.user_id, target, "whatsapp", "sent");
            } catch (e) {
              whatsapp.failed++;
              await logReminder(t.user_id, target, "whatsapp", "failed", (e as Error).message);
            }
          }
        }
      }

      return json(
        { ok: true, target, targets: (targets ?? []).length, email, whatsapp },
        200,
        cors,
      );
    }

    // Send a sample reminder to a specific address/number so an admin can preview
    // exactly what participants receive. Super-admin only.
    if (action === "test_reminder") {
      const adm = await checkAdmin(req);
      if (!adm.ok) return json({ ok: false, error: "Admin only." }, 200, cors);
      const cfg = await loadAutomation();
      const channel = String(p.channel || "email");
      const to = String(p.to || "").trim();
      if (!to) return json({ ok: false, error: "A destination is required." }, 400, cors);
      try {
        if (channel === "email") {
          const { subject, html, text } = renderReminderEmail(cfg, p.name || "there", 3);
          await sendEmail(to, `[Test] ${subject}`, html, text);
        } else if (channel === "whatsapp") {
          const phone = normalizePhone(to);
          if (!phone) return json({ ok: false, error: "Invalid phone number." }, 400, cors);
          const msg = fillVars(
            cfg.whatsapp_message || "Hi {name}! You have {remaining} of 6 tasks left today.",
            { name: p.name || "there", done: 3, remaining: 3 },
          );
          const tpl = cfg.whatsapp_template_name
            ? {
                name: cfg.whatsapp_template_name,
                lang: cfg.whatsapp_template_lang || "en",
                params: [p.name || "there", "3"],
              }
            : undefined;
          await sendWhatsapp(phone, msg, tpl);
        } else {
          return json({ ok: false, error: "Unknown channel." }, 400, cors);
        }
        return json({ ok: true }, 200, cors);
      } catch (e) {
        return json({ ok: false, error: (e as Error).message }, 200, cors);
      }
    }

    // Staff-gated bulk email — the meeting scheduler uses this to email invites
    // to participants + coaches + mentors + admins (any staff can send, not just
    // super admins). Content is built by the caller; this just fans it out.
    if (action === "send_bulk") {
      if (!ADMIN_ENV_OK) {
        return json(
          { ok: false, error: "Email function is misconfigured (service key missing)." },
          200,
          cors,
        );
      }
      const staff = await checkStaff(req);
      if (!staff.ok) return json({ ok: false, error: "Staff only." }, 200, cors);
      let recipients: string[] = Array.isArray(p.recipients)
        ? [...new Set(p.recipients.filter((x: unknown) => typeof x === "string" && x))]
        : [];
      // Anti-abuse: send_bulk is meant for meeting invites to platform members.
      // Restrict recipients to known member emails so a compromised staff account
      // can't fan arbitrary HTML out to arbitrary external addresses (phishing /
      // spam from the verified VKM domain). Emails live in auth.users, so build
      // the allow-list from there (profiles has no email column). Also cap size.
      {
        const allowed = await memberEmailSet();
        const before = recipients.length;
        recipients = recipients.filter((r) => allowed.has(r.trim().toLowerCase())).slice(0, 2000);
        if (recipients.length < before) {
          console.warn(`send_bulk: dropped ${before - recipients.length} non-member recipient(s)`);
        }
      }
      const subject = String(p.subject || "VK Mentorship");
      const html = String(p.html || "");
      const text = p.text ? String(p.text) : undefined;
      let sent = 0;
      let failed = 0;
      for (const to of recipients) {
        try {
          await sendEmail(to, subject, html, text);
          sent++;
        } catch (e) {
          failed++;
          console.error("send_bulk sendEmail failed:", (e as Error).message);
        }
      }
      return json({ ok: true, sent, failed }, 200, cors);
    }

    // All other actions are admin-only.
    if (!ADMIN_ENV_OK) {
      // Misconfigured function env — not the caller's fault. Return 200 so the
      // client surfaces this exact message instead of a generic non-2xx error.
      return json(
        {
          ok: false,
          error:
            "Email function is misconfigured: SUPABASE_SERVICE_ROLE_KEY / SUPABASE_URL is missing. Redeploy the function (these are normally auto-injected by Supabase).",
        },
        200,
        cors,
      );
    }
    const adm = await checkAdmin(req);
    if (!adm.ok) {
      // Return 200 with a precise, actionable message so the client surfaces it
      // verbatim instead of the opaque "Edge Function returned a non-2xx status
      // code". (The pre-auth OTP path above stays generic for security.)
      const msg =
        adm.reason === "not-admin"
          ? "This account isn't a super admin, so it can't send messages. Sign in with an admin account."
          : adm.reason === "no-auth"
            ? "You're not signed in. Sign in as an admin and try again."
            : "Your admin session has expired or is invalid. Sign out and sign back in, then retry.";
      return json({ ok: false, error: msg }, 200, cors);
    }

    // Caller is a verified super_admin past this point — provider/config error
    // details are safe (and useful) to surface for debugging their setup.
    try {
      if (action === "send_email") {
        await sendEmail(p.to, p.subject, p.html, p.text);
        return json({ ok: true }, 200, cors);
      }
      if (action === "send_sms") {
        await sendSms(p.to, p.body);
        return json({ ok: true }, 200, cors);
      }
      if (action === "send_whatsapp") {
        await sendWhatsapp(p.to, p.body);
        return json({ ok: true }, 200, cors);
      }
      if (action === "test") {
        const to = String(p.to || "");
        if (p.channel === "email")
          await sendEmail(
            to,
            "VKM test email",
            "<p>✅ Your VKM email provider is working.</p>",
            "Your VKM email provider is working.",
          );
        else if (p.channel === "sms") await sendSms(to, "✅ VKM SMS test — your provider works.");
        else if (p.channel === "whatsapp")
          await sendWhatsapp(to, "✅ VKM WhatsApp test — your provider works.");
        else return json({ ok: false, error: "Unknown channel" }, 400, cors);
        return json({ ok: true }, 200, cors);
      }
    } catch (e) {
      // Return 200 so supabase.functions.invoke doesn't mask this behind a
      // generic "non-2xx" error — the admin needs the real provider message
      // (e.g. MailerSend domain/recipient validation) to fix their setup.
      return json({ ok: false, error: String((e as Error).message) }, 200, cors);
    }

    return json({ ok: false, error: "Unknown action" }, 400, cors);
  } catch (e) {
    // Pre-auth / parse errors — stay generic so internals aren't leaked.
    console.error("messaging error:", (e as Error).message);
    return json({ ok: false, error: "Request failed" }, 500, cors);
  }
});
