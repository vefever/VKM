// Per-week resource catalog for the Program Progress task drill-downs.
//
// Today this is derived from the hardcoded curriculum (real assignments + real
// generated briefs) plus a clearly-labelled sample recording so the inline
// player is demonstrable. It is intentionally shaped like a data source: swap
// `getWeekResources` for a Supabase query against a future `week_resources`
// table and nothing else in the UI needs to change.
import type { ProgramWeek } from "./program";
import type { VideoKind } from "@/lib/video-source";

export type WeekVideo = {
  title: string;
  /**
   * Any reference an admin supplies: a YouTube/Vimeo link, a direct .mp4, or
   * an uploaded-file URL. The player auto-detects the kind; `provider` is an
   * optional explicit override.
   */
  url: string;
  provider?: VideoKind;
  durationLabel: string;
  /** True while we use a stand-in recording rather than the real class video. */
  sample?: boolean;
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

// Genuine, public, playable clips — used ONLY as stand-ins so every source
// kind (YouTube / Vimeo / direct file) is demonstrable. Replace with real
// class recordings supplied by the admin panel (or a DB URL).
const SAMPLE_RECORDINGS: { url: string; provider: VideoKind; durationLabel: string }[] = [
  {
    url: "https://www.youtube.com/watch?v=aqz-KE-bpKQ",
    provider: "youtube",
    durationLabel: "10:34",
  },
  { url: "https://vimeo.com/76979871", provider: "vimeo", durationLabel: "3:03" },
  {
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4",
    provider: "file",
    durationLabel: "0:15",
  },
];

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
 * Resources for a given curriculum week. `currentWeek` lets us only attach a
 * (sample) recording to weeks that have already been taught — upcoming weeks
 * legitimately have no video yet.
 */
export function getWeekResources(
  w: ProgramWeek,
  currentWeek: number,
  videoOverride?: { url: string; provider?: VideoKind; title?: string | null },
): WeekResources {
  const sample = SAMPLE_RECORDINGS[(w.week - 1) % SAMPLE_RECORDINGS.length];
  const video: WeekVideo | undefined = videoOverride?.url
    ? {
        title: videoOverride.title || `${w.topic} — class recording`,
        url: videoOverride.url,
        provider: videoOverride.provider,
        durationLabel: "Class recording",
      }
    : w.week <= currentWeek
      ? {
          title: `${w.topic} — class recording`,
          url: sample.url,
          provider: sample.provider,
          durationLabel: sample.durationLabel,
          sample: true,
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
