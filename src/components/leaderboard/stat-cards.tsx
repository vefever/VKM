import { motion } from "framer-motion";
import { Trophy, Star, Users, Crown, type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useCountUp } from "@/hooks/use-count-up";
import type { LeaderboardStats } from "@/types/leaderboard";

type Accent = "gold" | "navy" | "success" | "danger";

type CardDef = {
  label: string;
  value: number;
  prefix?: string;
  coin?: boolean;
  Icon: LucideIcon;
  accent: Accent;
};

const ACCENT: Record<Accent, { bar: string; chip: string }> = {
  gold: { bar: "bg-gradient-gold", chip: "bg-gradient-gold text-navy" },
  navy: { bar: "bg-gradient-navy", chip: "bg-gradient-navy text-primary-foreground" },
  success: { bar: "bg-[oklch(0.71_0.14_160)]", chip: "bg-[oklch(0.71_0.14_160)] text-white" },
  danger: { bar: "bg-destructive", chip: "bg-destructive text-destructive-foreground" },
};

function StatCard({ def, index }: { def: CardDef; index: number }) {
  const count = useCountUp(def.value);
  const { Icon } = def;
  const accent = ACCENT[def.accent];
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.45, delay: 0.25 + index * 0.1, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -4 }}
    >
      <Card className="relative h-full overflow-hidden rounded-2xl p-5 shadow-vkm">
        <span
          aria-hidden
          className={cn("absolute inset-x-0 top-0 h-[3px] opacity-80", accent.bar)}
        />
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {def.label}
            </p>
            <p className="mt-2 flex items-center gap-1.5 text-3xl font-bold tracking-tight text-foreground tabular-nums md:text-4xl">
              {def.prefix ?? ""}
              {count}
              {def.coin && <span className="lb-coin text-xl">🪙</span>}
            </p>
          </div>
          <span
            className={cn(
              "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl shadow-vkm",
              accent.chip,
            )}
          >
            <Icon className="h-6 w-6" />
          </span>
        </div>
      </Card>
    </motion.div>
  );
}

export function StatCards({ stats }: { stats: LeaderboardStats }) {
  const cards: CardDef[] = [
    { label: "Your rank", value: stats.yourRank, prefix: "#", Icon: Trophy, accent: "gold" },
    { label: "Your points", value: stats.yourPoints, coin: true, Icon: Star, accent: "navy" },
    { label: "Cohort avg", value: stats.cohortAvg, Icon: Users, accent: "success" },
    { label: "Top score", value: stats.topScore, Icon: Crown, accent: "danger" },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      {cards.map((c, i) => (
        <StatCard key={c.label} def={c} index={i} />
      ))}
    </div>
  );
}
