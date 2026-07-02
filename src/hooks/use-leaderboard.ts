import { useCallback, useEffect, useMemo, useState } from "react";
import { formatDistanceToNowStrict } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { stageFor } from "@/lib/vkm/program";
import type {
  ActivityItem,
  ActivityTag,
  LeaderboardEntry,
  LeaderboardScope,
  LeaderboardStats,
  Stage,
} from "@/types/leaderboard";

// Map the real 5-tier VKM stage onto the leaderboard's 3-tier display model.
function mapStage(name: string): Stage {
  if (name === "Starter") return "Starter";
  if (name === "Builder") return "Builder";
  return "Operator"; // Operator / Closer / Growth Champion
}

// Point-ledger source → human label + a feed tag/tagType (reusing existing styles).
const SOURCE_META: Record<string, { label: string; tag: string; tagType: ActivityTag }> = {
  task: { label: "Weekly task", tag: "Task", tagType: "proof" },
  attend: { label: "Class attendance", tag: "Attended", tagType: "approved" },
  habit: { label: "Daily habit", tag: "Habit", tagType: "omm" },
  revenue: { label: "Revenue milestone", tag: "Revenue", tagType: "milestone" },
  leads: { label: "Leads", tag: "Leads", tagType: "class" },
  closing: { label: "Closing", tag: "Closing", tagType: "milestone" },
  bonus: { label: "Bonus", tag: "Bonus", tagType: "milestone" },
  manual: { label: "Award", tag: "Award", tagType: "milestone" },
};
function sourceMeta(source: string) {
  return SOURCE_META[source] ?? { label: "Points", tag: "Points", tagType: "proof" as ActivityTag };
}

type RawEntry = {
  user_id: string;
  full_name: string | null;
  business_name: string | null;
  batch_id: string | null;
  batch_name: string | null;
  points: number;
  weeks_approved: number;
};

type RawActivity = {
  id: string;
  user_id: string;
  full_name: string | null;
  source: string;
  reference: string | null;
  points: number;
  batch_id: string | null;
  awarded_at: string;
};

function toEntries(rows: RawEntry[], userId?: string): LeaderboardEntry[] {
  // rows arrive sorted by points desc; assign a dense rank within THIS set.
  return rows.map((r, i) => {
    const points = Number(r.points ?? 0);
    return {
      id: r.user_id,
      rank: i + 1,
      name: r.full_name ?? "Member",
      business: r.business_name ?? "—",
      weeksCompleted: Number(r.weeks_approved ?? 0),
      totalWeeks: 16,
      points,
      stage: mapStage(stageFor(points).name),
      isCurrentUser: r.user_id === userId,
      batchId: r.batch_id ?? null,
      batchName: r.batch_name ?? null,
    };
  });
}

function computeStats(entries: LeaderboardEntry[]): LeaderboardStats {
  const me = entries.find((e) => e.isCurrentUser);
  const points = entries.map((e) => e.points);
  const cohortAvg = points.length ? Math.round(points.reduce((a, b) => a + b, 0) / points.length) : 0;
  return {
    yourRank: me?.rank ?? 0,
    yourPoints: me?.points ?? 0,
    cohortAvg,
    topScore: points.length ? Math.max(...points) : 0,
  };
}

export interface UseLeaderboardResult {
  entries: LeaderboardEntry[];
  activity: ActivityItem[];
  stats: LeaderboardStats;
  loading: boolean;
  scope: LeaderboardScope;
  setScope: (s: LeaderboardScope) => void;
  myBatchName: string | null;
  hasBatch: boolean;
  scopeLabel: string;
}

export function useLeaderboard(): UseLeaderboardResult {
  const { user } = useAuth();
  const [raw, setRaw] = useState<RawEntry[]>([]);
  const [rawActivity, setRawActivity] = useState<RawActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState<LeaderboardScope>("mine");

  const load = useCallback(async () => {
    const [{ data: lb }, { data: act }] = await Promise.all([
      supabase.rpc("get_leaderboard"),
      supabase.rpc("get_leaderboard_activity", { _limit: 40 }),
    ]);
    setRaw((lb ?? []) as RawEntry[]);
    setRawActivity((act ?? []) as RawActivity[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    let active = true;
    void load().then(() => {
      if (!active) return;
    });
    return () => {
      active = false;
    };
  }, [load]);

  // The current user's batch (from the full row set) drives the "My batch" view.
  const myRow = useMemo(() => raw.find((r) => r.user_id === user?.id), [raw, user]);
  const myBatchId = myRow?.batch_id ?? null;
  const myBatchName = myRow?.batch_name ?? null;
  const hasBatch = !!myBatchId;

  // If the viewer has no batch, "My batch" is meaningless — default to All.
  useEffect(() => {
    if (!hasBatch && scope === "mine") setScope("all");
  }, [hasBatch, scope]);

  const entries = useMemo(() => {
    const filtered =
      scope === "mine" && myBatchId ? raw.filter((r) => r.batch_id === myBatchId) : raw;
    return toEntries(filtered, user?.id);
  }, [raw, scope, myBatchId, user]);

  const stats = useMemo(() => computeStats(entries), [entries]);

  const activity = useMemo<ActivityItem[]>(() => {
    const scoped =
      scope === "mine" && myBatchId
        ? rawActivity.filter((a) => a.batch_id === myBatchId)
        : rawActivity;
    return scoped.slice(0, 12).map((a) => {
      const meta = sourceMeta(a.source);
      const detail = a.reference ? ` · ${a.reference}` : "";
      return {
        id: a.id,
        actorName: a.full_name ?? "Member",
        action: `+${a.points} XP · ${meta.label}${detail}`,
        timestamp: formatDistanceToNowStrict(new Date(a.awarded_at), { addSuffix: true }),
        tag: meta.tag,
        tagType: meta.tagType,
      };
    });
  }, [rawActivity, scope, myBatchId]);

  const scopeLabel = scope === "mine" && myBatchName ? myBatchName : "All batches";

  return { entries, activity, stats, loading, scope, setScope, myBatchName, hasBatch, scopeLabel };
}

// ---- shared presentation helpers ----
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}
