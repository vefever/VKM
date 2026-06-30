import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, ChevronDown, ChevronUp, X } from "lucide-react";
import { format } from "date-fns";
import { SectionCard } from "@/components/vkm/section-card";
import { cn } from "@/lib/utils";
import {
  HABITS,
  dateForDay,
  type DayState,
  type TrackerConfig,
} from "@/components/habits/habit-tracker";
import { ProofAttachments } from "@/components/participant/proof-attachments";
import type { Attachment } from "@/components/chat/chat-data";

const CELL: Record<DayState, string> = {
  completed: "bg-[#10b981] text-white",
  inprogress: "bg-[#f59e0b] text-white",
  missed: "bg-[#ef4444] text-white",
  today: "border-2 border-[#0F1B2D] bg-card font-bold text-foreground",
  upcoming: "bg-muted/70 text-muted-foreground/60",
};

const STATE_LABEL: Record<DayState, { label: string; cls: string }> = {
  completed: { label: "All done", cls: "bg-[#10b981]/15 text-[#0d7a55]" },
  inprogress: { label: "Partial", cls: "bg-[#f59e0b]/15 text-[oklch(0.5_0.12_70)]" },
  missed: { label: "Missed", cls: "bg-[#ef4444]/15 text-[#b91c1c]" },
  today: { label: "Today", cls: "bg-navy/10 text-navy" },
  upcoming: { label: "Upcoming", cls: "bg-muted text-muted-foreground" },
};

export function HabitGrid({
  config,
  dayState,
  title = "Weekly Tracker",
  subtitle,
  isDone,
  proofsFor,
}: {
  config: TrackerConfig;
  dayState: (day: number) => DayState;
  title?: string;
  subtitle?: string;
  isDone?: (day: number, habitId: string) => boolean;
  proofsFor?: (day: number, habitId: string) => Attachment[];
}) {
  const [show, setShow] = useState(false); // hidden by default — reveal on demand
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const { weeks, daysPerWeek } = config;
  const interactive = !!isDone;

  // Column labels from the weekday of the first week's days.
  const cols = Array.from({ length: daysPerWeek }, (_, i) => format(dateForDay(i + 1), "EEEEE"));

  return (
    <SectionCard
      title={title}
      subtitle={subtitle ?? `${weeks} weeks · ${daysPerWeek}-day weeks`}
      action={
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          {show ? "Hide grid" : "Show grid"}
          {show ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
      }
    >
      <AnimatePresence initial={false}>
        {show && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="mx-auto max-w-xl pt-1">
              {interactive && (
                <p className="mb-2 text-center text-[11px] text-muted-foreground">
                  Tap any day to see that date’s submissions.
                </p>
              )}
              {/* Column header */}
              <div className="mb-1.5 flex items-center gap-2">
                <span className="w-8 shrink-0" />
                <div
                  className="grid flex-1"
                  style={{
                    gridTemplateColumns: `repeat(${daysPerWeek}, minmax(0,1fr))`,
                    gap: "0.375rem",
                  }}
                >
                  {cols.map((c, i) => (
                    <span
                      key={i}
                      className="text-center text-[10px] font-medium uppercase text-muted-foreground"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              </div>

              {/* Week rows */}
              <div className="space-y-1.5">
                {Array.from({ length: weeks }, (_, w) => (
                  <div key={w} className="flex items-center gap-2">
                    <span className="w-8 shrink-0 text-[11px] font-semibold text-muted-foreground">
                      W{w + 1}
                    </span>
                    <div
                      className="grid flex-1"
                      style={{
                        gridTemplateColumns: `repeat(${daysPerWeek}, minmax(0,1fr))`,
                        gap: "0.375rem",
                      }}
                    >
                      {Array.from({ length: daysPerWeek }, (_, c) => {
                        const day = w * daysPerWeek + c + 1;
                        const state = dayState(day);
                        const cellCls = cn(
                          "flex aspect-square items-center justify-center rounded-md text-[10px] font-medium tabular-nums transition-transform sm:text-xs",
                          CELL[state],
                          interactive &&
                            "cursor-pointer hover:scale-110 hover:ring-2 hover:ring-gold/50",
                        );
                        const content =
                          state === "completed" ? <Check className="h-3.5 w-3.5" /> : day;
                        return interactive ? (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setSelectedDay(day)}
                            title={`Day ${day} · ${STATE_LABEL[state].label}`}
                            className={cellCls}
                          >
                            {content}
                          </button>
                        ) : (
                          <div key={c} title={`Day ${day} · ${state}`} className={cellCls}>
                            {content}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* Legend */}
              <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 border-t border-border pt-3 text-[11px] text-muted-foreground">
                <Legend className="bg-[#10b981]" label="All done" />
                <Legend className="bg-[#f59e0b]" label="Partial" />
                <Legend className="bg-[#ef4444]" label="Missed" />
                <Legend className="border-2 border-[#0F1B2D] bg-card" label="Today" />
                <Legend className="bg-muted" label="Upcoming" />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!show && (
        <button
          type="button"
          onClick={() => setShow(true)}
          className="flex w-full items-center justify-between rounded-xl border border-dashed border-border bg-secondary/30 px-4 py-3 text-left transition-colors hover:border-gold/40 hover:bg-secondary/50"
        >
          <span className="text-sm font-medium text-foreground">
            View your full {weeks}-week completion grid
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
      )}

      <AnimatePresence>
        {selectedDay !== null && interactive && (
          <DayDetailModal
            day={selectedDay}
            dayState={dayState}
            isDone={isDone!}
            proofsFor={proofsFor}
            onClose={() => setSelectedDay(null)}
          />
        )}
      </AnimatePresence>
    </SectionCard>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn("h-3 w-3 rounded-full", className)} />
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Per-date submission summary (popup) — mobile-friendly bottom sheet.
// ---------------------------------------------------------------------------
function DayDetailModal({
  day,
  dayState,
  isDone,
  proofsFor,
  onClose,
}: {
  day: number;
  dayState: (day: number) => DayState;
  isDone: (day: number, habitId: string) => boolean;
  proofsFor?: (day: number, habitId: string) => Attachment[];
  onClose: () => void;
}) {
  const date = dateForDay(day);
  const state = dayState(day);
  const meta = STATE_LABEL[state];
  const doneHabits = HABITS.filter((h) => isDone(day, h.id));

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 24 }}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-card shadow-vkm-float sm:rounded-3xl"
      >
        <div className="flex items-center gap-3 border-b border-border p-4">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">{format(date, "EEEE, MMM d")}</p>
            <p className="text-[11px] text-muted-foreground">Day {day}</p>
          </div>
          <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium", meta.cls)}>
            {meta.label}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">
              {doneHabits.length}/{HABITS.length}
            </span>{" "}
            habits done
          </p>

          {doneHabits.length === 0 ? (
            <p className="rounded-xl bg-secondary/50 px-3 py-6 text-center text-sm text-muted-foreground">
              {state === "upcoming"
                ? "This day hasn’t started yet."
                : "No habits submitted on this day."}
            </p>
          ) : (
            doneHabits.map((h) => {
              const Icon = h.icon;
              const files = proofsFor?.(day, h.id) ?? [];
              return (
                <div key={h.id} className="rounded-xl border border-border p-3">
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-white"
                      style={{ background: `linear-gradient(135deg, ${h.from}, ${h.to})` }}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="flex-1 text-sm font-medium text-foreground">{h.name}</span>
                    <Check className="h-4 w-4 text-[#10b981]" />
                  </div>
                  {files.length > 0 ? (
                    <div className="mt-2">
                      <ProofAttachments files={files} />
                    </div>
                  ) : (
                    <p className="mt-1.5 text-[11px] text-muted-foreground">
                      Auto-completed from tracker — no file attached.
                    </p>
                  )}
                </div>
              );
            })
          )}
        </div>
      </motion.div>
    </div>
  );
}
