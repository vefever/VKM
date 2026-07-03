import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Loader2,
  FolderOpen,
  CalendarClock,
  Activity,
  ImagePlus,
  FolderDown,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { SectionCard } from "@/components/vkm/section-card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ProofAttachments } from "@/components/participant/proof-attachments";
import { type Attachment } from "@/components/chat/chat-data";
import { type WeekRow } from "@/components/coach/coach-data";
import { useParticipantHabits, HABITS } from "@/components/habits/habit-tracker";
import { useVisionFor } from "@/components/participant/vision-data";
import { proxyFetchFile } from "@/lib/vkm/file-proxy.functions";

type ZipEntry = { folder: string; file: Attachment };

// Every file a participant has ever uploaded, aggregated from the three
// sources that hold Attachment[] arrays — reuses ProofAttachments as-is (it
// already handles lightbox preview + real one-click download).
export function ParticipantFilesTab({
  userId,
  weeks,
  habits,
}: {
  userId: string;
  weeks: WeekRow[];
  habits: ReturnType<typeof useParticipantHabits>;
}) {
  const { statement, loading: visionLoading } = useVisionFor(userId);
  const fetchFile = useServerFn(proxyFetchFile);
  const [openDay, setOpenDay] = useState<number | null>(null);
  const [zipping, setZipping] = useState(false);
  const [zipProgress, setZipProgress] = useState<{ done: number; total: number } | null>(null);

  const weekGroups = useMemo(
    () =>
      weeks
        .filter((w) => w.proof_files.length > 0)
        .sort((a, b) => a.week_no - b.week_no)
        .map((w) => ({ weekNo: w.week_no, files: w.proof_files })),
    [weeks],
  );

  // Grouped by DAY — each day folds together every habit's proof for that
  // day, matching how the download-all zip is organized (Day 1/, Day 2/, …).
  const dayGroups = useMemo(() => {
    if (habits.loading) return [];
    const maxDay = Math.max(1, habits.programDay || 1);
    const groups: { day: number; habitFiles: { label: string; files: Attachment[] }[] }[] = [];
    for (let day = 1; day <= maxDay; day++) {
      const habitFiles = HABITS.map((h) => ({ label: h.name, files: habits.proofsFor(day, h.id) })).filter(
        (x) => x.files.length > 0,
      );
      if (habitFiles.length > 0) groups.push({ day, habitFiles });
    }
    return groups.reverse(); // most recent day first
  }, [habits]);

  const visionFiles: Attachment[] = useMemo(
    () =>
      statement.images.map((img) => ({
        kind: "image" as const,
        url: img.url,
        name: img.caption || "Vision board photo",
        size: 0,
      })),
    [statement.images],
  );

  const totalWeekFiles = weekGroups.reduce((n, g) => n + g.files.length, 0);
  const totalHabitFiles = dayGroups.reduce(
    (n, g) => n + g.habitFiles.reduce((m, h) => m + h.files.length, 0),
    0,
  );
  const totalFiles = totalWeekFiles + totalHabitFiles + visionFiles.length;

  // Build the full "folder path -> file" plan the zip mirrors exactly, with
  // zero-padded day/week numbers so entries sort naturally in any zip viewer.
  function buildZipPlan(): ZipEntry[] {
    const pad = (n: number) => String(n).padStart(2, "0");
    const entries: ZipEntry[] = [];
    for (const g of weekGroups) {
      for (const f of g.files) entries.push({ folder: `Weekly Proofs/Week ${pad(g.weekNo)}`, file: f });
    }
    for (const g of dayGroups) {
      for (const h of g.habitFiles) {
        for (const f of h.files) {
          entries.push({
            folder: `Daily Habit Proofs/Day ${pad(g.day)}`,
            file: { ...f, name: `${h.label.replace(/[^\w.-]+/g, "_")}_${f.name}` },
          });
        }
      }
    }
    for (const f of visionFiles) entries.push({ folder: "Vision Board", file: f });
    return entries;
  }

  async function downloadAllAsZip() {
    const plan = buildZipPlan();
    if (plan.length === 0) return;
    setZipping(true);
    setZipProgress({ done: 0, total: plan.length });
    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      const usedNames = new Map<string, number>(); // folder -> count, to de-dupe filenames
      let failed = 0;

      for (const entry of plan) {
        try {
          // Fetched server-side (not a direct browser fetch) so the zip never
          // depends on the client's own cross-origin visibility into storage.
          const res = await fetchFile({ data: { url: entry.file.url } });
          if (!(res instanceof Response) || !res.ok) throw new Error("fetch failed");
          const blob = await res.blob();
          const key = `${entry.folder}/${entry.file.name}`;
          const n = usedNames.get(key) ?? 0;
          usedNames.set(key, n + 1);
          const finalName = n === 0 ? entry.file.name : appendSuffix(entry.file.name, n);
          zip.file(`${entry.folder}/${finalName}`, blob);
        } catch {
          failed++;
        }
        setZipProgress((p) => (p ? { done: p.done + 1, total: p.total } : p));
      }

      const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "participant-files.zip";
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);

      if (failed > 0) {
        toast.warning(`Downloaded zip — ${failed} file(s) couldn't be fetched and were skipped`);
      } else {
        toast.success(`Downloaded zip with ${plan.length} file(s)`);
      }
    } catch (e) {
      toast.error("Couldn't build the zip", { description: (e as Error).message });
    } finally {
      setZipping(false);
      setZipProgress(null);
    }
  }

  if (habits.loading || visionLoading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (totalFiles === 0) {
    return (
      <SectionCard>
        <p className="flex items-center gap-2 py-6 text-center text-sm text-muted-foreground">
          <FolderOpen className="h-4 w-4" /> No files uploaded yet.
        </p>
      </SectionCard>
    );
  }

  return (
    <div className="space-y-4">
      <SectionCard
        title={
          <span className="flex items-center gap-2">
            <FolderOpen className="h-4 w-4 text-navy" /> All files
          </span>
        }
        subtitle="Click any file to preview or download individually"
        action={
          <Button
            className="rounded-full bg-gradient-navy shadow-vkm"
            onClick={downloadAllAsZip}
            disabled={zipping}
          >
            {zipping ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderDown className="h-4 w-4" />}
            {zipping && zipProgress ? `Zipping ${zipProgress.done}/${zipProgress.total}…` : "Download all (.zip)"}
          </Button>
        }
      >
        <div className="flex flex-wrap gap-2 text-xs">
          <CountPill label="Total" value={totalFiles} />
          <CountPill label="Weekly proofs" value={totalWeekFiles} />
          <CountPill label="Habit proofs" value={totalHabitFiles} />
          <CountPill label="Vision board" value={visionFiles.length} />
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          The zip mirrors this page: <span className="font-mono">Weekly Proofs/Week NN</span>,{" "}
          <span className="font-mono">Daily Habit Proofs/Day NN</span>, and{" "}
          <span className="font-mono">Vision Board</span> folders.
        </p>
      </SectionCard>

      {weekGroups.length > 0 && (
        <SectionCard
          title={
            <span className="flex items-center gap-2 text-sm font-semibold">
              <CalendarClock className="h-4 w-4 text-muted-foreground" /> Weekly proofs
            </span>
          }
          subtitle={`${totalWeekFiles} file(s)`}
        >
          <div className="space-y-4">
            {weekGroups.map((g) => (
              <div key={g.weekNo}>
                <p className="mb-1.5 text-xs font-semibold text-foreground">Week {g.weekNo}</p>
                <ProofAttachments files={g.files} />
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {dayGroups.length > 0 && (
        <SectionCard
          title={
            <span className="flex items-center gap-2 text-sm font-semibold">
              <Activity className="h-4 w-4 text-muted-foreground" /> Daily habit proofs — by day
            </span>
          }
          subtitle={`${totalHabitFiles} file(s) across ${dayGroups.length} day(s)`}
        >
          <div className="space-y-1.5">
            {dayGroups.map((g) => {
              const isOpen = openDay === g.day;
              const fileCount = g.habitFiles.reduce((n, h) => n + h.files.length, 0);
              return (
                <div key={g.day} className="overflow-hidden rounded-xl border border-border">
                  <button
                    type="button"
                    onClick={() => setOpenDay(isOpen ? null : g.day)}
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-secondary/40"
                  >
                    <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-navy text-xs font-bold text-primary-foreground">
                      {g.day}
                    </span>
                    <span className="min-w-0 flex-1 text-sm font-medium text-foreground">Day {g.day}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {fileCount} file{fileCount === 1 ? "" : "s"} · {g.habitFiles.length} habit
                      {g.habitFiles.length === 1 ? "" : "s"}
                    </span>
                    <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
                  </button>
                  {isOpen && (
                    <div className="space-y-3 border-t border-border px-3 py-3">
                      {g.habitFiles.map((h) => (
                        <div key={h.label}>
                          <p className="mb-1.5 text-xs font-semibold text-foreground">{h.label}</p>
                          <ProofAttachments files={h.files} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </SectionCard>
      )}

      {visionFiles.length > 0 && (
        <SectionCard
          title={
            <span className="flex items-center gap-2 text-sm font-semibold">
              <ImagePlus className="h-4 w-4 text-muted-foreground" /> Vision board photos
            </span>
          }
          subtitle={`${visionFiles.length} file(s)`}
        >
          <ProofAttachments files={visionFiles} />
        </SectionCard>
      )}
    </div>
  );
}

function appendSuffix(filename: string, n: number): string {
  const dot = filename.lastIndexOf(".");
  if (dot <= 0) return `${filename}_${n}`;
  return `${filename.slice(0, dot)}_${n}${filename.slice(dot)}`;
}

function CountPill({ label, value }: { label: string; value: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 font-medium text-foreground">
      {label} <span className="tabular-nums text-muted-foreground">{value}</span>
    </span>
  );
}
