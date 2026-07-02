import { createContext, createElement, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { resolveMyProgramId, defaultProgramId } from "@/lib/vkm/program-scope";
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
  const { user } = useAuth();
  const [weeks, setWeeks] = useState<ProgramWeek[]>(VKM_WEEKS);
  const [programId, setProgramId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // The participant's program comes from THEIR batch (falls back to the
      // default active program), so different batches can run different content.
      const pid = user ? await resolveMyProgramId(user.id) : await defaultProgramId();
      if (!pid) {
        setProgramId(null);
        setWeeks(VKM_WEEKS);
        return;
      }
      setProgramId(pid);
      const { data: rows } = await supabase
        .from("program_weeks")
        .select("week_no, phase, topic, mode, why, task, proof")
        .eq("program_id", pid)
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
  }, [user]);

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
