import type { RealtimeChannel } from "@supabase/supabase-js";

// Wires typing + online-presence onto an ALREADY-CREATED channel (before
// .subscribe()) so a thread never needs a second realtime channel just for
// these — they ride the same channel each hook already opens for
// postgres_changes on new messages.
export function wirePresenceAndTyping(
  channel: RealtimeChannel,
  meId: string,
  onTypingOtherChange: (v: boolean) => void,
  onOnlineOtherChange: (v: boolean) => void,
) {
  let typingTimeout: ReturnType<typeof setTimeout> | undefined;
  let lastSent = 0;

  const recomputeOnline = () => {
    const state = channel.presenceState<{ user_id: string }>();
    const online = Object.values(state)
      .flat()
      .some((p) => p.user_id !== meId);
    onOnlineOtherChange(online);
  };

  channel
    .on("broadcast", { event: "typing" }, ({ payload }) => {
      const from = (payload as { user_id?: string })?.user_id;
      if (!from || from === meId) return;
      onTypingOtherChange(true);
      if (typingTimeout) clearTimeout(typingTimeout);
      typingTimeout = setTimeout(() => onTypingOtherChange(false), 3000);
    })
    .on("presence", { event: "sync" }, recomputeOnline)
    .on("presence", { event: "join" }, recomputeOnline)
    .on("presence", { event: "leave" }, recomputeOnline);

  return {
    // Call from the channel's .subscribe((status) => ...) callback so we only
    // track presence once the channel is actually connected.
    onSubscribed: (status: string) => {
      if (status === "SUBSCRIBED") void channel.track({ user_id: meId });
    },
    sendTyping: () => {
      const now = Date.now();
      if (now - lastSent < 1500) return; // throttle — don't flood the channel
      lastSent = now;
      void channel.send({ type: "broadcast", event: "typing", payload: { user_id: meId } });
    },
    cleanup: () => {
      if (typingTimeout) clearTimeout(typingTimeout);
    },
  };
}

// ---------------------------------------------------------------------------
// Read state (chat_read_state) — shared by the coach thread and member DMs.
// ---------------------------------------------------------------------------
import { supabase } from "@/integrations/supabase/client";

export type ThreadKind = "coach" | "dm";

export async function markThreadRead(kind: ThreadKind, threadId: string, userId: string) {
  await supabase
    .from("chat_read_state")
    .upsert(
      { thread_kind: kind, thread_id: threadId, user_id: userId, last_read_at: new Date().toISOString() },
      { onConflict: "thread_kind,thread_id,user_id" },
    );
}

// The furthest any OTHER participant of this thread has read up to (max across
// all rows that aren't mine) — used to render "seen" on my own messages.
export async function fetchOtherLastRead(
  kind: ThreadKind,
  threadId: string,
  meId: string,
): Promise<Date | null> {
  const { data } = await supabase
    .from("chat_read_state")
    .select("last_read_at")
    .eq("thread_kind", kind)
    .eq("thread_id", threadId)
    .neq("user_id", meId)
    .order("last_read_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.last_read_at ? new Date(data.last_read_at) : null;
}
