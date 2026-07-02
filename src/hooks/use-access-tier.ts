import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { PAST_BATCH_STATUSES, type AccessTier } from "@/lib/vkm/access";

// Resolve the current participant's access tier:
//   alumni flag        → "alumni"
//   only past batches  → "community"
//   otherwise          → "full"
// Staff (non-participant-only) are always "full". Defaults to "full" until
// resolved so we never briefly hide the nav for a full-access user.
export function useAccessTier(): { tier: AccessTier; loading: boolean } {
  const { user, roles, primaryRole } = useAuth();
  const [tier, setTier] = useState<AccessTier>("full");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    // Only participants are gated. Anyone with a staff role gets full access.
    const staff = roles.some((r) => r === "coach" || r === "mentor" || r === "super_admin");
    if (staff || primaryRole !== "participant") {
      setTier("full");
      setLoading(false);
      return;
    }
    let alive = true;
    (async () => {
      const [{ data: prof }, { data: bm }] = await Promise.all([
        supabase.from("profiles").select("is_alumni").eq("id", user.id).maybeSingle(),
        supabase
          .from("batch_members")
          .select("batches(status)")
          .eq("user_id", user.id)
          .eq("role", "participant"),
      ]);
      if (!alive) return;

      if ((prof as { is_alumni?: boolean } | null)?.is_alumni) {
        setTier("alumni");
        setLoading(false);
        return;
      }
      const statuses = (bm ?? [])
        .map((r) => (r as unknown as { batches: { status: string } | null }).batches?.status)
        .filter(Boolean) as string[];
      const hasActive = statuses.some((s) => !PAST_BATCH_STATUSES.has(s));
      // Has batches, but every one is a past cohort → community-only.
      setTier(statuses.length > 0 && !hasActive ? "community" : "full");
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [user, roles, primaryRole]);

  return { tier, loading };
}
