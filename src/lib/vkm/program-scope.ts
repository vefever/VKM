import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// Resolving which PROGRAM a participant sees, and which one staff are editing.
// Each batch maps to a program (batches.program_id), so a participant's content
// (curriculum weeks, class videos, resources) comes from their batch's program;
// staff pick a batch to edit its program.

/** The default program when a participant has no batch/program — earliest active. */
export async function defaultProgramId(): Promise<string | null> {
  const { data } = await supabase
    .from("programs")
    .select("id")
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

type BatchEmbed = { program_id: string | null; start_date: string | null; status: string | null };

/** A participant's program = their batch's program (newest batch that has one), else default. */
export async function resolveMyProgramId(userId: string): Promise<string | null> {
  try {
    const { data } = await supabase
      .from("batch_members")
      .select("batches(program_id, start_date, status)")
      .eq("user_id", userId)
      .eq("role", "participant");
    const withProg = (data ?? [])
      .map((r) => (r as unknown as { batches: BatchEmbed | null }).batches)
      .filter((b): b is BatchEmbed => !!b && !!b.program_id);
    if (withProg.length) {
      withProg.sort((a, b) => (b.start_date ?? "").localeCompare(a.start_date ?? ""));
      return withProg[0].program_id;
    }
  } catch {
    /* fall through */
  }
  return defaultProgramId();
}

export type ProgramOption = { programId: string; label: string };

// Batch-first picker for staff editors: one option per program, labelled by the
// batch(es) using it (so it reads "Batch 16", "Batch 17"). Defaults to the
// newest active batch's program.
export function useProgramOptions() {
  const [options, setOptions] = useState<ProgramOption[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [{ data: progs }, { data: batches }] = await Promise.all([
        supabase.from("programs").select("id, title, created_at").order("created_at", { ascending: true }),
        supabase.from("batches").select("id, name, program_id, start_date, status").order("start_date", { ascending: false, nullsFirst: false }),
      ]);
      if (!alive) return;

      const byProg = new Map<string, string[]>();
      (batches ?? []).forEach((b) => {
        if (b.program_id) {
          const arr = byProg.get(b.program_id) ?? [];
          arr.push(b.name);
          byProg.set(b.program_id, arr);
        }
      });
      const opts: ProgramOption[] = (progs ?? []).map((p) => {
        const names = byProg.get(p.id) ?? [];
        return { programId: p.id, label: names.length ? names.join(" · ") : p.title };
      });
      setOptions(opts);

      const activeBatch =
        (batches ?? []).find((b) => b.program_id && b.status === "active") ??
        (batches ?? []).find((b) => b.program_id);
      setSelected(activeBatch?.program_id ?? opts[0]?.programId ?? null);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, []);

  return { options, selected, setSelected, loading };
}
