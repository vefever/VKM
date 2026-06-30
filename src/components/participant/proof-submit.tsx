import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Upload, CheckCircle2, Clock, AlertTriangle, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/vkm/page-header";
import { SectionCard } from "@/components/vkm/section-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { weekByNumber } from "@/lib/vkm/program";
import { useAuth } from "@/hooks/use-auth";
import { useMyProofs, currentWeekNo } from "@/components/coach/coach-data";
import { uploadAttachment, type Attachment } from "@/components/chat/chat-data";
import { LocalPreviewTile, FilePickerZone } from "@/components/participant/proof-attachments";
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
  const maxWeek = currentWeekNo();
  const [week, setWeek] = useState(maxWeek);
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [staged, setStaged] = useState<Staged[]>([]);
  const [busy, setBusy] = useState(false);

  const w = weekByNumber(week);
  const byWeek = useMemo(() => {
    const m: Record<number, (typeof weeks)[number]> = {};
    weeks.forEach((x) => (m[x.week_no] = x));
    return m;
  }, [weeks]);

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

  async function onSubmit() {
    if (!url.trim() && staged.length === 0) {
      toast.error("Add a proof link or upload at least one file.");
      return;
    }
    setBusy(true);
    try {
      let attachments: Attachment[] = [];
      if (staged.length && user) {
        attachments = await Promise.all(staged.map((s) => uploadAttachment(user.id, s.file)));
      }
      const { error } = await submit(week, url, note, attachments);
      if (error) {
        toast.error("Could not submit", { description: error });
      } else {
        haptic("success");
        if (week <= 14) flyPoints(250);
        toast.success(`Week ${week} proof submitted`, {
          description: "Your coach will review it shortly.",
        });
        setUrl("");
        setNote("");
        staged.forEach((s) => URL.revokeObjectURL(s.url));
        setStaged([]);
      }
    } catch (e) {
      toast.error("Upload failed", { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
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
                      onClick={() => setWeek(n)}
                      disabled={st === "approved"}
                      className={cn(
                        "h-9 w-9 rounded-lg text-sm font-medium transition-colors",
                        week === n
                          ? "bg-gradient-navy text-primary-foreground"
                          : st === "approved"
                            ? "bg-[oklch(0.93_0.06_160)] text-[oklch(0.35_0.12_160)]"
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
              {staged.length > 0 && (
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
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
                Previews are from your device — files upload only when you submit.
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
                {byWeek[week] ? "Resubmit" : "Submit for review"}
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
