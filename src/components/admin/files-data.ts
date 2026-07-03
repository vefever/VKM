import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { type Attachment } from "@/components/chat/chat-data";
import { type WeekFileGroup, type DayFileGroup } from "@/components/coach/files-browser";
import { HABITS } from "@/components/habits/habit-tracker";

export type ParticipantFileCounts = {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  weekly_file_count: number;
  habit_file_count: number;
  vision_file_count: number;
  total_file_count: number;
};

// Batch roster with per-participant file counts (cheap — no file payloads),
// used for the batch-level list before a participant is expanded.
export function useBatchFileCounts(batchId: string | null) {
  const [rows, setRows] = useState<ParticipantFileCounts[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!batchId) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.rpc("admin_batch_file_counts", { _batch_id: batchId });
    if (!error && data) setRows(data as ParticipantFileCounts[]);
    setLoading(false);
  }, [batchId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { rows, loading, reload: load };
}

type RawParticipantFiles = {
  weekly: { week_no: number; files: Attachment[] }[];
  habits: { day_no: number; items: { habit_id: string; files: Attachment[] }[] }[];
  vision: { url: string; caption?: string }[];
};

export type ParticipantFileGroups = {
  weekGroups: WeekFileGroup[];
  dayGroups: DayFileGroup[];
  visionFiles: Attachment[];
};

const habitLabel = (habitId: string) => HABITS.find((h) => h.id === habitId)?.name ?? habitId;

function normalize(raw: RawParticipantFiles): ParticipantFileGroups {
  const weekGroups: WeekFileGroup[] = [...raw.weekly]
    .sort((a, b) => a.week_no - b.week_no)
    .map((w) => ({ weekNo: w.week_no, files: w.files }));

  const dayGroups: DayFileGroup[] = [...raw.habits]
    .sort((a, b) => b.day_no - a.day_no) // most recent day first
    .map((d) => ({
      day: d.day_no,
      habitFiles: d.items.map((i) => ({ label: habitLabel(i.habit_id), files: i.files })),
    }));

  const visionFiles: Attachment[] = raw.vision.map((img) => ({
    kind: "image" as const,
    url: img.url,
    name: img.caption || "Vision board photo",
    size: 0,
  }));

  return { weekGroups, dayGroups, visionFiles };
}

export type BatchZipEntry = { folder: string; file: Attachment };

// Flattened, participant-name-prefixed zip plan for one participant — used
// by the batch-wide "download all" so every participant gets their own
// top-level folder inside a single combined zip.
export async function fetchParticipantZipEntries(
  userId: string,
  participantName: string,
): Promise<BatchZipEntry[]> {
  const { data, error } = await supabase.rpc("admin_participant_files", { _user_id: userId });
  if (error || !data) return [];
  const raw = data as unknown as RawParticipantFiles;
  const pad = (n: number) => String(n).padStart(2, "0");
  const root = participantName.replace(/[^\w.-]+/g, "_") || userId;
  const entries: BatchZipEntry[] = [];

  for (const w of raw.weekly) {
    for (const f of w.files) entries.push({ folder: `${root}/Weekly Proofs/Week ${pad(w.week_no)}`, file: f });
  }
  for (const d of raw.habits) {
    for (const item of d.items) {
      for (const f of item.files) {
        entries.push({
          folder: `${root}/Daily Habit Proofs/Day ${pad(d.day_no)}`,
          file: { ...f, name: `${habitLabel(item.habit_id).replace(/[^\w.-]+/g, "_")}_${f.name}` },
        });
      }
    }
  }
  for (const img of raw.vision) {
    entries.push({
      folder: `${root}/Vision Board`,
      file: { kind: "image", url: img.url, name: img.caption || "Vision board photo", size: 0 },
    });
  }
  return entries;
}

// Full file listing for one participant — a single RPC round trip mirroring
// what ParticipantFilesTab computes client-side from three separate hooks.
export function useParticipantFiles(userId: string | null) {
  const [groups, setGroups] = useState<ParticipantFileGroups | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!userId) {
      setGroups(null);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.rpc("admin_participant_files", { _user_id: userId });
    if (!error && data) setGroups(normalize(data as unknown as RawParticipantFiles));
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { groups, loading, reload: load };
}
