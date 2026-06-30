import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Dumbbell, Footprints, Bike, HeartPulse, Plus, X, Timer } from "lucide-react";
import { SectionCard } from "@/components/vkm/section-card";
import { cn } from "@/lib/utils";
import type { Workout } from "@/components/habits/habit-tracker";

const KINDS = [
  { key: "gym", label: "Gym", icon: Dumbbell, color: "#ef4444" },
  { key: "run", label: "Run", icon: Footprints, color: "#10b981" },
  { key: "cycle", label: "Cycle", icon: Bike, color: "#0ea5e9" },
  { key: "yoga", label: "Yoga", icon: HeartPulse, color: "#8b5cf6" },
] as const;

const PRESET_MINS = [20, 30, 45, 60];

export function WorkoutCard({
  items,
  totalMinutes,
  addWorkout,
  removeWorkout,
}: {
  items: Workout[];
  totalMinutes: number;
  addWorkout: (kind: string, minutes: number) => void;
  removeWorkout: (id: string) => void;
}) {
  const [kind, setKind] = useState<string>("gym");
  const [minutes, setMinutes] = useState(30);

  const kindMeta = (k: string) => KINDS.find((x) => x.key === k) ?? KINDS[0];

  return (
    <SectionCard
      title="Gym & Workouts"
      subtitle="Log a session — completes “Gym / Workout”"
      action={
        totalMinutes > 0 ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-[#ef4444]/12 px-2 py-0.5 text-[11px] font-semibold text-[#b91c1c]">
            <Timer className="h-3 w-3" /> {totalMinutes} min today
          </span>
        ) : undefined
      }
    >
      {/* Kind picker */}
      <div className="grid grid-cols-4 gap-2">
        {KINDS.map((k) => {
          const Icon = k.icon;
          const active = kind === k.key;
          return (
            <button
              key={k.key}
              type="button"
              onClick={() => setKind(k.key)}
              className={cn(
                "flex flex-col items-center gap-1 rounded-2xl border p-2.5 text-xs font-medium transition-all hover:-translate-y-0.5",
                active
                  ? "border-transparent text-white shadow-vkm"
                  : "border-border bg-card text-foreground hover:bg-secondary/50",
              )}
              style={active ? { background: k.color } : undefined}
            >
              <Icon className="h-5 w-5" />
              {k.label}
            </button>
          );
        })}
      </div>

      {/* Minutes */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {PRESET_MINS.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMinutes(m)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium transition-colors",
              minutes === m
                ? "bg-gradient-navy text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground",
            )}
          >
            {m}m
          </button>
        ))}
        <button
          type="button"
          onClick={() => addWorkout(kind, minutes)}
          className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-xl bg-gradient-navy px-3 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> Log {minutes}m
        </button>
      </div>

      {/* Today's sessions */}
      {items.length > 0 && (
        <ul className="mt-4 space-y-2">
          <AnimatePresence initial={false}>
            {items.map((w) => {
              const meta = kindMeta(w.kind);
              const Icon = meta.icon;
              return (
                <motion.li
                  key={w.id}
                  layout
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2"
                >
                  <span
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-white"
                    style={{ background: meta.color }}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="flex-1 text-sm font-medium capitalize text-foreground">
                    {w.kind}
                  </span>
                  <span className="text-sm tabular-nums text-muted-foreground">
                    {w.minutes} min
                  </span>
                  <button
                    type="button"
                    onClick={() => removeWorkout(w.id)}
                    className="rounded-md p-1 text-muted-foreground hover:text-destructive"
                    aria-label="Remove"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}
    </SectionCard>
  );
}
