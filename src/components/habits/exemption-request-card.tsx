import { useMemo, useState } from "react";
import { toast } from "sonner";
import { HeartPulse, Loader2, Send, Clock, Check, X, CalendarOff } from "lucide-react";
import { format } from "date-fns";
import { SectionCard } from "@/components/vkm/section-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { dateForDay, type DayState } from "@/components/habits/habit-tracker";
import {
  useMyExemptions,
  EXEMPTION_REASONS,
  type ExemptionReason,
} from "@/components/habits/habit-exemptions-data";

const STATUS_CHIP: Record<string, { label: string; cls: string; icon: typeof Clock }> = {
  pending: { label: "Awaiting staff", cls: "bg-[#6366f1]/12 text-[#4f46e5]", icon: Clock },
  approved: { label: "Excused", cls: "bg-[#10b981]/15 text-[#0d7a55]", icon: Check },
  rejected: { label: "Declined", cls: "bg-[#ef4444]/12 text-[#b91c1c]", icon: X },
};

/**
 * Participant-facing "special request" for a missed habit day. They pick a past
 * missed day, a reason, and send it to staff. An approved request excuses the
 * day and protects the streak. Capped at 3 per calendar month.
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
  const { rows, remaining, limit, submit, cancel } = useMyExemptions();
  const [day, setDay] = useState<string>("");
  const [reason, setReason] = useState<ExemptionReason>("fever");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  // Selectable days: past days (before today) that are currently Missed or
  // Partial and not already requested/excused. Newest first.
  const options = useMemo(() => {
    const requested = new Set(rows.filter((r) => r.status !== "rejected").map((r) => r.day_no));
    const out: { day: number; label: string }[] = [];
    for (let d = programDay - 1; d >= 1; d--) {
      const st = dayState(d);
      if ((st === "missed" || st === "inprogress") && !requested.has(d)) {
        out.push({ day: d, label: `Day ${d} · ${format(dateForDay(d, anchor), "EEE, MMM d")}` });
      }
    }
    return out;
  }, [programDay, dayState, rows, anchor]);

  async function send() {
    const dn = Number(day);
    if (!dn) {
      toast.error("Pick the day you missed.");
      return;
    }
    setBusy(true);
    try {
      await submit(dn, format(dateForDay(dn, anchor), "yyyy-MM-dd"), reason, note);
      toast.success("Request sent", { description: "Your coach will review it shortly." });
      setDay("");
      setNote("");
    } catch (e) {
      const msg = (e as Error).message || "";
      toast.error("Couldn't send request", {
        description: /limit/i.test(msg) ? "You've used all 3 exemptions this month." : msg,
      });
    } finally {
      setBusy(false);
    }
  }

  const atLimit = remaining <= 0;

  return (
    <SectionCard
      title={
        <span className="flex items-center gap-2 text-sm font-semibold">
          <HeartPulse className="h-4 w-4 text-[#6366f1]" /> Missed a day? Request an exemption
        </span>
      }
      subtitle="Fever, health or travel — send a missed day to your coach so your streak stays safe"
      action={
        <span
          className={cn(
            "rounded-full px-2.5 py-1 text-xs font-semibold",
            atLimit ? "bg-[#ef4444]/12 text-[#b91c1c]" : "bg-[#6366f1]/12 text-[#4f46e5]",
          )}
        >
          {remaining} of {limit} left this month
        </span>
      }
    >
      <div className="space-y-4">
        {atLimit ? (
          <p className="rounded-xl bg-secondary/50 px-3 py-3 text-sm text-muted-foreground">
            You've used all {limit} exemptions this month. Exemptions reset at the start of next
            month.
          </p>
        ) : options.length === 0 ? (
          <p className="rounded-xl bg-secondary/50 px-3 py-3 text-sm text-muted-foreground">
            No missed days to request right now — keep it up! You can request an exemption here
            whenever you miss a day for a genuine reason.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">Missed day</Label>
                <select
                  value={day}
                  onChange={(e) => setDay(e.target.value)}
                  className="h-10 w-full rounded-lg border border-input bg-background px-2 text-sm"
                >
                  <option value="">Select the day you missed…</option>
                  {options.map((o) => (
                    <option key={o.day} value={o.day}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Reason</Label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value as ExemptionReason)}
                  className="h-10 w-full rounded-lg border border-input bg-background px-2 text-sm"
                >
                  {EXEMPTION_REASONS.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Note to your coach (optional)</Label>
              <Input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="A short explanation helps your coach decide…"
                className="h-10 rounded-lg"
              />
            </div>
            <Button
              onClick={send}
              disabled={busy || !day}
              className="rounded-xl bg-gradient-navy text-primary-foreground hover:opacity-90"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}{" "}
              Send request
            </Button>
          </div>
        )}

        {rows.length > 0 && (
          <div className="space-y-2 border-t border-border pt-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Your requests
            </p>
            {rows.map((r) => {
              const chip = STATUS_CHIP[r.status];
              const Icon = chip.icon;
              return (
                <div
                  key={r.id}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card p-2.5"
                >
                  <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
                    <CalendarOff className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      Day {r.day_no} · {format(new Date(r.exempt_date), "EEE, MMM d")}
                    </p>
                    <p className="truncate text-[11px] capitalize text-muted-foreground">
                      {r.reason}
                      {r.note ? ` — ${r.note}` : ""}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
                      chip.cls,
                    )}
                  >
                    <Icon className="h-3 w-3" /> {chip.label}
                  </span>
                  {r.status === "pending" && (
                    <button
                      type="button"
                      onClick={() => void cancel(r.id)}
                      className="shrink-0 rounded-md p-1 text-muted-foreground hover:text-destructive"
                      aria-label="Cancel request"
                      title="Cancel this request"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </SectionCard>
  );
}
