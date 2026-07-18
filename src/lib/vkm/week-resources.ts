// Per-week resource catalog for the Program Progress task drill-downs.
//
// Derived from the hardcoded curriculum (real assignments + real generated
// briefs). The class VIDEO is never invented here: a week shows a video only
// when staff have actually set one for that batch (`videoOverride`, read from
// program_weeks.class_video_*). Weeks with no recording yet render an honest
// "posted after the live class" state rather than a stand-in clip.
import type { ProgramWeek } from "./program";
import type { VideoKind } from "@/lib/video-source";

export type WeekVideo = {
  title: string;
  /**
   * Any reference staff supply: a Google Drive share link, a YouTube/Vimeo
   * link, a direct .mp4/HLS URL, or an uploaded-file URL. The player detects
   * the kind from the URL itself; `provider` is only a stored hint.
   */
  url: string;
  provider?: VideoKind;
  /** Staff-uploaded custom thumbnail (else YouTube auto-derives, else placeholder). */
  thumbnail?: string | null;
  durationLabel: string;
};

export type WeekAssignment = {
  title: string;
  instructions: string;
  dueLabel: string;
};

export type DownloadType = "pdf" | "doc" | "csv" | "zip" | "txt";
export type WeekDownload = {
  name: string;
  type: DownloadType;
  /** Produced on demand so the Download button saves a real file (no backend). */
  build: () => { blob: Blob; filename: string };
};

export type WeekResources = {
  video?: WeekVideo;
  assignments: WeekAssignment[];
  downloads: WeekDownload[];
};

function briefFor(w: ProgramWeek) {
  const text = [
    `VK MENTORSHIP — WEEK ${w.week} BRIEF`,
    `Phase: ${w.phase}    Mode: ${w.mode}`,
    `Topic: ${w.topic}`,
    ``,
    `WHY IT MATTERS`,
    w.why,
    ``,
    `THIS WEEK'S TASK`,
    w.task,
    ``,
    `PROOF REQUIRED`,
    w.proof,
    ``,
    `— Submit your proof in the app before next Tuesday's class.`,
  ].join("\n");
  return () => ({
    blob: new Blob([text], { type: "text/plain;charset=utf-8" }),
    filename: `week-${String(w.week).padStart(2, "0")}-brief.txt`,
  });
}

/**
 * Resources for a given curriculum week.
 *
 * A week has a video ONLY when staff have set one for this batch. There is no
 * fallback clip: an untaught or not-yet-uploaded week returns `video:
 * undefined` and the UI shows "recording posts after the live class".
 * `currentWeek` is retained by callers to decide locked/unlocked framing.
 */
export function getWeekResources(
  w: ProgramWeek,
  _currentWeek: number,
  videoOverride?: { url: string; provider?: VideoKind; title?: string | null; thumbnail?: string | null },
): WeekResources {
  const video: WeekVideo | undefined = videoOverride?.url
    ? {
        title: videoOverride.title || `${w.topic} — class recording`,
        url: videoOverride.url,
        provider: videoOverride.provider,
        thumbnail: videoOverride.thumbnail ?? null,
        durationLabel: "Class recording",
      }
    : undefined;
  return {
    video,
    assignments: [
      {
        title: w.topic,
        instructions: w.task,
        dueLabel: "Before next Tuesday's class",
      },
    ],
    downloads: [
      {
        name: `Week ${w.week} brief`,
        type: "txt",
        build: briefFor(w),
      },
    ],
  };
}
