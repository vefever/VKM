import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Send, AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAppShell } from "@/hooks/use-app-shell";
import { haptic } from "@/lib/haptics";
import {
  monthLabel,
  type SnapshotInput,
  type MetricKey,
} from "@/components/business/business-data";
import { METRIC_COPY } from "@/components/business/metric-copy";
import { InfoHint } from "@/components/vkm/info-hint";

type Kind = "inr" | "int" | "pct" | "nps";
type Form = Record<string, string>;

const FIELDS: {
  group: string;
  intro: string;
  items: { key: MetricKey; kind: Kind }[];
}[] = [
  {
    group: "Revenue",
    intro: "How much money came in this month.",
    items: [
      { key: "revenue_inr", kind: "inr" },
      { key: "mrr_inr", kind: "inr" },
    ],
  },
  {
    group: "Leads & Sales",
    intro: "Who you reached and what you closed.",
    items: [
      { key: "leads", kind: "int" },
      { key: "deals", kind: "int" },
      { key: "pipeline_inr", kind: "inr" },
      { key: "avg_deal_inr", kind: "inr" },
    ],
  },
  {
    group: "Sales health",
    intro: "Simple measures of how well your selling is working.",
    items: [
      { key: "closing_rate_pct", kind: "pct" },
      { key: "followup_pct", kind: "pct" },
      { key: "nps", kind: "nps" },
    ],
  },
];

// Live ₹ lakh/crore hint so owners see the scale of what they typed.
function inrHint(raw: string): string {
  const n = Number(raw);
  if (!raw.trim() || !Number.isFinite(n) || n <= 0) return "";
  if (n >= 1e7) return `= ₹${(n / 1e7).toFixed(2)} Cr`;
  if (n >= 1e5) return `= ₹${(n / 1e5).toFixed(2)} L`;
  if (n >= 1e3) return `= ₹${(n / 1e3).toFixed(1)} K`;
  return "";
}

const ALL = FIELDS.flatMap((g) => g.items);

function toForm(initial: SnapshotInput | null): Form {
  const f: Form = {};
  ALL.forEach(({ key }) => {
    const v = initial?.[key];
    f[key] = v == null ? "" : String(v);
  });
  f.note = initial?.note ?? "";
  f.reflection_win = initial?.reflection_win ?? "";
  f.reflection_blocker = initial?.reflection_blocker ?? "";
  return f;
}

// Hard validation — returns an error string per field, or null when valid.
function fieldError(raw: string, kind: Kind): string | null {
  if (raw.trim() === "") return null; // optional
  const n = Number(raw);
  if (!Number.isFinite(n)) return "Enter a number";
  if (kind === "pct") return n < 0 || n > 100 ? "Must be 0–100" : null;
  if (kind === "nps") return n < -100 || n > 100 ? "Must be −100 to 100" : null;
  if (n < 0) return "Can't be negative";
  if (kind === "int" && !Number.isInteger(n)) return "Whole number only";
  return null;
}
const parse = (raw: string): number | null => (raw.trim() === "" ? null : Number(raw));

// Soft, non-blocking "sanity" flags surfaced for the coach's attention.
function sanityWarnings(form: Form, baseline: SnapshotInput | null): string[] {
  const w: string[] = [];
  const rev = parse(form.revenue_inr);
  const leads = parse(form.leads);
  const deals = parse(form.deals);
  if (rev != null && baseline?.revenue_inr && rev > baseline.revenue_inr * 10) {
    w.push("Revenue is 10×+ last month — double-check the figure.");
  }
  if (deals != null && leads != null && deals > leads) {
    w.push("Deals closed exceed new leads this month — confirm that's right.");
  }
  return w;
}

export function UpdateSnapshotDrawer({
  open,
  onOpenChange,
  monthISO,
  initial,
  baseline = null,
  onSave,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  monthISO: string;
  initial: SnapshotInput | null;
  baseline?: SnapshotInput | null;
  onSave: (input: SnapshotInput) => Promise<{ error?: string }>;
}) {
  const { appShell } = useAppShell();
  const [form, setForm] = useState<Form>(() => toForm(initial));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setForm(toForm(initial));
  }, [open, initial]);

  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    ALL.forEach(({ key, kind }) => {
      const err = fieldError(form[key], kind);
      if (err) e[key] = err;
    });
    return e;
  }, [form]);
  const hasErrors = Object.keys(errors).length > 0;
  const warnings = useMemo(() => sanityWarnings(form, baseline), [form, baseline]);

  async function save() {
    if (hasErrors) {
      toast.error("Fix the highlighted fields first.");
      return;
    }
    setBusy(true);
    const input: SnapshotInput = {
      revenue_inr: parse(form.revenue_inr),
      mrr_inr: parse(form.mrr_inr),
      leads: parse(form.leads),
      deals: parse(form.deals),
      pipeline_inr: parse(form.pipeline_inr),
      avg_deal_inr: parse(form.avg_deal_inr),
      closing_rate_pct: parse(form.closing_rate_pct),
      followup_pct: parse(form.followup_pct),
      nps: parse(form.nps),
      note: form.note.trim() || null,
      reflection_win: form.reflection_win.trim() || null,
      reflection_blocker: form.reflection_blocker.trim() || null,
    };
    const { error } = await onSave(input);
    setBusy(false);
    if (error) {
      toast.error("Could not save", { description: error });
    } else {
      haptic("success");
      toast.success(`Saved — ${monthLabel(monthISO)} numbers submitted`, {
        description: `Your coach will review them, then they'll count toward your points and trends.`,
      });
      onOpenChange(false);
    }
  }

  const body = (
    <div className="space-y-4 px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] sm:px-0 sm:pb-0">
      <p className="rounded-xl bg-secondary/50 px-3 py-2 text-xs text-muted-foreground">
        Pre-filled with last month — just edit what changed.{" "}
        <span className="font-medium text-foreground">All fields are optional</span> — save what you
        have and fill the rest later.
      </p>

      {FIELDS.map((g) => (
        <div key={g.group}>
          <p className="text-sm font-semibold text-foreground">{g.group}</p>
          <p className="mb-2 text-xs text-muted-foreground">{g.intro}</p>
          <div className="grid grid-cols-2 gap-2.5">
            {g.items.map((it) => {
              const err = errors[it.key];
              const copy = METRIC_COPY[it.key];
              const hint = it.kind === "inr" ? inrHint(form[it.key]) : "";
              return (
                <label key={it.key} className="block">
                  <span className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
                    {copy.full} <InfoHint text={copy.help} />
                  </span>
                  <Input
                    type="number"
                    inputMode={it.kind === "nps" ? "numeric" : "decimal"}
                    step={it.kind === "int" ? "1" : "any"}
                    value={form[it.key]}
                    onChange={(e) => setForm((f) => ({ ...f, [it.key]: e.target.value }))}
                    placeholder={`e.g. ${copy.example}`}
                    aria-invalid={!!err}
                    className={cn(
                      "h-10 rounded-xl",
                      err && "border-destructive focus-visible:ring-destructive",
                    )}
                  />
                  {err ? (
                    <span className="mt-1 block text-[11px] text-destructive">{err}</span>
                  ) : hint ? (
                    <span className="mt-1 block text-[11px] text-muted-foreground">{hint}</span>
                  ) : null}
                </label>
              );
            })}
          </div>
        </div>
      ))}

      {warnings.length > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5">
          {warnings.map((w) => (
            <p key={w} className="flex items-start gap-1.5 text-xs text-amber-800">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {w}
            </p>
          ))}
          <p className="mt-1 text-[11px] text-amber-700/80">
            You can still submit — your coach will see these flags.
          </p>
        </div>
      )}

      <div>
        <p className="text-sm font-semibold text-foreground">Monthly reflection</p>
        <p className="mb-2 text-xs text-muted-foreground">
          Two quick lines for your coach & AI Advisor — this is where the mentoring happens.
        </p>
        <label className="block">
          <span className="mb-1 block text-xs text-muted-foreground">What worked this month?</span>
          <textarea
            value={form.reflection_win}
            onChange={(e) => setForm((f) => ({ ...f, reflection_win: e.target.value }))}
            placeholder="Your biggest win or what's working…"
            className="min-h-[52px] w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>
        <label className="mt-2.5 block">
          <span className="mb-1 block text-xs text-muted-foreground">
            What's your biggest blocker?
          </span>
          <textarea
            value={form.reflection_blocker}
            onChange={(e) => setForm((f) => ({ ...f, reflection_blocker: e.target.value }))}
            placeholder="What's slowing you down right now…"
            className="min-h-[52px] w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>
      </div>

      <Button
        onClick={save}
        disabled={busy || hasErrors}
        className="w-full rounded-xl bg-gradient-navy text-primary-foreground shadow-vkm hover:opacity-90"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        Submit {monthLabel(monthISO)} numbers
      </Button>
    </div>
  );

  const title = `Update ${monthLabel(monthISO)}`;

  if (appShell) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[90vh]">
          <DrawerHeader>
            <DrawerTitle>{title}</DrawerTitle>
          </DrawerHeader>
          <div className="overflow-y-auto">{body}</div>
        </DrawerContent>
      </Drawer>
    );
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {body}
      </DialogContent>
    </Dialog>
  );
}
