import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Target,
  Banknote,
  Users,
  TrendingUp,
  Trophy,
  Bot,
  CalendarClock,
  Megaphone,
  CheckCircle2,
  Circle,
  Star,
  ArrowRight,
  Flag,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { usePrimaryGoal } from "@/components/participant/vision-data";
import { PageHeader } from "@/components/vkm/page-header";
import { KpiTile } from "@/components/vkm/kpi-tile";
import { SectionCard } from "@/components/vkm/section-card";
import { AnimatedCounter } from "@/components/vkm/animated-counter";
import { IconBadge } from "@/components/vkm/icon-badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  VKM_PROGRAM,
  VKM_WEEKS,
  VKM_MILESTONES,
  weekByNumber,
  isOfflineWeek,
  stageFor,
} from "@/lib/vkm/program";
import { useParticipantStats } from "@/components/participant/participant-stats";
import { useTodayActions } from "@/components/participant/focus-data";
import { useLeaderboard } from "@/hooks/use-leaderboard";
import { useBusinessData, momDelta } from "@/components/business/business-data";

export const Route = createFileRoute("/_authenticated/participant/")({
  component: ParticipantDashboard,
});

const inrShort = (n: number | null | undefined) => {
  if (n == null) return "—";
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(1)}Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(1)}L`;
  if (n >= 1e3) return `₹${(n / 1e3).toFixed(1)}K`;
  return `₹${n}`;
};
const momLabel = (curr: number | null | undefined, prev: number | null | undefined) => {
  const d = momDelta(curr ?? null, prev ?? null);
  return d == null ? undefined : `${d > 0 ? "+" : ""}${d}% MoM`;
};
const momTrend = (curr: number | null | undefined, prev: number | null | undefined): "up" | "down" | "flat" => {
  const d = momDelta(curr ?? null, prev ?? null);
  return d == null || d === 0 ? "flat" : d > 0 ? "up" : "down";
};

function ParticipantDashboard() {
  const { profile } = useAuth();
  const name = profile?.full_name?.split(" ")[0] ?? "there";
  // Canonical numbers — one source, shared with Program Progress & Habits.
  const stats = useParticipantStats();
  // Live data — real today's actions, real cohort leaderboard, real numbers.
  const { tasks: focus } = useTodayActions();
  const { entries: lbEntries } = useLeaderboard();
  const biz = useBusinessData();
  const latest = biz.latest;
  const prev = biz.previous;
  const series = (key: "revenue_inr" | "leads" | "closing_rate_pct") =>
    biz.snapshots.map((s) => Number(s[key] ?? 0));

  const week = Math.min(stats.totalWeeks, Math.max(1, stats.currentWeek));
  const w = weekByNumber(week) ?? VKM_WEEKS[0];
  const pct = Math.round(((week - 1) / stats.totalWeeks) * 100);
  const stage = stats.points != null ? stageFor(stats.points).name : "—";
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const focusDone = focus.filter((f) => f.done).length;
  const focusPct = focus.length ? Math.round((focusDone / focus.length) * 100) : 0;

  // Top of the cohort leaderboard, always including the current user.
  const me = lbEntries.find((e) => e.isCurrentUser);
  const top5 = lbEntries.slice(0, 5);
  const lbShow = me && !top5.some((e) => e.isCurrentUser) ? [...top5, me] : top5;
  const leaderboard = lbShow.map((e) => ({
    n: e.isCurrentUser ? "You" : e.name,
    pts: e.points,
    you: e.isCurrentUser,
    rank: e.rank,
  }));

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="mx-auto w-full max-w-[1280px]"
    >
      <PageHeader
        eyebrow={`${VKM_PROGRAM.title} · Batch 16`}
        title={`${greeting}, ${name}.`}
        description={`Your Week ${week} priority is ${w.topic}. ${VKM_PROGRAM.tagline}.`}
        actions={
          <Button variant="outline" className="rounded-full" asChild>
            <Link to="/participant/calendar">View calendar</Link>
          </Button>
        }
      />

      <StickyWeekBar week={week} pct={pct} topic={w.topic} />

      <GoalBanner />

      {/* Progress hero */}
      <section className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 overflow-hidden rounded-3xl bg-gradient-navy p-7 text-primary-foreground shadow-vkm-float">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary-foreground/70">
                Program progress
              </p>
              <p className="mt-3 text-5xl font-semibold tracking-tight">
                Week {week}{" "}
                <span className="text-primary-foreground/50 text-2xl">/ {stats.totalWeeks}</span>
              </p>
              <p className="mt-2 text-sm text-primary-foreground/70">
                {w.phase} phase · {w.topic} ({w.mode})
              </p>
            </div>
            <div className="relative">
              <svg viewBox="0 0 120 120" className="h-28 w-28 -rotate-90">
                <circle
                  cx="60"
                  cy="60"
                  r="50"
                  fill="none"
                  stroke="oklch(1 0 0 / 0.15)"
                  strokeWidth="10"
                />
                <motion.circle
                  cx="60"
                  cy="60"
                  r="50"
                  fill="none"
                  stroke="oklch(0.78 0.13 85)"
                  strokeWidth="10"
                  strokeLinecap="round"
                  initial={{ strokeDasharray: `0 ${2 * Math.PI * 50}` }}
                  animate={{
                    strokeDasharray: `${(pct / 100) * 2 * Math.PI * 50} ${2 * Math.PI * 50}`,
                  }}
                  transition={{ duration: 1.1, ease: "easeOut" }}
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-xl font-semibold">
                <AnimatedCounter value={`${pct}%`} />
              </span>
            </div>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {[
              {
                l: "Total points",
                v: stats.points == null ? "—" : String(stats.points),
                to: "/participant/leaderboard" as const,
              },
              { l: "Current stage", v: stage, to: "/participant/progress" as const },
              {
                l: "Milestones",
                v: `${stats.milestones.length} / 3`,
                to: "/participant/milestones" as const,
              },
            ].map((x) => (
              <Link
                key={x.l}
                to={x.to}
                className="app-press group/tile relative rounded-2xl bg-white/5 p-4 backdrop-blur transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
              >
                <p className="text-[11px] uppercase tracking-wider text-primary-foreground/60">
                  {x.l}
                </p>
                <AnimatedCounter value={x.v} className="mt-1.5 block text-xl font-semibold" />
                <ArrowRight className="absolute right-3 top-3 h-3.5 w-3.5 text-primary-foreground/40 opacity-0 transition-opacity group-hover/tile:opacity-100" />
              </Link>
            ))}
          </div>
        </div>

        {/* This Week task card — fills the hero row height, primary CTA pinned bottom */}
        <SectionCard
          className="flex flex-col"
          bodyClassName="flex flex-1 flex-col"
          title={`Week ${week} · ${w.topic}`}
          subtitle={`${w.mode}${isOfflineWeek(week) ? " — coach visits in person" : ""}`}
        >
          <p className="text-xs uppercase tracking-wider text-gold mb-1">WHY</p>
          <p className="text-sm text-foreground">{w.why}</p>
          <p className="text-xs uppercase tracking-wider text-gold mt-3 mb-1">TASK</p>
          <p className="text-sm text-foreground">{w.task}</p>
          <p className="text-xs uppercase tracking-wider text-gold mt-3 mb-1">PROOF</p>
          <p className="text-sm text-foreground">{w.proof}</p>
          <Button
            asChild
            className="mt-auto w-full rounded-xl bg-gradient-navy text-primary-foreground hover:opacity-90 sm:mt-6"
          >
            <Link to="/participant/proof">Submit proof (+40 pts)</Link>
          </Button>
        </SectionCard>
      </section>

      {/* Today's Focus + KPI row */}
      <section className="mt-4 grid gap-4 lg:grid-cols-3">
        <SectionCard
          title="Today's Focus"
          subtitle={`${focus.length} actions · ${focusDone} done`}
          className="lg:col-span-1"
        >
          <ul className="space-y-2.5">
            {focus.length === 0 ? (
              <li className="rounded-xl bg-muted/40 px-3 py-4 text-center text-sm text-muted-foreground">
                No actions for today yet — open Today's Focus to plan them.
              </li>
            ) : (
              focus.map((f) => (
                <li
                  key={f.id}
                  className="flex items-start gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-muted/60"
                >
                  {f.done ? (
                    <CheckCircle2 className="mt-0.5 h-5 w-5 text-[oklch(0.55_0.14_160)]" />
                  ) : (
                    <Circle className="mt-0.5 h-5 w-5 text-muted-foreground" />
                  )}
                  <span
                    className={
                      f.done
                        ? "text-sm text-muted-foreground line-through"
                        : "text-sm text-foreground"
                    }
                  >
                    {f.text}
                  </span>
                </li>
              ))
            )}
          </ul>
          <div className="mt-4 flex items-center gap-3">
            <Progress value={focusPct} className="h-1.5 flex-1" />
            <span className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
              {focusPct}%
            </span>
          </div>
        </SectionCard>

        <div className="lg:col-span-2 grid gap-4 sm:grid-cols-2">
          <KpiTile
            label="Revenue (mo)"
            value={inrShort(latest?.revenue_inr)}
            delta={momLabel(latest?.revenue_inr, prev?.revenue_inr)}
            trend={momTrend(latest?.revenue_inr, prev?.revenue_inr)}
            icon={Banknote}
            accent="gold"
            spark={series("revenue_inr")}
            detail={{
              howTo:
                "Update this month's numbers in My Business — your coach reviews them and they feed your trends.",
            }}
          />
          <KpiTile
            label="Leads (mo)"
            value={latest?.leads != null ? String(latest.leads) : "—"}
            delta={momLabel(latest?.leads, prev?.leads)}
            trend={momTrend(latest?.leads, prev?.leads)}
            icon={Users}
            accent="navy"
            spark={series("leads")}
            detail={{
              howTo:
                "Log leads in the Lead Tracker and run your 3-day follow-up cadence to keep climbing.",
            }}
          />
          <KpiTile
            label="Closing rate"
            value={latest?.closing_rate_pct != null ? `${latest.closing_rate_pct}%` : "—"}
            delta={momLabel(latest?.closing_rate_pct, prev?.closing_rate_pct)}
            trend={momTrend(latest?.closing_rate_pct, prev?.closing_rate_pct)}
            icon={TrendingUp}
            accent="success"
            spark={series("closing_rate_pct")}
            detail={{
              howTo:
                "Tighten objection handling (Week 13) — a higher close rate earns KPI points every month.",
            }}
          />
          <KpiTile
            label="Habit streak"
            value={`${stats.streak}d`}
            delta={`${stats.todayDone} done today`}
            trend={stats.streak > 0 ? "up" : "flat"}
            icon={Target}
            accent="success"
            detail={{
              howTo:
                "Tick every daily habit with proof to extend your streak and bank points each day.",
            }}
          />
        </div>
      </section>

      {/* Lower row */}
      <section className="mt-4 grid gap-4 lg:grid-cols-3">
        <SectionCard
          title="AI Business Advisor"
          subtitle="Personal advisor trained on your business"
          action={
            <Button size="sm" variant="ghost" className="rounded-full" asChild>
              <Link to="/participant/advisor">Open</Link>
            </Button>
          }
        >
          <div className="rounded-2xl bg-secondary p-4">
            <div className="flex items-start gap-3">
              <IconBadge icon={Bot} accent="gold" />
              <div>
                <p className="text-sm font-medium text-foreground">Today's nudge</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  You're on Week {week} — {w.topic}. Ask your AI Advisor to pressure-test this
                  week's task ({w.task}) and turn it into 3 concrete actions for your business.
                </p>
              </div>
            </div>
          </div>
          <Button
            asChild
            className="mt-3 w-full rounded-xl bg-gradient-gold text-navy hover:opacity-90"
          >
            <Link to="/participant/advisor">
              <Bot className="h-4 w-4" /> Ask the AI Advisor
            </Link>
          </Button>
        </SectionCard>

        <SectionCard
          title="Batch 16 Leaderboard"
          subtitle="Points + stage"
          action={
            <Button size="sm" variant="ghost" className="rounded-full" asChild>
              <Link to="/participant/leaderboard">All</Link>
            </Button>
          }
        >
          <ol className="flex snap-x gap-2 overflow-x-auto pb-1 sm:flex-col sm:gap-2 sm:overflow-visible sm:pb-0">
            {leaderboard.length === 0 && (
              <li className="rounded-xl bg-muted/40 px-3 py-4 text-center text-sm text-muted-foreground">
                Leaderboard fills in as the cohort earns points.
              </li>
            )}
            {leaderboard.map((r) => (
              <li
                key={r.you ? "you" : `${r.n}-${r.rank}`}
                className={cn(
                  "flex min-w-[210px] shrink-0 snap-start items-center justify-between rounded-xl px-3 py-2.5 transition-colors sm:min-w-0 sm:shrink",
                  r.you
                    ? "bg-gradient-gold text-navy shadow-vkm ring-2 ring-gold/60"
                    : "border border-border bg-card sm:border-transparent sm:hover:bg-muted/60",
                )}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      "inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold",
                      r.you
                        ? "bg-navy text-primary-foreground"
                        : r.rank <= 3
                          ? "bg-navy text-primary-foreground"
                          : "border border-border bg-card",
                    )}
                  >
                    {r.rank}
                  </span>
                  <span className="text-sm font-medium">{r.n}</span>
                  {r.you && (
                    <span className="rounded-full bg-navy px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-primary-foreground">
                      You
                    </span>
                  )}
                </div>
                <span className="text-sm font-semibold tabular-nums">{r.pts} pts</span>
              </li>
            ))}
          </ol>
        </SectionCard>

        <SectionCard title="Your 3 Milestones" subtitle="Goal Setter → Champion">
          <ul className="flex snap-x gap-2.5 overflow-x-auto pb-1 sm:flex-col sm:gap-2.5 sm:overflow-visible sm:pb-0">
            {VKM_MILESTONES.map((m) => {
              const unlocked = stats.milestones.includes(m.code);
              const weeksToGo = m.unlockWeek - week;
              const hint = unlocked
                ? "Achieved"
                : weeksToGo > 0
                  ? `${weeksToGo} week${weeksToGo === 1 ? "" : "s"} to go`
                  : "Unlock in progress";
              return (
                <li
                  key={m.code}
                  className="flex min-w-[230px] shrink-0 snap-start items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5 sm:min-w-0 sm:shrink"
                >
                  <IconBadge icon={Star} accent={unlocked ? "gold" : "muted"} />
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        "truncate text-sm font-medium",
                        !unlocked && "text-muted-foreground",
                      )}
                    >
                      {m.name}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{hint}</p>
                  </div>
                  <Badge variant={unlocked ? "default" : "outline"} className="rounded-full">
                    {unlocked ? "Unlocked" : "Locked"}
                  </Badge>
                </li>
              );
            })}
          </ul>
        </SectionCard>
      </section>

      {/* VK class announcement */}
      <section className="mt-4">
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-vkm">
          <IconBadge icon={Megaphone} accent="gold" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">
              Tuesday class · Week {week + 1}: {VKM_WEEKS[week]?.topic} — "{VKM_WEEKS[week]?.why}"
            </p>
            <p className="text-xs text-muted-foreground">
              From Venu Kalyan · live every Tuesday · whole cohort
            </p>
          </div>
          <Button size="sm" variant="outline" className="rounded-full" asChild>
            <Link to="/participant/meetings">
              <CalendarClock className="h-4 w-4" /> Add to calendar
            </Link>
          </Button>
        </div>
      </section>
    </motion.div>
  );
}

// #23 — condensed sticky header (mobile): appears on scroll so the week context
// and primary action stay reachable once the hero scrolls away.
// The participant's #1 goal (set on the Vision page) greets them here at login,
// with a live progress rollup from this year's vision goals.
function GoalBanner() {
  const { goal, progress, goalCount, loading } = usePrimaryGoal();
  if (loading) return null;

  return (
    <Link
      to="/participant/vision"
      className="group my-4 flex items-center gap-3 rounded-2xl border border-gold/40 bg-gradient-to-r from-gold/[0.14] to-transparent p-4 transition-colors hover:border-gold/60"
    >
      <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-gold text-navy shadow-vkm">
        <Flag className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        {goal ? (
          <>
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gold">
                Your #1 goal this year
              </p>
              {progress != null && (
                <span className="shrink-0 text-[11px] font-semibold tabular-nums text-foreground">
                  {progress}%
                </span>
              )}
            </div>
            <p className="truncate text-base font-bold text-foreground">{goal}</p>
            {progress != null ? (
              <div className="mt-1.5 flex items-center gap-2">
                <div className="h-1.5 max-w-[260px] flex-1 overflow-hidden rounded-full bg-gold/20">
                  <motion.div
                    className="h-full rounded-full bg-gradient-gold"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.9, ease: "easeOut" }}
                  />
                </div>
                <span className="shrink-0 text-[11px] text-muted-foreground">
                  {goalCount} {goalCount === 1 ? "goal" : "goals"}
                </span>
              </div>
            ) : (
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Add this year’s goals to track progress →
              </p>
            )}
          </>
        ) : (
          <>
            <p className="text-sm font-semibold text-foreground">Set your #1 goal for this year</p>
            <p className="text-xs text-muted-foreground">
              A clear headline to focus every week on — it’ll show up here.
            </p>
          </>
        )}
      </div>
      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
    </Link>
  );
}

function StickyWeekBar({ week, pct, topic }: { week: number; pct: number; topic: string }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 240);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: -56, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -56, opacity: 0 }}
          transition={{ type: "spring", stiffness: 380, damping: 32 }}
          className="fixed inset-x-0 top-[calc(4rem+env(safe-area-inset-top))] z-30 md:hidden"
        >
          <div className="mx-3 mt-2 flex items-center gap-3 rounded-2xl border border-border glass px-3 py-2 shadow-vkm-float">
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-foreground">
                Week {week} · {pct}% · <span className="text-muted-foreground">{topic}</span>
              </p>
              <Progress value={pct} className="mt-1 h-1" />
            </div>
            <Button
              size="sm"
              asChild
              className="h-9 shrink-0 rounded-full bg-gradient-navy text-primary-foreground"
            >
              <Link to="/participant/proof">Submit</Link>
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
