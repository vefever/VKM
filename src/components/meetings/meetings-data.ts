import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { profilesDisplayFor } from "@/lib/profiles-display";

export type Meeting = {
  id: string;
  topic: string;
  host_id: string;
  participant_id: string | null;
  start_time: string;
  duration_min: number;
  join_url: string | null;
  status: string;
  zoom_meeting_id: string | null;
  hostName: string;
  participantName: string;
};

export type SchedulablePerson = { id: string; name: string; avatar: string | null };

async function namesFor(ids: string[]) {
  const m = new Map<string, { name: string; avatar: string | null }>();
  const clean = [...new Set(ids.filter(Boolean))];
  if (!clean.length) return m;
  const resolved = await profilesDisplayFor(clean);
  resolved.forEach((p) => m.set(p.id, { name: p.name, avatar: p.avatar }));
  return m;
}

/** Meetings the current user can see (RLS: host, invited participant, or staff). */
export function useMeetings() {
  const { user } = useAuth();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setError(null);
    const { data, error: err } = await supabase
      .from("meetings")
      .select(
        "id, topic, host_id, participant_id, start_time, duration_min, join_url, status, zoom_meeting_id",
      )
      .order("start_time", { ascending: true });
    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }
    const rows = data ?? [];
    const names = await namesFor(rows.flatMap((r) => [r.host_id, r.participant_id ?? ""]));
    setMeetings(
      rows.map((r) => ({
        ...r,
        hostName: names.get(r.host_id)?.name ?? "Coach",
        participantName: r.participant_id
          ? (names.get(r.participant_id)?.name ?? "Participant")
          : "—",
      })),
    );
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void load().catch(() => setLoading(false));
  }, [load]);

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`meetings:${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "meetings" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user, load]);

  return { meetings, loading, error, reload: load };
}

/** Participants a coach/mentor can schedule with — drawn from their batches.
 *  Super admins with no batch fall back to all participant-role users. */
export function useSchedulableParticipants() {
  const { user, hasRole } = useAuth();
  const [people, setPeople] = useState<SchedulablePerson[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!user) return;
      const { data: mine } = await supabase
        .from("batch_members")
        .select("batch_id")
        .eq("user_id", user.id)
        .in("role", ["coach", "mentor"]);
      const batchIds = (mine ?? []).map((b) => b.batch_id);

      let ids: string[] = [];
      if (batchIds.length) {
        const { data } = await supabase
          .from("batch_members")
          .select("user_id")
          .eq("role", "participant")
          .in("batch_id", batchIds);
        ids = (data ?? []).map((d) => d.user_id);
      } else if (hasRole("super_admin")) {
        const { data } = await supabase
          .from("user_roles")
          .select("user_id")
          .eq("role", "participant");
        ids = (data ?? []).map((d) => d.user_id);
      }

      const names = await namesFor(ids);
      const list = [...new Set(ids)].map((id) => ({
        id,
        name: names.get(id)?.name ?? "Participant",
        avatar: names.get(id)?.avatar ?? null,
      }));
      list.sort((a, b) => a.name.localeCompare(b.name));
      if (alive) {
        setPeople(list);
        setLoading(false);
      }
    })().catch(() => {
      if (alive) setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [user, hasRole]);

  return { people, loading };
}

export async function scheduleMeeting(input: {
  participantId: string;
  topic: string;
  startTime: string; // ISO
  duration: number;
}) {
  const { data, error } = await supabase.functions.invoke("zoom", {
    body: { action: "create_meeting", ...input },
  });
  if (error) throw error;
  if (data?.ok === false) throw new Error(data.error || "Could not schedule meeting");
  return data.meeting as { id: string };
}

export type ZoomJoinInfo = {
  signature: string;
  sdkKey: string;
  meetingNumber: string;
  password: string;
  role: number;
};

export async function getZoomSignature(meetingId: string): Promise<ZoomJoinInfo> {
  const { data, error } = await supabase.functions.invoke("zoom", {
    body: { action: "signature", meetingId },
  });
  if (error) throw error;
  if (data?.ok === false) throw new Error(data.error || "Could not join meeting");
  return data as ZoomJoinInfo;
}
