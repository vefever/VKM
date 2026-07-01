import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SITE_URL = "https://vkmentorship.com";

export type MeetingType = "zoom" | "link" | "in_person";

// One-click "Add to Google Calendar" link (works in the invite email).
function googleCalUrl(args: {
  topic: string;
  startISO: string;
  durationMin: number;
  details: string;
  location: string;
}): string {
  const start = new Date(args.startISO);
  const end = new Date(start.getTime() + args.durationMin * 60000);
  const stamp = (d: Date) => d.toISOString().replace(/[-:]|\.\d{3}/g, "");
  const q = new URLSearchParams({
    action: "TEMPLATE",
    text: args.topic,
    dates: `${stamp(start)}/${stamp(end)}`,
    details: args.details,
    location: args.location,
  });
  return `https://calendar.google.com/calendar/render?${q.toString()}`;
}

const esc = (s: string) =>
  (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function buildInviteEmail(args: {
  topic: string;
  whenLabel: string;
  durationMin: number;
  type: MeetingType;
  joinUrl: string | null;
  location: string | null;
  notes: string | null;
  hostName: string;
  gcalUrl: string;
}): { subject: string; html: string; text: string } {
  const where =
    args.type === "in_person"
      ? `In person — ${esc(args.location || "location shared separately")}`
      : args.joinUrl
        ? `Online — <a href="${esc(args.joinUrl)}" style="color:#3b6fb0">Join link</a>`
        : "Online";
  const subject = `Meeting invite: ${args.topic}`;
  const html = `<!doctype html><html><body style="margin:0;background:#f4f1ea;font-family:Segoe UI,Helvetica,Arial,sans-serif;color:#1a2230">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px"><tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 8px 30px rgba(11,37,69,.1)">
      <tr><td style="background:#0B2545;padding:22px 28px;color:#fff;font-size:16px;font-weight:700;letter-spacing:2px">VK <span style="color:#E7B53C">MENTORSHIP</span></td></tr>
      <tr><td style="padding:28px">
        <p style="margin:0 0 4px;font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:#C79A1E;font-weight:700">Meeting invitation</p>
        <h1 style="margin:2px 0 14px;font-size:22px;color:#0B2545">${esc(args.topic)}</h1>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f9fb;border:1px solid #e4e7ec;border-radius:12px">
          <tr><td style="padding:14px 18px;font-size:14px;color:#1a2230;line-height:1.9">
            <strong style="color:#5b6675">When:</strong> ${esc(args.whenLabel)} · ${args.durationMin} min<br>
            <strong style="color:#5b6675">Where:</strong> ${where}<br>
            <strong style="color:#5b6675">Host:</strong> ${esc(args.hostName)}
            ${args.notes ? `<br><strong style="color:#5b6675">Notes:</strong> ${esc(args.notes)}` : ""}
          </td></tr>
        </table>
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0 6px"><tr>
          ${
            args.joinUrl
              ? `<td bgcolor="#0B2545" style="border-radius:12px"><a href="${esc(args.joinUrl)}" style="display:inline-block;padding:12px 24px;font-size:14px;font-weight:700;color:#fff;text-decoration:none">Join the meeting →</a></td><td style="width:10px"></td>`
              : ""
          }
          <td bgcolor="#E7B53C" style="border-radius:12px"><a href="${esc(args.gcalUrl)}" style="display:inline-block;padding:12px 24px;font-size:14px;font-weight:700;color:#0B2545;text-decoration:none">Add to calendar</a></td>
        </tr></table>
        <p style="margin:18px 0 0;font-size:12px;color:#8a93a3">You're invited via VK Mentorship. See all your meetings in the app calendar at <a href="${SITE_URL}/app" style="color:#3b6fb0">${SITE_URL}</a>.</p>
      </td></tr>
    </table>
  </td></tr></table></body></html>`;
  const text = [
    `Meeting invite: ${args.topic}`,
    `When: ${args.whenLabel} (${args.durationMin} min)`,
    args.type === "in_person"
      ? `Where: In person — ${args.location || ""}`
      : `Join: ${args.joinUrl || "Online"}`,
    `Host: ${args.hostName}`,
    args.notes ? `Notes: ${args.notes}` : "",
    `Add to calendar: ${args.gcalUrl}`,
  ]
    .filter(Boolean)
    .join("\n");
  return { subject, html, text };
}

// ---------------------------------------------------------------------------
// Staff the scheduler can add as co-hosts (coach / mentor / super_admin).
// ---------------------------------------------------------------------------
export const getSchedulableStaff = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ data: isAdmin }, { data: isMentor }, { data: isCoach }] = await Promise.all([
      supabase.rpc("has_role", { _user_id: userId, _role: "super_admin" }),
      supabase.rpc("has_role", { _user_id: userId, _role: "mentor" }),
      supabase.rpc("has_role", { _user_id: userId, _role: "coach" }),
    ]);
    if (!isAdmin && !isMentor && !isCoach) throw new Error("Forbidden: staff only");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sdb = supabaseAdmin as unknown as SupabaseClient;
    const { data: roleRows } = await sdb
      .from("user_roles")
      .select("user_id, role")
      .in("role", ["coach", "mentor", "super_admin"]);
    const byUser = new Map<string, string>();
    (roleRows ?? []).forEach((r) => {
      const rank: Record<string, number> = { super_admin: 3, mentor: 2, coach: 1 };
      const cur = byUser.get(r.user_id);
      if (!cur || (rank[r.role as string] ?? 0) > (rank[cur] ?? 0)) byUser.set(r.user_id, r.role as string);
    });
    const ids = [...byUser.keys()];
    if (ids.length === 0) return [] as { id: string; name: string; role: string }[];
    const { data: profs } = await sdb.from("profiles").select("id, full_name").in("id", ids);
    const nameOf = new Map((profs ?? []).map((p) => [p.id, p.full_name as string | null]));
    return ids
      .map((id) => ({ id, name: nameOf.get(id) || "Staff", role: byUser.get(id) as string }))
      .sort((a, b) => a.name.localeCompare(b.name));
  });

// ---------------------------------------------------------------------------
// Schedule a group meeting — creates the meeting (+ Zoom if requested), invites
// every attendee, notifies them in-app and emails them a calendar invite.
// ---------------------------------------------------------------------------
export const scheduleMeeting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (input: {
      topic: string;
      startTime: string; // ISO
      duration: number;
      type: MeetingType;
      joinUrl?: string;
      location?: string;
      notes?: string;
      participantIds: string[];
      staffIds: string[];
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const [{ data: isAdmin }, { data: isMentor }, { data: isCoach }] = await Promise.all([
      supabase.rpc("has_role", { _user_id: userId, _role: "super_admin" }),
      supabase.rpc("has_role", { _user_id: userId, _role: "mentor" }),
      supabase.rpc("has_role", { _user_id: userId, _role: "coach" }),
    ]);
    if (!isAdmin && !isMentor && !isCoach) throw new Error("Forbidden: staff only");

    const topic = (data.topic || "").trim();
    if (!topic) throw new Error("Topic is required");
    if (!data.startTime) throw new Error("Start time is required");
    const duration = Math.max(5, Math.min(480, Number(data.duration) || 30));

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // meeting_type / location / notes / meeting_attendees aren't in the generated
    // types yet — use an untyped client view for these writes.
    const sdb = supabaseAdmin as unknown as SupabaseClient;

    const attendeeIds = [
      ...new Set([...(data.participantIds ?? []), ...(data.staffIds ?? []), userId]),
    ].filter(Boolean);
    if (attendeeIds.length === 0) throw new Error("Select at least one attendee");

    // --- Create the meeting (+ Zoom link if requested) ---
    let meetingId: string;
    let joinUrl: string | null = null;
    if (data.type === "zoom") {
      const primary = (data.participantIds ?? [])[0] ?? userId;
      const { data: z, error: zErr } = await supabase.functions.invoke("zoom", {
        body: { action: "create_meeting", participantId: primary, topic, startTime: data.startTime, duration },
      });
      if (zErr || z?.ok === false) {
        throw new Error(
          (z?.error as string) ||
            "Couldn't auto-create the Zoom meeting. Set up Zoom in Admin → Integrations, or pick a custom link / in-person.",
        );
      }
      meetingId = z.meeting.id as string;
      await sdb
        .from("meetings")
        .update({ meeting_type: "zoom", notes: data.notes?.trim() || null })
        .eq("id", meetingId);
      const { data: mrow } = await sdb
        .from("meetings")
        .select("join_url")
        .eq("id", meetingId)
        .maybeSingle();
      joinUrl = mrow?.join_url ?? null;
    } else {
      joinUrl = data.type === "link" ? data.joinUrl?.trim() || null : null;
      const { data: mrow, error: mErr } = await sdb
        .from("meetings")
        .insert({
          topic,
          host_id: userId,
          start_time: data.startTime,
          duration_min: duration,
          meeting_type: data.type,
          join_url: joinUrl,
          location: data.type === "in_person" ? data.location?.trim() || null : null,
          notes: data.notes?.trim() || null,
          status: "scheduled",
        })
        .select("id")
        .single();
      if (mErr) throw new Error(mErr.message);
      meetingId = mrow.id as string;
    }

    // --- Attendees (with a role snapshot) ---
    const { data: roleRows } = await sdb
      .from("user_roles")
      .select("user_id, role")
      .in("user_id", attendeeIds);
    const roleOf = new Map<string, string>();
    (roleRows ?? []).forEach((r) => {
      if (!roleOf.has(r.user_id)) roleOf.set(r.user_id, r.role as string);
    });
    await sdb.from("meeting_attendees").upsert(
      attendeeIds.map((id) => ({
        meeting_id: meetingId,
        user_id: id,
        role: roleOf.get(id) ?? "member",
        status: id === userId ? "accepted" : "invited",
      })),
      { onConflict: "meeting_id,user_id", ignoreDuplicates: true },
    );

    // --- Notify every attendee (except the scheduler) ---
    const whenLabel = new Date(data.startTime).toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    });
    const others = attendeeIds.filter((id) => id !== userId);
    if (others.length) {
      await sdb.from("notifications").insert(
        others.map((id) => ({
          user_id: id,
          type: "meeting",
          title: "New meeting scheduled",
          body: `${topic} · ${whenLabel} (${duration} min)${
            data.type === "in_person" ? ` · ${data.location?.trim() || "in person"}` : ""
          }`,
          link: joinUrl || null,
          actor_id: userId,
        })),
      );
    }

    // --- Email everyone a calendar invite (staff-gated bulk send) ---
    const { data: usersPage } = await sdb.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const emailOf = new Map<string, string>();
    (usersPage?.users ?? []).forEach((u) => {
      if (u.email) emailOf.set(u.id, u.email);
    });
    const recipients = attendeeIds.map((id) => emailOf.get(id)).filter((e): e is string => !!e);
    const hostName =
      (await sdb.from("profiles").select("full_name").eq("id", userId).maybeSingle()).data
        ?.full_name || "Your VKM host";
    const gcalUrl = googleCalUrl({
      topic,
      startISO: data.startTime,
      durationMin: duration,
      details:
        (data.notes?.trim() ? data.notes.trim() + "\n" : "") +
        (joinUrl ? `Join: ${joinUrl}` : data.type === "in_person" ? `Location: ${data.location || ""}` : ""),
      location: data.type === "in_person" ? data.location?.trim() || "" : joinUrl || "",
    });
    const { subject, html, text } = buildInviteEmail({
      topic,
      whenLabel,
      durationMin: duration,
      type: data.type,
      joinUrl,
      location: data.location?.trim() || null,
      notes: data.notes?.trim() || null,
      hostName,
      gcalUrl,
    });

    let emailed = 0;
    if (recipients.length) {
      try {
        const { data: res } = await supabase.functions.invoke("messaging", {
          body: { action: "send_bulk", recipients, subject, html, text },
        });
        emailed = (res as { sent?: number } | null)?.sent ?? 0;
      } catch {
        /* email is best-effort — the meeting, calendar block and notifications still land */
      }
    }

    return { ok: true, meetingId, attendees: attendeeIds.length, emailed };
  });
