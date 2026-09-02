import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Loader2, RefreshCw, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PILLAR_COLOR, type GoalInput, type Pillar } from "@/components/participant/vision-data";
import { generateVisionPlan, type PlanGoal } from "@/lib/vkm/vision-plan.functions";

/**
 * "Generate with AI" for the 1-year vision.
 *
 * Takes the owner's #1 goal and drafts a roadmap from it — a 1-year statement
 * plus 3–5 measurable goals — grounded in their real business numbers through
 * the same provider the AI Advisor uses.
 *
 * Nothing is written until they apply it, and each goal has its own checkbox:
 * this is a draft to argue with, not an answer. Applying only ADDS — it never
 * touches goals they already set.
 */
export function VisionPlanGenerator({
  headline,
  year,
  onApply,
}: {
  /** Their #1 goal — the whole plan is built backwards from this. */
  headline: string;
  year: number;
  onApply: (statement: string, goals: GoalInput[]) => Promise<void> | void;
}) {
  const generate = useServerFn(generateVisionPlan);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [applying, setApplying] = useState(false);
  const [statement, setStatement] = useState("");
  const [goals, setGoals] = useState<PlanGoal[]>([]);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [useStatement, setUseStatement] = useState(true);

  const hasHeadline = !!headline.trim();

  async function run() {
    if (busy) return;
    setBusy(true);
    setGoals([]);
    setStatement("");
    try {
      const r = await generate({ data: { headline, year } });
      if (!r.ok || !r.plan) {
        toast.error("Couldn't build the roadmap", { description: r.error });
        return;
      }
      setStatement(r.plan.statement);
      setGoals(r.plan.goals);
      setPicked(new Set(r.plan.goals.map((_, i) => i))); // everything on by default
      setUseStatement(!!r.plan.statement);
      setOpen(true);
    } catch (e) {
      toast.error("Couldn't build the roadmap", { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function apply() {
    if (applying) return;
    const chosen = goals.filter((_, i) => picked.has(i));
    if (!chosen.length && !useStatement) {
      toast.error("Pick at least one goal, or keep the vision statement.");
      return;
    }
    setApplying(true);
    try {
      await onApply(
        useStatement ? statement : "",
        chosen.map((g) => ({
          year: 1,
          title: g.title,
          category: g.category as Pillar,
          target_value: g.target_value,
          current_value: null,
          unit: g.unit,
          target_date: null,
          status: "not_started",
          why: g.why,
        })),
      );
      toast.success("Added to your vision", {
        description: `${chosen.length} goal${chosen.length === 1 ? "" : "s"} added — edit any of them anytime.`,
      });
      setOpen(false);
      setGoals([]);
      setStatement("");
    } catch (e) {
      toast.error("Couldn't save the plan", { description: (e as Error).message });
    } finally {
      setApplying(false);
    }
  }

  function toggle(i: number) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="rounded-lg"
        onClick={() => void run()}
        disabled={busy || !hasHeadline}
        title={
          hasHeadline
            ? "Draft a 1-year roadmap from your #1 goal"
            : "Write your #1 goal first — the roadmap is built from it"
        }
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Sparkles className="h-4 w-4 text-gold" />
        )}
        <span className="hidden sm:inline">{busy ? "Thinking…" : "Generate with AI"}</span>
      </Button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-3 overflow-hidden"
          >
            <div className="rounded-2xl border border-gold/40 bg-gold/[0.05] p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                  <Sparkles className="h-4 w-4 text-gold" /> Your roadmap to “{headline}”
                </p>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Discard this roadmap"
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Built from your business numbers. Untick anything you don't want — nothing is saved
                until you add it.
              </p>

              {statement && (
                <button
                  type="button"
                  onClick={() => setUseStatement((v) => !v)}
                  aria-pressed={useStatement}
                  className={cn(
                    "mt-3 flex w-full gap-2 rounded-xl border p-2.5 text-left transition-colors",
                    useStatement ? "border-gold/50 bg-card" : "border-border bg-card/40 opacity-60",
                  )}
                >
                  <Tick on={useStatement} />
                  <span className="min-w-0">
                    <span className="block text-[10px] font-semibold uppercase tracking-wide text-gold">
                      1-year vision statement
                    </span>
                    <span className="block text-sm text-foreground">{statement}</span>
                  </span>
                </button>
              )}

              <div className="mt-2 space-y-2">
                {goals.map((g, i) => {
                  const on = picked.has(i);
                  return (
                    <button
                      key={`${g.title}-${i}`}
                      type="button"
                      onClick={() => toggle(i)}
                      aria-pressed={on}
                      className={cn(
                        "flex w-full gap-2 rounded-xl border p-2.5 text-left transition-colors",
                        on ? "border-gold/50 bg-card" : "border-border bg-card/40 opacity-60",
                      )}
                    >
                      <Tick on={on} />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-1.5">
                          <span className="text-sm font-semibold text-foreground">{g.title}</span>
                          {g.target_value != null && (
                            <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-foreground">
                              {g.target_value}
                              {g.unit ? ` ${g.unit}` : ""}
                            </span>
                          )}
                        </span>
                        <span className="mt-0.5 flex items-center gap-1.5">
                          <span
                            aria-hidden
                            className="inline-block h-2 w-2 rounded-full"
                            style={{ background: PILLAR_COLOR[g.category as Pillar] }}
                          />
                          <span className="text-[11px] text-muted-foreground">{g.category}</span>
                        </span>
                        {g.why && (
                          <span className="mt-1 block text-[11px] italic text-muted-foreground">
                            {g.why}
                          </span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => void apply()}
                  disabled={applying}
                  className="rounded-full bg-gradient-navy text-primary-foreground hover:opacity-90"
                >
                  {applying ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                  Add to my vision
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void run()}
                  disabled={busy || applying}
                  className="rounded-full"
                >
                  <RefreshCw className="h-4 w-4" /> Try again
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function Tick({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border",
        on ? "border-gold bg-gradient-gold text-navy" : "border-muted-foreground/40",
      )}
    >
      {on && <Check className="h-3 w-3" />}
    </span>
  );
}
