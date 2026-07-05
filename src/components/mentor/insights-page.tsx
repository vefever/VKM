import { useMemo } from "react";
import { motion } from "framer-motion";
import { Link } from "@tanstack/react-router";
import { Sparkles, AlertTriangle, TrendingDown, GraduationCap, Clock3, CheckCircle2, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/vkm/page-header";
import { SectionCard } from "@/components/vkm/section-card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useCohort } from "@/components/coach/cohort-data";

// Rule-derived insights ("signals") — every number traces to a real table
// (coach_cohort_overview, org-wide for a mentor). No fabricated data.
export function MentorInsightsPage() {
  const { rows, loading } = useCohort();

  const signals = useMemo(() => {
    const started = rows.filter((r) => r.started);
    const atRisk = rows.filter((r) => r.atRisk);
    const pending = rows.filter((r) => Number(r.pending_proofs) > 0);
    const inactive3d = started.filter((r) => !r.habit_active_3d);
    // Near graduation: within 2 approved weeks of finishing the program.
    const nearGrad = started.filter((r) => r.total_weeks - Number(r.weeks_approved) <= 2 && Number(r.weeks_approved) > 0);

    // Lowest-completion active batch (avg weeks_approved / total_weeks).
    const byBatch = new Map<string, { name: string; pct: number[]; }>();
    started.forEach((r) => {
      if (!r.batch_id) return;
      const e = byBatch.get(r.batch_id) ?? { name: r.batch_name ?? "Batch", pct: [] as number[] };
      e.pct.push(r.total_weeks > 0 ? (Number(r.weeks_approved) / r.total_weeks) * 100 : 0);
      byBatch.set(r.batch_id, e);
    });
    let lowestBatch: { name: string; pct: number } | null = null;
    for (const e of byBatch.values()) {
      const avg = Math.round(e.pct.reduce((n, x) => n + x, 0) / e.pct.length);
      if (lowestBatch === null || avg < lowestBatch.pct) lowestBatch = { name: e.name, pct: avg };
    }

    return { atRisk, pending, inactive3d, nearGrad, lowestBatch };
  }, [rows]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
      className="space-y-5"
    >
      <PageHeader
        eyebrow="Mentor · VK"
        title="Insights"
        description="What needs your attention — derived live from real cohort data across every batch."
        icon={Sparkles}
      />

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <SignalTile label="At risk" value={signals.atRisk.length} icon={AlertTriangle} accent="danger" />
            <SignalTile label="Pending proofs" value={signals.pending.length} icon={Clock3} accent="warning" />
            <SignalTile label="Inactive 3+ days" value={signals.inactive3d.length} icon={TrendingDown} accent="warning" />
            <SignalTile label="Near graduation" value={signals.nearGrad.length} icon={GraduationCap} accent="success" />
          </section>

          {signals.lowestBatch && (
            <SectionCard>
              <p className="flex items-center gap-2 text-sm">
                <TrendingDown className="h-4 w-4 text-muted-foreground" />
                <span className="font-semibold text-foreground">{signals.lowestBatch.name}</span>
                <span className="text-muted-foreground">has the lowest completion at {signals.lowestBatch.pct}% — worth a check-in with its coaches.</span>
              </p>
            </SectionCard>
          )}

          <AttentionList title="Participants at risk" icon={AlertTriangle} rows={signals.atRisk} empty="No one is at risk right now — the whole cohort is on track." reasons />
          <AttentionList title="Tracking to graduation" icon={GraduationCap} rows={signals.nearGrad} empty="No one is within reach of graduation yet." />
        </>
      )}
    </motion.div>
  );
}

function SignalTile({ label, value, icon: Icon, accent }: { label: string; value: number; icon: typeof Sparkles; accent: "danger" | "warning" | "success" }) {
  const style = {
    danger: "bg-red-50 text-red-600",
    warning: "bg-amber-50 text-amber-700",
    success: "bg-[oklch(0.93_0.06_160)] text-[oklch(0.35_0.12_160)]",
  }[accent];
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-vkm">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{value}</p>
        </div>
        <span className={cn("inline-flex h-9 w-9 items-center justify-center rounded-xl", style)}><Icon className="h-4 w-4" /></span>
      </div>
    </div>
  );
}

function AttentionList({ title, icon: Icon, rows, empty, reasons }: { title: string; icon: typeof Sparkles; rows: ReturnType<typeof useCohort>["rows"]; empty: string; reasons?: boolean }) {
  return (
    <SectionCard title={<span className="flex items-center gap-2 text-sm font-semibold"><Icon className="h-4 w-4 text-muted-foreground" /> {title}</span>} subtitle={`${rows.length} participant(s)`} bodyClassName="p-0">
      {rows.length === 0 ? (
        <p className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground"><CheckCircle2 className="h-4 w-4" /> {empty}</p>
      ) : (
        <div className="divide-y divide-border">
          {rows.map((r) => {
            const initials = (r.name || "?").split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase();
            return (
              <Link key={r.user_id} to="/mentor/participant/$userId" params={{ userId: r.user_id }} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-secondary/40">
                <Avatar className="h-9 w-9 border border-border">
                  <AvatarImage src={r.avatar_url ?? undefined} />
                  <AvatarFallback className="bg-gradient-navy text-[11px] font-semibold text-primary-foreground">{initials}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">{r.name}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{r.batch_name ?? "—"} · Week {r.currentWeek} · {r.weeks_approved} approved</p>
                  {reasons && r.reasons.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {r.reasons.map((reason) => (
                        <span key={reason} className="rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] text-destructive">{reason}</span>
                      ))}
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </SectionCard>
  );
}
