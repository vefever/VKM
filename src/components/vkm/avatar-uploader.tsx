import { useCallback, useEffect, useRef, useState, type DragEvent } from "react";
import { Camera, ImagePlus, Loader2, Move, Upload, ZoomIn } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalFooter,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from "@/components/ui/responsive-modal";
import { Slider } from "@/components/ui/slider";
import {
  CROP_VIEWPORT,
  cropToCircularBlob,
  drawCropPreview,
  initialTransform,
  loadImage,
  validateAvatarFile,
  type CropTransform,
} from "@/lib/avatar-crop";
import { uploadAvatar } from "@/lib/avatar-upload";
import { useAuth } from "@/hooks/use-auth";

export type AvatarUploaderSize = "md" | "lg" | "xl";

const TRIGGER_SIZE: Record<AvatarUploaderSize, string> = {
  md: "h-16 w-16 text-lg",
  lg: "h-24 w-24 text-2xl",
  xl: "h-32 w-32 text-3xl",
};

function initialsOf(name: string) {
  return (name || "?")
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function AvatarUploader({
  avatarUrl,
  name,
  userId,
  onChange,
  size = "lg",
  className,
}: {
  avatarUrl: string | null;
  name: string;
  userId?: string;
  onChange?: (url: string) => void;
  size?: AvatarUploaderSize;
  className?: string;
}) {
  const { refreshProfile } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [cropOpen, setCropOpen] = useState(false);
  const [source, setSource] = useState<HTMLImageElement | null>(null);
  const [transform, setTransform] = useState<CropTransform>(initialTransform({} as HTMLImageElement));
  const [panning, setPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0, ox: 0, oy: 0 });
  const previewRef = useRef<HTMLCanvasElement>(null);

  const redraw = useCallback(() => {
    const canvas = previewRef.current;
    if (!canvas || !source) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    drawCropPreview(ctx, source, transform, CROP_VIEWPORT);
  }, [source, transform]);

  useEffect(() => {
    if (cropOpen && source) redraw();
  }, [cropOpen, source, transform, redraw]);

  async function openFile(file: File | undefined) {
    if (!file || !userId) return;
    const err = validateAvatarFile(file);
    if (err) {
      toast.error(err);
      return;
    }
    try {
      const img = await loadImage(file);
      setSource(img);
      setTransform(initialTransform(img));
      setCropOpen(true);
    } catch (e) {
      toast.error("Could not open image", { description: (e as Error).message });
    }
  }

  function onFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    void openFile(e.target.files?.[0]);
    e.target.value = "";
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragOver(false);
    void openFile(e.dataTransfer.files?.[0]);
  }

  async function saveCrop() {
    if (!source || !userId) return;
    setBusy(true);
    try {
      const blob = await cropToCircularBlob(source, transform);
      const url = await uploadAvatar(userId, blob);
      onChange?.(url);
      await refreshProfile();
      setCropOpen(false);
      setSource(null);
      toast.success("Profile photo updated");
    } catch (e) {
      toast.error("Upload failed", { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  function onPointerDown(e: React.PointerEvent) {
    if (!source) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setPanning(true);
    panStart.current = { x: e.clientX, y: e.clientY, ox: transform.offsetX, oy: transform.offsetY };
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!panning) return;
    setTransform((t) => ({
      ...t,
      offsetX: panStart.current.ox + (e.clientX - panStart.current.x),
      offsetY: panStart.current.oy + (e.clientY - panStart.current.y),
    }));
  }

  function onPointerUp() {
    setPanning(false);
  }

  const initials = initialsOf(name);

  return (
    <>
      <div
        className={cn("relative shrink-0", className)}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
      >
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={onFileInput}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          aria-label="Change profile photo"
          className={cn(
            "group relative inline-flex items-center justify-center overflow-hidden rounded-full bg-gradient-gold font-bold text-navy ring-2 ring-gold/40 transition-transform hover:scale-[1.02]",
            TRIGGER_SIZE[size],
            dragOver && "ring-4 ring-gold scale-[1.02]",
          )}
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt={name} className="h-full w-full object-cover" />
          ) : (
            initials
          )}
          <span className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 bg-black/45 opacity-0 transition-opacity group-hover:opacity-100">
            {busy ? (
              <Loader2 className="h-5 w-5 animate-spin text-white" />
            ) : (
              <>
                <Camera className="h-5 w-5 text-white" />
                <span className="text-[9px] font-medium text-white/90">Change</span>
              </>
            )}
          </span>
        </button>
        {dragOver && (
          <span className="pointer-events-none absolute -inset-2 flex items-center justify-center rounded-full border-2 border-dashed border-gold bg-gold/10 text-[10px] font-semibold text-gold">
            Drop photo
          </span>
        )}
      </div>

      <ResponsiveModal
        open={cropOpen}
        onOpenChange={(o) => {
          if (!o && !busy) {
            setCropOpen(false);
            setSource(null);
          }
        }}
      >
        <ResponsiveModalContent className="max-w-sm rounded-2xl sm:max-w-md">
          <ResponsiveModalHeader>
            <ResponsiveModalTitle>Crop profile photo</ResponsiveModalTitle>
            <ResponsiveModalDescription>
              Drag to reposition, use the slider to zoom. Your photo is saved as a circle.
            </ResponsiveModalDescription>
          </ResponsiveModalHeader>

          <div className="space-y-4">
            <div
              className={cn(
                "relative mx-auto touch-none select-none",
                panning && "cursor-grabbing",
                !panning && "cursor-grab",
              )}
              style={{ width: CROP_VIEWPORT, height: CROP_VIEWPORT }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            >
              <canvas
                ref={previewRef}
                width={CROP_VIEWPORT}
                height={CROP_VIEWPORT}
                className="rounded-full shadow-vkm"
              />
              <span className="pointer-events-none absolute inset-0 rounded-full ring-2 ring-gold/50 ring-offset-2 ring-offset-background" />
            </div>

            <div className="flex items-center gap-3 px-1">
              <ZoomIn className="h-4 w-4 shrink-0 text-muted-foreground" />
              <Slider
                min={1}
                max={3}
                step={0.02}
                value={[transform.scale]}
                onValueChange={([v]) => setTransform((t) => ({ ...t, scale: v }))}
                aria-label="Zoom"
              />
            </div>

            <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
              <Move className="h-3.5 w-3.5" /> Drag image to adjust framing
            </p>

            <div
              className="rounded-xl border border-dashed border-border bg-secondary/30 p-4 text-center"
              onDragOver={(e) => e.preventDefault()}
              onDrop={onDrop}
            >
              <Upload className="mx-auto h-5 w-5 text-muted-foreground" />
              <p className="mt-1 text-xs text-muted-foreground">
                Or drop a different image here · JPG, PNG, WebP · max 8 MB
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2 rounded-full"
                onClick={() => fileRef.current?.click()}
              >
                <ImagePlus className="h-3.5 w-3.5" /> Choose file
              </Button>
            </div>
          </div>

          <ResponsiveModalFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              disabled={busy}
              onClick={() => {
                setCropOpen(false);
                setSource(null);
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="rounded-xl bg-gradient-navy text-primary-foreground"
              disabled={busy || !source}
              onClick={() => void saveCrop()}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save photo
            </Button>
          </ResponsiveModalFooter>
        </ResponsiveModalContent>
      </ResponsiveModal>
    </>
  );
}