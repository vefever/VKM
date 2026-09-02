import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Camera, Loader2, Trash2, UserRound } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { SectionCard } from "@/components/vkm/section-card";
import { Button } from "@/components/ui/button";
import {
  VenuAvatar,
  VENU_NAME,
  VENU_TITLE,
  VENU_AVATAR_QUERY_KEY,
  useVenuAvatarUrl,
} from "@/components/vkm/venu-avatar";
import { supabase } from "@/integrations/supabase/client";
import { uploadToStorage } from "@/lib/storage-upload";

/**
 * Sets the portrait shown wherever the Venu Kalyan Avatar speaks — the pinned
 * persona card on the AI Advisor, every assistant bubble, the typing indicator.
 *
 * Each save uploads under a fresh key rather than overwriting the last one, so
 * participants never get a stale portrait served from the CDN, and writes the
 * resulting URL to the program_settings singleton (admin-only update, readable
 * by every participant).
 */
export function VenuAvatarUploader() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const current = useVenuAvatarUrl();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function save(url: string | null) {
    const { error } = await supabase
      .from("program_settings")
      .update({ advisor_avatar_url: url })
      .eq("id", 1);
    if (error) throw error;
    // Refresh every avatar already mounted on screen.
    await qc.invalidateQueries({ queryKey: VENU_AVATAR_QUERY_KEY });
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (!user?.id) {
      toast.error("You need to be signed in to upload.");
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file (PNG, JPG, WebP…)");
      return;
    }
    setBusy(true);
    try {
      // The chat-attachments bucket requires the first path segment to be the
      // uploader's own uid (see the storage RLS policy), so the key is scoped to
      // this admin even though the portrait itself is shared platform-wide.
      const safe = file.name.replace(/[^\w.-]+/g, "_");
      const url = await uploadToStorage(
        "chat-attachments",
        `${user.id}/venu-avatar/${Date.now()}-${safe}`,
        file,
      );
      await save(url);
      toast.success("Venu's avatar updated", {
        description: "Participants will see the new portrait in their AI Advisor.",
      });
    } catch (e) {
      toast.error("Avatar upload failed", { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function clear() {
    setBusy(true);
    try {
      await save(null);
      toast.success("Avatar removed — showing the VK monogram.");
    } catch (e) {
      toast.error("Couldn't remove the avatar", { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <SectionCard
      title={
        <span className="flex items-center gap-2">
          <UserRound className="h-4 w-4 text-navy" /> Avatar portrait
        </span>
      }
      subtitle="The face participants see in the AI Advisor — on the pinned persona card and every reply. A square photo works best."
    >
      <div className="flex flex-wrap items-center gap-4">
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,.heic,.heif"
          className="hidden"
          onChange={(e) => {
            void onFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />

        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          aria-label="Change Venu's avatar"
          className="group relative rounded-full transition-transform hover:scale-[1.03] disabled:opacity-60"
        >
          <VenuAvatar className="h-20 w-20" ring />
          <span className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 rounded-full bg-black/45 opacity-0 transition-opacity group-hover:opacity-100">
            {busy ? (
              <Loader2 className="h-5 w-5 animate-spin text-white" />
            ) : (
              <>
                <Camera className="h-4 w-4 text-white" />
                <span className="text-[9px] font-medium text-white/90">Change</span>
              </>
            )}
          </span>
        </button>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-foreground">{VENU_NAME}</p>
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {VENU_TITLE} · AI Avatar
          </p>
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {current.startsWith("/")
              ? "No portrait uploaded — showing the VK monogram."
              : current}
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="rounded-full"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
          >
            <Camera className="h-4 w-4" /> Upload
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="rounded-full"
            onClick={() => void clear()}
            disabled={busy || current.startsWith("/")}
          >
            <Trash2 className="h-4 w-4" /> Remove
          </Button>
        </div>
      </div>
    </SectionCard>
  );
}
