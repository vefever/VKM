import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Video,
  Upload,
  Save,
  Eye,
  Trash2,
  Loader2,
  CheckCircle2,
  Youtube,
  Film,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/vkm/page-header";
import { SectionCard } from "@/components/vkm/section-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { VideoPlayer } from "@/components/vkm/video-player";
import { cn } from "@/lib/utils";
import { VKM_WEEKS } from "@/lib/vkm/program";
import {
  useWeekVideos,
  uploadClassVideo,
  saveWeekVideo,
  detectProvider,
  type WeekVideoRow,
} from "@/components/admin/class-videos-data";
import { useProgramOptions } from "@/lib/vkm/program-scope";
import { BatchProgramPicker } from "@/components/admin/batch-program-picker";

const PROVIDER_LABEL = { youtube: "YouTube", vimeo: "Vimeo", file: "File / Upload" } as const;

export function ClassVideosManager() {
  const { options, selected, setSelected, loading: optLoading } = useProgramOptions();
  const { rows, loading, reload } = useWeekVideos(selected);
  const byWeek = new Map(rows.map((r) => [r.week_no, r]));
  const setCount = rows.filter((r) => r.url).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-5"
    >
      <PageHeader
        eyebrow="Admin · LMS"
        title="Class Videos"
        description="Attach a recording to each week — paste a YouTube / Vimeo / .mp4 link or upload a file. Participants in the selected batch see it inside that week's task."
        icon={Video}
      />

      <BatchProgramPicker
        options={options}
        selected={selected}
        onSelect={setSelected}
        loading={optLoading}
        hint="Videos apply to this batch's participants only."
      />

      <SectionCard>
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{setCount}</span> of {VKM_WEEKS.length}{" "}
          weeks have a video set.
        </p>
      </SectionCard>

      <div className="space-y-2.5">
        {VKM_WEEKS.map((wk) => {
          const row = byWeek.get(wk.week);
          return (
            <div key={wk.week} className="rounded-xl border border-border bg-card p-3">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-secondary text-sm font-bold text-foreground">
                  {wk.week}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">{wk.topic}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {wk.phase} · {wk.mode}
                  </p>
                </div>
                <SetBadge has={!!row?.url} />
              </div>
              <WeekVideoField
                className="mt-3"
                programId={selected}
                weekNo={wk.week}
                topic={wk.topic}
                initial={row}
                loading={loading}
                onSaved={reload}
              />
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

function SetBadge({ has }: { has: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
        has
          ? "bg-[oklch(0.93_0.06_160)] text-[oklch(0.35_0.12_160)]"
          : "bg-secondary text-muted-foreground",
      )}
    >
      {has ? <CheckCircle2 className="h-3 w-3" /> : <Film className="h-3 w-3" />}
      {has ? "Set" : "None"}
    </span>
  );
}

/**
 * Reusable per-week class-video editor (paste link OR upload). Used by the LMS
 * Class Videos page and the Program Design page. The parent supplies the week
 * context (number/topic); this renders only the editable controls.
 */
export function WeekVideoField({
  programId,
  weekNo,
  topic,
  initial,
  loading,
  onSaved,
  className,
}: {
  programId: string | null;
  weekNo: number;
  topic: string;
  initial?: WeekVideoRow;
  loading: boolean;
  onSaved: () => void;
  className?: string;
}) {
  const [url, setUrl] = useState(initial?.url ?? "");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Sync the field when the async load (or a save/reload) changes the stored
  // value. This only fires on real DB changes, not while the admin is typing.
  const savedUrl = initial?.url ?? "";
  useEffect(() => setUrl(savedUrl), [savedUrl]);
  const trimmed = url.trim();
  const dirty = trimmed !== savedUrl;
  const provider = trimmed ? detectProvider(trimmed) : null;

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("video/")) {
      toast.error("Please choose a video file");
      return;
    }
    setUploading(true);
    try {
      const publicUrl = await uploadClassVideo(file);
      setUrl(publicUrl);
      toast.success("Uploaded", { description: "Click Save to attach it to this week." });
    } catch (err) {
      toast.error("Upload failed", { description: (err as Error).message });
    } finally {
      setUploading(false);
    }
  }

  async function save(clear = false) {
    if (!programId) {
      toast.error("Pick a batch first");
      return;
    }
    setSaving(true);
    try {
      const u = clear ? "" : trimmed;
      await saveWeekVideo(programId, weekNo, {
        url: u || null,
        provider: u ? detectProvider(u) : null,
        title: null,
      });
      if (clear) setUrl("");
      toast.success(`Week ${weekNo} ${u ? "saved" : "cleared"}`);
      onSaved();
    } catch (err) {
      toast.error("Could not save", { description: (err as Error).message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={className}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://youtube.com/… · vimeo.com/… · …/class.mp4 · or upload →"
          disabled={loading || saving || uploading}
          className="h-9 flex-1 rounded-lg text-sm"
        />
        {provider && (
          <span className="inline-flex shrink-0 items-center gap-1 self-start rounded-full bg-navy/10 px-2 py-1 text-[10px] font-medium text-navy sm:self-auto">
            {provider === "youtube" ? (
              <Youtube className="h-3 w-3" />
            ) : (
              <Film className="h-3 w-3" />
            )}
            {PROVIDER_LABEL[provider]}
          </span>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input ref={fileRef} type="file" accept="video/*" className="hidden" onChange={onPick} />
        <Button
          size="sm"
          variant="outline"
          className="h-8 rounded-lg"
          disabled={uploading || saving}
          onClick={() => fileRef.current?.click()}
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          Upload
        </Button>

        {trimmed && (
          <Dialog>
            <DialogTrigger asChild>
              <Button size="sm" variant="ghost" className="h-8 rounded-lg">
                <Eye className="h-4 w-4" /> Preview
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl p-0">
              <DialogHeader className="px-4 pt-4">
                <DialogTitle className="text-base">
                  Week {weekNo} — {topic}
                </DialogTitle>
              </DialogHeader>
              <div className="px-4 pb-4">
                <VideoPlayer url={trimmed} provider={provider ?? undefined} title={topic} />
              </div>
            </DialogContent>
          </Dialog>
        )}

        <div className="ml-auto flex items-center gap-2">
          {savedUrl && (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 rounded-lg text-destructive hover:text-destructive"
              disabled={saving}
              onClick={() => save(true)}
            >
              <Trash2 className="h-4 w-4" /> Clear
            </Button>
          )}
          <Button
            size="sm"
            className="h-8 rounded-lg bg-gradient-navy text-primary-foreground hover:opacity-90"
            disabled={!dirty || saving || uploading}
            onClick={() => save(false)}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}
