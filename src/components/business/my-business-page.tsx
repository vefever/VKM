import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "@tanstack/react-router";
import { formatDistanceToNowStrict } from "date-fns";
import {
  Briefcase,
  Banknote,
  Users,
  TrendingUp,
  Target,
  Bot,
  Pencil,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  ArrowRight,
  X,
  Trophy,
  MessageCircle,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/vkm/page-header";
import { SectionCard } from "@/components/vkm/section-card";
import { KpiTile } from "@/components/vkm/kpi-tile";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  useBusinessData,
  momDelta,
  monthLabel,
  monthShort,
  type BusinessSnapshot,
  type MetricKey,
} from "@/components/business/business-data";
import { ImportDocumentDialog } from "@/components/business/import-document-dialog";
import { extractedToColumns, type ExtractedBusiness } from "@/lib/vkm/business-fields";
import { UpdateSnapshotDrawer } from "@/components/business/update-snapshot-drawer";
import { METRIC_COPY, readingFor, type Signal } from "@/components/business/metric-copy";
import { weekByNumber } from "@/lib/vkm/program";
import { useEnrollment } from "@/components/participant/enrollment-data";
import { AnalyticsSection } from "@/components/business/analytics-section";
import { TeamSection } from "@/components/business/team-section";

const inr = (n: number | null | undefined) => {
  if (n == null) return "—";
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(1)}Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(1)}L`;
  if (n >= 1e3) return `₹${(n / 1e3).toFixed(1)}K`;
  return `₹${n}`;
};
const num = (n: number | null | undefined) => (n == null ? "—" : String(n));
const pct = (n: number | null | undefined) => (n == null ? "—" : `${n}%`);

// One canonical name per section — used identically for tab label, heading, and
// hash — so nav, scroll target and URL all line up.
const NAV = [
  { id: "overview", label: "Overview" },
  { id: "profile", label: "Profile" },
  { id: "team", label: "Team" },
  { id: "revenue", label: "Revenue" },
  { id: "leads", label: "Leads" },
  { id: "sales", label: "Sales" },
  { id: "performance", label: "Performance" },
  { id: "analytics", label: "Analytics" },
  { id: "insights", label: "Insights" },
];
const SECTION_IDS = NAV.map((n) => n.id);

// Which metric sections the coach cares about most in each program phase.
const PHASE_FOCUS: Record<string, string[]> = {
  Foundation: ["revenue"],
  Systems: ["leads", "sales"],
  Sell: ["revenue", "sales"],
  Review: ["performance"],
};

type Data = ReturnType<typeof useBusinessData>;

export function MyBusinessPage() {
  const data = useBusinessData();
  const [open, setOpen] = useState(false);
  const { latest, previous, snapshots } = data;

  // Deep-link: landing on /participant/business#performance scrolls there on load.
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (!id) return;
    requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView());
  }, []);
  // Prefill the entry form with the current month's draft, else last reported month.
  const initial = data.byMonth.get(data.currentMonth) ?? latest;

  const delta = (key: MetricKey) => {
    const d = momDelta(latest?.[key] ?? null, previous?.[key] ?? null);
    return d == null ? undefined : `${d > 0 ? "+" : ""}${d}% MoM`;
  };
  const trend = (key: MetricKey): "up" | "down" | "flat" => {
    const d = momDelta(latest?.[key] ?? null, previous?.[key] ?? null);
    return d == null || d === 0 ? "flat" : d > 0 ? "up" : "down";
  };
  const series = (key: MetricKey) => snapshots.map((s) => Number(s[key] ?? 0));
  const reading = (key: MetricKey, display: string) =>
    readingFor(
      key,
      latest?.[key] ?? null,
      momDelta(latest?.[key] ?? null, previous?.[key] ?? null),
      display,
    );

  // Phase-aware focus — anchored to THIS participant's own program week
  // (relative to their start date), not the global cohort clock.
  const { currentWeek: programWeek, totalWeeks: programTotalWeeks } = useEnrollment();
  const currentWeek = weekByNumber(Math.max(1, programWeek));
  const focusIds = (currentWeek && PHASE_FOCUS[currentWeek.phase]) || [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="mx-auto w-full max-w-[1280px] space-y-6"
    >
      <PageHeader
        eyebrow="Participant"
        title="My Business"
        description="Your venture's profile, monthly numbers, trends and AI insight — one cockpit."
        icon={Briefcase}
        actions={
          <Button
            className="rounded-full bg-gradient-navy shadow-vkm"
            onClick={() => setOpen(true)}
          >
            <Pencil className="h-4 w-4" /> Update this month
          </Button>
        }
      />

      <ProgramBand data={data} week={programWeek} totalWeeks={programTotalWeeks} />

      <SectionNav />

      <HowItWorks />

      {/* OVERVIEW */}
      <section id="overview" className="scroll-mt-32 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-foreground">Overview</h2>
          <div className="flex items-center gap-2">
            {latest ? (
              <>
                <span className="text-xs text-muted-foreground">
                  as of {monthLabel(latest.month)}
                </span>
                <StatusChip status={latest.status} />
              </>
            ) : (
              <span className="text-xs text-muted-foreground">no numbers yet</span>
            )}
          </div>
        </div>

        {latest ? (
          <>
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
              <KpiTile
                spotlight={false}
                label="MRR"
                value={inr(latest.mrr_inr)}
                delta={delta("mrr_inr")}
                trend={trend("mrr_inr")}
                icon={Banknote}
                accent="gold"
                spark={series("mrr_inr")}
                hint={METRIC_COPY.mrr_inr.help}
              />
              <KpiTile
                spotlight={false}
                label="Revenue (mo)"
                value={inr(latest.revenue_inr)}
                delta={delta("revenue_inr")}
                trend={trend("revenue_inr")}
                icon={TrendingUp}
                accent="success"
                spark={series("revenue_inr")}
                hint={METRIC_COPY.revenue_inr.help}
              />
              <KpiTile
                spotlight={false}
                label="Leads"
                value={num(latest.leads)}
                delta={delta("leads")}
                trend={trend("leads")}
                icon={Users}
                accent="navy"
                spark={series("leads")}
                hint={METRIC_COPY.leads.help}
              />
              <KpiTile
                spotlight={false}
                label="Closing rate"
                value={pct(latest.closing_rate_pct)}
                delta={delta("closing_rate_pct")}
                trend={trend("closing_rate_pct")}
                icon={Target}
                accent="navy"
                spark={series("closing_rate_pct")}
                hint={METRIC_COPY.closing_rate_pct.help}
              />
            </div>
            <OverviewExtras data={data} onUpdate={() => setOpen(true)} />
          </>
        ) : (
          <SectionCard>
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-navy text-primary-foreground shadow-vkm">
                <Banknote className="h-6 w-6" />
              </span>
              <p className="text-base font-semibold text-foreground">Post your first month</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                Add this month's revenue, leads and deals. Your coach reviews them, then they feed
                your trends and points.
              </p>
              <Button
                className="rounded-xl bg-gradient-navy shadow-vkm"
                onClick={() => setOpen(true)}
              >
                <Pencil className="h-4 w-4" /> Update {monthLabel(data.currentMonth)}
              </Button>
            </div>
          </SectionCard>
        )}
      </section>

      {/* PROFILE */}
      <ProfileSection data={data} />

      {/* TEAM */}
      <TeamSection reportedTeamSize={data.profile?.team_size ?? null} />

      {/* REVENUE */}
      <MetricSection
        id="revenue"
        title="Revenue"
        onUpdate={() => setOpen(true)}
        status={latest?.status}
        highlight={focusIds.includes("revenue")}
        reading={reading("revenue_inr", inr(latest?.revenue_inr))}
        tiles={
          <>
            <KpiTile
              spotlight={false}
              label="Revenue (mo)"
              value={inr(latest?.revenue_inr)}
              delta={delta("revenue_inr")}
              trend={trend("revenue_inr")}
              icon={TrendingUp}
              accent="success"
              hint={METRIC_COPY.revenue_inr.help}
            />
            <KpiTile
              spotlight={false}
              label="MRR"
              value={inr(latest?.mrr_inr)}
              delta={delta("mrr_inr")}
              trend={trend("mrr_inr")}
              icon={Banknote}
              accent="gold"
              hint={METRIC_COPY.mrr_inr.help}
            />
          </>
        }
        bars={snapshots.map((s) => ({ label: monthShort(s.month), v: Number(s.revenue_inr ?? 0) }))}
        color="oklch(0.71 0.14 160)"
      />

      {/* LEADS */}
      <MetricSection
        id="leads"
        title="Leads"
        onUpdate={() => setOpen(true)}
        status={latest?.status}
        highlight={focusIds.includes("leads")}
        reading={reading("leads", num(latest?.leads))}
        tiles={
          <KpiTile
            spotlight={false}
            label="New leads"
            value={num(latest?.leads)}
            delta={delta("leads")}
            trend={trend("leads")}
            icon={Users}
            accent="navy"
            hint={METRIC_COPY.leads.help}
          />
        }
        bars={snapshots.map((s) => ({ label: monthShort(s.month), v: Number(s.leads ?? 0) }))}
        color="oklch(0.5 0.12 260)"
      />

      {/* SALES */}
      <MetricSection
        id="sales"
        title="Sales"
        onUpdate={() => setOpen(true)}
        status={latest?.status}
        highlight={focusIds.includes("sales")}
        reading={reading("deals", num(latest?.deals))}
        tiles={
          <>
            <KpiTile
              spotlight={false}
              label="Deals closed"
              value={num(latest?.deals)}
              delta={delta("deals")}
              trend={trend("deals")}
              icon={CheckCircle2}
              accent="success"
              hint={METRIC_COPY.deals.help}
            />
            <KpiTile
              spotlight={false}
              label="Pipeline"
              value={inr(latest?.pipeline_inr)}
              delta={delta("pipeline_inr")}
              trend={trend("pipeline_inr")}
              icon={TrendingUp}
              accent="navy"
              hint={METRIC_COPY.pipeline_inr.help}
            />
            <KpiTile
              spotlight={false}
              label="Avg deal"
              value={inr(latest?.avg_deal_inr)}
              delta={delta("avg_deal_inr")}
              trend={trend("avg_deal_inr")}
              icon={Banknote}
              accent="gold"
              hint={METRIC_COPY.avg_deal_inr.help}
            />
          </>
        }
        bars={snapshots.map((s) => ({ label: monthShort(s.month), v: Number(s.deals ?? 0) }))}
        color="oklch(0.62 0.12 300)"
      />

      {/* Performance */}
      <MetricSection
        id="performance"
        title="Performance"
        onUpdate={() => setOpen(true)}
        status={latest?.status}
        highlight={focusIds.includes("performance")}
        reading={reading("closing_rate_pct", pct(latest?.closing_rate_pct))}
        tiles={
          <>
            <KpiTile
              spotlight={false}
              label="Closing rate"
              value={pct(latest?.closing_rate_pct)}
              delta={delta("closing_rate_pct")}
              trend={trend("closing_rate_pct")}
              icon={Target}
              accent="navy"
              hint={METRIC_COPY.closing_rate_pct.help}
            />
            <KpiTile
              spotlight={false}
              label="Follow-up rate"
              value={pct(latest?.followup_pct)}
              delta={delta("followup_pct")}
              trend={trend("followup_pct")}
              icon={Clock}
              accent="success"
              hint={METRIC_COPY.followup_pct.help}
            />
            <KpiTile
              spotlight={false}
              label="Customer happiness"
              value={num(latest?.nps)}
              delta={delta("nps")}
              trend={trend("nps")}
              icon={Sparkles}
              accent="gold"
              hint={METRIC_COPY.nps.help}
            />
          </>
        }
        bars={snapshots.map((s) => ({
          label: monthShort(s.month),
          v: Number(s.closing_rate_pct ?? 0),
        }))}
        color="oklch(0.5 0.18 300)"
      />

      {/* ANALYTICS */}
      <AnalyticsSection data={data} />

      {/* INSIGHTS */}
      <InsightsSection data={data} />

      <UpdateSnapshotDrawer
        open={open}
        onOpenChange={setOpen}
        monthISO={data.currentMonth}
        initial={initial}
        baseline={previous}
        onSave={(input) => data.saveSnapshot(data.currentMonth, input)}
      />
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Scroll-spy — the active tab is the last section whose top has passed under the
// sticky bar. Deterministic (no off-by-one), and it keeps the URL hash in sync.
const SPY_OFFSET = 128; // header (64) + sticky section bar (~56) — matches scroll-mt-32

function useScrollSpy(ids: string[]) {
  const [active, setActive] = useState(ids[0]);
  const activeRef = useRef(ids[0]);
  const lockUntil = useRef(0);

  function set(id: string) {
    if (id !== activeRef.current) {
      activeRef.current = id;
      setActive(id);
    }
    try {
      window.history.replaceState(null, "", `#${id}`);
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    function onScroll() {
      // A recent click owns the active tab; ignore the jump's own scroll events.
      if (Date.now() < lockUntil.current) return;
      let current = ids[0];
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top - SPY_OFFSET <= 1) current = id;
      }
      // Page bottom: short trailing sections can't reach the bar — pick the last.
      if (
        Math.ceil(window.innerHeight + window.scrollY) >=
        document.documentElement.scrollHeight - 2
      ) {
        current = ids[ids.length - 1];
      }
      set(current);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [ids]);

  // Clicking a tab sets it active authoritatively (works for bottom sections).
  function select(id: string) {
    lockUntil.current = Date.now() + 1200;
    set(id);
  }

  return { active, select };
}

function SectionNav() {
  const { active, select } = useScrollSpy(SECTION_IDS);
  return (
    <div className="sticky top-[calc(4rem+env(safe-area-inset-top))] z-20 -mx-4 border-y border-border/60 bg-background/85 px-4 py-2 backdrop-blur sm:top-[4.5rem]">
      <div className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {NAV.map((n) => (
          <a
            key={n.id}
            href={`#${n.id}`}
            onClick={() => select(n.id)}
            aria-current={active === n.id ? "true" : undefined}
            className={cn(
              "app-press inline-flex min-h-9 shrink-0 items-center rounded-full border px-3.5 text-sm font-medium transition-colors",
              active === n.id
                ? "border-transparent bg-gradient-navy text-primary-foreground shadow-vkm"
                : "border-border bg-card text-foreground hover:bg-secondary/50",
            )}
          >
            {n.label}
          </a>
        ))}
      </div>
    </div>
  );
}

// Anchors the page to the 16-week coached journey: where you are, the goal you
// set, and the week's focus — so the numbers serve the program, not vice-versa.
function ProgramBand({
  data,
  week,
  totalWeeks,
}: {
  data: Data;
  week: number;
  totalWeeks: number;
}) {
  const displayWeek = Math.max(1, week);
  const wk = weekByNumber(displayWeek);
  const throughPct = Math.round((displayWeek / totalWeeks) * 100);
  const target = data.profile?.target_mrr_inr ?? null;
  const mrr = data.latest?.mrr_inr ?? null;
  const goalPct = target && mrr != null ? Math.min(100, Math.round((mrr / target) * 100)) : null;

  return (
    <div className="overflow-hidden rounded-3xl bg-gradient-navy p-4 text-primary-foreground shadow-vkm-float sm:p-5 md:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary-foreground/70">
            Your {totalWeeks}-week journey
          </p>
          <p className="mt-1 text-lg font-semibold leading-tight sm:text-2xl">
            Week {displayWeek} of {totalWeeks} — {wk?.topic}
          </p>
          <p className="mt-1 text-xs text-primary-foreground/70 sm:text-sm">
            {wk?.phase} phase · is the program moving your numbers?
          </p>
        </div>
        <Link
          to="/participant/progress"
          className="app-press inline-flex shrink-0 flex-col items-center rounded-2xl bg-white/10 px-3 py-1.5 leading-none transition-colors hover:bg-white/15"
        >
          <span className="text-lg font-bold tabular-nums sm:text-2xl">{throughPct}%</span>
          <span className="mt-0.5 text-[9px] uppercase tracking-wide text-primary-foreground/60">
            done
          </span>
        </Link>
      </div>

      {target != null && (
        <div className="mt-4 rounded-2xl bg-white/5 p-3">
          <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 text-xs sm:text-sm">
            <span className="text-primary-foreground/80">Goal: {inr(target)} MRR by Week {totalWeeks}</span>
            <span className="font-semibold">
              {mrr != null ? inr(mrr) : "—"}
              {goalPct != null ? ` · ${goalPct}%` : ""}
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/15">
            <div
              className="h-full rounded-full bg-gradient-gold transition-all"
              style={{ width: `${goalPct ?? 0}%` }}
            />
          </div>
        </div>
      )}

      {wk && (
        <div className="mt-3 flex flex-col items-start gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <Link
            to="/participant/progress"
            className="app-press inline-flex max-w-full items-center gap-1 rounded-full bg-white/10 px-3 py-1.5 text-xs text-primary-foreground/90 transition-colors hover:bg-white/15"
          >
            <span className="truncate">This week: {wk.task}</span>
            <ArrowRight className="h-3 w-3 shrink-0" />
          </Link>
          <Button
            size="sm"
            asChild
            className="rounded-full bg-gradient-gold text-navy hover:opacity-90"
          >
            <Link to="/participant/proof">Submit Week {displayWeek} proof</Link>
          </Button>
        </div>
      )}
    </div>
  );
}

// #B + #C — status surface + derived strategic metrics for the Overview.
function OverviewExtras({ data, onUpdate }: { data: Data; onUpdate: () => void }) {
  const { latest, profile } = data;
  if (!latest) return null;
  const target = profile?.target_mrr_inr ?? null;
  const gap =
    target != null && latest.mrr_inr != null ? Math.max(0, target - latest.mrr_inr) : null;
  const runRate =
    target && latest.mrr_inr != null ? Math.round((latest.mrr_inr / target) * 100) : null;
  const conv = latest.leads ? Math.round(((latest.deals ?? 0) / latest.leads) * 100) : null;

  return (
    <>
      {latest.status === "rejected" && (
        <div className="flex items-start gap-2.5 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground">
              {monthLabel(latest.month)} needs revision
            </p>
            {latest.coach_note && (
              <p className="text-xs text-muted-foreground">
                {data.reviewerName ?? "Coach"}: {latest.coach_note}
              </p>
            )}
          </div>
          <Button size="sm" className="shrink-0 rounded-full bg-gradient-navy" onClick={onUpdate}>
            Revise
          </Button>
        </div>
      )}
      {latest.status === "pending" && (
        <p className="rounded-xl bg-secondary/50 px-3 py-2 text-xs text-muted-foreground">
          {monthLabel(latest.month)} numbers are{" "}
          <span className="font-medium">pending coach review</span> — they'll count toward your
          points once approved.
        </p>
      )}
      {latest.status === "approved" && latest.reviewed_at && (
        <p className="rounded-xl bg-[oklch(0.95_0.03_160)] px-3 py-2 text-xs text-[oklch(0.4_0.1_160)]">
          Reviewed by {data.reviewerName ?? "your coach"}{" "}
          {formatDistanceToNowStrict(new Date(latest.reviewed_at), { addSuffix: true })} — counting
          toward your points.
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border bg-card px-3 py-2.5">
        <PointsProjection data={data} />
        <Button size="sm" variant="outline" className="rounded-full" asChild>
          <Link to="/participant/chat">
            <MessageCircle className="h-3.5 w-3.5" /> Ask my coach
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <DerivedTile
          label="Gap to MRR goal"
          value={target == null ? "Set target" : gap === 0 ? "Goal hit 🎉" : inr(gap)}
          hint={target != null ? `to ${inr(target)}` : "in Profile"}
        />
        <DerivedTile
          label="Run-rate to goal"
          value={runRate == null ? "—" : `${runRate}%`}
          hint="of target MRR"
        />
        <DerivedTile
          label="Lead → deal"
          value={conv == null ? "—" : `${conv}%`}
          hint="conversion"
        />
      </div>
    </>
  );
}

// #3 — connect numbers to the platform's points logic so progress feels rewarded.
function PointsProjection({ data }: { data: Data }) {
  const { latest, previous } = data;
  if (!latest) return null;
  const revUp = (momDelta(latest.revenue_inr, previous?.revenue_inr ?? null) ?? 0) > 0;
  const leadsUp = (momDelta(latest.leads, previous?.leads ?? null) ?? 0) > 0;
  const parts: string[] = [];
  if (revUp) parts.push("+50 revenue up");
  if (leadsUp) parts.push("+30 leads up");
  const total = (revUp ? 50 : 0) + (leadsUp ? 30 : 0);

  if (total === 0) {
    return (
      <span className="text-xs text-muted-foreground">
        Grow revenue or leads this month to earn bonus points.
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground">
      <Trophy className="h-3.5 w-3.5 text-gold" />
      {latest.status === "approved"
        ? `Earned this month: +${total} (${parts.join(", ")})`
        : `On approval: +${total} pts (${parts.join(", ")})`}
    </span>
  );
}

function DerivedTile({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3 shadow-vkm">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-base font-bold text-foreground sm:text-lg">{value}</p>
      <p className="text-[11px] text-muted-foreground">{hint}</p>
    </div>
  );
}

function StatusChip({ status }: { status: BusinessSnapshot["status"] }) {
  const meta = {
    pending: { label: "Pending review", cls: "bg-gold/15 text-[oklch(0.45_0.1_85)]", Icon: Clock },
    approved: {
      label: "Coach approved",
      cls: "bg-[oklch(0.93_0.06_160)] text-[oklch(0.35_0.12_160)]",
      Icon: CheckCircle2,
    },
    rejected: {
      label: "Needs revision",
      cls: "bg-[oklch(0.93_0.06_25)] text-[oklch(0.45_0.16_25)]",
      Icon: AlertTriangle,
    },
  }[status];
  const Icon = meta.Icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
        meta.cls,
      )}
    >
      <Icon className="h-3 w-3" /> {meta.label}
    </span>
  );
}

function TrendBars({ data, color }: { data: { label: string; v: number }[]; color: string }) {
  if (data.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        No history yet — your trend appears once you post a couple of months.
      </p>
    );
  }
  const max = Math.max(...data.map((d) => d.v), 1);
  return (
    <div className="flex h-28 items-end gap-1.5">
      {data.map((d, i) => (
        <div key={i} className="flex flex-1 flex-col items-center gap-1">
          <div
            className="w-full rounded-t-md transition-all"
            style={{ height: `${Math.max((d.v / max) * 100, 2)}%`, background: color }}
            title={`${d.label}: ${d.v}`}
          />
          <span className="text-[10px] text-muted-foreground">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

function MetricSection({
  id,
  title,
  tiles,
  bars,
  color,
  status,
  reading,
  highlight,
  onUpdate,
}: {
  id: string;
  title: string;
  tiles: React.ReactNode;
  bars: { label: string; v: number }[];
  color: string;
  status?: BusinessSnapshot["status"];
  reading?: { text: string; signal: Signal } | null;
  highlight?: boolean;
  onUpdate: () => void;
}) {
  return (
    <section id={id} className="scroll-mt-32">
      <SectionCard
        className={cn(highlight && "ring-2 ring-gold/50")}
        title={
          <span className="flex items-center gap-2">
            {title}
            {highlight && (
              <span className="rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[oklch(0.45_0.1_85)]">
                Focus this week
              </span>
            )}
          </span>
        }
        subtitle="Self-reported monthly · reviewed by your coach"
        action={
          <div className="flex items-center gap-2">
            {status && (
              <span className="hidden sm:inline-flex">
                <StatusChip status={status} />
              </span>
            )}
            <Button size="sm" variant="outline" className="rounded-full" onClick={onUpdate}>
              <Pencil className="h-3.5 w-3.5" /> Update
            </Button>
          </div>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{tiles}</div>
        {reading && <ReadingLine reading={reading} />}
        <div className="mt-5 border-t border-border pt-4">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Trend
          </p>
          <TrendBars data={bars} color={color} />
        </div>
      </SectionCard>
    </section>
  );
}

// Plain-language reading of a metric + a comprehension-friendly signal tag.
function ReadingLine({ reading }: { reading: { text: string; signal: Signal } }) {
  const tag =
    reading.signal === "good"
      ? { label: "Improving", cls: "bg-[oklch(0.93_0.06_160)] text-[oklch(0.35_0.12_160)]" }
      : reading.signal === "bad"
        ? { label: "Needs attention", cls: "bg-[oklch(0.93_0.06_25)] text-[oklch(0.45_0.16_25)]" }
        : { label: "Watch this", cls: "bg-gold/15 text-[oklch(0.45_0.1_85)]" };
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-secondary/40 px-3 py-2.5">
      <span
        className={cn(
          "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
          tag.cls,
        )}
      >
        {tag.label}
      </span>
      <span className="text-sm text-foreground">{reading.text}</span>
    </div>
  );
}

// First-run "How this works" — three plain steps, dismissible per device.
function HowItWorks() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    try {
      setShow(!localStorage.getItem("vkm.mybiz.howto.v1"));
    } catch {
      /* ignore */
    }
  }, []);
  if (!show) return null;
  function dismiss() {
    try {
      localStorage.setItem("vkm.mybiz.howto.v1", "1");
    } catch {
      /* ignore */
    }
    setShow(false);
  }
  return (
    <div className="relative rounded-2xl border border-gold/30 bg-gold/[0.06] p-4">
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="app-press absolute right-1.5 top-1.5 inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
      <p className="text-sm font-semibold text-foreground">How this works</p>
      <ol className="mt-2 space-y-1.5 text-sm text-muted-foreground">
        <li>
          <span className="font-medium text-foreground">1.</span> Fill in your business profile —
          you only do this once.
        </li>
        <li>
          <span className="font-medium text-foreground">2.</span> Post your numbers each month — it
          takes about a minute.
        </li>
        <li>
          <span className="font-medium text-foreground">3.</span> Your coach reviews them, then you
          see your trends and earn points.
        </li>
      </ol>
    </div>
  );
}

function ProfileSection({ data }: { data: Data }) {
  const b = data.profile;
  const { user } = useAuth();
  const [importOpen, setImportOpen] = useState(false);

  // Save AI-extracted fields straight to the owner's business_brains (RLS:
  // INSERT/UPDATE owner only), then refresh the page data.
  async function saveExtracted(fields: ExtractedBusiness) {
    if (!user) throw new Error("Not signed in");
    const cols = extractedToColumns(fields);
    if (!Object.keys(cols).length) return;
    const { error } = await supabase
      .from("business_brains")
      .upsert({ user_id: user.id, ...cols }, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
    await data.reload();
    toast.success("Business profile updated from your document");
  }

  return (
    <section id="profile" className="scroll-mt-32">
      <SectionCard
        title="Profile"
        subtitle="Your venture at a glance — keep it current"
        action={
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="rounded-full"
              onClick={() => setImportOpen(true)}
            >
              <Sparkles className="h-3.5 w-3.5" /> Auto-fill from PDF
            </Button>
            <Button size="sm" variant="outline" className="rounded-full" asChild>
              <Link to="/participant/profile">
                <Pencil className="h-3.5 w-3.5" /> Edit profile
              </Link>
            </Button>
          </div>
        }
      >
        <ImportDocumentDialog
          open={importOpen}
          onOpenChange={setImportOpen}
          onApply={saveExtracted}
        />
        {b ? (
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Field label="Business" value={b.business_name ?? "—"} />
            <Field label="Industry" value={b.industry ?? "—"} />
            <Field label="Location" value={b.location ?? "—"} />
            <Field label="Business model" value={b.business_model ?? "—"} />
            <Field label="Legal structure" value={b.legal_structure ?? "—"} />
            <Field label="Founded" value={b.founded_year != null ? String(b.founded_year) : "—"} />
            <Field
              label="Years running"
              value={b.years_running != null ? String(b.years_running) : "—"}
            />
            <Field label="Team size" value={b.team_size != null ? String(b.team_size) : "—"} />
            <Field
              label="Customers"
              value={b.num_customers != null ? String(b.num_customers) : "—"}
            />
            <Field label="Target MRR" value={inr(b.target_mrr_inr)} />
            <Field label="Pricing model" value={b.pricing_model ?? "—"} />
            <Field label="Website" value={b.website ?? "—"} />
            <Field className="col-span-2 sm:col-span-3" label="USP" value={b.usp ?? "—"} />
            <Field
              className="col-span-2 sm:col-span-3"
              label="Ideal customer"
              value={b.target_customer ?? "—"}
            />
            <Field
              className="col-span-2 sm:col-span-3"
              label="Main competitors"
              value={b.main_competitors ?? "—"}
            />
            <Field
              className="col-span-2 sm:col-span-3"
              label="Top products / services"
              value={b.top_products ?? "—"}
            />
            <Field
              className="col-span-2 sm:col-span-3"
              label="Success in 4 months"
              value={b.success_definition ?? "—"}
            />
          </dl>
        ) : (
          <p className="py-3 text-sm text-muted-foreground">
            No profile yet —{" "}
            <Link to="/participant/profile" className="font-medium text-foreground underline">
              add your business details
            </Link>
            .
          </p>
        )}
      </SectionCard>
    </section>
  );
}

function Field({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={className}>
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm text-foreground">{value}</dd>
    </div>
  );
}

function InsightsSection({ data }: { data: Data }) {
  const { latest, previous } = data;
  const revDelta = momDelta(latest?.revenue_inr ?? null, previous?.revenue_inr ?? null);
  const leadDelta = momDelta(latest?.leads ?? null, previous?.leads ?? null);

  const reading =
    !latest || !previous
      ? "Post two months of numbers to unlock month-over-month trend reading."
      : revDelta != null && revDelta < 0
        ? `Revenue is down ${Math.abs(revDelta)}% MoM. Pressure-test your follow-up cadence and pipeline quality with the AI Advisor.`
        : leadDelta != null && leadDelta < 0
          ? `Leads dipped ${Math.abs(leadDelta)}% MoM — revisit your top lead sources before they compound downstream.`
          : "Momentum is positive — lock it in with this week's proof and keep the cadence.";

  return (
    <section id="insights" className="scroll-mt-32">
      <SectionCard title="Insights" subtitle="Computed from your profile + numbers">
        <div className="rounded-2xl bg-gradient-navy p-4 text-primary-foreground">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-gold">
            <Bot className="h-3.5 w-3.5" /> AI Advisor reading
          </p>
          <p className="mt-1.5 text-sm text-primary-foreground/85">{reading}</p>
          <Button asChild className="mt-3 rounded-xl bg-gradient-gold text-navy hover:opacity-90">
            <Link to="/participant/advisor">
              Open AI Advisor <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </SectionCard>
    </section>
  );
}
