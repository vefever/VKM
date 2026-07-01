import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { profilesDisplayFor } from "@/lib/profiles-display";
import type { Attachment } from "@/components/chat/chat-data";

// ── Domain constants ─────────────────────────────────────────────────────────
export type TicketStatus = "open" | "in_progress" | "resolved" | "closed";
export type TicketPriority = "low" | "normal" | "high" | "urgent";
export type TicketCategory =
  | "technical"
  | "program"
  | "billing"
  | "coaching"
  | "account"
  | "general";

export const CATEGORIES: { value: TicketCategory; label: string }[] = [
  { value: "technical", label: "Technical / app issue" },
  { value: "program", label: "Program & curriculum" },
  { value: "coaching", label: "Coaching & sessions" },
  { value: "billing", label: "Billing & payments" },
  { value: "account", label: "Account & login" },
  { value: "general", label: "Something else" },
];

export const PRIORITIES: { value: TicketPriority; label: string; dot: string }[] = [
  { value: "low", label: "Low", dot: "#94a3b8" },
  { value: "normal", label: "Normal", dot: "#3b82f6" },
  { value: "high", label: "High", dot: "#f59e0b" },
  { value: "urgent", label: "Urgent", dot: "#ef4444" },
];

export const STATUSES: { value: TicketStatus; label: string; cls: string }[] = [
  { value: "open", label: "Open", cls: "bg-[#3b82f6]/15 text-[#2563eb]" },
  { value: "in_progress", label: "In progress", cls: "bg-[#f59e0b]/15 text-[#b45309]" },
  { value: "resolved", label: "Resolved", cls: "bg-[#10b981]/15 text-[#047857]" },
  { value: "closed", label: "Closed", cls: "bg-secondary text-muted-foreground" },
];

export const labelFor = <T extends string>(list: { value: T; label: string }[], v: T) =>
  list.find((x) => x.value === v)?.label ?? v;

// ── Types ────────────────────────────────────────────────────────────────────
export type SupportTicket = {
  id: string;
  user_id: string;
  subject: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  assigned_to: string | null;
  last_message_at: string;
  created_at: string;
  requesterName?: string;
  requesterAvatar?: string | null;
  assigneeName?: string | null;
};

export type SupportMessage = {
  id: string;
  ticket_id: string;
  sender_id: string;
  body: string | null;
  attachments: Attachment[];
  created_at: string;
  senderName?: string;
  senderAvatar?: string | null;
};

type NewTicket = {
  subject: string;
  category: TicketCategory;
  priority: TicketPriority;
  body: string;
  attachments?: Attachment[];
};

// ── Participant: my tickets ──────────────────────────────────────────────────
export function useMyTickets() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("support_tickets")
      .select("*")
      .eq("user_id", user.id)
      .order("last_message_at", { ascending: false });
    const rows = (data ?? []) as SupportTicket[];
    const assignees = [...new Set(rows.map((t) => t.assigned_to).filter(Boolean) as string[])];
    const map = await profilesDisplayFor(assignees);
    setTickets(
      rows.map((t) => ({ ...t, assigneeName: t.assigned_to ? map.get(t.assigned_to)?.name : null })),
    );
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void load();
    if (!user) return;
    const ch = supabase
      .channel(`support-mine:${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "support_tickets", filter: `user_id=eq.${user.id}` },
        () => void load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user, load]);

  const createTicket = useCallback(
    async ({ subject, category, priority, body, attachments }: NewTicket) => {
      if (!user) throw new Error("You're not signed in.");
      const { data, error } = await supabase
        .from("support_tickets")
        .insert({ user_id: user.id, subject, category, priority })
        .select("id")
        .single();
      if (error) throw error;
      const ticketId = (data as { id: string }).id;
      const { error: mErr } = await supabase.from("support_ticket_messages").insert({
        ticket_id: ticketId,
        sender_id: user.id,
        body: body.trim() || null,
        attachments: attachments ?? [],
      });
      if (mErr) throw mErr;
      await load();
      return ticketId;
    },
    [user, load],
  );

  const closeTicket = useCallback(
    async (id: string, status: TicketStatus) => {
      const { error } = await supabase
        .from("support_tickets")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      await load();
    },
    [load],
  );

  return { tickets, loading, createTicket, closeTicket, reload: load };
}

// ── Staff (mentor/admin): all tickets ────────────────────────────────────────
export function useStaffTickets() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("support_tickets")
      .select("*")
      .order("last_message_at", { ascending: false });
    const rows = (data ?? []) as SupportTicket[];
    const ids = [
      ...new Set(rows.flatMap((t) => [t.user_id, t.assigned_to]).filter(Boolean) as string[]),
    ];
    const map = await profilesDisplayFor(ids);
    setTickets(
      rows.map((t) => ({
        ...t,
        requesterName: map.get(t.user_id)?.name ?? "Participant",
        requesterAvatar: map.get(t.user_id)?.avatar ?? null,
        assigneeName: t.assigned_to ? (map.get(t.assigned_to)?.name ?? null) : null,
      })),
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
    const ch = supabase
      .channel("support-all")
      .on("postgres_changes", { event: "*", schema: "public", table: "support_tickets" }, () =>
        void load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [load]);

  const updateTicket = useCallback(
    async (id: string, patch: Partial<Pick<SupportTicket, "status" | "priority" | "assigned_to">>) => {
      const { error } = await supabase
        .from("support_tickets")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      await load();
    },
    [load],
  );

  return { tickets, loading, updateTicket, reload: load };
}

// ── Shared: one ticket's message thread ──────────────────────────────────────
export function useTicketThread(ticketId: string | null) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!ticketId) {
      setMessages([]);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("support_ticket_messages")
      .select("*")
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: true });
    const rows = (data ?? []) as SupportMessage[];
    const ids = [...new Set(rows.map((m) => m.sender_id))];
    const map = await profilesDisplayFor(ids);
    setMessages(
      rows.map((m) => ({
        ...m,
        attachments: (m.attachments ?? []) as Attachment[],
        senderName: map.get(m.sender_id)?.name ?? "Member",
        senderAvatar: map.get(m.sender_id)?.avatar ?? null,
      })),
    );
    setLoading(false);
  }, [ticketId]);

  useEffect(() => {
    void load();
    if (!ticketId) return;
    const ch = supabase
      .channel(`support-thread:${ticketId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "support_ticket_messages",
          filter: `ticket_id=eq.${ticketId}`,
        },
        () => void load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [ticketId, load]);

  const send = useCallback(
    async (body: string, attachments: Attachment[] = []) => {
      if (!user || !ticketId) return;
      if (!body.trim() && attachments.length === 0) return;
      const { error } = await supabase.from("support_ticket_messages").insert({
        ticket_id: ticketId,
        sender_id: user.id,
        body: body.trim() || null,
        attachments,
      });
      if (error) throw error;
      await load();
    },
    [user, ticketId, load],
  );

  return { messages, loading, send };
}
