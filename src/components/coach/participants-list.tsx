import { motion } from "framer-motion";
import { Link } from "@tanstack/react-router";
import { Users, Activity, Loader2, ChevronRight, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/vkm/page-header";
import { AvatarBadge } from "@/components/vkm/avatar-badge";
import { SectionCard } from "@/components/vkm/section-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useParticipantsOverview } from "@/components/coach/coach-data";

export function ParticipantsList({
  eyebrow = "Coach",
  detailBase,
  habitsTo,
}: {
  eyebrow?: string;
  detailBase: string; // e.g. "/coach/participant"
  habitsTo?: string; // e.g. "/coach/health"
}) {
  const { rows, loading, error } = useParticipantsOverview();

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-5"
    >
      <PageHeader
        eyebrow={eyebrow}
        title="Participants"
        description="Tap a participant to open their full progress card — personal, business & 16-week journey."
        icon={Users}
        actions={
          habitsTo ? (
            <Button variant="outline" className="rounded-full" asChild>
              <Link to={habitsTo}>
                <Activity className="h-4 w-4" /> Habit tracking
              </Link>
            </Button>
          ) : undefined
        }
      />

      <SectionCard bodyClassName="p-0">
        {loading ? (
          <p className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading participants…
          </p>
        ) : error ? (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <AlertTriangle className="h-6 w-6 text-destructive" />
            <p className="text-sm font-medium text-foreground">Couldn’t load participants</p>
            <p className="max-w-sm text-xs text-muted-foreground">{error}</p>
          </div>
        ) : rows.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            No participants yet — they appear once invited.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((p) => {
              const pct = Math.round((p.weeksDone / 16) * 100);
              return (
                <li key={p.id}>
                  <Link
                    to={`${detailBase}/${p.id}` as any}
                    className="flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-secondary/50 sm:px-5"
                  >
                    <AvatarBadge name={p.name} src={p.avatar_url} size="lg" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium text-foreground">{p.name}</p>
                        {p.pending > 0 && (
                          <span className="rounded-full bg-gold/15 px-1.5 py-0.5 text-[10px] font-semibold text-[oklch(0.45_0.1_85)]">
                            {p.pending} pending
                          </span>
                        )}
                      </div>
                      <div className="mt-1.5 flex items-center gap-2">
                        <Progress value={pct} className="h-1.5 max-w-[160px] flex-1" />
                        <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                          {p.weeksDone}/16
                        </span>
                      </div>
                    </div>
                    <span className="hidden shrink-0 text-right sm:block">
                      <span className="block text-sm font-bold tabular-nums text-foreground">
                        {p.points}
                      </span>
                      <span className="text-[11px] text-muted-foreground">points</span>
                    </span>
                    <Badge
                      variant={p.atRisk ? "destructive" : "outline"}
                      className="shrink-0 rounded-full"
                    >
                      {p.atRisk ? "At risk" : "On track"}
                    </Badge>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>
    </motion.div>
  );
}
