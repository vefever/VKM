import { useQuery } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

// Static fallback if no portrait has been uploaded yet. Admins set the real one
// in Admin -> VK Knowledge Base; dropping a file at public/venu-kalyan.jpg also
// works. If neither exists, Radix's Avatar shows the "VK" monogram, so the
// avatar never renders as a broken image.
export const VENU_AVATAR_FALLBACK_SRC = "/venu-kalyan.jpg";

export const VENU_NAME = "Venu Kalyan";
export const VENU_TITLE = "Business Growth Strategist";
export const VENU_TAGLINE =
  "Right customers ni attract chesi, right solutions ivvadame real business.";

// Shared query key so the admin uploader can invalidate every avatar on screen
// the moment a new portrait is saved.
export const VENU_AVATAR_QUERY_KEY = ["venu-avatar-url"] as const;

/**
 * The portrait chosen by an admin, from the program_settings singleton. Cached
 * for the session — the image changes about as often as the branding does, and
 * every message bubble mounts one of these, so this must not refetch per row.
 */
export function useVenuAvatarUrl() {
  const { data } = useQuery({
    queryKey: VENU_AVATAR_QUERY_KEY,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("program_settings")
        .select("advisor_avatar_url")
        .eq("id", 1)
        .maybeSingle();
      return data?.advisor_avatar_url ?? null;
    },
  });
  return data ?? VENU_AVATAR_FALLBACK_SRC;
}

/**
 * Venu Kalyan's avatar — used everywhere he "speaks": the pinned persona card
 * at the top of the AI Advisor, every assistant message bubble, and the typing
 * indicator. Keeping it in one place means the owner sees the same face in
 * every surface, which is what makes it read as *Venu* rather than as a bot.
 */
export function VenuAvatar({
  className,
  ring = false,
  src,
}: {
  className?: string;
  /** Gold halo — used on the large pinned card, not on inline message bubbles. */
  ring?: boolean;
  /** Override the looked-up portrait (the admin uploader previews with this). */
  src?: string | null;
}) {
  const resolved = useVenuAvatarUrl();
  return (
    <Avatar
      className={cn(
        "h-8 w-8 shadow-vkm",
        ring && "ring-2 ring-gold/70 ring-offset-2 ring-offset-card",
        className,
      )}
    >
      <AvatarImage src={src ?? resolved} alt={VENU_NAME} className="object-cover" />
      <AvatarFallback className="bg-gradient-gold text-[0.7em] font-bold tracking-tight text-navy">
        VK
      </AvatarFallback>
    </Avatar>
  );
}
