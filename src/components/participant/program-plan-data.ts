import { createContext, createElement, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { VKM_WEEKS, type ProgramWeek, type Phase } from "@/lib/vkm/program";

// DB-backed, variable-length program plan. The active program's program_weeks
// rows are the source of truth; until an admin seeds/edits them we fall back to
// the built-in VKM_WEEKS so nothing breaks. Program length = number of weeks.

export type ProgramPhaseGroup = { name: Phase; weeks: number[] };

export type ProgramPlan = {
  weeks: ProgramWeek[];
  length: number;
  phases: ProgramPhaseGroup[];
  byNumber: (n: number) => ProgramWeek | undefined;
  loading: boolean;
  programId: string | null;
  reload: () => void;
};

function phasesFrom(weeks: ProgramWeek[]): ProgramPhaseGroup[] {
  const order: Phase[] = [];
  const map = new Map<Phase, number[]>();
  for (const w of weeks) {
    if (!map.has(w.phase)) {
      map.set(w.phase, []);
      order.push(w.phase);
    }
    map.get(w.phase)!.push(w.week);
  }
  return order.map((name) => ({ name, weeks: map.get(name)! }));
}

export function useProgramPlan(): ProgramPlan {
  const [weeks, setWeeks] = useState<ProgramWeek[]>(VKM_WEEKS);
  const [programId, setProgramId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: prog } = await supabase
        .from("programs")
        .select("id")
        .eq("status", "active")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (!prog) {
        setProgramId(null);
        setWeeks(VKM_WEEKS);
        return;
      }
      setProgramId(prog.id);
      const { data: rows } = await supabase
        .from("program_weeks")
        .select("week_no, phase, topic, mode, why, task, proof")
        .eq("program_id", prog.id)
        .order("week_no", { ascending: true });
      if (rows && rows.length > 0) {
        setWeeks(
          rows.map((r) => ({
            week: r.week_no,
            phase: r.phase as Phase,
            topic: r.topic,
            mode: r.mode as ProgramWeek["mode"],
            why: r.why,
            task: r.task,
            proof: r.proof,
          })),
        );
      } else {
        setWeeks(VKM_WEEKS);
      }
    } catch {
      setWeeks(VKM_WEEKS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    weeks,
    length: weeks.length,
    phases: phasesFrom(weeks),
    byNumber: (n) => weeks.find((w) => w.week === n),
    loading,
    programId,
    reload: load,
  };
}

// Context so the deep subcomponents of the progress page read one shared plan
// without prop-threading.
const PlanContext = createContext<ProgramPlan | null>(null);

export function ProgramPlanProvider({ children }: { children: ReactNode }) {
  const plan = useProgramPlan();
  return createElement(PlanContext.Provider, { value: plan }, children);
}

export function usePlan(): ProgramPlan {
  const ctx = useContext(PlanContext);
  if (!ctx) throw new Error("usePlan must be used within a ProgramPlanProvider");
  return ctx;
}
