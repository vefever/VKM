import { useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  LayoutList,
  MapPin,
  Video as VideoIcon,
  FileText,
  Upload,
  Link as LinkIcon,
  Trash2,
  Loader2,
  Plus,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/vkm/page-header";
import { SectionCard } from "@/components/vkm/section-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { VKM_WEEKS, type Phase } from "@/lib/vkm/program";
import { useProgramOptions } from "@/lib/vkm/program-scope";
import { BatchProgramPicker } from "@/components/admin/batch-program-picker";
import { WeekVideoField } from "@/components/admin/class-videos-manager";
import {
  useWeekVideos,
  useWeekResources,
  uploadResourceFile,
  addWeekResource,
  deleteWeekResource,
  type WeekResource,
} from "@/components/admin/class-videos-data";

const PHASE_COLOR: Record<Phase, string> = {
  Foundation: "#3b82f6",
  Systems: "#8b5cf6",
  Sell: "#f59e0b",
  Review: "#10b981",
};

export function ProgramDesign() {
  const { options, selected, setSelected, loading: optLoading } = useProgramOptions();
  const { rows, loading, reload } = useWeekVideos(selected);
  const { byWeek: resByWeek, reload: reloadRes } = useWeekResources(selected);
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
        eyebrow="Admin"
        title="Program Design"
        description="Per week: the class video and any downloads / resources for a batch. Different batches can have different videos and files; participants see only their batch's content."
        icon={LayoutList}
      />

      <BatchProgramPicker
        options={options}
        selected={selected}
        onSelect={setSelected}
        loading={optLoading}
        hint="All videos & resources below apply to this batch."
      />

      <SectionCard>
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{setCount}</span> of {VKM_WEEKS.length}{" "}
          weeks have a class video set for this batch.
        </p>
      </SectionCard>

      <div className="space-y-3">
        {VKM_WEEKS.map((wk) => (
          <SectionCard key={wk.week}>
            {/* curriculum detail */}
            <div className="flex items-start gap-3">
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-secondary text-sm font-bold text-foreground">
                {wk.week}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-foreground">{wk.topic}</p>
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium text-white"
                    style={{ background: PHASE_COLOR[wk.phase] }}
                  >
                    {wk.phase}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                    {wk.mode === "Offline" ? <MapPin className="h-3 w-3" /> : <VideoIcon className="h-3 w-3" />}
                    {wk.mode}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">Task:</span> {wk.task}
                </p>
              </div>
            </div>

            {/* class video */}
            <div className="mt-3 border-t border-border pt-3">
              <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <VideoIcon className="h-3.5 w-3.5" /> Class video
                {byWeek.get(wk.week)?.url && (
                  <span className="rounded-full bg-[oklch(0.93_0.06_160)] px-1.5 py-0.5 text-[9px] font-bold text-[oklch(0.35_0.12_160)]">
                    SET
                  </span>
                )}
              </p>
              <WeekVideoField
                programId={selected}
                weekNo={wk.week}
                topic={wk.topic}
                initial={byWeek.get(wk.week)}
                loading={loading}
                onSaved={reload}
              />
            </div>

            {/* resources / downloads */}
            <div className="mt-3 border-t border-border pt-3">
              <ResourcesEditor
                programId={selected}
                weekNo={wk.week}
                resources={resByWeek.get(wk.week) ?? []}
                onChanged={reloadRes}
              />
            </div>
          </SectionCard>
        ))}
      </div>
    </motion.div>
  );
}

function ResourcesEditor({
  programId,
  weekNo,
  resources,
  onChanged,
}: {
  programId: string | null;
  weekNo: number;
  resources: WeekResource[];
  onChanged: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [linkTitle, setLinkTitle] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [showLink, setShowLink] = useState(false);

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (!programId) {
      toast.error("Pick a batch first");
      return;
    }
    setBusy(true);
    try {
      const { url, file_name, size } = await uploadResourceFile(file);
      await addWeekResource(programId, weekNo, { kind: "file", title: file.name, url, file_name, size });
      toast.success("Resource added");
      onChanged();
    } catch (e) {
      toast.error("Upload failed", { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function addLink() {
    if (!programId) {
      toast.error("Pick a batch first");
      return;
    }
    if (!linkTitle.trim() || !linkUrl.trim()) return;
    setBusy(true);
    try {
      await addWeekResource(programId, weekNo, {
        kind: "link",
        title: linkTitle.trim(),
        url: linkUrl.trim(),
      });
      setLinkTitle("");
      setLinkUrl("");
      setShowLink(false);
      toast.success("Link added");
      onChanged();
    } catch (e) {
      toast.error("Could not add link", { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    try {
      await deleteWeekResource(id);
      onChanged();
    } catch (e) {
      toast.error("Could not remove", { description: (e as Error).message });
    }
  }

  return (
    <div>
      <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        <FileText className="h-3.5 w-3.5" /> Downloads &amp; resources
        <span className="text-muted-foreground/60">({resources.length})</span>
      </p>

      {resources.length > 0 && (
        <div className="mb-2 space-y-1.5">
          {resources.map((r) => (
            <div key={r.id} className="flex items-center gap-2 rounded-lg border border-border bg-card p-2">
              <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-secondary text-navy">
                {r.kind === "link" ? <LinkIcon className="h-3.5 w-3.5" /> : <Download className="h-3.5 w-3.5" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-foreground">{r.title}</p>
                <p className="truncate text-[10px] text-muted-foreground">
                  {r.kind === "link" ? r.url : r.file_name}
                </p>
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 rounded-md text-destructive"
                onClick={() => remove(r.id)}
                title="Remove"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            void onFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <Button
          size="sm"
          variant="outline"
          className="h-8 rounded-lg"
          disabled={busy || !programId}
          onClick={() => fileRef.current?.click()}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Upload file
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-8 rounded-lg"
          disabled={busy || !programId}
          onClick={() => setShowLink((s) => !s)}
        >
          <LinkIcon className="h-4 w-4" /> Add link
        </Button>
      </div>

      {showLink && (
        <div className="mt-2 flex flex-col gap-2 rounded-lg border border-border bg-secondary/30 p-2 sm:flex-row">
          <Input
            value={linkTitle}
            onChange={(e) => setLinkTitle(e.target.value)}
            placeholder="Title (e.g. Slides)"
            className="h-8 rounded-lg text-sm sm:w-40"
          />
          <Input
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="https://…"
            className="h-8 flex-1 rounded-lg text-sm"
          />
          <Button
            size="sm"
            className="h-8 rounded-lg bg-gradient-navy text-primary-foreground"
            disabled={busy || !linkTitle.trim() || !linkUrl.trim()}
            onClick={addLink}
          >
            <Plus className="h-4 w-4" /> Add
          </Button>
        </div>
      )}
    </div>
  );
}
