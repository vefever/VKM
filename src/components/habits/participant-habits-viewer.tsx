import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import {
  Activity,
  Flame,
  CheckCircle2,
  Footprints,
  Trophy,
  Loader2,
  Users,
  Droplets,
  Dumbbell,
  AlertTriangle,
} from "lucide-react";
import { PageHeader } from "@/components/vkm/page-header";
import { SectionCard } from "@/components/vkm/section-card";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { HABITS, useParticipantHabits } from "@/components/habits/habit-tracker";
import { HabitGrid } from "@/components/habits/habit-grid";

type Person = { id: string; name: string };

function initials(name: string) {
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase();
}

export function ParticipantHabitsViewer({ eyebrow = "Coach" }: { eyebrow?: string }) {
  const [people, setPeople] = useState<Person[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loadingList, setLoadingList] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "participant");
      const ids = (roles ?? []).map((r) => r.user_id);
      if (ids.length === 0) {
        if (active) setLoadingList(false);
        return;
      }
      const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", ids);
      if (!active) return;
      const list = (profs ?? []).map((p) => ({ id: p.id, name: p.full_name ?? "Participant" }));
      list.sort((a, b) => a.name.localeCompare(b.name));
      setPeople(list);
      setSelected(list[0]?.id ?? null);
      setLoadingList(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const current = useMemo(() => people.find((p) => p.id === selected) ?? null, [people, selected]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-5"
    >
      <PageHeader
        eyebrow={eyebrow}
        title="Participant Habits"
        description="Live 90-day habit & step tracking for each participant — updates in real time."
        icon={Activity}
      />

      {loadingList ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading participants…
        </div>
      ) : people.length === 0 ? (
        <SectionCard title="No participants yet">
          <p className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
            <Users className="h-4 w-4" /> Participants will appear here once they're invited and
            start logging.
          </p>
        </SectionCard>
      ) : (
        <>
          {/* Participant chips */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {people.map((p) => {
              const active = p.id === selected;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelected(p.id)}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors",
                    active
                      ? "border-transparent bg-gradient-navy text-primary-foreground shadow-vkm"
                      : "border-border bg-card text-foreground hover:bg-secondary/60",
                  )}
                >
                  <span
                    className={cn(
                      "inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold",
                      active
                        ? "bg-white/15 text-primary-foreground"
                        : "bg-gradient-navy text-primary-foreground",
                    )}
                  >
                    {initials(p.name)}
                  </span>
                  {p.name}
                </button>
              );
            })}
          </div>

          {current && (
            <ParticipantDetail key={current.id} userId={current.id} name={current.name} />
          )}
        </>
      )}
    </motion.div>
  );
}

function ParticipantDetail({ userId, name }: { userId: string; name: string }) {
  const t = useParticipantHabits(userId);

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4 lg:grid-cols-7">
        <Stat
          icon={CheckCircle2}
          accent="text-[#10b981]"
          label="Today"
          value={`${t.todayDone}/${HABITS.length}`}
        />
        <Stat icon={Flame} accent="text-[#f59e0b]" label="Streak" value={`${t.streak}d`} />
        <Stat
          icon={Activity}
          accent="text-[#3b82f6]"
          label="Days done"
          value={`${t.completedDays}`}
        />
        <Stat
          icon={Trophy}
          accent="text-[oklch(0.5_0.11_80)]"
          label="Points"
          value={`${t.points}`}
        />
        <Stat icon={Footprints} accent="text-[#10b981]" label="Steps" value={`${t.steps}`} />
        <Stat
          icon={Droplets}
          accent="text-[#0ea5e9]"
          label="Water"
          value={`${(t.waterMl / 1000).toFixed(1)}L`}
        />
        <Stat
          icon={Dumbbell}
          accent="text-[#ef4444]"
          label="Workout"
          value={`${t.workoutMinutes}m`}
        />
      </div>

      {t.loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading {name}'s tracker…
        </div>
      ) : (
        <>
          <HabitGrid config={t.config} dayState={t.dayState} title={`${name} · Habit Tracker`} />
          {t.waterEvents.length > 0 && (
            <SectionCard
              title="Water log · today"
              subtitle="Each glass is timestamped · ⚠ flags glasses logged inside the 30-min cooldown"
            >
              <ul className="divide-y divide-border">
                {t.waterEvents.map((e) => (
                  <li key={e.id} className="flex items-start gap-3 py-2.5">
                    <span
                      className={cn(
                        "mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white",
                        e.ml > 0 ? "bg-[#0ea5e9]" : "bg-muted-foreground/40",
                      )}
                    >
                      <Droplets className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-foreground">
                        {e.ml > 0 ? "+" : ""}
                        {e.ml} ml
                        {e.rapid && (
                          <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                            <AlertTriangle className="h-3 w-3" /> rapid
                          </span>
                        )}
                      </p>
                      {e.reason && <p className="text-xs text-muted-foreground">“{e.reason}”</p>}
                    </div>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {format(new Date(e.created_at), "h:mm a")}
                    </span>
                  </li>
                ))}
              </ul>
            </SectionCard>
          )}
        </>
      )}
    </div>
  );
}

function Stat({
  icon: Icon,
  accent,
  label,
  value,
}: {
  icon: typeof Activity;
  accent: string;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3.5 shadow-vkm">
      <Icon className={cn("h-5 w-5", accent)} />
      <p className="mt-1.5 text-xl font-bold tabular-nums text-foreground">{value}</p>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
    </div>
  );
}
