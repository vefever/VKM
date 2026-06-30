import { useCallback, useEffect, useState } from "react";
import { isThisWeek, isToday, isYesterday } from "date-fns";
import {
  CheckCircle2,
  Trophy,
  ClipboardList,
  Megaphone,
  Video,
  FileDown,
  Coins,
  Bell,
  type LucideIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export type AppNotification = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  actor_id: string | null;
  read: boolean;
  created_at: string;
};

export function useNotifications(limit = 50) {
  const { user } = useAuth();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let active = true;

    supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(limit)
      .then(({ data }) => {
        if (!active) return;
        setItems((data ?? []) as AppNotification[]);
        setLoading(false);
      });

    const ch = supabase
      .channel(`notifications:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (p) => setItems((prev) => [p.new as AppNotification, ...prev]),
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (p) => {
          const n = p.new as AppNotification;
          setItems((prev) => prev.map((x) => (x.id === n.id ? n : x)));
        },
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (p) => {
          const o = p.old as { id: string };
          setItems((prev) => prev.filter((x) => x.id !== o.id));
        },
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(ch);
    };
  }, [user, limit]);

  const unread = items.filter((i) => !i.read).length;

  const markRead = useCallback(
    async (id: string) => {
      setItems((prev) => prev.map((x) => (x.id === id ? { ...x, read: true } : x)));
      if (user) await supabase.from("notifications").update({ read: true }).eq("id", id);
    },
    [user],
  );

  const markAllRead = useCallback(async () => {
    setItems((prev) => prev.map((x) => ({ ...x, read: true })));
    if (user)
      await supabase
        .from("notifications")
        .update({ read: true })
        .eq("user_id", user.id)
        .eq("read", false);
  }, [user]);

  return { items, unread, loading, markRead, markAllRead };
}

// ---- grouping ----
export type NotifGroup = { label: string; items: AppNotification[] };

export function groupNotifications(items: AppNotification[]): NotifGroup[] {
  const groups: NotifGroup[] = [
    { label: "Today", items: [] },
    { label: "Yesterday", items: [] },
    { label: "This week", items: [] },
    { label: "Earlier", items: [] },
  ];
  for (const n of items) {
    const d = new Date(n.created_at);
    if (isToday(d)) groups[0].items.push(n);
    else if (isYesterday(d)) groups[1].items.push(n);
    else if (isThisWeek(d, { weekStartsOn: 1 })) groups[2].items.push(n);
    else groups[3].items.push(n);
  }
  return groups.filter((g) => g.items.length > 0);
}

// ---- per-type icon + accent ----
const META: Record<string, { Icon: LucideIcon; color: string }> = {
  proof: { Icon: CheckCircle2, color: "#10b981" },
  points: { Icon: Coins, color: "#C8A84B" },
  milestone: { Icon: Trophy, color: "#C8A84B" },
  assignment: { Icon: ClipboardList, color: "#3b82f6" },
  content: { Icon: Video, color: "#8b5cf6" },
  lms: { Icon: Video, color: "#8b5cf6" },
  workbook: { Icon: FileDown, color: "#0ea5e9" },
  download: { Icon: FileDown, color: "#0ea5e9" },
  announcement: { Icon: Megaphone, color: "#f59e0b" },
};

export function notificationMeta(type: string) {
  return META[type] ?? { Icon: Bell, color: "#6B7280" };
}
