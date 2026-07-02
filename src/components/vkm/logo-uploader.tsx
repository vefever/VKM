import { useRef, useState } from "react";
import { Building2, Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { uploadToStorage } from "@/lib/storage-upload";

const SIZE: Record<"md" | "lg" | "xl", string> = {
  md: "h-16 w-16",
  lg: "h-20 w-20",
  xl: "h-24 w-24",
};

// Square business-logo uploader (mirrors the profile-photo UX). It uploads the
// file and persists it straight to business_brains.logo_url, so uploading from
// either the Business profile settings OR the My Business page reflects in the
// other — they read the same source. `onChange` lets the caller sync local UI.
export function LogoUploader({
  logoUrl,
  businessName,
  userId,
  onChange,
  size = "lg",
  className,
}: {
  logoUrl: string | null;
  businessName?: string | null;
  userId?: string;
  onChange?: (url: string) => void;
  size?: "md" | "lg" | "xl";
  className?: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function onFile(file: File | undefined) {
    if (!file || !userId) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file (PNG, JPG, SVG…)");
      return;
    }
    setBusy(true);
    try {
      const safe = file.name.replace(/[^\w.-]+/g, "_");
      const url = await uploadToStorage("chat-attachments", `logo/${userId}/${Date.now()}-${safe}`, file);
      const { error } = await supabase
        .from("business_brains")
        .upsert({ user_id: userId, logo_url: url }, { onConflict: "user_id" });
      if (error) throw error;
      onChange?.(url);
      toast.success("Business logo updated");
    } catch (e) {
      toast.error("Logo upload failed", { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={cn("shrink-0", className)}>
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml,.heic,.heif"
        className="hidden"
        onChange={(e) => {
          void onFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        aria-label="Change business logo"
        disabled={busy}
        className={cn(
          "group relative inline-flex items-center justify-center overflow-hidden rounded-2xl border border-border bg-card ring-1 ring-border transition-transform hover:scale-[1.02]",
          SIZE[size],
        )}
      >
        {logoUrl ? (
          <img src={logoUrl} alt={businessName || "Business logo"} className="h-full w-full object-contain" />
        ) : (
          <Building2 className="h-1/2 w-1/2 text-muted-foreground/50" />
        )}
        <span className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 bg-black/45 opacity-0 transition-opacity group-hover:opacity-100">
          {busy ? (
            <Loader2 className="h-5 w-5 animate-spin text-white" />
          ) : (
            <>
              <Camera className="h-4 w-4 text-white" />
              <span className="text-[9px] font-medium text-white/90">Logo</span>
            </>
          )}
        </span>
      </button>
    </div>
  );
}
