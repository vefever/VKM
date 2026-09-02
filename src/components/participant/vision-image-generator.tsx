import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  Image as ImageIcon,
  Download,
  Loader2,
  Maximize2,
  RefreshCw,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { downloadUrl } from "@/lib/download-file";
import { VisionImageLightbox } from "@/components/participant/vision-image-lightbox";
import { generateVisionImage } from "@/lib/vkm/vision-image.functions";
import { IMAGE_PURPOSES, type ImagePurpose } from "@/lib/vkm/image-purposes";
import type { VisionGoal, VisionStatement } from "@/components/participant/vision-data";

// Fallback starting points, used only when the owner hasn't written a vision or
// set any goals yet.
const GENERIC_IDEAS = [
  "My new showroom, full of happy customers",
  "My team celebrating hitting our yearly target",
  "The house I want for my family",
  "Me speaking on stage at a business event",
];

/**
 * Turn what's already on this page — their north stars, their lifestyle goal,
 * their actual goals — into one-tap prompts.
 *
 * An owner who has written "Open 3 outlets across Guntur" shouldn't have to
 * retype it to picture it; the whole point of generating here rather than in a
 * generic image tool is that the page already knows what they're chasing.
 */
function ideasFrom(statement: VisionStatement, goals: VisionGoal[]): string[] {
  const out: string[] = [];
  const add = (s: string | null | undefined) => {
    const t = s?.trim();
    // Long statements make poor image prompts and duplicates waste a chip.
    if (t && t.length <= 120 && !out.includes(t)) out.push(t);
  };

  add(statement.primary_goal);
  add(statement.statement_1yr);
  add(statement.lifestyle_goal);
  for (const g of goals) add(g.title);
  add(statement.statement);

  return out.length ? out.slice(0, 5) : GENERIC_IDEAS;
}

// Poster first — it is the headline output of this page.
const PURPOSE_ORDER: ImagePurpose[] = ["poster", "vision", "workspace", "social", "story"];

// Preview box shape per purpose, so what's on screen matches what gets made.
const PREVIEW_ASPECT: Record<ImagePurpose, string> = {
  poster: "aspect-[2/3] max-w-[220px]",
  vision: "aspect-square max-w-[240px]",
  workspace: "aspect-[3/2] max-w-[320px]",
  social: "aspect-square max-w-[240px]",
  story: "aspect-[2/3] max-w-[190px]",
};

/** Turn the server's data URL into a File so it takes the normal upload path. */
async function dataUrlToFile(dataUrl: string): Promise<File> {
  const blob = await (await fetch(dataUrl)).blob();
  return new File([blob], `vision-ai-${Date.now()}.png`, { type: blob.type || "image/png" });
}

/**
 * "Generate with AI" for the Vision Board. The generated image is previewed
 * first and only added when the owner keeps it — an image they didn't choose
 * shouldn't silently land on their board.
 *
 * Handing the result to the caller's `onUpload` means a generated image goes
 * through the identical storage path as a manual upload, so everything
 * downstream (storage bucket, statement record, removal) stays the same.
 */
export function VisionImageGenerator({
  statement,
  goals,
  onUpload,
  disabled,
}: {
  statement: VisionStatement;
  goals: VisionGoal[];
  onUpload: (f: File, opts?: { keepFullSize?: boolean }) => Promise<void>;
  disabled?: boolean;
}) {
  const generate = useServerFn(generateVisionImage);
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState("");
  const [remaining, setRemaining] = useState<number | null>(null);
  const [purpose, setPurpose] = useState<ImagePurpose>("poster");
  // Opt-in each time: putting your own face into a picture is a choice, not a
  // setting that quietly stays on.
  const [useFace, setUseFace] = useState(false);
  const [useLogo, setUseLogo] = useState(false);
  const [zoom, setZoom] = useState(false);

  const ideas = useMemo(() => ideasFrom(statement, goals), [statement, goals]);

  async function run() {
    const p = prompt.trim();
    if (!p || busy) return;
    setBusy(true);
    setPreview("");
    try {
      const r = await generate({ data: { prompt: p, purpose, useFace, useLogo } });
      if (typeof r.remaining === "number") setRemaining(r.remaining);
      if (!r.ok) {
        toast.error("Couldn't generate that image", { description: r.error });
        return;
      }
      setPreview(r.dataUrl);
    } catch (e) {
      toast.error("Couldn't generate that image", { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function keep() {
    if (!preview || saving) return;
    setSaving(true);
    try {
      // Posters are printed, so they must not be downscaled on upload.
      await onUpload(await dataUrlToFile(preview), { keepFullSize: purpose === "poster" });
      toast.success("Added to your vision board");
      setPreview("");
      setPrompt("");
      setOpen(false);
    } catch (e) {
      toast.error("Couldn't save the image", { description: (e as Error).message });
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className="rounded-full"
      >
        <Sparkles className="h-4 w-4 text-gold" /> Generate with AI
      </Button>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-border bg-secondary/25 p-3"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <Sparkles className="h-4 w-4 text-gold" /> Describe what you want to see
        </p>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setPreview("");
          }}
          aria-label="Close AI image generator"
          className="text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* What it's for — drives the art direction and the size for you. */}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {PURPOSE_ORDER.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => {
              setPurpose(p);
              setPreview("");
            }}
            title={IMAGE_PURPOSES[p].hint}
            className={cn(
              "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
              purpose === p
                ? "border-gold bg-gradient-gold text-navy"
                : "border-border bg-card text-muted-foreground hover:border-gold/50",
            )}
          >
            {IMAGE_PURPOSES[p].label}
          </button>
        ))}
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">
        {IMAGE_PURPOSES[purpose].hint} · {IMAGE_PURPOSES[purpose].size}
      </p>

      {/* Put yourself and your brand in the picture — off unless asked for. */}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {(
          [
            { on: useFace, set: setUseFace, Icon: UserRound, label: "Use my photo" },
            { on: useLogo, set: setUseLogo, Icon: ImageIcon, label: "Use my logo" },
          ] as const
        ).map(({ on, set, Icon, label }) => (
          <button
            key={label}
            type="button"
            aria-pressed={on}
            onClick={() => {
              set(!on);
              setPreview("");
            }}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
              on
                ? "border-navy bg-gradient-navy text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:border-gold/50",
            )}
          >
            <Icon className="h-3 w-3" />
            {label}
            {on && <Check className="h-3 w-3" />}
          </button>
        ))}
      </div>

      <div className="mt-2 flex gap-2">
        <Input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void run();
            }
          }}
          placeholder="e.g. My new showroom, full of happy customers"
          maxLength={500}
          className="h-10 flex-1 rounded-lg"
        />
        <Button
          type="button"
          onClick={() => void run()}
          disabled={busy || !prompt.trim()}
          className="h-10 shrink-0 rounded-lg bg-gradient-navy text-primary-foreground hover:opacity-90"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          <span className="hidden sm:inline">{busy ? "Creating…" : "Create"}</span>
        </Button>
      </div>

      {!preview && !busy && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {ideas.map((idea) => (
            <button
              key={idea}
              type="button"
              onClick={() => setPrompt(idea)}
              className="rounded-full border border-border bg-card px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:border-gold/50 hover:text-foreground"
            >
              {idea}
            </button>
          ))}
        </div>
      )}

      {busy && (
        <div
          className={cn(
            "mt-3 flex w-full items-center justify-center rounded-xl border border-dashed border-border bg-card",
            PREVIEW_ASPECT[purpose],
          )}
        >
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      <AnimatePresence>
        {preview && !busy && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3">
            {/* The preview is a small, cropped box — tap it to judge the whole
                image properly before deciding whether to keep it. */}
            <button
              type="button"
              onClick={() => setZoom(true)}
              aria-label="View generated image full size"
              className={cn(
                "group relative block w-full overflow-hidden rounded-xl border border-border",
                PREVIEW_ASPECT[purpose],
              )}
            >
              <img
                src={preview}
                alt="Generated vision board preview"
                className="h-full w-full object-cover"
              />
              <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/35 opacity-0 transition-opacity group-hover:opacity-100">
                <Maximize2 className="h-5 w-5 text-white" />
              </span>
            </button>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                onClick={() => void keep()}
                disabled={saving}
                className="rounded-full bg-gradient-navy text-primary-foreground hover:opacity-90"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                Add to board
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void run()}
                disabled={saving}
                className="rounded-full"
              >
                <RefreshCw className="h-4 w-4" /> Try again
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void downloadUrl(preview, `vision-${purpose}-${Date.now()}.png`)}
                disabled={saving}
                className="rounded-full"
              >
                <Download className="h-4 w-4" /> Download
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <p
        className={cn(
          "mt-2 text-[11px] text-muted-foreground",
          remaining !== null && remaining <= 2 && "font-medium text-foreground",
        )}
      >
        {remaining === null
          ? "AI images are a starting point — upload your own photos too."
          : `${remaining} AI image${remaining === 1 ? "" : "s"} left this month.`}
      </p>

      {/* Same viewer the board uses, so a not-yet-saved preview gets the full
          uncropped view too — that's what you judge it on before keeping it. */}
      <VisionImageLightbox
        images={preview ? [{ url: preview }] : []}
        index={zoom && preview ? 0 : null}
        onClose={() => setZoom(false)}
        onIndexChange={() => {}}
      />
    </motion.div>
  );
}
