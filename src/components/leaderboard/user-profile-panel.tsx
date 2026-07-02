import { motion } from "framer-motion";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { initialsOf } from "@/hooks/use-leaderboard";
import type { LeaderboardEntry } from "@/types/leaderboard";


// A few scattered decorative stars over the navy hero.
const STARS = [
  { top: "14%", left: "18%" },
  { top: "22%", left: "78%" },
  { top: "40%", left: "30%" },
  { top: "12%", left: "55%" },
  { top: "50%", left: "70%" },
  { top: "30%", left: "88%" },
];

export function UserProfilePanel({ user }: { user: LeaderboardEntry | undefined }) {
  // No ranked user yet (empty cohort / still loading) — render nothing rather
  // than dereferencing an undefined entry.
  if (!user) return null;
  return (
    <motion.div
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, delay: 0.4 }}
      className="relative overflow-hidden rounded-2xl bg-gradient-navy p-5 text-center text-primary-foreground shadow-vkm-float"
    >
      {STARS.map((s, i) => (
        <span
          key={i}
          className="lb-star"
          style={{ top: s.top, left: s.left, ["--lb-dur" as string]: `${2 + (i % 3)}s` }}
        />
      ))}

      <div className="relative">
        {/* Avatar with XP badge */}
        <div className="relative mx-auto h-16 w-16">
          {user.avatar ? (
            <img
              src={user.avatar}
              alt={user.name}
              className="h-16 w-16 rounded-full object-cover ring-2 ring-white/40"
            />
          ) : (
            <span className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-gradient-gold text-lg font-bold text-navy ring-2 ring-white/40">
              {initialsOf(user.name)}
            </span>
          )}
          <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold text-gold ring-1 ring-white/15">
            <span className="lb-coin">🪙</span> {user.points} XP
          </span>
        </div>

        <p className="mt-4 text-lg font-bold">{user.name}</p>
        <p className="text-xs text-primary-foreground/60">{user.business}</p>

        {/* XP summary row */}
        <div className="mt-4 flex items-center justify-between gap-2 rounded-2xl bg-white/5 p-3">
          <span className="flex items-center gap-1.5 text-xl font-bold text-gold">
            <span className="lb-coin">🪙</span> {user.points} XP
          </span>
          <Link
            to="/participant/achievements"
            className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-navy transition-transform hover:scale-105"
          >
            View Points History <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </motion.div>
  );
}
