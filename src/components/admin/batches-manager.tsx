import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useServerFn } from "@tanstack/react-start";
import {
  Layers3,
  Plus,
  Loader2,
  Upload,
  GraduationCap,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/vkm/page-header";
import { SectionCard } from "@/components/vkm/section-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { createInvite } from "@/lib/vkm/invites.functions";
import { PAST_BATCH_STATUSES } from "@/lib/vkm/access";

type Batch = {
  id: string;
  name: string;
  status: string;
  start_date: string | null;
  memberCount: number;
  alumniCount: number;
};

const STATUS_OPTS = [
  { value: "active", label: "Active — full app" },
  { value: "upcoming", label: "Upcoming — full app" },
  { value: "completed", label: "Completed — Community only" },
  { value: "archived", label: "Archived — Community only" },
];

const STATUS_BADGE: Record<string, string> = {
  active: "bg-[#10b981]/15 text-[#047857]",
  upcoming: "bg-[#3b82f6]/15 text-[#2563eb]",
  completed: "bg-amber-500/15 text-amber-700",
  archived: "bg-secondary text-muted-foreground",
};

export function BatchesManager() {
  const invite = useServerFn(createInvite);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [newOpen, setNewOpen] = useState(false);
  const [importFor, setImportFor] = useState<Batch | null>(null);

  const load = useCallback(async () => {
    const [{ data: bs }, { data: bm }, { data: profs }] = await Promise.all([
      supabase.from("batches").select("id, name, status, start_date").order("start_date", { ascending: false, nullsFirst: false }),
      supabase.from("batch_members").select("batch_id, user_id").eq("role", "participant"),
      supabase.from("profiles").select("id, is_alumni"),
    ]);
    const alumniSet = new Set((profs ?? []).filter((p) => (p as { is_alumni?: boolean }).is_alumni).map((p) => p.id));
    const byBatch = new Map<string, { total: number; alumni: number }>();
    (bm ?? []).forEach((r) => {
      if (!r.batch_id) return;
      const e = byBatch.get(r.batch_id) ?? { total: 0, alumni: 0 };
      e.total += 1;
      if (alumniSet.has(r.user_id)) e.alumni += 1;
      byBatch.set(r.batch_id, e);
    });
    setBatches(
      (bs ?? []).map((b) => ({
        id: b.id,
        name: b.name,
        status: b.status ?? "active",
        start_date: b.start_date,
        memberCount: byBatch.get(b.id)?.total ?? 0,
        alumniCount: byBatch.get(b.id)?.alumni ?? 0,
      })),
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function setStatus(b: Batch, status: string) {
    const { error } = await supabase.from("batches").update({ status }).eq("id", b.id);
    if (error) return toast.error("Couldn't update status", { description: error.message });
    toast.success(`${b.name} → ${status}`, {
      description: PAST_BATCH_STATUSES.has(status)
        ? "Members now see the Community page only."
        : "Members have full app access.",
    });
    await load();
  }

  async function setBatchAlumni(b: Batch, value: boolean) {
    const { data: members } = await supabase
      .from("batch_members")
      .select("user_id")
      .eq("batch_id", b.id)
      .eq("role", "participant");
    const ids = (members ?? []).map((m) => m.user_id);
    if (ids.length === 0) return toast("No members in this batch yet.");
    let ok = 0;
    for (const uid of ids) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.rpc as any)("admin_set_alumni", { _user_id: uid, _value: value });
      if (!error) ok++;
    }
    toast.success(value ? "Marked as alumni" : "Alumni removed", {
      description: `${ok}/${ids.length} members in ${b.name}. Alumni see Community + My Business + Support + Settings.`,
    });
    await load();
  }

  async function createBatch(name: string, status: string) {
    const { error } = await supabase.from("batches").insert({ name: name.trim(), status });
    if (error) throw error;
    await load();
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-5"
    >
      <PageHeader
        eyebrow="Admin"
        title="Batches"
        description="Manage cohorts & access. Completed/archived batches see only the Community page; alumni also get My Business, Support & Settings."
        icon={Layers3}
        actions={
          <Button className="rounded-full bg-gradient-navy shadow-vkm" onClick={() => setNewOpen(true)}>
            <Plus className="h-4 w-4" /> New batch
          </Button>
        }
      />

      {loading ? (
        <SectionCard>
          <p className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading batches…
          </p>
        </SectionCard>
      ) : batches.length === 0 ? (
        <SectionCard>
          <p className="py-10 text-center text-sm text-muted-foreground">
            No batches yet — create one, then import its members.
          </p>
        </SectionCard>
      ) : (
        <div className="space-y-3">
          {batches.map((b) => {
            const past = PAST_BATCH_STATUSES.has(b.status);
            return (
              <SectionCard key={b.id}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-navy text-primary-foreground">
                      <Layers3 className="h-5 w-5" />
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-foreground">{b.name}</p>
                        <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize", STATUS_BADGE[b.status] ?? STATUS_BADGE.archived)}>
                          {b.status}
                        </span>
                      </div>
                      <p className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                        <Users className="h-3 w-3" /> {b.memberCount} members
                        {b.alumniCount > 0 && (
                          <span className="inline-flex items-center gap-1 text-[oklch(0.5_0.11_80)]">
                            <GraduationCap className="h-3 w-3" /> {b.alumniCount} alumni
                          </span>
                        )}
                        {past && <span className="text-amber-600">· Community-only</span>}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Select value={b.status} onValueChange={(v) => setStatus(b, v)}>
                      <SelectTrigger className="h-9 w-52 rounded-lg text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTS.map((s) => (
                          <SelectItem key={s.value} value={s.value}>
                            {s.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button size="sm" variant="outline" className="h-9 rounded-lg" onClick={() => setImportFor(b)}>
                      <Upload className="h-4 w-4" /> Import members
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-9 rounded-lg"
                      onClick={() => setBatchAlumni(b, b.alumniCount < b.memberCount)}
                      disabled={b.memberCount === 0}
                      title="Toggle alumni access for this batch's members"
                    >
                      <GraduationCap className="h-4 w-4" />
                      {b.alumniCount >= b.memberCount && b.memberCount > 0 ? "Unmark alumni" : "Mark alumni"}
                    </Button>
                  </div>
                </div>
              </SectionCard>
            );
          })}
        </div>
      )}

      <NewBatchDialog open={newOpen} onOpenChange={setNewOpen} onCreate={createBatch} />
      {importFor && (
        <ImportMembersDialog
          batch={importFor}
          invite={invite}
          onClose={() => setImportFor(null)}
          onDone={load}
        />
      )}
    </motion.div>
  );
}

function NewBatchDialog({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreate: (name: string, status: string) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [status, setStatus] = useState("active");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      await onCreate(name, status);
      toast.success(`${name.trim()} created`);
      setName("");
      setStatus("active");
      onOpenChange(false);
    } catch (e) {
      toast.error("Couldn't create batch", { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="rounded-3xl">
        <DialogHeader>
          <DialogTitle>New batch</DialogTitle>
          <DialogDescription>Create a cohort, then import its members.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Batch 17" />
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy || !name.trim()} className="bg-gradient-navy">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type ParsedMember = { name: string; email: string; phone?: string };

function parseMembers(text: string): ParsedMember[] {
  const out: ParsedMember[] = [];
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t) continue;
    const parts = t.split(/[,\t]/).map((p) => p.trim()).filter(Boolean);
    const email = parts.find((p) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(p));
    if (!email) continue; // skip lines without a valid email
    const phone = parts.find((p) => /^\+?[\d\s-]{7,}$/.test(p) && p !== email);
    const name = parts.find((p) => p !== email && p !== phone) ?? email.split("@")[0];
    out.push({ name, email, phone });
  }
  return out;
}

function ImportMembersDialog({
  batch,
  invite,
  onClose,
  onDone,
}: {
  batch: Batch;
  invite: ReturnType<typeof useServerFn<typeof createInvite>>;
  onClose: () => void;
  onDone: () => void;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const cancelled = useRef(false);

  const parsed = useMemo(() => parseMembers(text), [text]);

  async function run() {
    if (parsed.length === 0 || busy) return;
    setBusy(true);
    cancelled.current = false;
    setProgress({ done: 0, total: parsed.length });
    let ok = 0;
    const failed: string[] = [];
    for (let i = 0; i < parsed.length; i++) {
      if (cancelled.current) break;
      const m = parsed[i];
      try {
        await invite({
          data: { email: m.email, name: m.name, role: "participant", phone: m.phone, batch: batch.name },
        });
        ok++;
      } catch (e) {
        failed.push(`${m.email} (${(e as Error).message})`);
      }
      setProgress({ done: i + 1, total: parsed.length });
    }
    setBusy(false);
    if (ok > 0) toast.success(`Imported ${ok} member${ok > 1 ? "s" : ""} to ${batch.name}`);
    if (failed.length > 0) toast.error(`${failed.length} failed`, { description: failed.slice(0, 3).join("; ") });
    onDone();
    if (failed.length === 0) onClose();
  }

  return (
    <Dialog open onOpenChange={(o) => !busy && !o && onClose()}>
      <DialogContent className="max-w-lg rounded-3xl">
        <DialogHeader>
          <DialogTitle>Import members → {batch.name}</DialogTitle>
          <DialogDescription>
            One per line: <span className="font-medium text-foreground">Name, email, phone</span> (phone
            optional). Each gets an invite and is added to this batch. Existing users are matched by email.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={8}
            placeholder={"Ravi Kumar, ravi@example.com, +91 98765 43210\nAnitha Rao, anitha@example.com"}
            disabled={busy}
            className="font-mono text-xs"
          />
          <p className="text-[11px] text-muted-foreground">
            {parsed.length} valid {parsed.length === 1 ? "member" : "members"} detected
            {progress && ` · ${progress.done}/${progress.total} processed`}
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            {busy ? "Close when done" : "Cancel"}
          </Button>
          <Button onClick={run} disabled={busy || parsed.length === 0} className="bg-gradient-navy">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Import {parsed.length > 0 ? parsed.length : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
