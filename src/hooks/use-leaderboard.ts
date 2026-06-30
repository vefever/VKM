import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { stageFor } from "@/lib/vkm/program";
import type { ActivityItem, LeaderboardEntry, LeaderboardStats, Stage } from "@/types/leaderboard";

// Map the real 5-tier VKM stage onto the leaderboard's 3-tier display model.
function mapStage(name: string): Stage {
  if (name === "Starter") return "Starter";
  if (name === "Builder") return "Builder";
  return "Operator"; // Operator / Closer / Growth Champion
}

// ---------------------------------------------------------------------------
// Cohort activity feed — still illustrative until an events stream exists.
// ---------------------------------------------------------------------------

const ACTIVITY: ActivityItem[] = [
  {
    id: "a1",
    actorName: "Suresh Reddy",
    action: "submitted Week 7 proof: CRM live with 240 leads",
    timestamp: "12m ago",
    tag: "Proof",
    tagType: "proof",
  },
  {
    id: "a2",
    actorName: "Coach Soumya",
    action: "approved Anitha Rao's Week 6 GAM minutes",
    timestamp: "1h ago",
    tag: "Approved",
    tagType: "approved",
  },
  {
    id: "a3",
    actorName: "Mahesh K",
    action: "completed daily OMM — 14-day streak",
    timestamp: "2h ago",
    tag: "OMM",
    tagType: "omm",
  },
  {
    id: "a4",
    actorName: "VK",
    action: "posted Tuesday class theme: 'Never lose a lead again'",
    timestamp: "Yesterday",
    tag: "Class",
    tagType: "class",
  },
  {
    id: "a5",
    actorName: "Ravi Teja",
    action: "unlocked Goal Setter milestone (Wk 3)",
    timestamp: "Yesterday",
    tag: "Milestone",
    tagType: "milestone",
  },
];

function computeStats(entries: LeaderboardEntry[]): LeaderboardStats {
  const me = entries.find((e) => e.isCurrentUser);
  const points = entries.map((e) => e.points);
  const cohortAvg = points.length
    ? Math.round(points.reduce((a, b) => a + b, 0) / points.length)
    : 0;
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
}

export function useLeaderboard(): UseLeaderboardResult {
  const { user } = useAuth();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void supabase.rpc("get_leaderboard").then(({ data }) => {
      if (!active) return;
      const rows = (data ?? []) as Array<{
        user_id: string;
        full_name: string | null;
        business_name: string | null;
        points: number;
        weeks_approved: number;
        rank: number;
      }>;
      setEntries(
        rows.map((r) => {
          const points = Number(r.points ?? 0);
          return {
            id: r.user_id,
            rank: Number(r.rank),
            name: r.full_name ?? "Member",
            business: r.business_name ?? "—",
            weeksCompleted: Number(r.weeks_approved ?? 0),
            totalWeeks: 16,
            points,
            stage: mapStage(stageFor(points).name),
            isCurrentUser: r.user_id === user?.id,
          };
        }),
      );
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [user]);

  const stats = useMemo(() => computeStats(entries), [entries]);
  return { entries, activity: ACTIVITY, stats, loading };
}

// ---- shared presentation helpers ----
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}
