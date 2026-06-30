import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Users, BookCopy, Layers3, GraduationCap, TrendingUp, Sparkles, CalendarClock,
} from "lucide-react";
import { PageHeader } from "@/components/vkm/page-header";
import { KpiTile } from "@/components/vkm/kpi-tile";
import { SectionCard } from "@/components/vkm/section-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { VKM_PROGRAM, VKM_VK_CLASS_FORMAT, weekByNumber } from "@/lib/vkm/program";
import { currentWeekNo } from "@/components/coach/coach-data";

export const Route = createFileRoute("/_authenticated/mentor/")({
  component: MentorDashboard,
});

const CURRENT_WEEK = currentWeekNo();

function MentorDashboard() {
  const w = weekByNumber(CURRENT_WEEK)!;
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
        <KpiTile label="Active batches"      value="3"   delta="Batch 15, 16, 17" trend="flat" icon={Layers3} accent="navy" />
        <KpiTile label="Active participants" value="22"  delta="+8 in Batch 17" trend="up" icon={Users} accent="gold" />
        <KpiTile label="Avg completion"      value="71%" delta="Above benchmark" trend="up" icon={BookCopy} accent="success" />
        <KpiTile label="Graduation rate"     value="92%" delta="Batch 14 closed" trend="up" icon={GraduationCap} accent="success" />
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

        <SectionCard title="AI Insights" subtitle="What needs your attention">
          <ul className="space-y-3">
            {[
              { t: `Most owners are in Builder — Systems month is working. Push Starters before Sell phase (Wk 9).`, i: TrendingUp },
              { t: `Imran S (Batch 16) at risk — missed Wk 6 GAM. Coach Soumya on it.`, i: Sparkles },
              { t: `2 candidates tracking to Growth Champion: Anitha Rao, Lakshmi N.`, i: GraduationCap },
            ].map((x, i) => (
              <li key={i} className="flex items-start gap-3 rounded-xl bg-secondary p-3">
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-navy text-primary-foreground">
                  <x.i className="h-4 w-4" />
                </span>
                <p className="text-sm text-foreground">{x.t}</p>
              </li>
            ))}
          </ul>
        </SectionCard>
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-2">
        <SectionCard title="Cohort pipeline" subtitle={VKM_PROGRAM.tagline}>
          <div className="grid gap-3 sm:grid-cols-4">
            {[
              { l: "Batch 17 · Foundation", v: 8,  c: "bg-secondary text-navy" },
              { l: "Batch 16 · Systems",    v: 6,  c: "bg-gradient-gold text-navy" },
              { l: "Batch 15 · Sell",       v: 8,  c: "bg-[oklch(0.71_0.14_160)] text-white" },
              { l: "Batch 14 · Graduated",  v: 10, c: "bg-gradient-navy text-primary-foreground" },
            ].map((s) => (
              <div key={s.l} className={`rounded-2xl p-5 ${s.c}`}>
                <p className="text-xs uppercase tracking-wider opacity-80">{s.l}</p>
                <p className="mt-2 text-3xl font-semibold">{s.v}</p>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title="Top performers · Batch 16"
          subtitle="Tracking to Growth Champion"
          action={<Button size="sm" variant="ghost" className="rounded-full" asChild><Link to="/mentor/leaderboards">All</Link></Button>}
        >
          <ul className="space-y-2">
            {[
              { n: "Anitha Rao", b: "Designs · Bengaluru", pts: 410, stage: "Operator" },
              { n: "Lakshmi N",  b: "Sarees · Hyderabad",  pts: 360, stage: "Builder" },
              { n: "Suresh Reddy", b: "Wholesale · Hyderabad", pts: 320, stage: "Builder" },
            ].map((p, i) => (
              <li key={p.n} className="flex items-center justify-between rounded-xl border border-border p-3">
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-navy text-primary-foreground text-[11px] font-semibold">{i + 1}</span>
                  <div>
                    <p className="text-sm font-medium">{p.n}</p>
                    <p className="text-xs text-muted-foreground">{p.b}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold tabular-nums">{p.pts}</p>
                  <p className="text-[11px] text-muted-foreground">{p.stage}</p>
                </div>
              </li>
            ))}
          </ul>
        </SectionCard>
      </section>
    </div>
  );
}
