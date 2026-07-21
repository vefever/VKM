import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  HeartPulse,
  Loader2,
  Send,
  Clock,
  Check,
  X,
  Thermometer,
  Stethoscope,
  Plane,
  Users,
  MoreHorizontal,
  ShieldCheck,
  CalendarDays,
  type LucideIcon,
} from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { dateForDay, type DayState } from "@/components/habits/habit-tracker";
import {
  useMyExemptions,
  EXEMPTION_REASONS,
  type ExemptionReason,
} from "@/components/habits/habit-exemptions-data";

const NOTE_MIN = 5;

const REASON_ICON: Record<ExemptionReason, LucideIcon> = {
  fever: Thermometer,
  health: Stethoscope,
  travel: Plane,
  family: Users,
  other: MoreHorizontal,
};

const STATUS_META: Record<
  string,
  { label: string; icon: LucideIcon; text: string; bar: string; chip: string }
> = {
  pending: {
    label: "Awaiting staff",
    icon: Clock,
    text: "text-[#4f46e5]",
    bar: "bg-[#6366f1]",
    chip: "bg-[#6366f1]/12 text-[#4f46e5]",
  },
  approved: {
    label: "Excused",
    icon: Check,
    text: "text-[#0d7a55]",
    bar: "bg-[#10b981]",
    chip: "bg-[#10b981]/15 text-[#0d7a55]",
  },
  rejected: {
    label: "Declined",
    icon: X,
    text: "text-[#b91c1c]",
    bar: "bg-[#ef4444]",
    chip: "bg-[#ef4444]/12 text-[#b91c1c]",
  },
};

/**
 * Participant-facing "special request" for a missed habit day — a polished flow:
 * pick a missed day, choose a reason, write a required note, and send it to your
 * coach. An approved request counts the day as a full 6/6 (streak + points).
 * Capped at 3 per calendar month.
 */
export function ExemptionRequestCard({
  programDay,
  dayState,
  anchor,
}: {
  programDay: number;
  dayState: (day: number) => DayState;
  anchor?: Date;
}) {
  const { rows, remaining, limit, usedThisMonth, submit, cancel } = useMyExemptions();
  const [day, setDay] = useState<number | null>(null);
  const [reason, setReason] = useState<ExemptionReason>("fever");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  // Selectable days: past days that are Missed or Partial and not already
  // requested/excused. Newest first.
  const options = useMemo(() => {
    const requested = new Set(rows.filter((r) => r.status !== "rejected").map((r) => r.day_no));
    const out: { day: number; date: Date }[] = [];
    for (let d = programDay - 1; d >= 1; d--) {
      const st = dayState(d);
      if ((st === "missed" || st === "inprogress") && !requested.has(d)) {
        out.push({ day: d, date: dateForDay(d, anchor) });
      }
    }
    return out;
  }, [programDay, dayState, rows, anchor]);

  const atLimit = remaining <= 0;
  const noteOk = note.trim().length >= NOTE_MIN;
  const canSend = !!day && noteOk && !busy;

  async function send() {
    if (!day) return toast.error("Pick the day you missed.");
    if (!noteOk) return toast.error(`Add a short note (at least ${NOTE_MIN} characters).`);
    setBusy(true);
    try {
      await submit(day, format(dateForDay(day, anchor), "yyyy-MM-dd"), reason, note);
      toast.success("Request sent to your coach", {
        description: "You'll be notified once it's reviewed.",
      });
      setDay(null);
      setNote("");
      setReason("fever");
    } catch (e) {
      const msg = (e as Error).message || "";
      toast.error("Couldn't send request", {
        description: /limit/i.test(msg)
          ? "You've used all 3 exemptions this month."
          : /note/i.test(msg)
            ? "Please add a short note for your coach."
            : msg,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-[#6366f1]/25 bg-card shadow-vkm">
      {/* Header band */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[#4f46e5] via-[#6366f1] to-[#818cf8] px-5 py-4 text-white">
        <span
          aria-hidden
          className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-white/15 blur-2xl"
        />
        <div className="relative flex items-center gap-3">
          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25">
            <HeartPulse className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-bold leading-tight">Missed a day? Protect your streak</h3>
            <p className="text-[12.5px] text-white/85">
              Fever, health or travel — send that day to your coach so it still counts.
            </p>
          </div>
          <QuotaPips used={usedThisMonth} limit={limit} />
        </div>
      </div>

      <div className="space-y-5 p-5">
        {atLimit ? (
          <EmptyBlock
            icon={ShieldCheck}
            title="All caught up for this month"
            body={`You've used all ${limit} exemptions this month. Your allowance resets on the 1st.`}
          />
        ) : options.length === 0 ? (
          <EmptyBlock
            icon={Check}
            title="Nothing to excuse — nice work!"
            body="No missed days right now. If you ever miss one for a genuine reason, you can request an exemption here."
          />
        ) : (
          <div className="space-y-5">
            {/* Step 1 — which day */}
            <Field step={1} label="Which day did you miss?">
              <div className="-mx-0.5 flex max-h-40 flex-wrap gap-2 overflow-y-auto p-0.5">
                {options.map((o) => {
                  const active = day === o.day;
                  return (
                    <button
                      key={o.day}
                      type="button"
                      onClick={() => setDay(active ? null : o.day)}
                      className={cn(
                        "group flex items-center gap-2 rounded-xl border px-3 py-2 text-left transition-all",
                        active
                          ? "border-transparent bg-[#6366f1] text-white shadow-vkm"
                          : "border-border bg-card hover:border-[#6366f1]/40 hover:bg-[#6366f1]/[0.05]",
                      )}
                    >
                      <CalendarDays
                        className={cn("h-4 w-4 shrink-0", active ? "text-white" : "text-[#6366f1]")}
                      />
                      <span className="leading-tight">
                        <span className="block text-xs font-semibold">
                          {format(o.date, "EEE, MMM d")}
                        </span>
                        <span
                          className={cn(
                            "block text-[10px]",
                            active ? "text-white/80" : "text-muted-foreground",
                          )}
                        >
                          Day {o.day}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </Field>

            {/* Step 2 — reason */}
            <Field step={2} label="What happened?">
              <div className="flex flex-wrap gap-2">
                {EXEMPTION_REASONS.map((r) => {
                  const Icon = REASON_ICON[r.id];
                  const active = reason === r.id;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setReason(r.id)}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all",
                        active
                          ? "border-transparent bg-gradient-navy text-primary-foreground shadow-vkm"
                          : "border-border bg-card text-foreground hover:bg-secondary/60",
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" /> {r.label}
                    </button>
                  );
                })}
              </div>
            </Field>

            {/* Step 3 — required note */}
            <Field
              step={3}
              label={
                <span className="flex items-center gap-1">
                  A note for your coach <span className="text-[#ef4444]">*</span>
                </span>
              }
            >
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                maxLength={400}
                placeholder="Tell your coach what happened — e.g. “Down with fever, couldn't do my habits.” This is required."
                className={cn(
                  "resize-none rounded-xl",
                  note.length > 0 &&
                    !noteOk &&
                    "border-[#ef4444]/50 focus-visible:ring-[#ef4444]/30",
                )}
              />
              <div className="flex items-center justify-between text-[11px]">
                <span className={cn(noteOk ? "text-[#0d7a55]" : "text-muted-foreground")}>
                  {noteOk ? "Looks good." : `Required — at least ${NOTE_MIN} characters.`}
                </span>
                <span className="tabular-nums text-muted-foreground">{note.trim().length}/400</span>
              </div>
            </Field>

            <Button
              onClick={send}
              disabled={!canSend}
              className="w-full rounded-xl bg-gradient-navy py-5 text-sm font-semibold text-primary-foreground shadow-vkm hover:opacity-90 disabled:opacity-50 sm:w-auto sm:px-6"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}{" "}
              Send to coach
            </Button>
          </div>
        )}

        {/* Your requests */}
        {rows.length > 0 && (
          <div className="space-y-2 border-t border-border pt-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Your requests
            </p>
            <AnimatePresence initial={false}>
              {rows.map((r) => {
                const meta = STATUS_META[r.status];
                const Icon = meta.icon;
                const RIcon =
                  REASON_ICON[(r.reason as ExemptionReason) ?? "other"] ?? MoreHorizontal;
                return (
                  <motion.div
                    key={r.id}
                    layout
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, height: 0, marginTop: 0 }}
                    className="relative flex items-center gap-3 overflow-hidden rounded-xl border border-border bg-card p-2.5 pl-3"
                  >
                    <span className={cn("absolute inset-y-0 left-0 w-1", meta.bar)} />
                    <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#6366f1]/10 text-[#4f46e5]">
                      <RIcon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {format(new Date(r.exempt_date), "EEE, MMM d")}{" "}
                        <span className="text-xs font-normal text-muted-foreground">
                          · Day {r.day_no}
                        </span>
                      </p>
                      {r.note && (
                        <p className="truncate text-[11px] text-muted-foreground">“{r.note}”</p>
                      )}
                    </div>
                    <span
                      className={cn(
                        "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
                        meta.chip,
                      )}
                    >
                      <Icon className="h-3 w-3" /> {meta.label}
                    </span>
                    {r.status === "pending" && (
                      <button
                        type="button"
                        onClick={() => void cancel(r.id)}
                        className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:text-destructive"
                        aria-label="Cancel request"
                        title="Cancel this request"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({
  step,
  label,
  children,
}: {
  step: number;
  label: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <p className="flex items-center gap-2 text-xs font-semibold text-foreground">
        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#6366f1]/12 text-[10px] font-bold text-[#4f46e5]">
          {step}
        </span>
        {label}
      </p>
      {children}
    </div>
  );
}

function QuotaPips({ used, limit }: { used: number; limit: number }) {
  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      <div className="flex gap-1">
        {Array.from({ length: limit }, (_, i) => (
          <span
            key={i}
            className={cn(
              "h-2 w-2 rounded-full ring-1 ring-inset ring-white/50",
              i < used ? "bg-white/35" : "bg-white",
            )}
          />
        ))}
      </div>
      <span className="text-[10px] font-medium text-white/85">{limit - used} left this month</span>
    </div>
  );
}

function EmptyBlock({
  icon: Icon,
  title,
  body,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border bg-secondary/30 px-4 py-8 text-center">
      <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[#6366f1]/10 text-[#4f46e5]">
        <Icon className="h-5 w-5" />
      </span>
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="max-w-xs text-xs text-muted-foreground">{body}</p>
    </div>
  );
}
