import { motion } from "framer-motion";
import { Link } from "@tanstack/react-router";
import { Users, Activity, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/vkm/page-header";
import { SectionCard } from "@/components/vkm/section-card";
import { AvatarBadge } from "@/components/vkm/avatar-badge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useParticipantsOverview } from "@/components/coach/coach-data";

export function CoachParticipants() {
  const { rows, loading } = useParticipantsOverview();

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-5"
    >
      <PageHeader
        eyebrow="Coach"
        title="My Participants"
        description="Each owner's progress, points and risk — live. Open tracking for habits, steps and water."
        icon={Users}
        actions={
          <Button variant="outline" className="rounded-full" asChild>
            <Link to="/coach/health">
              <Activity className="h-4 w-4" /> Habit tracking
            </Link>
          </Button>
        }
      />

      <SectionCard bodyClassName="p-0">
        {loading ? (
          <p className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading participants…
          </p>
        ) : rows.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            No participants yet — they appear once invited.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((p) => {
              const pct = Math.round((p.weeksDone / 16) * 100);
              return (
                <li key={p.id} className="flex items-center gap-4 px-4 py-3.5 sm:px-5">
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
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>
    </motion.div>
  );
}
