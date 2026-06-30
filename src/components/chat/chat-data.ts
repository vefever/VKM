import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { profilesDisplayFor } from "@/lib/profiles-display";
import { uploadToStorage } from "@/lib/storage-upload";

// namesFor kept for message sender labels in thread view

export type Attachment = {
  kind: "image" | "video" | "file";
  url: string;
  name: string;
  size: number;
};

export type ChatMessage = {
  id: string;
  conversation_id: string;
  sender_id: string | null;
  body: string | null;
  attachments: Attachment[];
  created_at: string;
};

async function namesFor(ids: string[]): Promise<Record<string, string>> {
  const clean = [...new Set(ids.filter(Boolean))];
  if (clean.length === 0) return {};
  const resolved = await profilesDisplayFor(clean);
  const map: Record<string, string> = {};
  resolved.forEach((p) => {
    map[p.id] = p.name;
  });
  return map;
}

export function callUrl(room: string): string {
  return `https://meet.jit.si/${room}`;
}

export async function uploadAttachment(userId: string, file: File): Promise<Attachment> {
  const safe = file.name.replace(/[^\w.-]+/g, "_");
  const path = `${userId}/${Date.now()}-${safe}`;
  const url = await uploadToStorage("chat-attachments", path, file);
  const kind = file.type.startsWith("image/")
    ? "image"
    : file.type.startsWith("video/")
      ? "video"
      : "file";
  return { kind, url, name: file.name, size: file.size };
}

// ---------------------------------------------------------------------------
// Participant — ensure & resolve their support conversation.
// ---------------------------------------------------------------------------
export function useMyConversation() {
  const { user } = useAuth();
  const [convId, setConvId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let active = true;
    (async () => {
      let { data } = await supabase
        .from("conversations")
        .select("id")
        .eq("participant_id", user.id)
        .maybeSingle();
      if (!data) {
        const ins = await supabase
          .from("conversations")
          .insert({ participant_id: user.id, title: "Coaching Support" })
          .select("id")
          .single();
        data = ins.data;
      }
      if (active) {
        setConvId(data?.id ?? null);
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [user]);

  return { convId, loading };
}

// ---------------------------------------------------------------------------
// A single thread — messages + send + realtime.
// ---------------------------------------------------------------------------
export function useThread(convId: string | null) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const namesRef = useRef(names);
  namesRef.current = names;

  useEffect(() => {
    if (!convId) {
      setMessages([]);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);

    (async () => {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", convId)
        .order("created_at", { ascending: true });
      if (!active) return;
      const msgs = (data ?? []) as ChatMessage[];
      setMessages(msgs);
      setNames(await namesFor(msgs.map((m) => m.sender_id ?? "")));
      setLoading(false);
    })();

    const ch = supabase
      .channel(`thread:${convId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${convId}`,
        },
        async (p) => {
          const m = p.new as ChatMessage;
          setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
          if (m.sender_id && !namesRef.current[m.sender_id]) {
            const resolved = await profilesDisplayFor([m.sender_id]);
            const pr = resolved.get(m.sender_id);
            setNames((n) => ({ ...n, [m.sender_id as string]: pr?.name ?? "User" }));
          }
        },
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(ch);
    };
  }, [convId]);

  const send = useCallback(
    async (body: string, attachments: Attachment[]) => {
      if (!user || !convId) return;
      if (!body.trim() && attachments.length === 0) return;
      await supabase.from("messages").insert({
        conversation_id: convId,
        sender_id: user.id,
        body: body.trim() || null,
        attachments,
      });
    },
    [user, convId],
  );

  return { messages, names, loading, send, meId: user?.id ?? null };
}

// ---------------------------------------------------------------------------
// Staff inbox — all participant conversations with last message.
// ---------------------------------------------------------------------------
export type InboxItem = {
  id: string;
  participantId: string;
  name: string;
  avatar: string | null;
  lastAt: string;
  preview: string;
};

export function useChatInbox() {
  const [items, setItems] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data: convs } = await supabase
      .from("conversations")
      .select("id, participant_id, last_message_at")
      .order("last_message_at", { ascending: false });
    const rows = convs ?? [];
    if (rows.length === 0) {
      setItems([]);
      setLoading(false);
      return;
    }
    const ids = rows.map((r) => r.id);
    const participantIds = rows.map((r) => r.participant_id);
    const [display, { data: msgs }] = await Promise.all([
      profilesDisplayFor(participantIds),
      supabase
        .from("messages")
        .select("conversation_id, body, attachments, created_at")
        .in("conversation_id", ids)
        .order("created_at", { ascending: false }),
    ]);
    const preview: Record<string, string> = {};
    (msgs ?? []).forEach((m) => {
      if (preview[m.conversation_id]) return;
      const atts = (m.attachments as Attachment[]) ?? [];
      preview[m.conversation_id] = m.body || (atts.length ? `📎 ${atts.length} attachment(s)` : "");
    });
    setItems(
      rows.map((r) => {
        const p = display.get(r.participant_id);
        return {
          id: r.id,
          participantId: r.participant_id,
          name: p?.name ?? "Participant",
          avatar: p?.avatar ?? null,
          lastAt: r.last_message_at,
          preview: preview[r.id] ?? "No messages yet",
        };
      }),
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const ch = supabase
      .channel("chat_inbox")
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, () =>
        load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [load]);

  return { items, loading };
}
