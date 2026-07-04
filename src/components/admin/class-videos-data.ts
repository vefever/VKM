import { useCallback, useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { resolveVideoSource, type VideoKind } from "@/lib/video-source";
import { uploadToStorage } from "@/lib/storage-upload";

export type WeekVideoRow = {
  week_no: number;
  url: string | null;
  provider: VideoKind | null;
  title: string | null;
  thumbnail: string | null;
};

// program_week_resources isn't in the generated types yet — cast the client.
const sdb = supabase as unknown as SupabaseClient;

/** Upload a video file to the class-videos bucket; returns its public URL. */
export async function uploadClassVideo(file: File): Promise<string> {
  const safe = file.name.replace(/[^\w.-]+/g, "_");
  const path = `week/${Date.now()}-${safe}`;
  return uploadToStorage("class-videos", path, file, file.type || "video/mp4");
}

/** Upload a custom thumbnail image; returns its public URL. */
export async function uploadThumbnail(file: File): Promise<string> {
  const safe = file.name.replace(/[^\w.-]+/g, "_");
  const path = `thumbnails/${Date.now()}-${safe}`;
  return uploadToStorage("class-videos", path, file, file.type || "image/jpeg");
}

/**
 * Persist a week's class video for a SPECIFIC program (staff-only via RLS).
 * Scoping by program_id is what makes videos batch-specific.
 */
export async function saveWeekVideo(
  programId: string,
  weekNo: number,
  v: { url: string | null; provider: VideoKind | null; title: string | null; thumbnail?: string | null },
) {
  const { error } = await supabase
    .from("program_weeks")
    .update({
      class_video_url: v.url,
      class_video_provider: v.provider,
      class_video_title: v.title,
      class_video_thumbnail: v.thumbnail ?? null,
    })
    .eq("program_id", programId)
    .eq("week_no", weekNo);
  if (error) throw error;
}

/** Detect the provider from a pasted URL so we can store an explicit hint. */
export function detectProvider(url: string): VideoKind {
  return resolveVideoSource(url).kind;
}

/** Read a program's per-week class-video config. */
export function useWeekVideos(programId: string | null) {
  const [rows, setRows] = useState<WeekVideoRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    if (!programId) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    void supabase
      .from("program_weeks")
      .select("week_no, class_video_url, class_video_provider, class_video_title, class_video_thumbnail")
      .eq("program_id", programId)
      .order("week_no")
      .then(({ data }) => {
        setRows(
          (data ?? []).map((r) => ({
            week_no: r.week_no,
            url: r.class_video_url,
            provider: (r.class_video_provider as VideoKind | null) ?? null,
            title: r.class_video_title,
            thumbnail: (r as { class_video_thumbnail: string | null }).class_video_thumbnail ?? null,
          })),
        );
        setLoading(false);
      });
  }, [programId]);

  useEffect(load, [load]);
  return { rows, loading, reload: load };
}

export type WeekVideoOverride = { url: string; provider?: VideoKind; title?: string | null; thumbnail?: string | null };

/** Map of week_no → override, only for weeks that have a real video set. */
export function videoMapFromRows(rows: WeekVideoRow[]): Map<number, WeekVideoOverride> {
  const m = new Map<number, WeekVideoOverride>();
  rows.forEach((r) => {
    if (r.url) m.set(r.week_no, { url: r.url, provider: r.provider ?? undefined, title: r.title, thumbnail: r.thumbnail });
  });
  return m;
}

// ── Per-week resources (downloads / links / files) ───────────────────────────
export type WeekResource = {
  id: string;
  week_no: number;
  kind: "file" | "link";
  title: string;
  url: string;
  file_name: string | null;
  size: number | null;
};

/** Upload a resource file (PDF, doc, image, zip…) and return its URL + metadata. */
export async function uploadResourceFile(
  file: File,
): Promise<{ url: string; file_name: string; size: number }> {
  const safe = file.name.replace(/[^\w.-]+/g, "_");
  const url = await uploadToStorage(
    "class-videos",
    `resources/${Date.now()}-${safe}`,
    file,
    file.type || "application/octet-stream",
  );
  return { url, file_name: file.name, size: file.size };
}

export async function addWeekResource(
  programId: string,
  weekNo: number,
  r: { kind: "file" | "link"; title: string; url: string; file_name?: string | null; size?: number | null },
) {
  const { error } = await sdb.from("program_week_resources").insert({
    program_id: programId,
    week_no: weekNo,
    kind: r.kind,
    title: r.title,
    url: r.url,
    file_name: r.file_name ?? null,
    size: r.size ?? null,
  });
  if (error) throw error;
}

export async function deleteWeekResource(id: string) {
  const { error } = await sdb.from("program_week_resources").delete().eq("id", id);
  if (error) throw error;
}

/** Read a program's resources, grouped by week. Realtime. */
export function useWeekResources(programId: string | null) {
  const [byWeek, setByWeek] = useState<Map<number, WeekResource[]>>(new Map());
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!programId) {
      setByWeek(new Map());
      setLoading(false);
      return;
    }
    const { data } = await sdb
      .from("program_week_resources")
      .select("id, week_no, kind, title, url, file_name, size")
      .eq("program_id", programId)
      .order("week_no")
      .order("sort");
    const m = new Map<number, WeekResource[]>();
    ((data ?? []) as WeekResource[]).forEach((r) => {
      const arr = m.get(r.week_no) ?? [];
      arr.push(r);
      m.set(r.week_no, arr);
    });
    setByWeek(m);
    setLoading(false);
  }, [programId]);

  useEffect(() => {
    void load();
    if (!programId) return;
    const ch = supabase
      .channel(`pwr:${programId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "program_week_resources", filter: `program_id=eq.${programId}` },
        () => void load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [programId, load]);

  return { byWeek, loading, reload: load };
}
