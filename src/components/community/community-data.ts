import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import type { Attachment } from "@/components/chat/chat-data";
import { MOCK_MEMBERS, MOCK_BY_ID } from "@/components/community/mock-members";
import { profilesDisplayFor } from "@/lib/profiles-display";

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
  batchLabel: string | null;
  status: MemberStatus;
  skills: string[];
  allowMessages: boolean;
  mock?: boolean;
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
      // Append sample members so the directory looks alive (demo data).
      setMembers([...real, ...MOCK_MEMBERS]);
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
    // Sample member → serve from mock data, skip the DB.
    const mock = MOCK_BY_ID.get(userId);
    if (mock) {
      setMember(mock);
      setBio(mock.bio);
      setLoading(false);
      return;
    }
    (async () => {
      const [{ data: m }, names, biz] = await Promise.all([
        supabase.from("member_profiles").select("*").eq("user_id", userId).maybeSingle(),
        profilesFor([userId]),
        communityBusinessMap(),
      ]);
      if (!active) return;
      const base = names.get(userId);
      const b = biz.get(userId);
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
      });

    const ch = supabase
      .channel(`dm:${threadId}`)
      .on(
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
        },
      )
      .subscribe();
    return () => {
      active = false;
      supabase.removeChannel(ch);
    };
  }, [threadId]);

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

  return { messages, send, loading, threadId };
}
