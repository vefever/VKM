import { motion } from "framer-motion";
import { Trophy } from "lucide-react";
import "../../styles/leaderboard-animations.css";
import { useLeaderboard } from "@/hooks/use-leaderboard";
import { StatCards } from "@/components/leaderboard/stat-cards";
import { RankingsCard } from "@/components/leaderboard/rankings-card";
import { UserProfilePanel } from "@/components/leaderboard/user-profile-panel";
import { ActivityFeed } from "@/components/leaderboard/activity-feed";
import { AiInsightCard } from "@/components/leaderboard/ai-insight-card";
import { PercentileBanner } from "@/components/leaderboard/percentile-banner";
import { SectionCard } from "@/components/vkm/section-card";
import { VKM_POINT_RULES, VKM_POINTS } from "@/lib/vkm/program";

function LeaderboardHeader({ xp }: { xp: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="space-y-4"
    >
      <div className="flex items-start gap-3 md:gap-4">
        <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-navy text-primary-foreground shadow-vkm-float md:h-14 md:w-14">
          <Trophy className="h-5 w-5 md:h-6 md:w-6" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gold md:text-xs">
            Participant
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold leading-tight tracking-tight text-foreground md:text-[34px]">
              Leaderboard
            </h1>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/40 bg-gold/15 px-3 py-1 text-sm font-bold text-[oklch(0.5_0.11_80)]">
              <span className="lb-coin">🪙</span> {xp} XP
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Batch 16 leaderboard — points + stage. Updated nightly.
          </p>
        </div>
      </div>

      {/* Gold shimmer line */}
      <div className="lb-shimmer h-0.5 w-full overflow-hidden rounded-full bg-gradient-gold opacity-90" />
    </motion.div>
  );
}

export function LeaderboardPage() {
  const { entries, activity, stats, loading } = useLeaderboard();
  const currentUser = entries.find((e) => e.isCurrentUser) ?? entries[0];
  const total = entries.length;
  const percentile = total ? Math.round(((total - stats.yourRank) / total) * 100) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6"
    >
      <LeaderboardHeader xp={stats.yourPoints} />

      <StatCards stats={stats} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <RankingsCard entries={entries} />

        <div className="space-y-6">
          {currentUser ? (
            <UserProfilePanel user={currentUser} />
          ) : (
            <SectionCard title="Your standing">
              <p className="py-6 text-center text-sm text-muted-foreground">
                {loading
                  ? "Loading the leaderboard…"
                  : "No leaderboard data yet — points appear here once the cohort starts earning them."}
              </p>
            </SectionCard>
          )}
          <PointsSystemCard />
          <ActivityFeed items={activity} />
          <AiInsightCard />
        </div>
      </div>

      <PercentileBanner percentile={percentile} />
    </motion.div>
  );
}

function PointsSystemCard() {
  return (
    <SectionCard
      title="How points work"
      subtitle={`Up to ${VKM_POINTS.programPointsTotal.toLocaleString("en-IN")} pts across ${VKM_POINTS.scoringWeeks} scoring weeks, plus daily habits`}
    >
      <ul className="space-y-2">
        {VKM_POINT_RULES.map((r) => (
          <li
            key={r.action}
            className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2"
          >
            <span className="text-xs text-muted-foreground">{r.action}</span>
            <span className="shrink-0 rounded-full bg-gold/15 px-2 py-0.5 text-xs font-bold text-[oklch(0.5_0.11_80)]">
              {r.points}
            </span>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}
