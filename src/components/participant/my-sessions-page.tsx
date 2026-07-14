import { useMemo } from "react";
import { motion } from "framer-motion";
import { Video, Loader2, PlayCircle, CalendarClock } from "lucide-react";
import { PageHeader } from "@/components/vkm/page-header";
import { SectionCard } from "@/components/vkm/section-card";
import { VideoPlayer } from "@/components/vkm/video-player";
import { weekByNumber } from "@/lib/vkm/program";
import { useMyMemberVideos, type MemberVideo } from "@/components/participant/member-videos-data";

export function MySessionsPage() {
  const { rows, loading } = useMyMemberVideos();

  // Group by week (null → "General"); keep week order 1..16, General first.
  const { general, weeks } = useMemo(() => {
    const general: MemberVideo[] = [];
    const byWeek = new Map<number, MemberVideo[]>();
    for (const r of rows) {
      if (r.week_no == null) general.push(r);
      else {
        const arr = byWeek.get(r.week_no) ?? [];
        arr.push(r);
        byWeek.set(r.week_no, arr);
      }
    }
    const weeks = [...byWeek.entries()].sort((a, b) => a[0] - b[0]);
    return { general, weeks };
  }, [rows]);

  const hasAny = general.length > 0 || weeks.length > 0;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="space-y-5">
      <PageHeader
        eyebrow="Participant"
        title="My Sessions"
        description="Your private 1-on-1 session videos, organised by week. Only you can see these."
        icon={Video}
      />

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : !hasAny ? (
        <SectionCard>
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-navy text-primary-foreground">
              <PlayCircle className="h-6 w-6" />
            </span>
            <p className="text-base font-semibold text-foreground">No session videos yet</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              When your coach or mentor records a 1-on-1 session for you, it'll appear here week by week.
            </p>
          </div>
        </SectionCard>
      ) : (
        <div className="space-y-5">
          {general.length > 0 && <VideoGroup title="General" subtitle="Not tied to a specific week" videos={general} />}
          {weeks.map(([wk, vids]) => (
            <VideoGroup key={wk} title={`Week ${wk}`} subtitle={weekByNumber(wk)?.topic ?? undefined} videos={vids} />
          ))}
        </div>
      )}

      {hasAny && (
        <p className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
          <CalendarClock className="h-3.5 w-3.5" /> More weeks unlock as your coach adds sessions across the 16-week program.
        </p>
      )}
    </motion.div>
  );
}

function VideoGroup({ title, subtitle, videos }: { title: string; subtitle?: string; videos: MemberVideo[] }) {
  return (
    <SectionCard
      title={<span className="flex items-center gap-2 text-sm font-semibold"><Video className="h-4 w-4 text-navy" /> {title}</span>}
      subtitle={subtitle}
    >
      <div className="space-y-5">
        {videos.map((v) => (
          <div key={v.id} className="space-y-2">
            {v.title && <p className="text-sm font-semibold text-foreground">{v.title}</p>}
            <div className="overflow-hidden rounded-xl border border-border">
              <VideoPlayer url={v.video_url} title={v.title ?? title} />
            </div>
            {v.note && <p className="text-xs text-muted-foreground">{v.note}</p>}
          </div>
        ))}
      </div>
    </SectionCard>
  );
}
