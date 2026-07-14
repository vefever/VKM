import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Video, Loader2, PlayCircle, ChevronLeft, CalendarClock, ListVideo } from "lucide-react";
import { PageHeader } from "@/components/vkm/page-header";
import { SectionCard } from "@/components/vkm/section-card";
import { VideoPlayer } from "@/components/vkm/video-player";
import { posterFor } from "@/lib/video-source";
import { weekByNumber, type Phase } from "@/lib/vkm/program";
import { cn } from "@/lib/utils";
import { useMyMemberVideos, type MemberVideo } from "@/components/participant/member-videos-data";

// ── Architecture ─────────────────────────────────────────────────────────────
// A member's session videos are organised into "chapters" (General + each week
// that has videos). The page is a two-level flow:
//   1. ChapterGrid  — a card per chapter (thumbnail, topic, video count).
//   2. ChapterView  — open one chapter → one focused player + a playlist of the
//                     rest of that chapter's videos.
// No giant stack of players; the member navigates like a course.

type Chapter = {
  key: string; // "general" | "week-3"
  weekNo: number | null;
  title: string; // "General" | "Week 3"
  topic: string | null;
  phase: Phase | null;
  videos: MemberVideo[];
};

const PHASE_COLOR: Record<Phase, string> = {
  Foundation: "#3b82f6",
  Systems: "#8b5cf6",
  Sell: "#f59e0b",
  Review: "#10b981",
};

function buildChapters(rows: MemberVideo[]): Chapter[] {
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
  const list: Chapter[] = [];
  if (general.length)
    list.push({ key: "general", weekNo: null, title: "General", topic: "Not tied to a specific week", phase: null, videos: general });
  for (const [wk, vids] of [...byWeek.entries()].sort((a, b) => a[0] - b[0])) {
    const info = weekByNumber(wk);
    list.push({
      key: `week-${wk}`,
      weekNo: wk,
      title: `Week ${wk}`,
      topic: info?.topic ?? null,
      phase: (info?.phase ?? null) as Phase | null,
      videos: vids,
    });
  }
  return list;
}

export function MySessionsPage() {
  const { rows, loading } = useMyMemberVideos();
  const chapters = useMemo(() => buildChapters(rows), [rows]);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const active = chapters.find((c) => c.key === openKey) ?? null;

  const total = rows.length;
  const done = chapters.length;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="space-y-5">
      <PageHeader
        eyebrow="Participant"
        title="My Sessions"
        description="Your private 1-on-1 session videos, organised into chapters by week. Only you can see these."
        icon={Video}
      />

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : chapters.length === 0 ? (
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
      ) : active ? (
        <ChapterView key={active.key} chapter={active} onBack={() => setOpenKey(null)} />
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{done}</span> chapter{done === 1 ? "" : "s"} ·{" "}
            <span className="font-semibold text-foreground">{total}</span> video{total === 1 ? "" : "s"}
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {chapters.map((c) => (
              <ChapterCard key={c.key} chapter={c} onOpen={() => setOpenKey(c.key)} />
            ))}
          </div>
          <p className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
            <CalendarClock className="h-3.5 w-3.5" /> More chapters unlock as your coach adds sessions across the 16-week program.
          </p>
        </>
      )}
    </motion.div>
  );
}

// ── A chapter card in the grid ───────────────────────────────────────────────
function ChapterCard({ chapter, onOpen }: { chapter: Chapter; onOpen: () => void }) {
  const poster = chapter.videos.map((v) => posterFor(v.video_url)).find(Boolean) ?? null;
  const accent = chapter.phase ? PHASE_COLOR[chapter.phase] : "#0f2f5f";
  const count = chapter.videos.length;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group overflow-hidden rounded-2xl border border-border bg-card text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-vkm"
    >
      <div className="relative aspect-video w-full overflow-hidden bg-gradient-navy">
        {poster && <img src={poster} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />}
        <div className="absolute inset-0 flex items-center justify-center bg-black/25">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 text-navy shadow-vkm-float transition-transform duration-200 group-hover:scale-110">
            <PlayCircle className="h-6 w-6" />
          </span>
        </div>
        {chapter.weekNo != null && (
          <span className="absolute left-2 top-2 inline-flex h-7 min-w-7 items-center justify-center rounded-lg px-1.5 text-xs font-bold text-white shadow" style={{ background: accent }}>
            {chapter.weekNo}
          </span>
        )}
        <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white">
          <ListVideo className="h-3 w-3" /> {count}
        </span>
      </div>
      <div className="space-y-0.5 p-3">
        <div className="flex items-center gap-2">
          <p className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{chapter.title}</p>
          {chapter.phase && (
            <span className="shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold text-white" style={{ background: accent }}>
              {chapter.phase}
            </span>
          )}
        </div>
        {chapter.topic && <p className="truncate text-xs text-muted-foreground">{chapter.topic}</p>}
      </div>
    </button>
  );
}

// ── One open chapter: focused player + playlist ──────────────────────────────
function ChapterView({ chapter, onBack }: { chapter: Chapter; onBack: () => void }) {
  const [idx, setIdx] = useState(0);
  const active = chapter.videos[idx] ?? chapter.videos[0];
  const accent = chapter.phase ? PHASE_COLOR[chapter.phase] : "#0f2f5f";
  const many = chapter.videos.length > 1;

  return (
    <div className="space-y-4">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
        <ChevronLeft className="h-4 w-4" /> All chapters
      </button>

      <div className="flex items-center gap-3">
        {chapter.weekNo != null ? (
          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-base font-bold text-white shadow-vkm" style={{ background: accent }}>
            {chapter.weekNo}
          </span>
        ) : (
          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-navy text-primary-foreground shadow-vkm">
            <Video className="h-5 w-5" />
          </span>
        )}
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-lg font-bold text-foreground">{chapter.title}</h2>
            {chapter.phase && (
              <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-white" style={{ background: accent }}>
                {chapter.phase}
              </span>
            )}
          </div>
          {chapter.topic && <p className="truncate text-sm text-muted-foreground">{chapter.topic}</p>}
        </div>
      </div>

      <div className={cn("grid gap-4", many && "lg:grid-cols-[1fr_320px]")}>
        <div className="space-y-3">
          <div className="overflow-hidden rounded-2xl border border-border shadow-vkm">
            <VideoPlayer key={active.id} url={active.video_url} title={active.title ?? chapter.title} />
          </div>
          <div className="space-y-1">
            {active.title && <p className="text-base font-semibold text-foreground">{active.title}</p>}
            {active.note && <p className="text-sm text-muted-foreground">{active.note}</p>}
          </div>
        </div>

        {many && (
          <div className="space-y-2">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <ListVideo className="h-3.5 w-3.5" /> In this chapter · {chapter.videos.length}
            </p>
            <div className="space-y-1.5">
              {chapter.videos.map((v, i) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setIdx(i)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl border p-2 text-left transition-colors",
                    i === idx ? "border-navy/40 bg-navy/[0.05]" : "border-border bg-card hover:bg-secondary/50",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold",
                      i === idx ? "bg-gradient-navy text-primary-foreground" : "bg-secondary text-muted-foreground",
                    )}
                  >
                    {i === idx ? <PlayCircle className="h-4 w-4" /> : i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-foreground">{v.title || `Video ${i + 1}`}</p>
                    {v.note && <p className="truncate text-[11px] text-muted-foreground">{v.note}</p>}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
