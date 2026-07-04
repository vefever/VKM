import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { VKM_WEEKS } from "@/lib/vkm/program";

export type BatchLite = { id: string; name: string; status: string };

export type ProgramRow = {
  id: string;
  title: string;
  description: string | null;
  duration_weeks: number;
  status: string;
  created_at: string;
  week_count: number;
  video_count: number;
  resource_count: number;
  batches: BatchLite[]; // batches currently assigned to this program
};

// All programs with per-program content counts + which batches run them.
export function useProgramsList() {
  const [programs, setPrograms] = useState<ProgramRow[]>([]);
  const [allBatches, setAllBatches] = useState<BatchLite[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [{ data: progs }, { data: weeks }, { data: res }, { data: batches }] = await Promise.all([
      supabase.from("programs").select("id, title, description, duration_weeks, status, created_at").order("created_at", { ascending: true }),
      supabase.from("program_weeks").select("program_id, class_video_url"),
      supabase.from("program_week_resources").select("program_id"),
      supabase.from("batches").select("id, name, status, program_id").order("start_date", { ascending: false, nullsFirst: false }),
    ]);

    const weekCount = new Map<string, number>();
    const videoCount = new Map<string, number>();
    ((weeks ?? []) as { program_id: string | null; class_video_url: string | null }[]).forEach((w) => {
      if (!w.program_id) return;
      weekCount.set(w.program_id, (weekCount.get(w.program_id) ?? 0) + 1);
      if (w.class_video_url) videoCount.set(w.program_id, (videoCount.get(w.program_id) ?? 0) + 1);
    });
    const resCount = new Map<string, number>();
    ((res ?? []) as { program_id: string }[]).forEach((r) => resCount.set(r.program_id, (resCount.get(r.program_id) ?? 0) + 1));

    const batchesByProgram = new Map<string, BatchLite[]>();
    const batchList: BatchLite[] = [];
    ((batches ?? []) as { id: string; name: string; status: string; program_id: string | null }[]).forEach((b) => {
      batchList.push({ id: b.id, name: b.name, status: b.status });
      if (b.program_id) {
        const arr = batchesByProgram.get(b.program_id) ?? [];
        arr.push({ id: b.id, name: b.name, status: b.status });
        batchesByProgram.set(b.program_id, arr);
      }
    });

    setAllBatches(batchList);
    setPrograms(
      ((progs ?? []) as Omit<ProgramRow, "week_count" | "video_count" | "resource_count" | "batches">[]).map((p) => ({
        ...p,
        week_count: weekCount.get(p.id) ?? 0,
        video_count: videoCount.get(p.id) ?? 0,
        resource_count: resCount.get(p.id) ?? 0,
        batches: batchesByProgram.get(p.id) ?? [],
      })),
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { programs, allBatches, loading, reload: load };
}

// Deep-copy a program (weeks incl. videos, milestones, resources) via the RPC.
export async function cloneProgram(sourceId: string, title: string, status = "active"): Promise<string> {
  const { data, error } = await supabase.rpc("clone_program", { _source: sourceId, _new_title: title, _status: status });
  if (error) throw error;
  return data as string;
}

// Create a blank program, optionally seeding the default 16-week plan.
export async function createProgram(title: string, seedDefault: boolean): Promise<string> {
  const { data, error } = await supabase
    .from("programs")
    .insert({ title: title.trim() || "New program", description: "Transformation program", duration_weeks: 16, status: "draft" })
    .select("id")
    .single();
  if (error) throw error;
  const id = data.id as string;
  if (seedDefault) {
    const payload = VKM_WEEKS.map((w) => ({
      program_id: id, week_no: w.week, phase: w.phase, topic: w.topic, mode: w.mode, why: w.why, task: w.task, proof: w.proof,
    }));
    const { error: seedErr } = await supabase.from("program_weeks").insert(payload);
    if (seedErr) throw seedErr;
  }
  return id;
}

// Assign (or clear) a batch's program — the RLS-permitted link that scopes what
// that batch's participants see. resolveMyProgramId picks it up automatically.
export async function assignBatchProgram(batchId: string, programId: string | null): Promise<void> {
  const { error } = await supabase.from("batches").update({ program_id: programId }).eq("id", batchId);
  if (error) throw error;
}

export async function setProgramStatus(programId: string, status: string): Promise<void> {
  const { error } = await supabase.from("programs").update({ status }).eq("id", programId);
  if (error) throw error;
}
