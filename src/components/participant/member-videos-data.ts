import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export type MemberVideo = {
  id: string;
  user_id: string;
  week_no: number | null;
  title: string | null;
  video_url: string;
  provider: string | null;
  note: string | null;
  created_at: string;
};

// A member's own 1-on-1 session videos (RLS-scoped to the signed-in user).
export function useMyMemberVideos() {
  const { user } = useAuth();
  const [rows, setRows] = useState<MemberVideo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    const load = () => {
      void supabase
        .from("member_session_videos")
        .select("id, user_id, week_no, title, video_url, provider, note, created_at")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .order("week_no", { ascending: true, nullsFirst: true })
        .order("created_at", { ascending: true })
        .then(({ data }) => {
          if (alive) {
            setRows((data ?? []) as MemberVideo[]);
            setLoading(false);
          }
        });
    };
    load();
    const ch = supabase
      .channel(`my_session_videos:${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "member_session_videos", filter: `user_id=eq.${user.id}` },
        () => load(),
      )
      .subscribe();
    return () => {
      alive = false;
      void supabase.removeChannel(ch);
    };
  }, [user]);

  return { rows, loading };
}
