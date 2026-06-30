import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
};

// ---------------------------------------------------------------------------
// Focus sessions (deep-work timer) — DB-backed, scoped to today.
// Same return shape as the old localStorage hook so the page is a drop-in swap.
// ---------------------------------------------------------------------------
export type FocusSession = { id: string; minutes: number; note?: string; timestamp: string };

export function useFocusSessions() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<FocusSession[]>([]);

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("focus_sessions")
      .select("id, minutes, note, created_at")
      .eq("user_id", user.id)
      .gte("created_at", `${todayStr()}T00:00:00`)
      .order("created_at");
    setSessions(
      (data ?? []).map((r) => ({
        id: r.id,
        minutes: r.minutes,
        note: r.note ?? undefined,
        timestamp: r.created_at,
      })),
    );
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const addSession = useCallback(
    async (minutes: number, note?: string) => {
      if (!user) return;
      // Optimistic, then persist.
      setSessions((s) => [
        ...s,
        { id: `tmp-${s.length}`, minutes, note, timestamp: new Date().toISOString() },
      ]);
      await supabase
        .from("focus_sessions")
        .insert({ user_id: user.id, minutes, note: note ?? null });
      void load();
    },
    [user, load],
  );

  return [{ date: todayStr(), count: sessions.length, sessions }, addSession] as const;
}

// ---------------------------------------------------------------------------
// Daily actions checklist — DB-backed, seeded once per day, persisted on change.
// ---------------------------------------------------------------------------
export type Action = { id: string; text: string; done: boolean };

// Read-only view of today's actions for summary surfaces (e.g. the dashboard).
// Does NOT seed — seeding is owned by useDailyActions on the Focus page so we
// never create duplicate rows.
export function useTodayActions() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Action[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    let active = true;
    void supabase
      .from("daily_actions")
      .select("id, text, done, sort_order")
      .eq("user_id", user.id)
      .eq("action_date", todayStr())
      .order("sort_order")
      .then(({ data }) => {
        if (!active) return;
        setTasks((data ?? []).map((r) => ({ id: r.id, text: r.text, done: r.done })));
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user]);

  return { tasks, loading };
}

export function useDailyActions(seed: () => string[]) {
  const { user } = useAuth();
  const [tasks, setTasksState] = useState<Action[]>([]);
  const [loading, setLoading] = useState(true);
  const dirty = useRef(false);
  const seedRef = useRef(seed);
  seedRef.current = seed;

  useEffect(() => {
    if (!user) return;
    let active = true;
    (async () => {
      const date = todayStr();
      const { data } = await supabase
        .from("daily_actions")
        .select("id, text, done, sort_order")
        .eq("user_id", user.id)
        .eq("action_date", date)
        .order("sort_order");
      if (!active) return;
      if (data && data.length > 0) {
        setTasksState(data.map((r) => ({ id: r.id, text: r.text, done: r.done })));
      } else {
        // Seed today's defaults once.
        const defaults = seedRef.current();
        const rows = defaults.map((text, i) => ({
          user_id: user.id,
          action_date: date,
          text,
          done: false,
          sort_order: i,
        }));
        const { data: inserted } = await supabase
          .from("daily_actions")
          .insert(rows)
          .select("id, text, done, sort_order");
        if (active)
          setTasksState((inserted ?? []).map((r) => ({ id: r.id, text: r.text, done: r.done })));
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [user]);

  // Persist the full ordered list (debounced) whenever it changes after load.
  useEffect(() => {
    if (loading || !dirty.current || !user) return;
    const snapshot = tasks;
    const date = todayStr();
    const h = setTimeout(() => {
      void (async () => {
        await supabase
          .from("daily_actions")
          .delete()
          .eq("user_id", user.id)
          .eq("action_date", date);
        if (snapshot.length)
          await supabase.from("daily_actions").insert(
            snapshot.map((t, i) => ({
              user_id: user.id,
              action_date: date,
              text: t.text,
              done: t.done,
              sort_order: i,
            })),
          );
      })();
    }, 500);
    return () => clearTimeout(h);
  }, [tasks, loading, user]);

  const setTasks = useCallback((updater: (t: Action[]) => Action[]) => {
    dirty.current = true;
    setTasksState(updater);
  }, []);

  return { tasks, setTasks, loading };
}
