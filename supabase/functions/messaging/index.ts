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

async function requireAdmin(req: Request): Promise<boolean> {
  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) return false;
  const { data } = await admin.auth.getUser(token);
  if (!data.user) return false;
  const { data: roles } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", data.user.id)
    .eq("role", "super_admin");
  return (roles?.length ?? 0) > 0;
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
    const r = await fetch("https://api.mailersend.com/v1/email", {
      method: "POST",
      headers: { Authorization: `Bearer ${c.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: { email: fromEmail, name: fromName },
        to: [{ email: to }],
        subject,
        html,
        text: text || stripHtml(html),
      }),
    });
    if (!r.ok && r.status !== 202) throw new Error(`MailerSend: ${await r.text()}`);
    return;
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

async function sendWhatsapp(to: string, body: string) {
  const s = await loadSetting("whatsapp");
  if (!s.enabled) throw new Error("WhatsApp provider is not enabled");
  if (s.provider === "twilio") return twilio(s.config, to, body, true);
  if (s.provider === "meta") {
    const r = await fetch(`https://graph.facebook.com/v20.0/${s.config.phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${s.config.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body },
      }),
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

    // All other actions are admin-only.
    if (!(await requireAdmin(req))) return json({ ok: false, error: "Forbidden" }, 403, cors);

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
