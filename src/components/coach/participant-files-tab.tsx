import { useMemo } from "react";
import { Loader2, FolderOpen, CalendarClock, Activity, ImagePlus } from "lucide-react";
import { SectionCard } from "@/components/vkm/section-card";
import { ProofAttachments } from "@/components/participant/proof-attachments";
import { type Attachment } from "@/components/chat/chat-data";
import { type WeekRow } from "@/components/coach/coach-data";
import { useParticipantHabits, HABITS } from "@/components/habits/habit-tracker";
import { useVisionFor } from "@/components/participant/vision-data";

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

  const weekGroups = useMemo(
    () =>
      weeks
        .filter((w) => w.proof_files.length > 0)
        .sort((a, b) => a.week_no - b.week_no)
        .map((w) => ({ label: `Week ${w.week_no}`, files: w.proof_files })),
    [weeks],
  );

  const habitGroups = useMemo(() => {
    if (habits.loading) return [];
    const maxDay = Math.max(1, habits.programDay || 1);
    const groups: { label: string; files: Attachment[] }[] = [];
    for (let day = 1; day <= maxDay; day++) {
      for (const h of HABITS) {
        const files = habits.proofsFor(day, h.id);
        if (files.length > 0) groups.push({ label: `Day ${day} · ${h.name}`, files });
      }
    }
    return groups.reverse(); // most recent first
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

  const totalFiles =
    weekGroups.reduce((n, g) => n + g.files.length, 0) +
    habitGroups.reduce((n, g) => n + g.files.length, 0) +
    visionFiles.length;

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
        subtitle="Click any file to preview or download"
      >
        <div className="flex flex-wrap gap-2 text-xs">
          <CountPill label="Total" value={totalFiles} />
          <CountPill label="Weekly proofs" value={weekGroups.reduce((n, g) => n + g.files.length, 0)} />
          <CountPill label="Habit proofs" value={habitGroups.reduce((n, g) => n + g.files.length, 0)} />
          <CountPill label="Vision board" value={visionFiles.length} />
        </div>
      </SectionCard>

      {weekGroups.length > 0 && (
        <SectionCard
          title={
            <span className="flex items-center gap-2 text-sm font-semibold">
              <CalendarClock className="h-4 w-4 text-muted-foreground" /> Weekly proofs
            </span>
          }
          subtitle={`${weekGroups.reduce((n, g) => n + g.files.length, 0)} file(s)`}
        >
          <div className="space-y-4">
            {weekGroups.map((g) => (
              <div key={g.label}>
                <p className="mb-1.5 text-xs font-semibold text-foreground">{g.label}</p>
                <ProofAttachments files={g.files} />
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {habitGroups.length > 0 && (
        <SectionCard
          title={
            <span className="flex items-center gap-2 text-sm font-semibold">
              <Activity className="h-4 w-4 text-muted-foreground" /> Daily habit proofs
            </span>
          }
          subtitle={`${habitGroups.reduce((n, g) => n + g.files.length, 0)} file(s)`}
        >
          <div className="space-y-4">
            {habitGroups.map((g) => (
              <div key={g.label}>
                <p className="mb-1.5 text-xs font-semibold text-foreground">{g.label}</p>
                <ProofAttachments files={g.files} />
              </div>
            ))}
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

function CountPill({ label, value }: { label: string; value: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 font-medium text-foreground">
      {label} <span className="tabular-nums text-muted-foreground">{value}</span>
    </span>
  );
}
