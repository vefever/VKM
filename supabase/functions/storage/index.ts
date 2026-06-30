// VKM storage edge function — lets the admin choose where uploads live:
// Supabase Storage (default) or Cloudflare R2 (S3-compatible).
//
// Actions (POST JSON { action, ... }):
//   presign    { bucket, key, contentType }  — any authed user; returns either
//                { provider:'supabase' } or { provider:'r2', uploadUrl, publicUrl }
//   get_config {}                            — super_admin; provider + non-secret config
//   set_config { provider, ... }             — super_admin; saves R2 credentials
//
// R2 config lives in messaging_settings(id='storage'), readable only via the
// service role here — the secret access key never reaches the browser.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") || "")
  .split(",").map((o) => o.trim()).filter(Boolean);

function corsFor(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") || "";
  let allow = "*";
  if (ALLOWED_ORIGINS.length > 0) allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}
const json = (b: unknown, status = 200, cors: Record<string, string> = {}) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

type StorageConfig = {
  accountId?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  bucket?: string;
  publicBaseUrl?: string;
};

async function loadStorage(): Promise<{ provider: string; enabled: boolean; c: StorageConfig }> {
  const { data } = await admin
    .from("messaging_settings")
    .select("provider, enabled, config")
    .eq("id", "storage")
    .maybeSingle();
  return {
    provider: (data?.provider as string) || "supabase",
    enabled: !!data?.enabled,
    c: (data?.config ?? {}) as StorageConfig,
  };
}

async function getUser(req: Request) {
  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) return null;
  const { data } = await admin.auth.getUser(token);
  return data.user ?? null;
}
async function isSuperAdmin(userId: string): Promise<boolean> {
  const { data } = await admin.from("user_roles").select("role").eq("user_id", userId).eq("role", "super_admin");
  return (data?.length ?? 0) > 0;
}

// --- S3 SigV4 query-string presign (PUT) for R2 -----------------------------
async function sha256hex(data: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(data));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function hmac(key: ArrayBuffer | Uint8Array, data: string): Promise<ArrayBuffer> {
  const k = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return crypto.subtle.sign("HMAC", k, new TextEncoder().encode(data));
}
const enc = (s: string) =>
  encodeURIComponent(s).replace(/[!*'()]/g, (ch) => "%" + ch.charCodeAt(0).toString(16).toUpperCase());
const encKey = (key: string) => key.split("/").map(enc).join("/");

async function presignR2(c: StorageConfig, key: string): Promise<string> {
  const host = `${c.accountId}.r2.cloudflarestorage.com`;
  const region = "auto";
  const service = "s3";
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const scope = `${dateStamp}/${region}/${service}/aws4_request`;
  const canonicalUri = `/${c.bucket}/${encKey(key)}`;

  const params: Record<string, string> = {
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${c.accessKeyId}/${scope}`,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": "900",
    "X-Amz-SignedHeaders": "host",
  };
  const canonicalQuery = Object.keys(params)
    .sort()
    .map((k) => `${enc(k)}=${enc(params[k])}`)
    .join("&");

  const canonicalRequest = [
    "PUT", canonicalUri, canonicalQuery, `host:${host}\n`, "host", "UNSIGNED-PAYLOAD",
  ].join("\n");
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, await sha256hex(canonicalRequest)].join("\n");

  const kDate = await hmac(new TextEncoder().encode("AWS4" + c.secretAccessKey), dateStamp);
  const kRegion = await hmac(kDate, region);
  const kService = await hmac(kRegion, service);
  const kSigning = await hmac(kService, "aws4_request");
  const sigBuf = await hmac(kSigning, stringToSign);
  const signature = [...new Uint8Array(sigBuf)].map((b) => b.toString(16).padStart(2, "0")).join("");

  return `https://${host}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}

Deno.serve(async (req) => {
  const cors = corsFor(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { action, ...p } = await req.json();
    const user = await getUser(req);
    if (!user) return json({ ok: false, error: "Unauthorized" }, 401, cors);

    if (action === "presign") {
      const { provider, enabled, c } = await loadStorage();
      const key = String(p.key || "");
      if (!key) return json({ ok: false, error: "key required" }, 400, cors);
      if (provider === "r2" && enabled && c.accountId && c.accessKeyId && c.secretAccessKey && c.bucket && c.publicBaseUrl) {
        const uploadUrl = await presignR2(c, key);
        const publicUrl = `${c.publicBaseUrl.replace(/\/$/, "")}/${encKey(key)}`;
        return json({ ok: true, provider: "r2", uploadUrl, publicUrl }, 200, cors);
      }
      return json({ ok: true, provider: "supabase" }, 200, cors);
    }

    // Admin-only beyond this point.
    if (!(await isSuperAdmin(user.id))) return json({ ok: false, error: "Forbidden" }, 403, cors);

    if (action === "get_config") {
      const { provider, enabled, c } = await loadStorage();
      return json({
        ok: true,
        provider, enabled,
        accountId: c.accountId ?? "",
        bucket: c.bucket ?? "",
        publicBaseUrl: c.publicBaseUrl ?? "",
        accessKeyId: c.accessKeyId ?? "",
        hasSecret: !!c.secretAccessKey,
      }, 200, cors);
    }

    if (action === "set_config") {
      const provider = p.provider === "r2" ? "r2" : "supabase";
      const { c: existing } = await loadStorage();
      const config: StorageConfig = {
        accountId: String(p.accountId || "").trim(),
        accessKeyId: String(p.accessKeyId || "").trim(),
        // Keep the stored secret if the admin left the field blank on re-save.
        secretAccessKey: p.secretAccessKey ? String(p.secretAccessKey).trim() : existing.secretAccessKey || "",
        bucket: String(p.bucket || "").trim(),
        publicBaseUrl: String(p.publicBaseUrl || "").trim(),
      };
      const enabled = provider === "r2"
        ? !!(config.accountId && config.accessKeyId && config.secretAccessKey && config.bucket && config.publicBaseUrl)
        : false;
      const { error } = await admin.from("messaging_settings").upsert(
        { id: "storage", provider, enabled, config, updated_at: new Date().toISOString() },
        { onConflict: "id" },
      );
      if (error) return json({ ok: false, error: error.message }, 500, cors);
      return json({ ok: true, provider, enabled }, 200, cors);
    }

    return json({ ok: false, error: "Unknown action" }, 400, cors);
  } catch (e) {
    console.error("storage error:", (e as Error).message);
    return json({ ok: false, error: "Request failed" }, 500, cors);
  }
});
