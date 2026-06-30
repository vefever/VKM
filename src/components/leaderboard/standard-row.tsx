import { motion } from "framer-motion";
import { Zap, Wrench, Rocket, type LucideIcon } from "lucide-react";
import { initialsOf } from "@/hooks/use-leaderboard";
import { cn } from "@/lib/utils";
import type { LeaderboardEntry, Stage } from "@/types/leaderboard";

// Original-theme stage palette (navy / grey / light-grey).
const STAGE: Record<Stage, { badge: string; Icon: LucideIcon }> = {
  Operator: { badge: "bg-gradient-navy text-primary-foreground", Icon: Zap },
  Builder: { badge: "bg-[#E5E7EB] text-[#374151]", Icon: Wrench },
  Starter: { badge: "bg-[#F3F4F6] text-[#6B7280]", Icon: Rocket },
};

function pointsClass(p: number): string {
  if (p >= 400) return "text-[oklch(0.5_0.11_80)] font-bold";
  if (p >= 300) return "text-foreground font-bold";
  if (p >= 200) return "text-foreground/80 font-semibold";
  return "text-muted-foreground";
}

export function StandardRow({ entry, index }: { entry: LeaderboardEntry; index: number }) {
  const stage = STAGE[entry.stage];
  const Icon = stage.Icon;
  const pct = Math.round((entry.weeksCompleted / entry.totalWeeks) * 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.9 + index * 0.08, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ scale: 1.01 }}
      className="flex items-center gap-3 rounded-2xl border border-border bg-card px-3 py-2.5 transition-colors hover:bg-secondary/60 sm:px-4"
    >
      {/* Rank */}
      <span className="w-8 shrink-0 text-sm font-bold text-foreground">#{entry.rank}</span>

      {/* Avatar */}
      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-navy text-xs font-semibold text-primary-foreground">
        {initialsOf(entry.name)}
      </span>

      {/* Name + business */}
      <div className="min-w-0 flex-1">
        <span className="block truncate font-medium text-foreground">{entry.name}</span>
        <span className="block truncate text-xs text-muted-foreground">{entry.business}</span>
      </div>

      {/* Weeks progress */}
      <div className="hidden w-[64px] shrink-0 sm:block">
        <p className="mb-1 text-right text-[10px] tabular-nums text-muted-foreground">
          {entry.weeksCompleted}/{entry.totalWeeks}
        </p>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.8, delay: 1 + index * 0.08, ease: "easeOut" }}
            className="h-full rounded-full bg-gradient-gold"
          />
        </div>
      </div>

      {/* Points */}
      <span
        className={cn(
          "flex w-[78px] shrink-0 items-center justify-end gap-1 tabular-nums",
          pointsClass(entry.points),
        )}
      >
        <span className="lb-coin text-xs">🪙</span>
        {entry.points}
      </span>

      {/* Stage badge */}
      <span
        className={cn(
          "hidden shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium sm:inline-flex",
          stage.badge,
        )}
      >
        <Icon className="h-4 w-4" />
        {entry.stage}
      </span>
    </motion.div>
  );
}
