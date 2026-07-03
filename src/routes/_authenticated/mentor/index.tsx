import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Users, BookCopy, Layers3, GraduationCap, TrendingDown, AlertTriangle, Trophy, CheckCircle2,
} from "lucide-react";
import { PageHeader } from "@/components/vkm/page-header";
import { KpiTile } from "@/components/vkm/kpi-tile";
import { SectionCard } from "@/components/vkm/section-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { VKM_PROGRAM, VKM_VK_CLASS_FORMAT, weekByNumber } from "@/lib/vkm/program";
import { currentWeekNo } from "@/components/coach/coach-data";
import { useMentorDashboardData } from "@/components/mentor/dashboard-data";

export const Route = createFileRoute("/_authenticated/mentor/")({
  component: MentorDashboard,
});

const CURRENT_WEEK = currentWeekNo();

function MentorDashboard() {
  const w = weekByNumber(CURRENT_WEEK)!;
  const { loading, kpis, pipeline, topPerformers, signals } = useMentorDashboardData();

  const noSignals = signals.atRiskCount === 0 && !signals.lowestCompletionBatch && signals.nearGraduationCount === 0;

  return (
    <div>
      <PageHeader
        eyebrow="Mentor · Venu Kalyan"
        title="Mentor Cockpit"
        description={`Tuesday class · Week ${CURRENT_WEEK}: ${w.topic} — "${w.why}". Your job: land the WHY. Your coaches drive implementation.`}
        actions={
          <>
            <Button variant="outline" className="rounded-full" asChild><Link to="/mentor/announcements">New broadcast</Link></Button>
            <Button className="rounded-full bg-gradient-navy shadow-vkm" asChild><Link to="/mentor/classes">Open Tuesday class</Link></Button>
          </>
        }
      />

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiTile label="Active batches" value={String(kpis.activeBatches)} icon={Layers3} accent="navy" loading={loading} />
        <KpiTile label="Active participants" value={String(kpis.activeParticipants)} icon={Users} accent="gold" loading={loading} />
        <KpiTile label="Avg completion" value={`${kpis.avgCompletionPct}%`} icon={BookCopy} accent="success" loading={loading} />
        <KpiTile label="Graduation rate" value={`${kpis.graduationRatePct}%`} icon={GraduationCap} accent="success" loading={loading} />
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-3">
        <SectionCard
          className="lg:col-span-2"
          title={`Tuesday class · Week ${CURRENT_WEEK}: ${w.topic}`}
          subtitle={`Theme to land: "${w.why}"`}
          action={<Badge className="rounded-full bg-gradient-gold text-navy">{w.mode}</Badge>}
        >
          <div className="divide-y divide-border">
            {VKM_VK_CLASS_FORMAT.map((b) => (
              <div key={b.block} className="flex items-center gap-4 py-3">
                <span className="inline-flex h-10 w-14 items-center justify-center rounded-xl bg-gradient-navy text-primary-foreground text-xs font-semibold">
                  {b.mins}m
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{b.block}</p>
                  <p className="text-xs text-muted-foreground">{b.what}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 rounded-xl bg-secondary p-3 text-sm">
            <span className="font-medium">Assign:</span>{" "}
            <span className="text-muted-foreground">{w.task}</span>
            <br />
            <span className="font-medium">Proof:</span>{" "}
            <span className="text-muted-foreground">{w.proof}</span>
          </div>
        </SectionCard>

        <SectionCard title="Signals" subtitle="What needs your attention">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : noSignals ? (
            <div className="flex items-start gap-3 rounded-xl bg-secondary p-3">
              <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-navy text-primary-foreground">
                <CheckCircle2 className="h-4 w-4" />
              </span>
              <p className="text-sm text-foreground">Nothing needs attention right now — cohort is on track.</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {signals.atRiskCount > 0 && (
                <li className="flex items-start gap-3 rounded-xl bg-secondary p-3">
                  <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-navy text-primary-foreground">
                    <AlertTriangle className="h-4 w-4" />
                  </span>
                  <p className="text-sm text-foreground">
                    <Link to="/mentor/cohort" className="underline underline-offset-2">
                      {signals.atRiskCount} participant{signals.atRiskCount === 1 ? "" : "s"} at risk
                    </Link>{" "}
                    across active batches this week.
                  </p>
                </li>
              )}
              {signals.lowestCompletionBatch && (
                <li className="flex items-start gap-3 rounded-xl bg-secondary p-3">
                  <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-navy text-primary-foreground">
                    <TrendingDown className="h-4 w-4" />
                  </span>
                  <p className="text-sm text-foreground">
                    {signals.lowestCompletionBatch.name} has the lowest completion at {signals.lowestCompletionBatch.pct}%.
                  </p>
                </li>
              )}
              {signals.nearGraduationCount > 0 && (
                <li className="flex items-start gap-3 rounded-xl bg-secondary p-3">
                  <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-navy text-primary-foreground">
                    <GraduationCap className="h-4 w-4" />
                  </span>
                  <p className="text-sm text-foreground">
                    {signals.nearGraduationCount} candidate{signals.nearGraduationCount === 1 ? "" : "s"} tracking toward Growth Champion.
                  </p>
                </li>
              )}
            </ul>
          )}
        </SectionCard>
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-2">
        <SectionCard title="Cohort pipeline" subtitle={VKM_PROGRAM.tagline}>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : pipeline.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active batches yet.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {pipeline.map((s, i) => (
                <div
                  key={s.batch_id}
                  className={
                    i === 0
                      ? "rounded-2xl bg-gradient-navy p-5 text-primary-foreground"
                      : "rounded-2xl bg-secondary p-5 text-navy"
                  }
                >
                  <p className="truncate text-xs uppercase tracking-wider opacity-80">{s.batch_name}</p>
                  <p className="mt-2 text-3xl font-semibold">{s.count}</p>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Top performers"
          subtitle="Across active batches"
          action={<Button size="sm" variant="ghost" className="rounded-full" asChild><Link to="/mentor/leaderboards">All</Link></Button>}
        >
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : topPerformers.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Trophy className="h-4 w-4" /> No points logged yet.
            </p>
          ) : (
            <ul className="space-y-2">
              {topPerformers.map((p, i) => (
                <li key={p.user_id} className="flex items-center justify-between rounded-xl border border-border p-3">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-navy text-primary-foreground text-[11px] font-semibold">{i + 1}</span>
                    <div>
                      <p className="text-sm font-medium">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.business || "—"}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold tabular-nums">{p.points}</p>
                    <p className="text-[11px] text-muted-foreground">{p.stage}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </section>
    </div>
  );
}
