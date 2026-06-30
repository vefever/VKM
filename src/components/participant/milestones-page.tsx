import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Trophy,
  Star,
  Gift,
  Medal,
  CheckCircle2,
  Lock,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { PageHeader } from "@/components/vkm/page-header";
import { SectionCard } from "@/components/vkm/section-card";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { VKM_MILESTONES, VKM_STAGES, stageFor } from "@/lib/vkm/program";
import { useMyProofs } from "@/components/coach/coach-data";

type TabId = "milestones" | "achievements" | "rewards";
const TABS: { id: TabId; label: string; icon: LucideIcon }[] = [
  { id: "milestones", label: "Milestones", icon: Star },
  { id: "achievements", label: "Achievements", icon: Medal },
  { id: "rewards", label: "Rewards", icon: Gift },
];

export function MilestonesPage() {
  const [tab, setTab] = useState<TabId>("milestones");
  const { weeks } = useMyProofs();
  const { user } = useAuth();

  const [points, setPoints] = useState(0);
  useEffect(() => {
    if (!user) return;
    let active = true;
    void supabase
      .from("points_ledger")
      .select("points")
      .eq("user_id", user.id)
      .then(({ data }) => {
        if (active) setPoints((data ?? []).reduce((n, r) => n + (r.points ?? 0), 0));
      });
    return () => {
      active = false;
    };
  }, [user]);

  const weeksDone = weeks.filter((w) => w.proof_status === "approved").length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-5"
    >
      <PageHeader
        eyebrow="Recognition"
        title="Milestones & Rewards"
        description="Three escalating milestones, your growth stage, and the reward kits you unlock."
        icon={Trophy}
      />

      {/* Tabs */}
      <div className="grid grid-cols-3 gap-1.5 rounded-2xl border border-border bg-card p-1.5 shadow-vkm">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "flex flex-col items-center justify-center gap-1 rounded-xl px-2 py-2.5 text-center text-[11px] font-medium transition-all sm:flex-row sm:gap-2 sm:py-2 sm:text-sm",
                active
                  ? "bg-gradient-navy text-primary-foreground shadow-vkm"
                  : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="leading-tight">{t.label}</span>
            </button>
          );
        })}
      </div>

      {tab === "milestones" && <MilestonesTab weeksDone={weeksDone} />}
      {tab === "achievements" && <AchievementsTab points={points} weeksDone={weeksDone} />}
      {tab === "rewards" && <RewardsTab weeksDone={weeksDone} />}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Milestones
// ---------------------------------------------------------------------------
function MilestonesTab({ weeksDone }: { weeksDone: number }) {
  const unlockedCount = VKM_MILESTONES.filter((m) => weeksDone >= m.unlockWeek).length;
  return (
    <SectionCard
      title="3 Milestones"
      subtitle={`${unlockedCount} of ${VKM_MILESTONES.length} unlocked — each handed over in front of your team`}
    >
      <div className="space-y-2.5">
        {VKM_MILESTONES.map((m, i) => {
          const unlocked = weeksDone >= m.unlockWeek;
          return (
            <div
              key={m.code}
              className={cn(
                "rounded-xl border p-3",
                unlocked ? "border-gold/40 bg-gold/[0.06]" : "border-border bg-card",
              )}
            >
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                    unlocked ? "bg-gradient-gold text-navy" : "bg-muted text-muted-foreground",
                  )}
                >
                  {unlocked ? <Star className="h-5 w-5" /> : <Lock className="h-4 w-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">
                    Milestone {i + 1}: {m.name}
                  </p>
                  <p className="text-xs text-muted-foreground">Unlocks Week {m.unlockWeek}</p>
                </div>
                <StatusPill unlocked={unlocked} unlockWeek={m.unlockWeek} />
              </div>

              {/* headline reward */}
              <div className="mt-2.5 rounded-lg bg-gold/10 px-3 py-2">
                <p className="flex items-start gap-1.5 text-sm font-semibold text-foreground">
                  <Gift className="mt-0.5 h-4 w-4 shrink-0 text-[oklch(0.6_0.13_85)]" />
                  {m.reward}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{m.description}</p>
              </div>

              <ul className="mt-2 space-y-1">
                {m.items.map((it) => (
                  <li key={it} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[oklch(0.6_0.13_85)]" />
                    {it}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// Achievements — growth stages
// ---------------------------------------------------------------------------
function AchievementsTab({ points, weeksDone }: { points: number; weeksDone: number }) {
  const current = stageFor(points);
  const next = VKM_STAGES.find((s) => s.min > current.min);
  const toNext = next ? Math.max(0, next.min - points) : 0;
  const unlockedMilestones = VKM_MILESTONES.filter((m) => weeksDone >= m.unlockWeek).length;

  return (
    <div className="space-y-4">
      {/* current stage banner */}
      <div className="overflow-hidden rounded-3xl bg-gradient-navy p-5 text-primary-foreground shadow-vkm-float">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-white/60">
          Current stage
        </p>
        <div className="mt-0.5 flex items-end justify-between gap-3">
          <p className="text-2xl font-bold">{current.name}</p>
          <p className="inline-flex items-center gap-1 text-lg font-bold tabular-nums">
            <Sparkles className="h-4 w-4 text-gold" /> {points} pts
          </p>
        </div>
        <p className="mt-1 text-xs text-white/70">
          {next
            ? `${toNext} pts to ${next.name}`
            : "Top stage reached — you're a Growth Champion 🏆"}
        </p>
      </div>

      <SectionCard title="Growth stages" subtitle="Earn points to climb — proofs, habits & classes">
        <div className="space-y-2">
          {VKM_STAGES.map((s) => {
            const reached = points >= s.min;
            const isCurrent = s.name === current.name;
            return (
              <div
                key={s.name}
                className={cn(
                  "flex items-center gap-3 rounded-xl border p-3",
                  isCurrent
                    ? "border-gold/50 bg-gold/[0.06]"
                    : reached
                      ? "border-border bg-card"
                      : "border-border bg-card opacity-70",
                )}
              >
                <span
                  className={cn(
                    "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                    reached ? "bg-gradient-gold text-navy" : "bg-muted text-muted-foreground",
                  )}
                >
                  {reached ? <CheckCircle2 className="h-5 w-5" /> : <Lock className="h-4 w-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">{s.name}</p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {s.min}
                    {s.max == null ? "+" : `–${s.max}`} pts
                  </p>
                </div>
                {isCurrent && (
                  <span className="rounded-full bg-gradient-navy px-2.5 py-0.5 text-[10px] font-medium text-primary-foreground">
                    You're here
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </SectionCard>

      <SectionCard>
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{unlockedMilestones}</span> of{" "}
          {VKM_MILESTONES.length} milestones unlocked ·{" "}
          <span className="font-semibold text-foreground">{weeksDone}</span> weeks approved
        </p>
      </SectionCard>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Rewards — the reward kits
// ---------------------------------------------------------------------------
function RewardsTab({ weeksDone }: { weeksDone: number }) {
  return (
    <SectionCard
      title="Your rewards"
      subtitle="Exclusive experiences with Venu Kalyan you unlock as you progress"
    >
      <div className="space-y-2.5">
        {VKM_MILESTONES.map((m) => {
          const unlocked = weeksDone >= m.unlockWeek;
          return (
            <div
              key={m.code}
              className={cn(
                "rounded-xl border p-3",
                unlocked ? "border-gold/40 bg-gold/[0.06]" : "border-border bg-card",
              )}
            >
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                    unlocked ? "bg-gradient-gold text-navy" : "bg-muted text-muted-foreground",
                  )}
                >
                  <Gift className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">{m.reward}</p>
                  <p className="text-xs text-muted-foreground">
                    {m.name} · unlocks Week {m.unlockWeek}
                  </p>
                </div>
                <StatusPill unlocked={unlocked} unlockWeek={m.unlockWeek} />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{m.description}</p>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {m.items.map((it) => (
                  <li
                    key={it}
                    className="rounded-full bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground"
                  >
                    {it}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[11px] text-muted-foreground">{m.handover}</p>
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}

function StatusPill({ unlocked, unlockWeek }: { unlocked: boolean; unlockWeek: number }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-medium",
        unlocked
          ? "bg-[oklch(0.93_0.06_160)] text-[oklch(0.35_0.12_160)]"
          : "bg-secondary text-muted-foreground",
      )}
    >
      {unlocked ? (
        <>
          <CheckCircle2 className="h-3 w-3" /> Unlocked
        </>
      ) : (
        <>
          <Lock className="h-3 w-3" /> Week {unlockWeek}
        </>
      )}
    </span>
  );
}
