import { motion } from "framer-motion";
import { Video, Play, Clock, Lock, CheckCircle2 } from "lucide-react";
import { PageHeader } from "@/components/vkm/page-header";
import { SectionCard } from "@/components/vkm/section-card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { VideoPlayer } from "@/components/vkm/video-player";
import { cn } from "@/lib/utils";
import { VKM_WEEKS, type ProgramWeek } from "@/lib/vkm/program";
import { getWeekResources } from "@/lib/vkm/week-resources";
import {
  useWeekVideos,
  videoMapFromRows,
  type WeekVideoOverride,
} from "@/components/admin/class-videos-data";
import { currentWeekNo } from "@/components/coach/coach-data";

// LMS = every Tuesday class recording, week by week, in one page.
export function LmsVideosPage() {
  const { rows } = useWeekVideos();
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
          <Dialog>
            <DialogTrigger asChild>
              <button
                type="button"
                className="app-press group flex w-full items-center gap-3 overflow-hidden rounded-xl bg-gradient-navy p-3 text-left text-primary-foreground shadow-vkm"
              >
                <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/20 transition-transform group-hover:scale-105">
                  <Play className="h-5 w-5 fill-current" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-semibold">{video.title}</span>
                    {video.sample && (
                      <span className="shrink-0 rounded bg-gold/30 px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">
                        Sample
                      </span>
                    )}
                  </span>
                  <span className="text-[11px] text-white/70">Tap to watch</span>
                </span>
              </button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl p-0">
              <DialogHeader className="px-4 pt-4">
                <DialogTitle className="text-base">{video.title}</DialogTitle>
              </DialogHeader>
              <div className="px-4 pb-4">
                <VideoPlayer
                  url={video.url}
                  provider={video.provider}
                  autoPlay
                  title={video.title}
                />
                {video.sample && (
                  <p className="mt-3 text-xs text-muted-foreground">
                    Stand-in recording — your real class video replaces this.
                  </p>
                )}
              </div>
            </DialogContent>
          </Dialog>
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
