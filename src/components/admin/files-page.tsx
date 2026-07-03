import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  FolderTree,
  Loader2,
  ChevronDown,
  FolderDown,
  FolderOpen,
  Layers3,
} from "lucide-react";
import { PageHeader } from "@/components/vkm/page-header";
import { SectionCard } from "@/components/vkm/section-card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useAnalyticsBatches } from "@/components/admin/analytics-data";
import {
  useBatchFileCounts,
  useParticipantFiles,
  fetchParticipantZipEntries,
  type ParticipantFileCounts,
} from "@/components/admin/files-data";
import { CountPill, FilesBrowser } from "@/components/coach/files-browser";
import { proxyFetchFile } from "@/lib/vkm/file-proxy.functions";

export function AdminFilesPage() {
  const { batches, loading: batchesLoading } = useAnalyticsBatches();
  const [batchId, setBatchId] = useState("");
  const { rows, loading: rowsLoading } = useBatchFileCounts(batchId || null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [zipping, setZipping] = useState(false);
  const [zipProgress, setZipProgress] = useState<{ done: number; total: number } | null>(null);
  const fetchFile = useServerFn(proxyFetchFile);

  const batch = batches.find((b) => b.batch_id === batchId);
  const batchTotals = rows.reduce(
    (acc, r) => ({
      weekly: acc.weekly + r.weekly_file_count,
      habit: acc.habit + r.habit_file_count,
      vision: acc.vision + r.vision_file_count,
      total: acc.total + r.total_file_count,
    }),
    { weekly: 0, habit: 0, vision: 0, total: 0 },
  );
  const participantsWithFiles = rows.filter((r) => r.total_file_count > 0).length;

  async function downloadBatchZip() {
    const withFiles = rows.filter((r) => r.total_file_count > 0);
    if (withFiles.length === 0) return;
    setZipping(true);
    setZipProgress({ done: 0, total: withFiles.length });
    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      let failedFiles = 0;

      for (let i = 0; i < withFiles.length; i++) {
        const p = withFiles[i];
        const entries = await fetchParticipantZipEntries(p.user_id, p.full_name || p.user_id);
        for (const entry of entries) {
          try {
            const res = await fetchFile({ data: { url: entry.file.url } });
            if (!(res instanceof Response) || !res.ok) throw new Error("fetch failed");
            const blob = await res.blob();
            zip.file(`${entry.folder}/${entry.file.name}`, blob);
          } catch {
            failedFiles++;
          }
        }
        setZipProgress({ done: i + 1, total: withFiles.length });
      }

      const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${(batch?.name || "batch").replace(/[^\w.-]+/g, "_")}-files.zip`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);

      if (failedFiles > 0) {
        toast.warning(`Downloaded zip — ${failedFiles} file(s) couldn't be fetched and were skipped`);
      } else {
        toast.success(`Downloaded zip for ${withFiles.length} participant(s)`);
      }
    } catch (e) {
      toast.error("Couldn't build the batch zip", { description: (e as Error).message });
    } finally {
      setZipping(false);
      setZipProgress(null);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-5"
    >
      <PageHeader
        eyebrow="Super Admin · VK"
        title="Files"
        description="Every file participants have uploaded — batch-wise, then participant-wise — with one-click download."
        icon={FolderTree}
      />

      <SectionCard>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[240px] flex-1 space-y-1.5">
            <Label>Batch</Label>
            <Select value={batchId} onValueChange={(v) => { setBatchId(v); setExpanded(null); }}>
              <SelectTrigger className="h-10 rounded-xl">
                <SelectValue placeholder={batchesLoading ? "Loading batches…" : "Choose a batch"} />
              </SelectTrigger>
              <SelectContent>
                {batches.map((b) => (
                  <SelectItem key={b.batch_id} value={b.batch_id}>
                    {b.name} · {b.status} · {b.participant_count} participant{b.participant_count === 1 ? "" : "s"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </SectionCard>

      {!batchId ? (
        <SectionCard>
          <p className="flex items-center gap-2 py-10 text-center text-sm text-muted-foreground">
            <Layers3 className="h-4 w-4" /> Choose a batch above to browse every participant's uploaded files.
          </p>
        </SectionCard>
      ) : rowsLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <SectionCard
            title={
              <span className="flex items-center gap-2">
                <FolderOpen className="h-4 w-4 text-navy" /> {batch?.name ?? "Batch"} — all files
              </span>
            }
            subtitle={`${participantsWithFiles} of ${rows.length} participant(s) have uploaded files`}
            action={
              <Button
                className="rounded-full bg-gradient-navy shadow-vkm"
                onClick={downloadBatchZip}
                disabled={zipping || batchTotals.total === 0}
              >
                {zipping ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderDown className="h-4 w-4" />}
                {zipping && zipProgress
                  ? `Zipping ${zipProgress.done}/${zipProgress.total} participant(s)…`
                  : "Download entire batch (.zip)"}
              </Button>
            }
          >
            <div className="flex flex-wrap gap-2 text-xs">
              <CountPill label="Total files" value={batchTotals.total} />
              <CountPill label="Weekly proofs" value={batchTotals.weekly} />
              <CountPill label="Habit proofs" value={batchTotals.habit} />
              <CountPill label="Vision board" value={batchTotals.vision} />
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              The zip nests one folder per participant, each mirroring their individual Files tab.
            </p>
          </SectionCard>

          <SectionCard title="Participants" subtitle="Click a participant to browse and download their files">
            {rows.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No participants in this batch.</p>
            ) : (
              <div className="space-y-1.5">
                {rows.map((r) => (
                  <ParticipantRow
                    key={r.user_id}
                    row={r}
                    isOpen={expanded === r.user_id}
                    onToggle={() => setExpanded(expanded === r.user_id ? null : r.user_id)}
                  />
                ))}
              </div>
            )}
          </SectionCard>
        </>
      )}
    </motion.div>
  );
}

function ParticipantRow({
  row,
  isOpen,
  onToggle,
}: {
  row: ParticipantFileCounts;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-secondary/40"
      >
        <img
          src={row.avatar_url || "/icon-512.png"}
          alt=""
          loading="lazy"
          decoding="async"
          className="h-8 w-8 shrink-0 rounded-full border border-border object-cover"
        />
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{row.full_name ?? "—"}</span>
        <span className="hidden shrink-0 gap-1.5 text-xs sm:flex">
          <CountPill label="Total" value={row.total_file_count} />
        </span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
      </button>
      {isOpen && <ParticipantDrilldown userId={row.user_id} name={row.full_name} />}
    </div>
  );
}

function ParticipantDrilldown({ userId, name }: { userId: string; name: string | null }) {
  const { groups, loading } = useParticipantFiles(userId);

  return (
    <div className="border-t border-border bg-secondary/10 p-3">
      {loading || !groups ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <FilesBrowser
          weekGroups={groups.weekGroups}
          dayGroups={groups.dayGroups}
          visionFiles={groups.visionFiles}
          zipFilename={`${(name || "participant").replace(/[^\w.-]+/g, "_")}-files.zip`}
        />
      )}
    </div>
  );
}
