import { useMemo } from "react";
import { Loader2 } from "lucide-react";
import { type Attachment } from "@/components/chat/chat-data";
import { type WeekRow } from "@/components/coach/coach-data";
import { useParticipantHabits, HABITS } from "@/components/habits/habit-tracker";
import { useVisionFor } from "@/components/participant/vision-data";
import { FilesBrowser } from "@/components/coach/files-browser";

// Every file a participant has ever uploaded, aggregated from the three
// sources that hold Attachment[] arrays — normalizes them into the shared
// FilesBrowser's grouped display + "download all as zip" UI.
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

  if (habits.loading || visionLoading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <FilesBrowser
      weekGroups={weekGroups}
      dayGroups={dayGroups}
      visionFiles={visionFiles}
      zipFilename="participant-files.zip"
    />
  );
}
