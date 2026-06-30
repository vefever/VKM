// VKM Zoom edge function.
//  - create_meeting { participantId, topic, startTime, duration } — staff only.
//      Creates a Zoom meeting via Server-to-Server OAuth and stores it.
//  - signature { meetingId } — host/participant of that meeting.
//      Returns a Zoom Meeting SDK signature so the call runs in-app (no redirect).
//
// Zoom credentials are read from messaging_settings(id='zoom') with the service
// role: { accountId, clientId, clientSecret, sdkKey, sdkSecret }.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Origin allow-list: set ALLOWED_ORIGINS (comma-separated) in the function's
// secrets to lock CORS down to your app's origin(s). Unset → falls back to "*".
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
const json = (b: unknown, status = 200, cors: Record<string, string> = {}) =>
  new Response(JSON.stringify(b), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

async function zoomConfig() {
  const { data } = await admin
    .from("messaging_settings")
    .select("enabled, config")
    .eq("id", "zoom")
    .maybeSingle();
  return { enabled: !!data?.enabled, c: (data?.config ?? {}) as Record<string, string> };
}

async function getUser(req: Request) {
  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) return null;
  const { data } = await admin.auth.getUser(token);
  return data.user ?? null;
}
async function rolesOf(userId: string): Promise<string[]> {
  const { data } = await admin.from("user_roles").select("role").eq("user_id", userId);
  return (data ?? []).map((r) => r.role as string);
}
const isStaff = (roles: string[]) =>
  roles.includes("coach") || roles.includes("mentor") || roles.includes("super_admin");

// --- Server-to-Server OAuth ------------------------------------------------
async function zoomToken(c: Record<string, string>) {
  const r = await fetch(
    `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${c.accountId}`,
    {
      method: "POST",
      headers: { Authorization: "Basic " + btoa(`${c.clientId}:${c.clientSecret}`) },
    },
  );
  if (!r.ok) throw new Error(`Zoom OAuth: ${await r.text()}`);
  return (await r.json()).access_token as string;
}

// --- Meeting SDK signature (JWT, HS256) ------------------------------------
const b64url = (bytes: Uint8Array) => {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const enc = (s: string) => new TextEncoder().encode(s);

async function sdkSignature(sdkKey: string, sdkSecret: string, mn: string, role: number) {
  const iat = Math.floor(Date.now() / 1000) - 30;
  const exp = iat + 60 * 60 * 2; // 2h
  const header = b64url(enc(JSON.stringify({ alg: "HS256", typ: "JWT" })));
  const payload = b64url(
    enc(
      JSON.stringify({
        appKey: sdkKey,
        sdkKey,
        mn,
        role,
        iat,
        exp,
        tokenExp: exp,
      }),
    ),
  );
  const data = `${header}.${payload}`;
  const key = await crypto.subtle.importKey(
    "raw",
    enc(sdkSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc(data));
  return `${data}.${b64url(new Uint8Array(sig))}`;
}

Deno.serve(async (req) => {
  const cors = corsFor(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { action, ...p } = await req.json();
    const user = await getUser(req);
    if (!user) return json({ ok: false, error: "Unauthorized" }, 401, cors);
    const roles = await rolesOf(user.id);
    const { enabled, c } = await zoomConfig();
    if (!enabled)
      return json(
        { ok: false, error: "Zoom is not enabled. Add your Zoom credentials in Admin → Integrations and turn it on." },
        200, cors,
      );

    if (action === "create_meeting") {
      if (!isStaff(roles)) return json({ ok: false, error: "Forbidden: staff only" }, 200, cors);
      if (!c.accountId || !c.clientId || !c.clientSecret)
        return json(
          { ok: false, error: "Zoom Server-to-Server OAuth credentials (Account ID, Client ID, Client Secret) are missing. The SDK Key/Secret alone can't create meetings." },
          200, cors,
        );
      const token = await zoomToken(c);
      const r = await fetch("https://api.zoom.us/v2/users/me/meetings", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: p.topic || "VKM Coaching Call",
          type: 2, // scheduled
          start_time: p.startTime, // ISO 8601
          duration: p.duration || 30,
          timezone: "UTC",
          settings: {
            join_before_host: true,
            waiting_room: false,
            approval_type: 2,
            meeting_authentication: false,
          },
        }),
      });
      // Surface the real Zoom error to staff (status 200 so invoke doesn't mask it).
      if (!r.ok) return json({ ok: false, error: `Zoom API: ${await r.text()}` }, 200, cors);
      const m = await r.json();
      const { data: row, error } = await admin
        .from("meetings")
        .insert({
          zoom_meeting_id: String(m.id),
          topic: p.topic || "VKM Coaching Call",
          host_id: user.id,
          participant_id: p.participantId ?? null,
          batch_id: p.batchId ?? null,
          start_time: p.startTime,
          duration_min: p.duration || 30,
          join_url: m.join_url,
          start_url: m.start_url,
          password: m.password ?? null,
          status: "scheduled",
        })
        .select("id, topic, start_time, duration_min, participant_id, host_id, status")
        .single();
      if (error) return json({ ok: false, error: error.message }, 200, cors);
      return json({ ok: true, meeting: row }, 200, cors);
    }

    if (action === "signature") {
      const { data: meeting } = await admin
        .from("meetings")
        .select("zoom_meeting_id, password, host_id, participant_id")
        .eq("id", p.meetingId)
        .maybeSingle();
      if (!meeting) return json({ ok: false, error: "Meeting not found" }, 200, cors);
      const isHost = meeting.host_id === user.id;
      const allowed = isHost || meeting.participant_id === user.id || isStaff(roles);
      if (!allowed) return json({ ok: false, error: "Forbidden" }, 403, cors);
      if (!c.sdkKey || !c.sdkSecret)
        return json({ ok: false, error: "Meeting SDK key/secret not configured" }, 200, cors);
      const role = isHost ? 1 : 0;
      const signature = await sdkSignature(c.sdkKey, c.sdkSecret, meeting.zoom_meeting_id!, role);
      return json({
        ok: true,
        signature,
        sdkKey: c.sdkKey,
        meetingNumber: meeting.zoom_meeting_id,
        password: meeting.password ?? "",
        role,
      }, 200, cors);
    }

    return json({ ok: false, error: "Unknown action" }, 400, cors);
  } catch (e) {
    // 200 + ok:false so the staff caller sees the real reason (e.g. Zoom OAuth
    // failure) instead of a masked "non-2xx" error.
    console.error("zoom error:", (e as Error).message);
    return json({ ok: false, error: String((e as Error).message) }, 200, cors);
  }
});
