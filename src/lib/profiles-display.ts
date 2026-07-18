import { supabase } from "@/integrations/supabase/client";

export type ProfileDisplay = { id: string; name: string; avatar: string | null };

/**
 * Resolve display names + avatars via the SECURITY DEFINER RPC (no phone / no
 * private enumeration).
 *
 * ALWAYS use this for anyone other than the signed-in user. A direct
 * `.from("profiles").select(...)` is blocked by the profiles_select_self_or_staff
 * policy and returns ZERO ROWS **without an error** for a participant, which
 * silently renders "Participant" with no photo. This RPC applies the proper
 * visibility rules (self, staff, batch peers, DM/meeting counterparts, public
 * directory) and returns the avatar too.
 */
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

/**
 * Same lookup, shaped as `{ [id]: { name, avatar } }` for call sites that index
 * by id. `fallback` names anyone the caller isn't allowed to resolve.
 */
export async function profileDisplayMap(
  ids: string[],
  fallback = "Member",
): Promise<Record<string, { name: string; avatar: string | null }>> {
  const m = await profilesDisplayFor(ids);
  const out: Record<string, { name: string; avatar: string | null }> = {};
  for (const id of new Set(ids.filter(Boolean))) {
    const hit = m.get(id);
    out[id] = { name: hit?.name ?? fallback, avatar: hit?.avatar ?? null };
  }
  return out;
}
