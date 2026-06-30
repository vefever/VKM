import { useMemo, useState } from "react";
import {
  Play,
  Lock,
  CheckCircle2,
  Download,
  FileText,
  FileSpreadsheet,
  FileArchive,
  Clock,
  ClipboardList,
  Video as VideoIcon,
  Circle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { VideoPlayer } from "@/components/vkm/video-player";
import { cn } from "@/lib/utils";
import { posterFor, type VideoKind } from "@/lib/video-source";
import type { ProgramWeek } from "@/lib/vkm/program";
import {
  getWeekResources,
  type DownloadType,
  type WeekDownload,
  type WeekResources,
} from "@/lib/vkm/week-resources";

const DL_ICON: Record<DownloadType, typeof FileText> = {
  pdf: FileText,
  doc: FileText,
  txt: FileText,
  csv: FileSpreadsheet,
  zip: FileArchive,
};

function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function triggerDownload(d: WeekDownload) {
  const { blob, filename } = d.build();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function TaskResources({
  wk,
  currentWeek,
  locked,
  watched,
  assignmentDone,
  submitted,
  onWatched,
  onToggleAssignment,
  videoOverride,
}: {
  wk: ProgramWeek;
  currentWeek: number;
  locked: boolean;
  watched: boolean;
  assignmentDone: boolean;
  submitted: boolean;
  onWatched: () => void;
  onToggleAssignment: (v: boolean) => void;
  videoOverride?: { url: string; provider?: VideoKind; title?: string | null };
}) {
  const res: WeekResources = useMemo(
    () => getWeekResources(wk, currentWeek, videoOverride),
    [wk, currentWeek, videoOverride],
  );

  return (
    <div className="space-y-3">
      <VideoBlock
        video={res.video}
        locked={locked}
        weekNo={wk.week}
        watched={watched}
        onWatched={onWatched}
      />
      <AssignmentBlock
        assignments={res.assignments}
        locked={locked}
        weekNo={wk.week}
        done={assignmentDone}
        submitted={submitted}
        onToggle={onToggleAssignment}
      />
      <DownloadBlock downloads={res.downloads} locked={locked} weekNo={wk.week} />
    </div>
  );
}

function SectionHead({
  icon: Icon,
  label,
  count,
}: {
  icon: typeof VideoIcon;
  label: string;
  count: number;
}) {
  return (
    <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
      <Icon className="h-3.5 w-3.5" />
      {label} <span className="text-muted-foreground/60">({count})</span>
    </p>
  );
}

function LockedNote({ weekNo }: { weekNo: number }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-dashed border-border bg-secondary/40 px-3 py-2.5 text-xs text-muted-foreground">
      <Lock className="h-3.5 w-3.5 shrink-0" />
      Unlocks in Week {weekNo}.
    </div>
  );
}

function EmptyNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-secondary/30 px-3 py-2.5 text-xs text-muted-foreground">
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Video — LMS-style inline player (click the 16:9 poster → plays in place)
// ---------------------------------------------------------------------------
function VideoBlock({
  video,
  locked,
  weekNo,
  watched,
  onWatched,
}: {
  video: WeekResources["video"];
  locked: boolean;
  weekNo: number;
  watched: boolean;
  onWatched: () => void;
}) {
  const [playing, setPlaying] = useState(false);
  const poster = video ? posterFor(video.url) : null;

  return (
    <div>
      <SectionHead icon={VideoIcon} label="Class video" count={video && !locked ? 1 : 0} />
      {locked ? (
        <LockedNote weekNo={weekNo} />
      ) : !video ? (
        <EmptyNote>Class recording is posted here after the live class.</EmptyNote>
      ) : (
        <>
          {/* Inline 16:9 player region — replaces the old popup. */}
          {playing ? (
            <VideoPlayer
              url={video.url}
              provider={video.provider}
              autoPlay
              onEnded={onWatched}
              poster={poster ?? undefined}
              title={video.title}
            />
          ) : (
            <button
              type="button"
              onClick={() => setPlaying(true)}
              aria-label={`Play ${video.title}`}
              className="app-press group relative block aspect-video w-full overflow-hidden rounded-xl bg-gradient-navy text-left text-primary-foreground shadow-vkm"
            >
              {poster && (
                <img
                  src={poster}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover opacity-70"
                />
              )}
              <span
                aria-hidden
                className="absolute inset-0 bg-gradient-to-t from-navy/85 via-navy/30 to-navy/10"
              />
              <span className="absolute inset-0 flex items-center justify-center">
                <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-white/20 ring-1 ring-white/30 backdrop-blur transition-transform group-hover:scale-110">
                  <Play className="h-6 w-6 fill-current" />
                </span>
              </span>
              {video.sample && (
                <span className="absolute right-2 top-2 rounded bg-gold/30 px-1.5 py-0.5 text-[9px] font-bold uppercase">
                  Sample
                </span>
              )}
              {watched && (
                <span className="absolute left-2 top-2 inline-flex items-center gap-0.5 rounded-full bg-[#10b981] px-2 py-0.5 text-[10px] font-semibold text-white">
                  <CheckCircle2 className="h-3 w-3" /> Watched
                </span>
              )}
              <span className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 p-3">
                <span className="truncate text-sm font-semibold drop-shadow">{video.title}</span>
                <span className="inline-flex shrink-0 items-center gap-1 rounded bg-black/40 px-1.5 py-0.5 text-[11px]">
                  <Clock className="h-3 w-3" /> {video.durationLabel}
                </span>
              </span>
            </button>
          )}

          {/* Caption + Mark watched — sits under the inline player, not in a modal. */}
          <div className="mt-2 flex items-center justify-between gap-2">
            <p className="text-[11px] text-muted-foreground">
              {video.sample
                ? "Stand-in recording — your real class video replaces this."
                : "Direct/uploaded videos check off on finish; for YouTube/Vimeo tap Mark watched."}
            </p>
            {watched ? (
              <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-[oklch(0.45_0.13_160)]">
                <CheckCircle2 className="h-4 w-4" /> Watched
              </span>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="min-h-11 shrink-0 rounded-lg"
                onClick={onWatched}
              >
                Mark watched
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Assignments — actionable in place
// ---------------------------------------------------------------------------
function AssignmentBlock({
  assignments,
  locked,
  weekNo,
  done,
  submitted,
  onToggle,
}: {
  assignments: WeekResources["assignments"];
  locked: boolean;
  weekNo: number;
  done: boolean;
  submitted: boolean;
  onToggle: (v: boolean) => void;
}) {
  // Submitting proof implies the assignment is done — never show "To do" then.
  const isDone = done || submitted;
  return (
    <div>
      <SectionHead
        icon={ClipboardList}
        label="Assignment"
        count={locked ? 0 : assignments.length}
      />
      {locked ? (
        <LockedNote weekNo={weekNo} />
      ) : assignments.length === 0 ? (
        <EmptyNote>No assignment for this week.</EmptyNote>
      ) : (
        <div className="space-y-2">
          {assignments.map((a, i) => (
            <div key={i} className="rounded-lg border border-border bg-card p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-foreground">{a.title}</p>
                <span
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
                    isDone
                      ? "bg-[oklch(0.93_0.06_160)] text-[oklch(0.35_0.12_160)]"
                      : "bg-secondary text-muted-foreground",
                  )}
                >
                  {isDone ? <CheckCircle2 className="h-3 w-3" /> : <Circle className="h-3 w-3" />}
                  {isDone ? "Done" : "To do"}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{a.instructions}</p>
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Clock className="h-3 w-3" /> {a.dueLabel}
                </span>
                {submitted ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[oklch(0.45_0.13_160)]">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Completed with your proof
                  </span>
                ) : (
                  // Secondary action — Submit proof is the dominant button below.
                  <Button
                    size="sm"
                    variant="outline"
                    className="min-h-11 rounded-lg"
                    onClick={() => onToggle(!done)}
                  >
                    {done ? "Mark not done" : "Mark done"}
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Downloads — real files, real download button
// ---------------------------------------------------------------------------
function DownloadBlock({
  downloads,
  locked,
  weekNo,
}: {
  downloads: WeekDownload[];
  locked: boolean;
  weekNo: number;
}) {
  // Build once to show a real size without re-generating on every render.
  const sized = useMemo(
    () => downloads.map((d) => ({ d, size: d.build().blob.size })),
    [downloads],
  );

  return (
    <div>
      <SectionHead icon={Download} label="Downloads" count={locked ? 0 : downloads.length} />
      {locked ? (
        <LockedNote weekNo={weekNo} />
      ) : downloads.length === 0 ? (
        <EmptyNote>No downloads for this week yet.</EmptyNote>
      ) : (
        <div className="space-y-2">
          {sized.map(({ d, size }, i) => {
            const Icon = DL_ICON[d.type];
            return (
              <div
                key={i}
                className="flex items-center gap-3 rounded-lg border border-border bg-card p-2.5"
              >
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-navy">
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{d.name}</p>
                  <p className="text-[11px] uppercase text-muted-foreground">
                    {d.type} · {fmtSize(size)}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 shrink-0 rounded-lg"
                  onClick={() => triggerDownload(d)}
                >
                  <Download className="h-4 w-4" /> Download
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
