import { motion } from "framer-motion";
import { LbAvatar } from "@/components/leaderboard/lb-avatar";
import type { LeaderboardEntry } from "@/types/leaderboard";

export function PinnedUserRow({ entry }: { entry: LeaderboardEntry }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.45, delay: 0.55, ease: [0.22, 1, 0.36, 1] }}
      className="lb-glow-pulse flex items-center gap-3 rounded-[50px] border-2 border-gold/60 bg-secondary px-3 py-2.5 sm:gap-4 sm:px-4"
    >
      {/* Rank badge */}
      <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-navy text-base font-bold text-primary-foreground shadow-vkm">
        #{entry.rank}
      </span>

      {/* Avatar + name */}
      <LbAvatar
        name={entry.name}
        avatar={entry.avatar}
        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-navy text-xs font-semibold text-primary-foreground ring-2 ring-gold/40"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-semibold text-foreground">{entry.name}</span>
          <span className="rounded-full bg-gradient-gold px-1.5 py-0.5 text-[10px] font-bold text-navy">
            You
          </span>
        </div>
        <span className="truncate text-xs text-muted-foreground">{entry.business}</span>
      </div>

      {/* XP */}
      <span className="flex shrink-0 items-center gap-1.5 font-bold text-[oklch(0.5_0.11_80)]">
        <span className="lb-coin">🪙</span>
        {entry.points} XP
      </span>
    </motion.div>
  );
}
