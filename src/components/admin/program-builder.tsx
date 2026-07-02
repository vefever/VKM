import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  LayoutList, Plus, Pencil, Trash2, Loader2, Save, Sparkles, MapPin, Video as VideoIcon,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/vkm/page-header";
import { SectionCard } from "@/components/vkm/section-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { VKM_WEEKS, type Phase } from "@/lib/vkm/program";
import { useProgramOptions } from "@/lib/vkm/program-scope";
import { BatchProgramPicker } from "@/components/admin/batch-program-picker";

const PHASES: Phase[] = ["Foundation", "Systems", "Sell", "Review"];
const PHASE_COLOR: Record<Phase, string> = {
  Foundation: "#3b82f6",
  Systems: "#8b5cf6",
  Sell: "#f59e0b",
  Review: "#10b981",
};

type WeekRow = {
  id: string;
  week_no: number;
  phase: string;
  topic: string;
  mode: string;
  why: string;
  task: string;
  proof: string;
};

type Draft = {
  id: string | null; // null = new
  week_no: number;
  phase: Phase;
  topic: string;
  mode: "Online" | "Offline";
  why: string;
  task: string;
  proof: string;
};

const SELECT = "id, week_no, phase, topic, mode, why, task, proof";

export function ProgramBuilder() {
  const { options, selected, setSelected, loading: optLoading } = useProgramOptions();
  const programId = selected;
  const [rows, setRows] = useState<WeekRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!programId) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("program_weeks")
      .select(SELECT)
      .eq("program_id", programId)
      .order("week_no", { ascending: true });
    setRows((data ?? []) as WeekRow[]);
    setLoading(false);
  }, [programId]);

  useEffect(() => { void load(); }, [load]);

  async function ensureProgram(): Promise<string | null> {
    if (programId) return programId;
    const { data, error } = await supabase
      .from("programs")
      .insert({ title: "VK Mentorship", description: "Transformation program", duration_weeks: 16, status: "active" })
      .select("id")
      .single();
    if (error) { toast.error("Could not create program", { description: error.message }); return null; }
    setSelected(data.id);
    return data.id;
  }

  async function initializeDefault() {
    setWorking(true);
    try {
      const pid = await ensureProgram();
      if (!pid) return;
      const payload = VKM_WEEKS.map((w) => ({
        program_id: pid, week_no: w.week, phase: w.phase, topic: w.topic,
        mode: w.mode, why: w.why, task: w.task, proof: w.proof,
      }));
      const { error } = await supabase.from("program_weeks").insert(payload);
      if (error) throw error;
      toast.success(`Loaded the default ${VKM_WEEKS.length}-week plan`);
      await load();
    } catch (e) { toast.error("Could not initialize", { description: (e as Error).message }); }
    finally { setWorking(false); }
  }

  const nextWeekNo = useMemo(() => (rows.length ? Math.max(...rows.map((r) => r.week_no)) + 1 : 1), [rows]);

  function openNew() {
    setDraft({ id: null, week_no: nextWeekNo, phase: "Foundation", topic: "", mode: "Online", why: "", task: "", proof: "" });
  }
  function openEdit(r: WeekRow) {
    setDraft({
      id: r.id, week_no: r.week_no, phase: (PHASES.includes(r.phase as Phase) ? r.phase : "Foundation") as Phase,
      topic: r.topic, mode: r.mode === "Offline" ? "Offline" : "Online", why: r.why, task: r.task, proof: r.proof,
    });
  }

  async function saveDraft() {
    if (!draft) return;
    if (!draft.topic.trim()) { toast.error("Topic is required"); return; }
    setSaving(true);
    try {
      const pid = await ensureProgram();
      if (!pid) return;
      const fields = {
        phase: draft.phase, topic: draft.topic.trim(), mode: draft.mode,
        why: draft.why.trim(), task: draft.task.trim(), proof: draft.proof.trim(),
      };
      if (draft.id) {
        const { error } = await supabase.from("program_weeks").update(fields).eq("id", draft.id);
        if (error) throw error;
        toast.success(`Week ${draft.week_no} updated`);
      } else {
        const { error } = await supabase.from("program_weeks").insert({ program_id: pid, week_no: nextWeekNo, ...fields });
        if (error) throw error;
        toast.success(`Week ${nextWeekNo} added`);
      }
      setDraft(null);
      await load();
    } catch (e) { toast.error("Could not save", { description: (e as Error).message }); }
    finally { setSaving(false); }
  }

  async function deleteWeek(r: WeekRow) {
    if (!programId) return;
    if (!confirm(`Delete Week ${r.week_no} (“${r.topic}”)? Later weeks shift up by one.`)) return;
    setWorking(true);
    try {
      const { error } = await supabase.rpc("admin_delete_program_week", { _program_id: programId, _week_no: r.week_no });
      if (error) throw error;
      toast.success(`Week ${r.week_no} removed`);
      await load();
    } catch (e) { toast.error("Could not delete", { description: (e as Error).message }); }
    finally { setWorking(false); }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="space-y-5">
      <PageHeader
        eyebrow="Admin"
        title="Program Builder"
        description="Add, remove and edit the weekly plan. Program length is however many weeks you define — each participant's clock starts the day they press Start, so changes apply to everyone from their own day one."
        icon={LayoutList}
        actions={
          rows.length > 0 ? (
            <Button onClick={openNew} className="rounded-xl bg-gradient-navy text-primary-foreground hover:opacity-90">
              <Plus className="h-4 w-4" /> Add week
            </Button>
          ) : undefined
        }
      />

      <BatchProgramPicker
        options={options}
        selected={selected}
        onSelect={setSelected}
        loading={optLoading}
        hint="Weeks you edit apply to this batch's program."
      />

      <SectionCard>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{rows.length}</span> weeks in this batch's program plan.
          </p>
          {rows.length > 0 && (
            <span className="text-xs text-muted-foreground">Editing here updates what every participant sees in Program Progress.</span>
          )}
        </div>
      </SectionCard>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : rows.length === 0 ? (
        <SectionCard>
          <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
            <Sparkles className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No weeks defined yet. Start from the built-in {VKM_WEEKS.length}-week plan, then customize.</p>
            <div className="flex gap-2">
              <Button onClick={initializeDefault} disabled={working} className="rounded-xl bg-gradient-navy text-primary-foreground hover:opacity-90">
                {working ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Load default {VKM_WEEKS.length}-week plan
              </Button>
              <Button onClick={openNew} variant="outline" className="rounded-xl"><Plus className="h-4 w-4" /> Add a blank week</Button>
            </div>
          </div>
        </SectionCard>
      ) : (
        <div className="space-y-3">
          {rows.map((wk) => (
            <SectionCard key={wk.id}>
              <div className="flex items-start gap-3">
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-secondary text-sm font-bold text-foreground">{wk.week_no}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-foreground">{wk.topic}</p>
                    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium text-white" style={{ background: PHASE_COLOR[(wk.phase as Phase)] ?? "#64748b" }}>{wk.phase}</span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                      {wk.mode === "Offline" ? <MapPin className="h-3 w-3" /> : <VideoIcon className="h-3 w-3" />} {wk.mode}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground"><span className="font-medium text-foreground">Why:</span> {wk.why || "—"}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground"><span className="font-medium text-foreground">Task:</span> {wk.task || "—"}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground"><span className="font-medium text-foreground">Proof:</span> {wk.proof || "—"}</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg" onClick={() => openEdit(wk)} title="Edit week"><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg text-destructive" disabled={working} onClick={() => deleteWeek(wk)} title="Delete week"><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            </SectionCard>
          ))}
        </div>
      )}

      {/* Add / edit dialog */}
      <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent className="sm:max-w-[560px] max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{draft?.id ? `Edit Week ${draft.week_no}` : `Add Week ${nextWeekNo}`}</DialogTitle>
            <DialogDescription>Topic, phase and the task + proof participants must submit.</DialogDescription>
          </DialogHeader>
          {draft && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Phase</Label>
                  <Select value={draft.phase} onValueChange={(v) => setDraft({ ...draft, phase: v as Phase })}>
                    <SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>{PHASES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Mode</Label>
                  <Select value={draft.mode} onValueChange={(v) => setDraft({ ...draft, mode: v as Draft["mode"] })}>
                    <SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Online">Online</SelectItem>
                      <SelectItem value="Offline">Offline</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Topic</Label>
                <Input value={draft.topic} onChange={(e) => setDraft({ ...draft, topic: e.target.value })} placeholder="Lifestyle Changes + OMM" className="h-10 rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <Label>Why it matters</Label>
                <Input value={draft.why} onChange={(e) => setDraft({ ...draft, why: e.target.value })} placeholder="Discipline & rhythm drive growth" className="h-10 rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <Label>Task</Label>
                <Input value={draft.task} onChange={(e) => setDraft({ ...draft, task: e.target.value })} placeholder="Install morning routine + start daily OMM" className="h-10 rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <Label>Proof required</Label>
                <Input value={draft.proof} onChange={(e) => setDraft({ ...draft, proof: e.target.value })} placeholder="OMM running 5+ days; routine log" className="h-10 rounded-xl" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" className="rounded-xl" onClick={() => setDraft(null)}>Cancel</Button>
            <Button onClick={saveDraft} disabled={saving} className="rounded-xl bg-gradient-navy text-primary-foreground hover:opacity-90">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
