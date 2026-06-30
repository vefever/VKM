import { useEffect, useState } from "react";
import { Pencil, Trash2, Target } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  PILLARS,
  GOAL_STATUSES,
  GOAL_TEMPLATES,
  STATUS_META,
  PILLAR_COLOR,
  goalProgress,
  type VisionGoal,
  type GoalInput,
  type Pillar,
  type GoalStatus,
} from "@/components/participant/vision-data";

// ---------------------------------------------------------------------------
// Goal card
// ---------------------------------------------------------------------------
export function GoalCard({
  goal,
  onEdit,
  onDelete,
  readOnly = false,
}: {
  goal: VisionGoal;
  onEdit?: () => void;
  onDelete?: () => void;
  readOnly?: boolean;
}) {
  const pct = goalProgress(goal);
  const color = PILLAR_COLOR[goal.category];
  const meta = STATUS_META[goal.status];
  const hasTarget = goal.target_value != null;

  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-start gap-2">
        <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color }} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">{goal.title}</p>
          <p className="text-[11px] text-muted-foreground">{goal.category}</p>
        </div>
        <span
          className={cn(
            "inline-flex shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium",
            meta.cls,
          )}
        >
          {meta.label}
        </span>
      </div>

      {hasTarget && (
        <div className="mt-2.5">
          <div className="mb-1 flex items-center justify-between text-[11px] text-muted-foreground">
            <span className="tabular-nums">
              {goal.current_value ?? 0} / {goal.target_value} {goal.unit ?? ""}
            </span>
            <span className="font-semibold text-foreground tabular-nums">{pct}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
          </div>
        </div>
      )}

      {goal.target_date && (
        <p className="mt-2 text-[11px] text-muted-foreground">Target: {goal.target_date}</p>
      )}
      {goal.why && <p className="mt-1.5 text-xs text-muted-foreground italic">“{goal.why}”</p>}

      {!readOnly && (
        <div className="mt-2.5 flex items-center gap-1.5">
          <Button size="sm" variant="outline" className="h-7 rounded-lg text-xs" onClick={onEdit}>
            <Pencil className="h-3.5 w-3.5" /> Edit
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 rounded-lg text-xs text-destructive hover:text-destructive"
            onClick={onDelete}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Goal editor dialog (add / edit)
// ---------------------------------------------------------------------------
type Draft = {
  title: string;
  category: Pillar;
  target_value: string;
  current_value: string;
  unit: string;
  target_date: string;
  status: GoalStatus;
  why: string;
};

const emptyDraft = (): Draft => ({
  title: "",
  category: "Revenue & Profit",
  target_value: "",
  current_value: "",
  unit: "",
  target_date: "",
  status: "not_started",
  why: "",
});

function fromGoal(g: VisionGoal): Draft {
  return {
    title: g.title,
    category: g.category,
    target_value: g.target_value?.toString() ?? "",
    current_value: g.current_value?.toString() ?? "",
    unit: g.unit ?? "",
    target_date: g.target_date ?? "",
    status: g.status,
    why: g.why ?? "",
  };
}

const numOrNull = (s: string) => {
  const n = Number(s);
  return s.trim() === "" || Number.isNaN(n) ? null : n;
};

export function GoalEditorDialog({
  open,
  onOpenChange,
  year,
  initial,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  year: number;
  initial: VisionGoal | null;
  onSave: (input: GoalInput) => void;
}) {
  const [d, setD] = useState<Draft>(emptyDraft);

  useEffect(() => {
    if (open) setD(initial ? fromGoal(initial) : emptyDraft());
  }, [open, initial]);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((p) => ({ ...p, [k]: v }));
  const valid = d.title.trim().length > 0;

  function submit() {
    if (!valid) return;
    onSave({
      year,
      title: d.title.trim(),
      category: d.category,
      target_value: numOrNull(d.target_value),
      current_value: numOrNull(d.current_value),
      unit: d.unit.trim() || null,
      target_date: d.target_date || null,
      status: d.status,
      why: d.why.trim() || null,
    });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Target className="h-4 w-4 text-navy" />
            {initial ? "Edit goal" : `Add a Year ${year} goal`}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <Field label="Goal">
            <Input
              value={d.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="e.g. Reach ₹5 Cr revenue"
              className="rounded-lg"
            />
          </Field>

          <Field label="Pillar">
            <div className="flex flex-wrap gap-1.5">
              {PILLARS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => set("category", p)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                    d.category === p
                      ? "border-transparent bg-gradient-navy text-primary-foreground"
                      : "border-border bg-card text-muted-foreground hover:bg-secondary/60",
                  )}
                >
                  <span className="h-2 w-2 rounded-full" style={{ background: PILLAR_COLOR[p] }} />
                  {p}
                </button>
              ))}
            </div>
          </Field>

          {/* One-tap starting points for the selected pillar — fill name + unit. */}
          <Field label="Quick start — tap to pre-fill, then tweak">
            <div className="flex flex-wrap gap-1.5">
              {GOAL_TEMPLATES[d.category].map((t) => {
                const chosen = d.title.trim() === t.title;
                return (
                  <button
                    key={t.title}
                    type="button"
                    onClick={() => setD((p) => ({ ...p, title: t.title, unit: t.unit }))}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                      chosen
                        ? "border-gold bg-gold/15 text-foreground"
                        : "border-dashed border-border bg-card text-muted-foreground hover:border-gold/50 hover:text-foreground",
                    )}
                  >
                    {t.title}
                  </button>
                );
              })}
            </div>
          </Field>

          <div className="grid grid-cols-3 gap-2">
            <Field label="Current">
              <Input
                inputMode="decimal"
                value={d.current_value}
                onChange={(e) => set("current_value", e.target.value)}
                placeholder="0"
                className="rounded-lg"
              />
            </Field>
            <Field label="Target">
              <Input
                inputMode="decimal"
                value={d.target_value}
                onChange={(e) => set("target_value", e.target.value)}
                placeholder="5"
                className="rounded-lg"
              />
            </Field>
            <Field label="Unit">
              <Input
                value={d.unit}
                onChange={(e) => set("unit", e.target.value)}
                placeholder="Cr · staff"
                className="rounded-lg"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Field label="Target date">
              <Input
                type="date"
                value={d.target_date}
                onChange={(e) => set("target_date", e.target.value)}
                className="rounded-lg"
              />
            </Field>
            <Field label="Status">
              <div className="flex flex-wrap gap-1">
                {GOAL_STATUSES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => set("status", s)}
                    className={cn(
                      "rounded-full px-2 py-1 text-[10px] font-medium transition-colors",
                      d.status === s
                        ? STATUS_META[s].cls
                        : "bg-card text-muted-foreground hover:bg-secondary/60",
                    )}
                  >
                    {STATUS_META[s].label}
                  </button>
                ))}
              </div>
            </Field>
          </div>

          <Field label="Why this matters">
            <Textarea
              value={d.why}
              onChange={(e) => set("why", e.target.value)}
              placeholder="What this goal unlocks for you and the business…"
              className="min-h-[64px] rounded-lg"
            />
          </Field>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className="bg-gradient-navy text-primary-foreground hover:opacity-90"
            disabled={!valid}
            onClick={submit}
          >
            {initial ? "Save goal" : "Add goal"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}
