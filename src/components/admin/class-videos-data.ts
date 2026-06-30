import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { resolveVideoSource, type VideoKind } from "@/lib/video-source";
import { uploadToStorage } from "@/lib/storage-upload";

export type WeekVideoRow = {
  week_no: number;
  url: string | null;
  provider: VideoKind | null;
  title: string | null;
};

/** Upload a video file to the class-videos bucket; returns its public URL. */
export async function uploadClassVideo(file: File): Promise<string> {
  const safe = file.name.replace(/[^\w.-]+/g, "_");
  const path = `week/${Date.now()}-${safe}`;
  return uploadToStorage("class-videos", path, file, file.type || "video/mp4");
}

/** Persist a week's class video (staff-only via RLS). */
export async function saveWeekVideo(
  weekNo: number,
  v: { url: string | null; provider: VideoKind | null; title: string | null },
) {
  const { error } = await supabase
    .from("program_weeks")
    .update({
      class_video_url: v.url,
      class_video_provider: v.provider,
      class_video_title: v.title,
    })
    .eq("week_no", weekNo);
  if (error) throw error;
}

/** Detect the provider from a pasted URL so we can store an explicit hint. */
export function detectProvider(url: string): VideoKind {
  return resolveVideoSource(url).kind;
}

/** Read every week's class-video config (used by admin + participant). */
export function useWeekVideos() {
  const [rows, setRows] = useState<WeekVideoRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    void supabase
      .from("program_weeks")
      .select("week_no, class_video_url, class_video_provider, class_video_title")
      .order("week_no")
      .then(({ data }) => {
        setRows(
          (data ?? []).map((r) => ({
            week_no: r.week_no,
            url: r.class_video_url,
            provider: (r.class_video_provider as VideoKind | null) ?? null,
            title: r.class_video_title,
          })),
        );
        setLoading(false);
      });
  }, []);

  useEffect(load, [load]);
  return { rows, loading, reload: load };
}

export type WeekVideoOverride = { url: string; provider?: VideoKind; title?: string | null };

/** Map of week_no → override, only for weeks that have a real video set. */
export function videoMapFromRows(rows: WeekVideoRow[]): Map<number, WeekVideoOverride> {
  const m = new Map<number, WeekVideoOverride>();
  rows.forEach((r) => {
    if (r.url) m.set(r.week_no, { url: r.url, provider: r.provider ?? undefined, title: r.title });
  });
  return m;
}
