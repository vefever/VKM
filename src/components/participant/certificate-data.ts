import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export type MemberCertificate = {
  id: string;
  title: string | null;
  file_url: string;
  file_type: string | null;
  note: string | null;
  issued_at: string;
};

/**
 * The signed-in member's own issued certificates (RLS-scoped). Realtime, so a
 * certificate a coach uploads appears without a refresh.
 */
export function useMyCertificates() {
  const { user } = useAuth();
  const [rows, setRows] = useState<MemberCertificate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    const load = () => {
      void supabase
        .from("member_certificates")
        .select("id, title, file_url, file_type, note, issued_at")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .order("issued_at", { ascending: false })
        .then(({ data }) => {
          if (alive) {
            setRows((data ?? []) as MemberCertificate[]);
            setLoading(false);
          }
        });
    };
    load();
    const ch = supabase
      .channel(`my_certificates:${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "member_certificates", filter: `user_id=eq.${user.id}` },
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
