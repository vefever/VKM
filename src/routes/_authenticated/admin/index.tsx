import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Users, Wallet, ShieldCheck, Database, Server, Bot, Layers3, GraduationCap,
} from "lucide-react";
import { PageHeader } from "@/components/vkm/page-header";
import { KpiTile } from "@/components/vkm/kpi-tile";
import { SectionCard } from "@/components/vkm/section-card";
import { Button } from "@/components/ui/button";
import { VKM_PROGRAM, VKM_ONBOARDING } from "@/lib/vkm/program";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: AdminDashboard,
});

function AdminDashboard() {
  return (
    <div>
      <PageHeader
        eyebrow="Super Admin · Operations"
        title="VKM System Overview"
        description={`${VKM_PROGRAM.title} — ${VKM_PROGRAM.tagline}. Across all cohorts, coaches, and operations.`}
        actions={
          <>
            <Button variant="outline" className="rounded-full" asChild><Link to="/admin/exports">Export</Link></Button>
            <Button className="rounded-full bg-gradient-navy shadow-vkm" asChild><Link to="/admin/users">Invite user</Link></Button>
          </>
        }
      />

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiTile label="Active participants" value="22"    delta="3 active batches" trend="up" icon={Users} accent="navy" />
        <KpiTile label="Revenue (this cohort)" value="₹48L" delta="6 × ₹8L paid" trend="up" icon={Wallet} accent="gold" />
        <KpiTile label="Active batches"      value="3"     delta="Batch 15, 16, 17" trend="flat" icon={Layers3} accent="success" />
        <KpiTile label="Graduation rate"     value="92%"   delta="Batch 14 closed" trend="up" icon={GraduationCap} accent="success" />
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-3">
        <SectionCard
          className="lg:col-span-2"
          title="Onboarding flow (Soumya · Ops & HR)"
          subtitle="7-step participant onboarding — Day 0 to Week 1"
          action={<Button size="sm" variant="ghost" className="rounded-full" asChild><Link to="/admin/vk-ops/onboarding">Open</Link></Button>}
        >
          <ol className="space-y-2.5">
            {VKM_ONBOARDING.map((s) => (
              <li key={s.step} className="flex items-start gap-3 rounded-xl border border-border bg-card px-3 py-2.5">
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-navy text-primary-foreground text-xs font-semibold">
                  {s.step}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{s.description}</p>
                  <p className="text-xs text-muted-foreground">{s.owner} · by {s.doneBy}</p>
                </div>
              </li>
            ))}
          </ol>
        </SectionCard>

        <SectionCard title="System health" subtitle="All systems nominal">
          <ul className="space-y-3">
            {[
              { l: "Database", v: "Healthy", i: Database },
              { l: "Auth",     v: "Healthy", i: ShieldCheck },
              { l: "AI Gateway", v: "Healthy", i: Bot },
              { l: "Storage",  v: "Healthy", i: Server },
              { l: "Master Tracker sync", v: "Healthy", i: Database },
            ].map((x) => (
              <li key={x.l} className="flex items-center gap-3 rounded-xl bg-secondary px-3 py-2.5">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-card">
                  <x.i className="h-4 w-4 text-navy" />
                </span>
                <span className="flex-1 text-sm font-medium">{x.l}</span>
                <span className="text-xs font-medium text-[oklch(0.55_0.14_160)]">{x.v}</span>
              </li>
            ))}
          </ul>
        </SectionCard>
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-3">
        <SectionCard title="Cohort distribution" subtitle="By phase">
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { l: "Foundation (Batch 17)", v: 8, c: "bg-secondary text-navy" },
              { l: "Systems (Batch 16)",    v: 6, c: "bg-gradient-gold text-navy" },
              { l: "Sell (Batch 15)",       v: 8, c: "bg-[oklch(0.71_0.14_160)] text-white" },
              { l: "Graduated (Batch 14)",  v: 10, c: "bg-gradient-navy text-primary-foreground" },
            ].map((s) => (
              <div key={s.l} className={`rounded-2xl p-4 ${s.c}`}>
                <p className="text-xs uppercase tracking-wider opacity-80">{s.l}</p>
                <p className="mt-1.5 text-2xl font-semibold">{s.v}</p>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          className="lg:col-span-2"
          title="Recent operations"
          subtitle="Live feed"
        >
          <div className="divide-y divide-border">
            {[
              { who: "Coach Soumya", what: "approved Anitha Rao's Week 6 GAM minutes (+40 pts)", when: "12m" },
              { who: "Soumya R", what: "marked Suresh Reddy Goal Setter milestone — gift dispatched", when: "1h" },
              { who: "Auto", what: "Tuesday class reminder sent to Batch 16 (6/6 confirmed)", when: "2h" },
              { who: "VK", what: "published Week 7 class theme: 'Never lose a lead again'", when: "Yesterday" },
              { who: "Backup", what: "nightly database backup OK (1.4 GB)", when: "32m" },
            ].map((a, i) => (
              <div key={i} className="flex items-center gap-3 py-3">
                <span className="inline-flex h-2 w-2 rounded-full bg-[oklch(0.71_0.14_160)]" />
                <p className="flex-1 text-sm"><span className="font-medium">{a.who}</span> <span className="text-muted-foreground">{a.what}</span></p>
                <span className="text-xs text-muted-foreground">{a.when} ago</span>
              </div>
            ))}
          </div>
        </SectionCard>
      </section>
    </div>
  );
}
