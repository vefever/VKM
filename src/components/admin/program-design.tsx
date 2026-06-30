import { motion } from "framer-motion";
import { LayoutList, MapPin, Video as VideoIcon } from "lucide-react";
import { PageHeader } from "@/components/vkm/page-header";
import { SectionCard } from "@/components/vkm/section-card";
import { VKM_WEEKS, type Phase } from "@/lib/vkm/program";
import { useWeekVideos } from "@/components/admin/class-videos-data";
import { WeekVideoField } from "@/components/admin/class-videos-manager";

const PHASE_COLOR: Record<Phase, string> = {
  Foundation: "#3b82f6",
  Systems: "#8b5cf6",
  Sell: "#f59e0b",
  Review: "#10b981",
};

export function ProgramDesign() {
  const { rows, loading, reload } = useWeekVideos();
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
        description="The 16-week curriculum — topic, task and proof for each week, plus its class video. Videos are shared with the LMS Class Videos page."
        icon={LayoutList}
      />

      <SectionCard>
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{setCount}</span> of {VKM_WEEKS.length}{" "}
          weeks have a class video set.
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
                    {wk.mode === "Offline" ? (
                      <MapPin className="h-3 w-3" />
                    ) : (
                      <VideoIcon className="h-3 w-3" />
                    )}
                    {wk.mode}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">Why:</span> {wk.why}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">Task:</span> {wk.task}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">Proof:</span> {wk.proof}
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
                weekNo={wk.week}
                topic={wk.topic}
                initial={byWeek.get(wk.week)}
                loading={loading}
                onSaved={reload}
              />
            </div>
          </SectionCard>
        ))}
      </div>
    </motion.div>
  );
}
