import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Settings2, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/vkm/page-header";
import { SectionCard } from "@/components/vkm/section-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

type Settings = {
  habit_weeks: number;
  habit_days_per_week: number;
  habit_points_per_tick: number;
  step_goal: number;
};

const DEFAULTS: Settings = {
  habit_weeks: 16,
  habit_days_per_week: 7,
  habit_points_per_tick: 10,
  step_goal: 4000,
};

const FIELDS: { key: keyof Settings; label: string; hint: string; min: number; max: number }[] = [
  {
    key: "habit_weeks",
    label: "Program length (weeks)",
    hint: "How many weeks the habit tracker grid spans",
    min: 1,
    max: 52,
  },
  {
    key: "habit_days_per_week",
    label: "Days per week",
    hint: "Columns per week row in the grid",
    min: 1,
    max: 7,
  },
  {
    key: "habit_points_per_tick",
    label: "Points per tick",
    hint: "Awarded each time a habit is marked done",
    min: 0,
    max: 100,
  },
  {
    key: "step_goal",
    label: "Daily step goal",
    hint: "Auto-completes Walking 20 Min at this step count",
    min: 100,
    max: 100000,
  },
];

export function ProgramSettingsForm() {
  const [form, setForm] = useState<Settings>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    supabase
      .from("program_settings")
      .select("habit_weeks, habit_days_per_week, habit_points_per_tick, step_goal")
      .eq("id", 1)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        if (data) setForm(data);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function save() {
    setSaving(true);
    const { error } = await supabase.from("program_settings").update(form).eq("id", 1);
    setSaving(false);
    if (error) toast.error("Could not save", { description: error.message });
    else
      toast.success("Settings saved", { description: "Every participant's tracker updates live." });
  }

  const totalDays = form.habit_weeks * form.habit_days_per_week;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <PageHeader
        eyebrow="Super Admin"
        title="Habit Program Settings"
        description="Configure the 90-day / 16-week habit tracker. Changes apply to every participant instantly."
        icon={Settings2}
        actions={
          <Button
            onClick={save}
            disabled={saving || loading}
            className="rounded-full bg-gradient-navy shadow-vkm"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{" "}
            Save
          </Button>
        }
      />

      <SectionCard
        title="Tracker configuration"
        subtitle={`Current grid: ${form.habit_weeks} weeks × ${form.habit_days_per_week} days = ${totalDays} days`}
      >
        {loading ? (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {FIELDS.map((f) => (
              <div key={f.key} className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {f.label}
                </label>
                <Input
                  type="number"
                  min={f.min}
                  max={f.max}
                  value={form[f.key]}
                  onChange={(e) => {
                    const v = Math.max(f.min, Math.min(f.max, Number(e.target.value) || f.min));
                    setForm((s) => ({ ...s, [f.key]: v }));
                  }}
                  className="h-11 rounded-xl"
                />
                <p className="text-xs text-muted-foreground">{f.hint}</p>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </motion.div>
  );
}
