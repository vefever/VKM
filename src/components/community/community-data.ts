import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import type { Attachment } from "@/components/chat/chat-data";
import { profilesDisplayFor } from "@/lib/profiles-display";
import { wirePresenceAndTyping, markThreadRead, fetchOtherLastRead } from "@/components/chat/presence-typing";

export type MemberStatus = "active" | "alumni";

export type Member = {
  id: string;
  name: string;
  avatar: string | null;
  headline: string | null;
  businessName: string | null;
  industry: string | null;
  location: string | null;
  website?: string | null;
  usp?: string | null;
  logoUrl?: string | null;
  email?: string | null;
  phone?: string | null;
  batchLabel: string | null;
  status: MemberStatus;
  skills: string[];
  allowMessages: boolean;
};

export type CommunityBusiness = {
  business_name: string | null;
  industry: string | null;
  location: string | null;
  website: string | null;
  usp: string | null;
  logo_url: string | null;
};

// Public business details pulled straight from members' business profiles
// (business_brains → My Business), keyed by user_id.
async function communityBusinessMap(): Promise<Map<string, CommunityBusiness>> {
  const m = new Map<string, CommunityBusiness>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase.rpc as any)("get_community_business");
  ((data ?? []) as (CommunityBusiness & { user_id: string })[]).forEach((r) =>
    m.set(r.user_id, r),
  );
  return m;
}

// Public contact details (email + phone) for members who opted their profile
// public, so peers can reach out.
async function communityContactMap(): Promise<Map<string, { email: string | null; phone: string | null }>> {
  const m = new Map<string, { email: string | null; phone: string | null }>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase.rpc as any)("get_community_contact");
  ((data ?? []) as { user_id: string; email: string | null; phone: string | null }[]).forEach((r) =>
    m.set(r.user_id, { email: r.email, phone: r.phone }),
  );
  return m;
}

export type MyMemberProfile = {
  headline: string | null;
  bio: string | null;
  business_name: string | null;
  industry: string | null;
  location: string | null;
  skills: string[];
  batch_label: string | null;
  status: MemberStatus;
  is_public: boolean;
  allow_messages: boolean;
};

export type DmThreadView = {
  id: string;
  otherId: string;
  otherName: string;
  otherAvatar: string | null;
  lastMessageAt: string;
};

export type DmMessage = {
  id: string;
  senderId: string | null;
  body: string | null;
  attachments: import("@/components/chat/chat-data").Attachment[];
  createdAt: string;
};

async function profilesFor(ids: string[]) {
  const m = new Map<string, { name: string; avatar: string | null }>();
  const resolved = await profilesDisplayFor(ids);
  resolved.forEach((p) => m.set(p.id, { name: p.name, avatar: p.avatar }));
  return m;
}

function pair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

// ---------------------------------------------------------------------------
// Directory — every member who has opted into a public profile.
// ---------------------------------------------------------------------------
export function useMemberDirectory() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: mps } = await supabase
        .from("member_profiles")
        .select(
          "user_id, headline, business_name, industry, location, skills, batch_label, status, allow_messages",
        )
        .eq("is_public", true);
      const ids = (mps ?? []).map((m) => m.user_id);
      const [names, biz] = await Promise.all([profilesFor(ids), communityBusinessMap()]);
      if (!active) return;
      const real: Member[] = (mps ?? []).map((m) => {
        // Business details come from the member's business profile (My Business)
        // first, falling back to anything they typed on their network profile.
        const b = biz.get(m.user_id);
        return {
          id: m.user_id,
          name: names.get(m.user_id)?.name ?? "Member",
          avatar: names.get(m.user_id)?.avatar ?? null,
          headline: m.headline,
          businessName: b?.business_name || m.business_name,
          industry: b?.industry || m.industry,
          location: b?.location || m.location,
          website: b?.website ?? null,
          usp: b?.usp ?? null,
          logoUrl: b?.logo_url ?? null,
          batchLabel: m.batch_label,
          status: m.status as MemberStatus,
          skills: m.skills ?? [],
          allowMessages: m.allow_messages,
        };
      });
      setMembers(real);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  return { members, loading };
}

// ---------------------------------------------------------------------------
// My own network profile (member-controlled).
// ---------------------------------------------------------------------------
export function useMyMemberProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<MyMemberProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    if (!user) return;
    setLoading(true);
    void supabase
      .from("member_profiles")
      .select(
        "headline, bio, business_name, industry, location, skills, batch_label, status, is_public, allow_messages",
      )
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        setProfile(
          data ? { ...data, skills: data.skills ?? [], status: data.status as MemberStatus } : null,
        );
        setLoading(false);
      });
  }, [user]);

  useEffect(load, [load]);

  const save = useCallback(
    async (patch: Partial<MyMemberProfile>) => {
      if (!user) return;
      await supabase
        .from("member_profiles")
        .upsert(
          { user_id: user.id, ...patch, updated_at: new Date().toISOString() },
          { onConflict: "user_id" },
        );
      load();
    },
    [user, load],
  );

  // Prefill suggestions from the owner's own (private) business brain.
  const prefillFromBrain = useCallback(async () => {
    if (!user) return null;
    const { data } = await supabase
      .from("business_brains")
      .select("business_name, industry, location")
      .eq("user_id", user.id)
      .maybeSingle();
    return data;
  }, [user]);

  return { profile, loading, save, prefillFromBrain, reload: load };
}

// ---------------------------------------------------------------------------
// A single member's public profile.
// ---------------------------------------------------------------------------
export function useMemberProfile(userId: string) {
  const [member, setMember] = useState<Member | null>(null);
  const [bio, setBio] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const [{ data: m }, names, biz, contacts] = await Promise.all([
        supabase.from("member_profiles").select("*").eq("user_id", userId).maybeSingle(),
        profilesFor([userId]),
        communityBusinessMap(),
        communityContactMap(),
      ]);
      if (!active) return;
      const base = names.get(userId);
      const b = biz.get(userId);
      const c = contacts.get(userId);
      setMember({
        id: userId,
        name: base?.name ?? "Member",
        avatar: base?.avatar ?? null,
        headline: m?.headline ?? null,
        businessName: b?.business_name || m?.business_name || null,
        industry: b?.industry || m?.industry || null,
        location: b?.location || m?.location || null,
        website: b?.website ?? null,
        usp: b?.usp ?? null,
        logoUrl: b?.logo_url ?? null,
        email: c?.email ?? null,
        phone: c?.phone ?? null,
        batchLabel: m?.batch_label ?? null,
        status: (m?.status as MemberStatus) ?? "active",
        skills: m?.skills ?? [],
        allowMessages: m?.allow_messages ?? false,
      });
      setBio(m?.bio ?? null);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [userId]);

  return { member, bio, loading };
}

// ---------------------------------------------------------------------------
// DM inbox — my conversations.
// ---------------------------------------------------------------------------
export function useDmThreads() {
  const { user } = useAuth();
  const [threads, setThreads] = useState<DmThreadView[]>([]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    const load = async () => {
      const { data } = await supabase
        .from("dm_threads")
        .select("id, user_lo, user_hi, last_message_at")
        .order("last_message_at", { ascending: false });
      const others = (data ?? []).map((t) => (t.user_lo === user.id ? t.user_hi : t.user_lo));
      const names = await profilesFor(others);
      if (!active) return;
      setThreads(
        (data ?? []).map((t) => {
          const other = t.user_lo === user.id ? t.user_hi : t.user_lo;
          return {
            id: t.id,
            otherId: other,
            otherName: names.get(other)?.name ?? "Member",
            otherAvatar: names.get(other)?.avatar ?? null,
            lastMessageAt: t.last_message_at,
          };
        }),
      );
    };
    load();
    const ch = supabase
      .channel(`dm_threads:${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "dm_threads" }, () => load())
      .subscribe();
    return () => {
      active = false;
      supabase.removeChannel(ch);
    };
  }, [user]);

  return threads;
}

// ---------------------------------------------------------------------------
// A live 1:1 thread with another member (creates it on demand).
// ---------------------------------------------------------------------------
export function useDmThread(otherUserId: string | null) {
  const { user } = useAuth();
  const [threadId, setThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<DmMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [typingOther, setTypingOther] = useState(false);
  const [otherOnline, setOtherOnline] = useState(false);
  const [otherLastReadAt, setOtherLastReadAt] = useState<Date | null>(null);
  const sendTypingRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (!user || !otherUserId) return;
    let active = true;
    setThreadId(null);
    (async () => {
      const [lo, hi] = pair(user.id, otherUserId);
      const { data } = await supabase
        .from("dm_threads")
        .upsert({ user_lo: lo, user_hi: hi }, { onConflict: "user_lo,user_hi" })
        .select("id")
        .single();
      if (active && data) setThreadId(data.id);
    })();
    return () => {
      active = false;
    };
  }, [user, otherUserId]);

  useEffect(() => {
    if (!threadId) return;
    let active = true;
    setLoading(true);
    setTypingOther(false);
    setOtherOnline(false);
    void supabase
      .from("dm_messages")
      .select("id, sender_id, body, attachments, created_at")
      .eq("thread_id", threadId)
      .order("created_at")
      .then(({ data }) => {
        if (!active) return;
        setMessages(
          (data ?? []).map((r) => ({
            id: r.id,
            senderId: r.sender_id,
            body: r.body,
            attachments: (r.attachments as DmMessage["attachments"] | null) ?? [],
            createdAt: r.created_at,
          })),
        );
        setLoading(false);
        if (user) void markThreadRead("dm", threadId, user.id);
      });

    void fetchOtherLastRead("dm", threadId, user?.id ?? "").then((d) => active && setOtherLastReadAt(d));

    const ch = supabase.channel(`dm:${threadId}`).on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "dm_messages",
        filter: `thread_id=eq.${threadId}`,
      },
      (p) => {
        const r = p.new as {
          id: string;
          sender_id: string | null;
          body: string | null;
          attachments: DmMessage["attachments"] | null;
          created_at: string;
        };
        setMessages((m) =>
          m.some((x) => x.id === r.id)
            ? m
            : [
                ...m,
                {
                  id: r.id,
                  senderId: r.sender_id,
                  body: r.body,
                  attachments: r.attachments ?? [],
                  createdAt: r.created_at,
                },
              ],
        );
        if (user) void markThreadRead("dm", threadId, user.id);
      },
    );
    ch.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "chat_read_state", filter: `thread_id=eq.${threadId}` },
      () => void fetchOtherLastRead("dm", threadId, user?.id ?? "").then((d) => active && setOtherLastReadAt(d)),
    );

    const presence = user
      ? wirePresenceAndTyping(ch, user.id, setTypingOther, setOtherOnline)
      : null;
    sendTypingRef.current = presence?.sendTyping ?? (() => {});

    ch.subscribe((status) => presence?.onSubscribed(status));

    return () => {
      active = false;
      presence?.cleanup();
      supabase.removeChannel(ch);
    };
  }, [threadId, user]);

  const send = useCallback(
    async (body: string, attachments: Attachment[] = []) => {
      if (!user || !threadId || (!body.trim() && !attachments.length)) return;
      await supabase.from("dm_messages").insert({
        thread_id: threadId,
        sender_id: user.id,
        body: body.trim() || null,
        attachments,
      });
    },
    [user, threadId],
  );

  const sendTyping = useCallback(() => sendTypingRef.current(), []);

  return { messages, send, loading, threadId, typingOther, otherOnline, otherLastReadAt, sendTyping };
}
