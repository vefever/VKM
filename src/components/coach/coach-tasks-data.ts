import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { profileDisplayMap } from "@/lib/profiles-display";
import { useAuth } from "@/hooks/use-auth";

export type CoachTask = {
  id: string;
  title: string;
  due_on: string | null;
  done: boolean;
  participant_id: string | null;
  participantName: string | null;
  participantAvatar: string | null;
};

/** A coach's personal tasks/reminders (optionally tied to a participant). */
export function useCoachTasks() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<CoachTask[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("coach_tasks")
      .select("id, title, due_on, done, participant_id")
      .eq("coach_id", user.id)
      .order("done")
      .order("due_on", { nullsFirst: false })
      .order("created_at");
    const rows = data ?? [];
    const ids = [...new Set(rows.map((r) => r.participant_id).filter(Boolean) as string[])];
    const display = ids.length ? await profileDisplayMap(ids, "Participant") : {};
    setTasks(
      rows.map((r) => ({
        ...r,
        participantName: r.participant_id
          ? (display[r.participant_id]?.name ?? "Participant")
          : null,
        participantAvatar: r.participant_id ? (display[r.participant_id]?.avatar ?? null) : null,
      })),
    );
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void load().catch(() => setLoading(false));
  }, [load]);

  const add = useCallback(
    async (input: { title: string; due_on?: string | null; participantId?: string | null }) => {
      if (!user || !input.title.trim()) return;
      await supabase.from("coach_tasks").insert({
        coach_id: user.id,
        title: input.title.trim(),
        due_on: input.due_on ?? null,
        participant_id: input.participantId ?? null,
      });
      void load();
    },
    [user, load],
  );

  const toggle = useCallback(async (id: string, done: boolean) => {
    setTasks((t) => t.map((x) => (x.id === id ? { ...x, done } : x)));
    await supabase
      .from("coach_tasks")
      .update({ done, updated_at: new Date().toISOString() })
      .eq("id", id);
  }, []);

  const remove = useCallback(async (id: string) => {
    setTasks((t) => t.filter((x) => x.id !== id));
    await supabase.from("coach_tasks").delete().eq("id", id);
  }, []);

  return { tasks, loading, add, toggle, remove, reload: load };
}

/** Add a single task tied to a participant (used from the participant card). */
export async function addCoachTask(input: {
  coachId: string;
  participantId: string;
  title: string;
  due_on?: string | null;
}) {
  const { error } = await supabase.from("coach_tasks").insert({
    coach_id: input.coachId,
    participant_id: input.participantId,
    title: input.title.trim(),
    due_on: input.due_on ?? null,
  });
  if (error) throw error;
}

/** Send one participant a notification (server enforces staff + own-participant). */
export async function notifyParticipant(input: {
  userId: string;
  title: string;
  body?: string;
  link?: string;
}) {
  const { error } = await supabase.rpc("notify_participant", {
    _user_id: input.userId,
    _title: input.title,
    _body: input.body ?? "",
    _link: input.link,
  });
  if (error) throw error;
}
