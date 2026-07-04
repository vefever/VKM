import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  BookCopy,
  Copy,
  Plus,
  Loader2,
  Layers3,
  ListChecks,
  Video,
  Paperclip,
  Pencil,
  GitBranch,
  CheckCircle2,
} from "lucide-react";
import { PageHeader } from "@/components/vkm/page-header";
import { SectionCard } from "@/components/vkm/section-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from "@/components/ui/responsive-modal";
import { cn } from "@/lib/utils";
import {
  useProgramsList,
  cloneProgram,
  createProgram,
  assignBatchProgram,
  setProgramStatus,
  type ProgramRow,
  type BatchLite,
} from "@/components/admin/programs-data";

type Role = "admin" | "mentor";

const STATUS_PILL: Record<string, string> = {
  active: "bg-[oklch(0.93_0.06_160)] text-[oklch(0.35_0.12_160)]",
  draft: "bg-secondary text-muted-foreground",
  archived: "bg-amber-50 text-amber-700",
};

export function ProgramsHub({ role = "admin", initialAction }: { role?: Role; initialAction?: "clone" | "create" | null }) {
  const { programs, allBatches, loading, reload } = useProgramsList();
  const [cloneOpen, setCloneOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [cloneSource, setCloneSource] = useState<ProgramRow | null>(null);

  const builderTo = role === "admin" ? "/admin/program-builder" : "/mentor/program-builder";
  const contentTo = role === "admin" ? "/admin/programs" : "/mentor/program-content";

  // Deep-link routes (/mentor/programs/clone, /programs/new) auto-open a dialog.
  useEffect(() => {
    if (initialAction === "clone") setCloneOpen(true);
    if (initialAction === "create") setCreateOpen(true);
  }, [initialAction]);

  function openClone(source: ProgramRow | null) {
    setCloneSource(source);
    setCloneOpen(true);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
      className="space-y-5"
    >
      <PageHeader
        eyebrow={role === "admin" ? "Super Admin" : "Mentor"}
        title="Programs"
        description="Clone the current program for a new batch, create a new one, and choose which batch runs which program."
        icon={BookCopy}
        actions={
          <>
            <Button variant="outline" className="rounded-xl" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" /> New program
            </Button>
            <Button className="rounded-xl bg-gradient-navy shadow-vkm" onClick={() => openClone(null)}>
              <Copy className="h-4 w-4" /> Clone program
            </Button>
          </>
        }
      />

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : programs.length === 0 ? (
        <SectionCard>
          <p className="py-8 text-center text-sm text-muted-foreground">No programs yet. Create one or clone to start.</p>
        </SectionCard>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {programs.map((p) => (
            <ProgramCard
              key={p.id}
              program={p}
              batches={allBatches}
              builderTo={builderTo}
              contentTo={contentTo}
              onClone={() => openClone(p)}
              onChanged={reload}
            />
          ))}
        </div>
      )}

      <CloneDialog
        open={cloneOpen}
        onOpenChange={setCloneOpen}
        programs={programs}
        batches={allBatches}
        source={cloneSource}
        builderTo={builderTo}
        onDone={reload}
      />
      <CreateDialog open={createOpen} onOpenChange={setCreateOpen} onDone={reload} />
    </motion.div>
  );
}

function ProgramCard({
  program,
  batches,
  builderTo,
  contentTo,
  onClone,
  onChanged,
}: {
  program: ProgramRow;
  batches: BatchLite[];
  builderTo: string;
  contentTo: string;
  onClone: () => void;
  onChanged: () => void;
}) {
  const [assigning, setAssigning] = useState(false);

  async function assign(batchId: string) {
    setAssigning(true);
    try {
      await assignBatchProgram(batchId, program.id);
      toast.success("Batch assigned to this program");
      onChanged();
    } catch (e) {
      toast.error("Couldn't assign", { description: (e as Error).message });
    } finally {
      setAssigning(false);
    }
  }

  async function toggleStatus() {
    const next = program.status === "active" ? "draft" : "active";
    try {
      await setProgramStatus(program.id, next);
      toast.success(next === "active" ? "Program set active" : "Program set to draft");
      onChanged();
    } catch (e) {
      toast.error("Couldn't update status", { description: (e as Error).message });
    }
  }

  return (
    <SectionCard>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-foreground">{program.title}</p>
          {program.description && <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{program.description}</p>}
        </div>
        <button
          type="button"
          onClick={toggleStatus}
          className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize", STATUS_PILL[program.status] ?? "bg-secondary text-muted-foreground")}
          title="Click to toggle active / draft"
        >
          {program.status}
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1"><ListChecks className="h-3.5 w-3.5" /> {program.week_count}/{program.duration_weeks} weeks</span>
        <span className="inline-flex items-center gap-1"><Video className="h-3.5 w-3.5" /> {program.video_count} videos</span>
        <span className="inline-flex items-center gap-1"><Paperclip className="h-3.5 w-3.5" /> {program.resource_count} resources</span>
      </div>

      <div className="mt-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Batches on this program</p>
        {program.batches.length === 0 ? (
          <p className="mt-1 text-xs text-muted-foreground">No batch assigned yet.</p>
        ) : (
          <div className="mt-1 flex flex-wrap gap-1.5">
            {program.batches.map((b) => (
              <span key={b.id} className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-foreground">
                <Layers3 className="h-3 w-3" /> {b.name}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button size="sm" className="rounded-lg bg-gradient-navy" onClick={onClone}>
          <Copy className="h-3.5 w-3.5" /> Clone
        </Button>
        <Button size="sm" variant="outline" className="rounded-lg" asChild>
          <Link to={builderTo}><Pencil className="h-3.5 w-3.5" /> Edit weeks</Link>
        </Button>
        <Button size="sm" variant="outline" className="rounded-lg" asChild>
          <Link to={contentTo}><Video className="h-3.5 w-3.5" /> Videos & files</Link>
        </Button>
        <div className="ml-auto">
          <Select onValueChange={assign} disabled={assigning}>
            <SelectTrigger className="h-8 w-[150px] rounded-lg text-xs">
              <SelectValue placeholder="Assign a batch…" />
            </SelectTrigger>
            <SelectContent>
              {batches.map((b) => (
                <SelectItem key={b.id} value={b.id}>{b.name} · {b.status}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </SectionCard>
  );
}

function CloneDialog({
  open,
  onOpenChange,
  programs,
  batches,
  source,
  builderTo,
  onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  programs: ProgramRow[];
  batches: BatchLite[];
  source: ProgramRow | null;
  builderTo: string;
  onDone: () => void;
}) {
  // Default source = the passed program, else the active one, else the first.
  const defaultSource = useMemo(
    () => source?.id ?? programs.find((p) => p.status === "active")?.id ?? programs[0]?.id ?? "",
    [source, programs],
  );
  const [sourceId, setSourceId] = useState(defaultSource);
  const [title, setTitle] = useState("");
  const [batchId, setBatchId] = useState<string>("none");
  const [busy, setBusy] = useState(false);
  const [doneId, setDoneId] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setSourceId(defaultSource);
      const src = programs.find((p) => p.id === defaultSource);
      const n = (batches.length ? batches.length : programs.length) + 1;
      setTitle(src ? `${src.title.replace(/\s*\(copy\)$/i, "")} — Batch ${n + 15}` : "New program");
      setBatchId("none");
      setDoneId(null);
    }
  }, [open, defaultSource, programs, batches.length]);

  async function doClone() {
    if (!sourceId) return;
    setBusy(true);
    try {
      const newId = await cloneProgram(sourceId, title);
      if (batchId !== "none") await assignBatchProgram(batchId, newId);
      const assigned = batches.find((b) => b.id === batchId);
      toast.success("Program cloned", {
        description: assigned ? `${assigned.name} now sees "${title}".` : `"${title}" created — assign a batch to make it visible.`,
      });
      setDoneId(newId);
      onDone();
    } catch (e) {
      toast.error("Clone failed", { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange}>
      <ResponsiveModalContent className="sm:max-w-lg">
        <ResponsiveModalHeader>
          <ResponsiveModalTitle className="flex items-center gap-2">
            <GitBranch className="h-5 w-5 text-gold" /> Clone a program
          </ResponsiveModalTitle>
          <ResponsiveModalDescription>
            Copies every week, class video, milestone and resource into a brand-new program you can customize.
          </ResponsiveModalDescription>
        </ResponsiveModalHeader>

        {doneId ? (
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-3 rounded-xl border border-border bg-[oklch(0.96_0.03_160)] p-4">
              <CheckCircle2 className="h-5 w-5 text-[oklch(0.45_0.13_160)]" />
              <p className="text-sm font-medium text-foreground">"{title}" is ready.</p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" className="rounded-xl" onClick={() => onOpenChange(false)}>Done</Button>
              <Button className="rounded-xl bg-gradient-navy" asChild>
                <Link to={builderTo} onClick={() => onOpenChange(false)}><Pencil className="h-4 w-4" /> Customize weeks</Link>
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Copy from</Label>
              <Select value={sourceId} onValueChange={setSourceId}>
                <SelectTrigger className="h-10 rounded-xl"><SelectValue placeholder="Choose a program" /></SelectTrigger>
                <SelectContent>
                  {programs.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.title} · {p.week_count} weeks</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>New program name</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. VK Mentorship — Batch 17" className="h-10 rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label>Assign to batch <span className="font-normal text-muted-foreground">(optional — makes it visible to that batch)</span></Label>
              <Select value={batchId} onValueChange={setBatchId}>
                <SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Don't assign yet</SelectItem>
                  {batches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.name} · {b.status}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" className="rounded-xl" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
              <Button className="rounded-xl bg-gradient-navy shadow-vkm" onClick={doClone} disabled={busy || !sourceId || !title.trim()}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />} Clone program
              </Button>
            </div>
          </div>
        )}
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}

function CreateDialog({ open, onOpenChange, onDone }: { open: boolean; onOpenChange: (o: boolean) => void; onDone: () => void }) {
  const [title, setTitle] = useState("");
  const [seed, setSeed] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle("");
      setSeed(true);
    }
  }, [open]);

  async function doCreate() {
    setBusy(true);
    try {
      await createProgram(title, seed);
      toast.success("Program created", { description: seed ? "Seeded with the default 16-week plan." : "Blank program — add weeks in the builder." });
      onOpenChange(false);
      onDone();
    } catch (e) {
      toast.error("Couldn't create", { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange}>
      <ResponsiveModalContent className="sm:max-w-md">
        <ResponsiveModalHeader>
          <ResponsiveModalTitle className="flex items-center gap-2"><Plus className="h-5 w-5 text-navy" /> New program</ResponsiveModalTitle>
          <ResponsiveModalDescription>Start fresh. Tip: cloning is usually faster — it copies the current program's content for you.</ResponsiveModalDescription>
        </ResponsiveModalHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Program name</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. VK Mentorship — Batch 17" className="h-10 rounded-xl" autoFocus />
          </div>
          <label className="flex items-center gap-2.5 rounded-xl border border-border bg-secondary/30 p-3 text-sm">
            <input type="checkbox" checked={seed} onChange={(e) => setSeed(e.target.checked)} className="h-4 w-4" />
            <span>Seed the default 16-week plan (recommended)</span>
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="outline" className="rounded-xl" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
            <Button className="rounded-xl bg-gradient-navy shadow-vkm" onClick={doCreate} disabled={busy || !title.trim()}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Create
            </Button>
          </div>
        </div>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
