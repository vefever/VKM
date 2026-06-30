import { motion } from "framer-motion";
import { initialsOf } from "@/hooks/use-leaderboard";
import type { LeaderboardEntry } from "@/types/leaderboard";

type Place = 1 | 2 | 3;

const MEDAL: Record<
  Place,
  {
    gradient: string;
    medal: string;
    ring: string;
    nameText: string;
    xpText: string;
    shimmer: string;
  }
> = {
  1: {
    gradient: "linear-gradient(90deg, #C8A84B, #F5A623, #C8A84B)",
    medal: "🥇",
    ring: "ring-[#fff3cf]",
    nameText: "text-[#3a2400]",
    xpText: "text-[#3a2400]",
    shimmer: "3s",
  },
  2: {
    gradient: "linear-gradient(90deg, #8a9bb0, #b0bec5, #8a9bb0)",
    medal: "🥈",
    ring: "ring-white/70",
    nameText: "text-[#1f2937]",
    xpText: "text-[#1f2937]",
    shimmer: "4s",
  },
  3: {
    gradient: "linear-gradient(90deg, #a0522d, #cd7f32, #a0522d)",
    medal: "🥉",
    ring: "ring-[#ffd9b3]",
    nameText: "text-white",
    xpText: "text-white",
    shimmer: "5s",
  },
};

export function MedalRow({ entry, index }: { entry: LeaderboardEntry; index: number }) {
  const place = entry.rank as Place;
  const cfg = MEDAL[place] ?? MEDAL[3];

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay: 0.9 + index * 0.1, ease: [0.22, 1, 0.36, 1] }}
      className="lb-shimmer flex h-16 items-center gap-3 rounded-[32px] px-3 sm:gap-4 sm:px-4"
      style={{ background: cfg.gradient, ["--lb-shimmer-dur" as string]: cfg.shimmer }}
    >
      {/* Medal + rank */}
      <span className="flex shrink-0 items-center gap-1.5">
        <span className="text-2xl drop-shadow">{cfg.medal}</span>
        <span className={`text-sm font-bold ${cfg.nameText}`}>#{entry.rank}</span>
      </span>

      {/* Avatar */}
      <span
        className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-black/20 text-xs font-bold text-white ring-2 ${cfg.ring}`}
      >
        {initialsOf(entry.name)}
      </span>

      {/* Name + business */}
      <div className="min-w-0 flex-1">
        <span className={`block truncate font-bold ${cfg.nameText}`}>{entry.name}</span>
        <span className={`block truncate text-xs ${cfg.nameText} opacity-70`}>
          {entry.business}
        </span>
      </div>

      {/* XP */}
      <span className={`flex shrink-0 items-center gap-1.5 font-bold ${cfg.xpText}`}>
        <span className="lb-coin">🪙</span>
        {entry.points} XP
      </span>
    </motion.div>
  );
}
