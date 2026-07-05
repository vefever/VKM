import { useMemo } from "react";
import { motion } from "framer-motion";
import { Users2, UserCog, Loader2, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/vkm/page-header";
import { SectionCard } from "@/components/vkm/section-card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useParticipantInteractions, type ParticipantInteraction } from "@/components/coach/coach-performance-data";

// Real coach → participant caseload map, from participant_coach_interactions()
// (staff-callable). Shows who each coach is responsible for + who's unassigned.
export function CoachAssignmentPage() {
  const { rows, loading } = useParticipantInteractions();

  const { byCoach, unassigned } = useMemo(() => {
    const groups = new Map<string, { name: string; members: ParticipantInteraction[] }>();
    const un: ParticipantInteraction[] = [];
    rows.forEach((r) => {
      if (r.coachId) {
        const g = groups.get(r.coachId) ?? { name: r.coachName || "Coach", members: [] };
        g.members.push(r);
        groups.set(r.coachId, g);
      } else {
        un.push(r);
      }
    });
    const byCoach = [...groups.entries()]
      .map(([id, g]) => ({ id, ...g }))
      .sort((a, b) => b.members.length - a.members.length);
    return { byCoach, unassigned: un };
  }, [rows]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
      className="space-y-5"
    >
      <PageHeader
        eyebrow="Super Admin"
        title="Coach Assignment"
        description="Which participants each coach is responsible for — live from real assignments."
        icon={UserCog}
      />

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          {unassigned.length > 0 && (
            <SectionCard
              title={<span className="flex items-center gap-2 text-sm font-semibold text-red-600"><AlertTriangle className="h-4 w-4" /> Unassigned participants</span>}
              subtitle={`${unassigned.length} participant(s) with no coach`}
              bodyClassName="p-0"
            >
              <div className="divide-y divide-border">
                {unassigned.map((r) => <MemberRow key={r.participantId} r={r} />)}
              </div>
            </SectionCard>
          )}

          {byCoach.length === 0 ? (
            <SectionCard><p className="py-8 text-center text-sm text-muted-foreground">No coach assignments yet.</p></SectionCard>
          ) : (
            byCoach.map((c) => (
              <SectionCard
                key={c.id}
                title={<span className="flex items-center gap-2 text-sm font-semibold"><Users2 className="h-4 w-4 text-navy" /> {c.name}</span>}
                subtitle={`${c.members.length} participant(s)`}
                bodyClassName="p-0"
              >
                <div className="divide-y divide-border">
                  {c.members.map((r) => <MemberRow key={r.participantId} r={r} />)}
                </div>
              </SectionCard>
            ))
          )}
        </>
      )}
    </motion.div>
  );
}

function MemberRow({ r }: { r: ParticipantInteraction }) {
  const initials = (r.participantName || "?").split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div className="flex items-center gap-3 px-4 py-2.5">
      <Avatar className="h-8 w-8 border border-border">
        <AvatarImage src={r.participantAvatar ?? undefined} />
        <AvatarFallback className="bg-gradient-navy text-[10px] font-semibold text-primary-foreground">{initials}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{r.participantName}</p>
        <p className="truncate text-[11px] text-muted-foreground">{r.batchName || "—"} · {r.weeksApproved} approved · {r.totalPoints} pts</p>
      </div>
      {r.weeksPending > 0 && (
        <span className="shrink-0 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">{r.weeksPending} pending</span>
      )}
    </div>
  );
}
