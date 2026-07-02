// VKM Leaderboard — shared types.

export type Stage = "Operator" | "Builder" | "Starter";

export type LeaderboardScope = "mine" | "all";

export interface LeaderboardEntry {
  id: string;
  rank: number;
  name: string;
  business: string;
  weeksCompleted: number;
  totalWeeks: number;
  points: number;
  stage: Stage;
  isCurrentUser: boolean;
  avatar: string | null;
  batchId: string | null;
  batchName: string | null;
}

export type ActivityTag = "proof" | "approved" | "omm" | "class" | "milestone";

export interface ActivityItem {
  id: string;
  actorName: string;
  action: string;
  timestamp: string;
  tag: string;
  tagType: ActivityTag;
}

export interface LeaderboardStats {
  yourRank: number;
  yourPoints: number;
  cohortAvg: number;
  topScore: number;
}
