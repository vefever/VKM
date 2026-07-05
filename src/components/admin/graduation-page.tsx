import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { GraduationCap, Award, Loader2, CheckCircle2, Users } from "lucide-react";
import { PageHeader } from "@/components/vkm/page-header";
import { SectionCard } from "@/components/vkm/section-card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useCohort } from "@/components/coach/cohort-data";
import { cn } from "@/lib/utils";

// Graduation & Recognition — real data from the cohort roster
// (coach_cohort_overview, org-wide for mentor/admin) + profiles.is_alumni,
// with the mentor/super-admin-callable admin_set_alumni action. No mock data.
export function GraduationPage({ eyebrow = "Super Admin" }: { eyebrow?: string } = {}) {
  const { rows, loading } = useCohort();
  const [alumni, setAlumni] = useState<Set<string>>(new Set());
  const [alumniLoading, setAlumniLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const loadAlumni = useCallback(async () => {
    const { data } = await supabase.from("profiles").select("id, is_alumni");
    setAlumni(new Set(((data ?? []) as { id: string; is_alumni: boolean }[]).filter((p) => p.is_alumni).map((p) => p.id)));
    setAlumniLoading(false);
  }, []);

  useEffect(() => {
    void loadAlumni();
  }, [loadAlumni]);

  async function setAlumniFlag(userId: string, value: boolean) {
    setBusy(userId);
    try {
      const { error } = await supabase.rpc("admin_set_alumni", { _user_id: userId, _value: value });
      if (error) throw error;
      toast.success(value ? "Marked as alumni" : "Alumni removed");
      await loadAlumni();
    } catch (e) {
      toast.error("Couldn't update", { description: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  const { readyToGraduate, alumniList, gradRate, startedCount } = useMemo(() => {
    const started = rows.filter((r) => r.started);
    // Ready = finished (or all-but-one week approved) and not yet alumni.
    const ready = started.filter((r) => Number(r.weeks_approved) >= r.total_weeks - 1 && !alumni.has(r.user_id));
    const alum = rows.filter((r) => alumni.has(r.user_id));
    const rate = started.length ? Math.round((alum.length / started.length) * 100) : 0;
    return { readyToGraduate: ready, alumniList: alum, gradRate: rate, startedCount: started.length };
  }, [rows, alumni]);

  const busyLoading = loading || alumniLoading;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
      className="space-y-5"
    >
      <PageHeader
        eyebrow={eyebrow}
        title="Graduation & Recognition"
        description="Who's completed the program, who's ready to graduate, and your alumni — all live."
        icon={GraduationCap}
      />

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <GradTile label="Active participants" value={startedCount} icon={Users} loading={busyLoading} />
        <GradTile label="Alumni" value={alumniList.length} icon={Award} loading={busyLoading} accent="gold" />
        <GradTile label="Graduation rate" value={gradRate} suffix="%" icon={GraduationCap} loading={busyLoading} accent="success" />
        <GradTile label="Ready to graduate" value={readyToGraduate.length} icon={CheckCircle2} loading={busyLoading} accent="success" />
      </section>

      <SectionCard
        title={<span className="flex items-center gap-2 text-sm font-semibold"><CheckCircle2 className="h-4 w-4 text-muted-foreground" /> Ready to graduate</span>}
        subtitle="Completed (or all-but-one) approved weeks — mark them alumni to move them to the Alumni Circle"
        bodyClassName="p-0"
      >
        {busyLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : readyToGraduate.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No one is ready to graduate yet.</p>
        ) : (
          <div className="divide-y divide-border">
            {readyToGraduate.map((r) => (
              <PersonRow key={r.user_id} r={r} busy={busy === r.user_id} action={
                <Button size="sm" className="h-8 rounded-lg bg-gradient-navy" disabled={busy === r.user_id} onClick={() => setAlumniFlag(r.user_id, true)}>
                  {busy === r.user_id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Award className="h-3.5 w-3.5" />} Mark alumni
                </Button>
              } />
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard
        title={<span className="flex items-center gap-2 text-sm font-semibold"><Award className="h-4 w-4 text-gold" /> Alumni</span>}
        subtitle={`${alumniList.length} graduate(s)`}
        bodyClassName="p-0"
      >
        {busyLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : alumniList.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No alumni yet.</p>
        ) : (
          <div className="divide-y divide-border">
            {alumniList.map((r) => (
              <PersonRow key={r.user_id} r={r} busy={busy === r.user_id} action={
                <Button size="sm" variant="ghost" className="h-8 rounded-lg text-muted-foreground" disabled={busy === r.user_id} onClick={() => setAlumniFlag(r.user_id, false)}>
                  {busy === r.user_id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Remove
                </Button>
              } />
            ))}
          </div>
        )}
      </SectionCard>
    </motion.div>
  );
}

function GradTile({ label, value, suffix, icon: Icon, accent, loading }: { label: string; value: number; suffix?: string; icon: typeof Award; accent?: "gold" | "success"; loading?: boolean }) {
  const chip = accent === "gold" ? "bg-gradient-gold text-navy" : accent === "success" ? "bg-[oklch(0.93_0.06_160)] text-[oklch(0.35_0.12_160)]" : "bg-gradient-navy text-primary-foreground";
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-vkm">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
          {loading ? <span className="mt-1 block h-7 w-12 animate-pulse rounded bg-secondary/60" /> : <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{value}{suffix}</p>}
        </div>
        <span className={cn("inline-flex h-9 w-9 items-center justify-center rounded-xl", chip)}><Icon className="h-4 w-4" /></span>
      </div>
    </div>
  );
}

function PersonRow({ r, action }: { r: ReturnType<typeof useCohort>["rows"][number]; busy: boolean; action: React.ReactNode }) {
  const initials = (r.name || "?").split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Avatar className="h-9 w-9 border border-border">
        <AvatarImage src={r.avatar_url ?? undefined} />
        <AvatarFallback className="bg-gradient-navy text-[11px] font-semibold text-primary-foreground">{initials}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">{r.name}</p>
        <p className="truncate text-[11px] text-muted-foreground">{r.batch_name ?? "—"} · {r.weeks_approved}/{r.total_weeks} weeks approved · {Number(r.points).toLocaleString("en-IN")} pts</p>
      </div>
      <div className="shrink-0">{action}</div>
    </div>
  );
}
