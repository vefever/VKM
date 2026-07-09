import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Upload,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Loader2,
  Send,
  Rocket,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/vkm/page-header";
import { SectionCard } from "@/components/vkm/section-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Link } from "@tanstack/react-router";
import { weekByNumber } from "@/lib/vkm/program";
import { useAuth } from "@/hooks/use-auth";
import { useMyProofs } from "@/components/coach/coach-data";
import { useEnrollment, weekFromStart } from "@/components/participant/enrollment-data";
import { uploadAttachment, type Attachment } from "@/components/chat/chat-data";
import { LocalPreviewTile, ExistingFileTile, FilePickerZone } from "@/components/participant/proof-attachments";
import { haptic } from "@/lib/haptics";
import { flyPoints } from "@/lib/fly-points";

type Staged = { id: string; file: File; url: string };

const STATUS_META: Record<string, { label: string; cls: string; Icon: typeof Clock }> = {
  approved: {
    label: "Approved",
    cls: "bg-[oklch(0.93_0.06_160)] text-[oklch(0.35_0.12_160)]",
    Icon: CheckCircle2,
  },
  pending: { label: "In review", cls: "bg-gold/15 text-[oklch(0.45_0.1_85)]", Icon: Clock },
  rejected: {
    label: "Needs changes",
    cls: "bg-[oklch(0.93_0.06_25)] text-[oklch(0.45_0.16_25)]",
    Icon: AlertTriangle,
  },
};

export function ProofSubmit() {
  const { user } = useAuth();
  const { weeks, loading, submit } = useMyProofs();
  // Weeks unlock one at a time from THIS participant's own start — not the
  // cohort calendar. Week 1 opens on their Day 1, a new week every 7 days.
  const { started, startedAt, totalWeeks, loading: enrLoading } = useEnrollment();
  const maxWeek = started ? weekFromStart(startedAt, totalWeeks) : 0;
  const [weekPick, setWeekPick] = useState<number | null>(null);
  const week = weekPick ?? maxWeek; // default to the current (latest unlocked) week
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [staged, setStaged] = useState<Staged[]>([]);
  // Files already submitted for the selected week — shown so the participant can
  // keep, remove or add to them instead of replacing everything on resubmit.
  const [existingFiles, setExistingFiles] = useState<Attachment[]>([]);
  const loadedSig = useRef<string>("");
  const [busy, setBusy] = useState(false);

  // Revoke any still-staged blob URLs if the user navigates away without
  // submitting (otherwise the underlying File objects — often multi-MB photos —
  // stay pinned in memory until a full reload).
  const stagedRef = useRef<Staged[]>([]);
  stagedRef.current = staged;
  useEffect(() => () => stagedRef.current.forEach((s) => URL.revokeObjectURL(s.url)), []);

  const w = weekByNumber(week);
  const byWeek = useMemo(() => {
    const m: Record<number, (typeof weeks)[number]> = {};
    weeks.forEach((x) => (m[x.week_no] = x));
    return m;
  }, [weeks]);

  // Load the selected week's saved proof into the form when the week changes (or
  // its data first arrives). The signature guards against re-loading — and thus
  // clobbering the participant's in-progress edits — while they're on that week.
  useEffect(() => {
    const rec = byWeek[week];
    const sig = `${week}:${rec ? "y" : "n"}`;
    if (loadedSig.current === sig) return;
    loadedSig.current = sig;
    setExistingFiles(rec?.proof_files ?? []);
    setUrl(rec?.proof_url ?? "");
    setNote(rec?.proof_note ?? "");
    setStaged((s) => {
      s.forEach((x) => URL.revokeObjectURL(x.url));
      return [];
    });
  }, [week, byWeek]);

  function removeExisting(idx: number) {
    setExistingFiles((f) => f.filter((_, i) => i !== idx));
  }

  function onFiles(files: FileList | null) {
    if (!files) return;
    const add = Array.from(files).map((f) => ({
      id: `${f.name}-${f.size}-${f.lastModified}`,
      file: f,
      url: URL.createObjectURL(f),
    }));
    setStaged((s) => [...s, ...add]);
  }
  function removeStaged(id: string) {
    setStaged((s) => {
      const t = s.find((x) => x.id === id);
      if (t) URL.revokeObjectURL(t.url);
      return s.filter((x) => x.id !== id);
    });
  }

  const hasSubmission = !!byWeek[week];

  async function onSubmit() {
    if (!url.trim() && staged.length === 0 && existingFiles.length === 0) {
      toast.error("Add a proof link or at least one file.");
      return;
    }
    setBusy(true);
    try {
      let newUploads: Attachment[] = [];
      if (staged.length && user) {
        newUploads = await Promise.all(staged.map((s) => uploadAttachment(user.id, s.file)));
      }
      // Keep the files already submitted (minus any removed) and append the new
      // uploads — so resubmitting adds to the week's proof instead of wiping it.
      const finalFiles = [...existingFiles, ...newUploads];
      const { error } = await submit(week, url, note, finalFiles);
      if (error) {
        toast.error("Could not submit", { description: error });
      } else {
        haptic("success");
        if (week <= 14 && !hasSubmission) flyPoints(250);
        toast.success(hasSubmission ? `Week ${week} proof updated` : `Week ${week} proof submitted`, {
          description: "Your coach will review it shortly.",
        });
        // The merged set is now the saved proof — keep it on screen; drop staged.
        setExistingFiles(finalFiles);
        staged.forEach((s) => URL.revokeObjectURL(s.url));
        setStaged([]);
      }
    } catch (e) {
      toast.error("Upload failed", { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  // Before the participant starts their program there are no unlocked weeks to
  // submit against — point them to Program Progress to begin.
  if (enrLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!started || maxWeek < 1) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="space-y-5"
      >
        <PageHeader
          eyebrow="Participant"
          title="Submit Weekly Proof"
          description="Your weekly tasks unlock one at a time once you start your program."
          icon={Upload}
        />
        <div className="relative overflow-hidden rounded-3xl bg-gradient-navy p-6 text-primary-foreground shadow-vkm-float sm:p-8">
          <span className="relative inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10">
            <Rocket className="h-6 w-6 text-gold" />
          </span>
          <h2 className="relative mt-4 text-2xl font-bold">Start your program first</h2>
          <p className="relative mt-2 max-w-xl text-sm text-white/80">
            Week 1 opens on your Day 1, then a new week unlocks every 7 days. Begin from Program
            Progress and you can submit this week's proof right away.
          </p>
          <Button
            asChild
            className="relative mt-6 w-full rounded-xl bg-gradient-gold py-6 text-base font-bold text-navy hover:opacity-90 sm:w-auto sm:px-8"
          >
            <Link to="/participant/progress">
              <Rocket className="h-5 w-5" /> Start my program <ArrowRight className="h-5 w-5" />
            </Link>
          </Button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-5"
    >
      <PageHeader
        eyebrow="Participant"
        title="Submit Weekly Proof"
        description={w ? `Week ${week}: ${w.topic} — proof required: ${w.proof}.` : `Week ${week}.`}
        icon={Upload}
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        {/* Form */}
        <SectionCard
          title="New submission"
          subtitle="Approved by your coach → +250 points (Weeks 1–14)"
        >
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Week
              </label>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {Array.from({ length: maxWeek }, (_, i) => i + 1).map((n) => {
                  const st = byWeek[n]?.proof_status;
                  return (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setWeekPick(n)}
                      title={st === "approved" ? "Approved — open to add files or resubmit" : undefined}
                      className={cn(
                        "h-9 w-9 rounded-lg text-sm font-medium transition-colors",
                        week === n
                          ? "bg-gradient-navy text-primary-foreground"
                          : st === "approved"
                            ? "bg-[oklch(0.93_0.06_160)] text-[oklch(0.35_0.12_160)] hover:opacity-80"
                            : "bg-muted text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {n}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Proof link <span className="text-muted-foreground/60">(optional)</span>
              </label>
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                type="url"
                inputMode="url"
                placeholder="https://drive.google.com/…  ·  photo / doc link"
                className="h-11 rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Upload proof{" "}
                <span className="text-muted-foreground/60">(images, video, PDF, docs)</span>
              </label>
              <FilePickerZone onFiles={onFiles} />
              {(existingFiles.length > 0 || staged.length > 0) && (
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {existingFiles.map((f, i) => (
                    <ExistingFileTile
                      key={`ex-${i}-${f.url}`}
                      file={f}
                      disabled={busy}
                      onRemove={() => removeExisting(i)}
                    />
                  ))}
                  {staged.map((s) => (
                    <LocalPreviewTile
                      key={s.id}
                      file={s.file}
                      url={s.url}
                      uploading={busy}
                      onRemove={() => removeStaged(s.id)}
                    />
                  ))}
                </div>
              )}
              <p className="text-[11px] text-muted-foreground">
                {existingFiles.length > 0
                  ? "Green “Uploaded” files are already submitted. Add more, or tap × to remove — nothing is lost until you submit."
                  : "Previews are from your device — files upload only when you submit."}
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Notes for your coach
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="What you did, who was involved, any blockers…"
                className="min-h-[90px] w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>

            {byWeek[week]?.proof_status === "approved" && (
              <div className="flex items-start gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm dark:border-emerald-900 dark:bg-emerald-950/20">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                <span className="text-foreground">
                  This week is <span className="font-medium">approved</span>. You can add files or fix it — but saving
                  sends it back to your coach for review, and its points pause until they approve again.
                </span>
              </div>
            )}

            {byWeek[week]?.proof_status === "rejected" && byWeek[week]?.coach_note && (
              <div className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <span className="text-foreground">
                  Coach feedback:{" "}
                  <span className="text-muted-foreground">{byWeek[week].coach_note}</span>
                </span>
              </div>
            )}

            <div className="flex justify-end">
              <Button
                onClick={onSubmit}
                disabled={busy}
                className="rounded-xl bg-gradient-navy shadow-vkm"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {byWeek[week]?.proof_status === "approved"
                  ? "Resubmit for review"
                  : hasSubmission
                    ? "Save changes"
                    : "Submit for review"}
              </Button>
            </div>
          </div>
        </SectionCard>

        {/* Status */}
        <SectionCard title="Your submissions" subtitle="Live status" bodyClassName="p-0">
          {loading ? (
            <p className="px-5 py-8 text-center text-sm text-muted-foreground">Loading…</p>
          ) : weeks.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-muted-foreground">
              No submissions yet.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {weeks.map((x) => {
                const meta = STATUS_META[x.proof_status] ?? STATUS_META.pending;
                const Icon = meta.Icon;
                return (
                  <li key={x.week_no} className="flex items-center gap-3 px-5 py-3">
                    <span className="text-sm font-semibold tabular-nums text-foreground">
                      W{x.week_no}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                      {weekByNumber(x.week_no)?.topic}
                    </span>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
                        meta.cls,
                      )}
                    >
                      <Icon className="h-3 w-3" /> {meta.label}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </SectionCard>
      </div>
    </motion.div>
  );
}
