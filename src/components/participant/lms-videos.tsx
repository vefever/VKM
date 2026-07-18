import { useState } from "react";
import { motion } from "framer-motion";
import { Video, Clock, Lock, CheckCircle2 } from "lucide-react";
import { PageHeader } from "@/components/vkm/page-header";
import { SectionCard } from "@/components/vkm/section-card";
import { VideoPlayer } from "@/components/vkm/video-player";
import { VideoThumb } from "@/components/vkm/video-thumb";
import { thumbnailFor } from "@/lib/video-source";
import { cn } from "@/lib/utils";
import { VKM_WEEKS, type ProgramWeek } from "@/lib/vkm/program";
import { getWeekResources } from "@/lib/vkm/week-resources";
import {
  useWeekVideos,
  videoMapFromRows,
  type WeekVideoOverride,
} from "@/components/admin/class-videos-data";
import { useProgramPlan } from "@/components/participant/program-plan-data";
import { currentWeekNo } from "@/components/coach/coach-data";

// LMS = every Tuesday class recording, week by week, in one page.
export function LmsVideosPage() {
  // Scope videos to the participant's OWN batch program (so a cloned Batch-17
  // program shows its own recordings), matching the Program Progress page.
  const { programId } = useProgramPlan();
  const { rows } = useWeekVideos(programId);
  const byWeek = videoMapFromRows(rows);
  const currentWeek = currentWeekNo();
  const available = VKM_WEEKS.filter(
    (w) => getWeekResources(w, currentWeek, byWeek.get(w.week)).video,
  ).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-5"
    >
      <PageHeader
        eyebrow="Learning"
        title="LMS"
        description="Every Tuesday class recording, week by week — watch right here."
        icon={Video}
      />

      <SectionCard>
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{available}</span> of {VKM_WEEKS.length}{" "}
          class recordings available.
        </p>
      </SectionCard>

      <div className="space-y-2.5">
        {VKM_WEEKS.map((wk) => (
          <LmsRow key={wk.week} wk={wk} currentWeek={currentWeek} override={byWeek.get(wk.week)} />
        ))}
      </div>
    </motion.div>
  );
}

function LmsRow({
  wk,
  currentWeek,
  override,
}: {
  wk: ProgramWeek;
  currentWeek: number;
  override?: WeekVideoOverride;
}) {
  const video = getWeekResources(wk, currentWeek, override).video;
  const locked = wk.week > currentWeek && !video;
  const [playing, setPlaying] = useState(false);

  return (
    <div className="rounded-xl border border-border bg-card p-3">
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
        {video && (
          <span className="inline-flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
            <Clock className="h-3 w-3" /> {video.durationLabel}
          </span>
        )}
      </div>

      <div className="mt-3">
        {video ? (
          playing ? (
            <VideoPlayer url={video.url} provider={video.provider} autoPlay title={video.title} poster={thumbnailFor(video.url, video.thumbnail) ?? undefined} />
          ) : (
            <VideoThumb
              url={video.url}
              provider={video.provider}
              thumbnail={video.thumbnail}
              title={video.title}
              durationLabel={video.durationLabel}
              onPlay={() => setPlaying(true)}
            />
          )
        ) : (
          <div
            className={cn(
              "flex items-center gap-2 rounded-lg border border-dashed border-border bg-secondary/40 px-3 py-2.5 text-xs text-muted-foreground",
            )}
          >
            {locked ? (
              <>
                <Lock className="h-3.5 w-3.5 shrink-0" /> Unlocks in Week {wk.week}.
              </>
            ) : (
              <>
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> Recording posts after the live
                class.
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
