// VKM Leaderboard — shared types.

export type Stage = "Operator" | "Builder" | "Starter";

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
