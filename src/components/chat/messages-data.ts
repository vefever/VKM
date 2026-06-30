import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { profilesDisplayFor } from "@/lib/profiles-display";

// One row in the Messenger conversation list — either the coaching thread or a
// 1:1 member DM. Shaped for a Facebook/LinkedIn-style inbox (avatar, name,
// last-message preview, time), sorted most-recent first.
export type InboxItem = {
  key: string;
  kind: "coach" | "member";
  convId: string | null; // coach conversation id
  otherId: string | null; // member user id
  name: string;
  avatar: string | null;
  preview: string;
  lastAt: number; // epoch ms (0 = no messages yet)
};

async function profilesFor(ids: string[]) {
  const m = new Map<string, { name: string; avatar: string | null }>();
  const clean = [...new Set(ids.filter(Boolean))];
  if (!clean.length) return m;
  const resolved = await profilesDisplayFor(clean);
  resolved.forEach((p) => m.set(p.id, { name: p.name, avatar: p.avatar }));
  return m;
}

export function useInbox() {
  const { user } = useAuth();
  const [items, setItems] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;

    // --- Coaching thread (ensure it exists so it always shows) ---
    let { data: conv } = await supabase
      .from("conversations")
      .select("id")
      .eq("participant_id", user.id)
      .maybeSingle();
    if (!conv) {
      const ins = await supabase
        .from("conversations")
        .insert({ participant_id: user.id, title: "Coaching Support" })
        .select("id")
        .single();
      conv = ins.data;
    }
    let coachPreview = "";
    let coachLast = 0;
    if (conv?.id) {
      const { data: lm } = await supabase
        .from("messages")
        .select("body, attachments, created_at")
        .eq("conversation_id", conv.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (lm) {
        coachPreview = lm.body ?? "📎 Attachment";
        coachLast = new Date(lm.created_at).getTime();
      }
    }
    const coachItem: InboxItem = {
      key: "coach",
      kind: "coach",
      convId: conv?.id ?? null,
      otherId: null,
      name: "Coaching Team",
      avatar: null,
      preview: coachPreview || "Message your coaching team",
      lastAt: coachLast,
    };

    // --- Member DM threads ---
    const { data: threads } = await supabase
      .from("dm_threads")
      .select("id, user_lo, user_hi, last_message_at")
      .order("last_message_at", { ascending: false });
    const tlist = threads ?? [];
    const otherIds = tlist.map((t) => (t.user_lo === user.id ? t.user_hi : t.user_lo));
    const names = await profilesFor(otherIds);

    const previews = new Map<string, { body: string; at: number }>();
    const threadIds = tlist.map((t) => t.id);
    if (threadIds.length) {
      const { data: dms } = await supabase
        .from("dm_messages")
        .select("thread_id, body, created_at")
        .in("thread_id", threadIds)
        .order("created_at", { ascending: false });
      (dms ?? []).forEach((d) => {
        if (!previews.has(d.thread_id)) {
          previews.set(d.thread_id, {
            body: d.body ?? "📎 Attachment",
            at: new Date(d.created_at).getTime(),
          });
        }
      });
    }

    const memberItems: InboxItem[] = tlist.map((t) => {
      const other = t.user_lo === user.id ? t.user_hi : t.user_lo;
      const pv = previews.get(t.id);
      return {
        key: `m:${other}`,
        kind: "member",
        convId: null,
        otherId: other,
        name: names.get(other)?.name ?? "Member",
        avatar: names.get(other)?.avatar ?? null,
        preview: pv?.body ?? "Say hello 👋",
        lastAt: pv?.at ?? new Date(t.last_message_at).getTime(),
      };
    });

    // Coach pinned first; members by recency below.
    const sortedMembers = memberItems.sort((a, b) => b.lastAt - a.lastAt);
    setItems([coachItem, ...sortedMembers]);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  // Refresh previews/order on any new message in either system.
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`inbox:${user.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, () =>
        load(),
      )
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "dm_messages" }, () =>
        load(),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "dm_threads" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user, load]);

  return { items, loading, reload: load };
}
