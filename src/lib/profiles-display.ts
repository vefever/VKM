import { supabase } from "@/integrations/supabase/client";

export type ProfileDisplay = { id: string; name: string; avatar: string | null };

/** Resolve display names via the SECURITY DEFINER RPC (no phone / no private enumeration). */
export async function profilesDisplayFor(ids: string[]): Promise<Map<string, ProfileDisplay>> {
  const m = new Map<string, ProfileDisplay>();
  const clean = [...new Set(ids.filter(Boolean))];
  if (!clean.length) return m;

  const { data, error } = await supabase.rpc("get_profiles_display", { _ids: clean });
  if (error) return m;

  (data ?? []).forEach((p: { id: string; full_name: string | null; avatar_url: string | null }) => {
    m.set(p.id, { id: p.id, name: p.full_name ?? "Member", avatar: p.avatar_url });
  });
  return m;
}