import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "@tanstack/react-router";
import { formatDistanceToNowStrict, differenceInCalendarDays } from "date-fns";
import {
  ShieldCheck,
  Check,
  X,
  ExternalLink,
  Loader2,
  Inbox,
  Search,
  ArrowDownUp,
  ListChecks,
  CheckSquare,
  Square,
  User,
  Clock,
  MessageSquare,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/vkm/page-header";
import { EmptyState } from "@/components/vkm/empty-state";
import { SectionCard } from "@/components/vkm/section-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { safeHref } from "@/lib/safe-url";
import { weekByNumber } from "@/lib/vkm/program";
import {
  useProofQueue,
  useHabitProofFeed,
  type PendingProof,
  type HabitProofItem,
} from "@/components/coach/coach-data";
import { ProofAttachments } from "@/components/participant/proof-attachments";
import { AvatarBadge } from "@/components/vkm/avatar-badge";
import { SnapshotReviewQueue } from "@/components/business/snapshot-review";
import { HABITS } from "@/components/habits/habit-tracker";

const HABIT_BY_ID = Object.fromEntries(HABITS.map((h) => [h.id, h]));

const APPROVE_NOTES = ["Great work — keep it up! 🎉", "Solid proof, approved.", "Exactly right."];
const REJECT_NOTES = [
  "Please attach a clear photo or screenshot.",
  "This doesn’t match this week’s task — resubmit.",
  "Add a short note explaining what you did.",
];

type Tab = "weekly" | "habits" | "business";
type Sort = "oldest" | "newest" | "week";

export function ProofReviews() {
  const { items, loading, error, review, requestChanges, unreview, reload } = useProofQueue();
  const habitFeed = useHabitProofFeed();
  const [tab, setTab] = useState<Tab>("weekly");

  const oldestDays = items.length
    ? differenceInCalendarDays(
        new Date(),
        new Date(Math.min(...items.map((i) => +new Date(i.created_at)))),
      )
    : 0;

  const TABS: { id: Tab; label: string; count?: number }[] = [
    { id: "weekly", label: "Weekly proofs", count: items.length },
    { id: "habits", label: "Habit proofs", count: habitFeed.items.length },
    { id: "business", label: "Business numbers" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-5"
    >
      <PageHeader
        eyebrow="Coach"
        title="Proof Reviews"
        description="Your review hub. Approving a weekly proof awards +250 pts (Weeks 1–14) and notifies the participant instantly."
        icon={ShieldCheck}
        actions={
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-gold/15 px-3 py-1 text-sm font-semibold text-[oklch(0.45_0.1_85)]">
              {items.length} pending
            </span>
            {oldestDays > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-sm text-muted-foreground">
                <Clock className="h-3.5 w-3.5" /> oldest {oldestDays}d
              </span>
            )}
          </div>
        }
      />

      {/* Stream tabs */}
      <div className="flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "inline-flex min-h-9 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium transition-colors",
              tab === t.id
                ? "bg-gradient-navy text-primary-foreground shadow-vkm"
                : "bg-secondary/60 text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
            {t.count != null && (
              <span
                className={cn(
                  "rounded-full px-1.5 text-[11px] font-semibold tabular-nums",
                  tab === t.id
                    ? "bg-white/20"
                    : t.count > 0
                      ? "bg-gold/25 text-[oklch(0.42_0.1_85)]"
                      : "bg-card text-muted-foreground",
                )}
              >
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === "weekly" && (
        <WeeklyQueue
          items={items}
          loading={loading}
          error={error}
          reload={reload}
          review={review}
          requestChanges={requestChanges}
          unreview={unreview}
        />
      )}
      {tab === "habits" && <HabitFeed feed={habitFeed} />}
      {tab === "business" && <SnapshotReviewQueue />}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Weekly proof queue — search, sort, bulk-approve, quick feedback.
// ---------------------------------------------------------------------------
type ReviewFn = (id: string, status: "approved" | "rejected", note: string) => Promise<void>;
type RequestChangesFn = (item: PendingProof, note: string) => Promise<void>;

function WeeklyQueue({
  items,
  loading,
  error,
  reload,
  review,
  requestChanges,
  unreview,
}: {
  items: PendingProof[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  review: ReviewFn;
  requestChanges: RequestChangesFn;
  unreview: (id: string) => Promise<void>;
}) {
  const [q, setQ] = useState("");
  const [sortBy, setSortBy] = useState<Sort>("oldest");
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  const visible = useMemo(() => {
    const list = items.filter((i) => !q.trim() || i.name.toLowerCase().includes(q.toLowerCase()));
    list.sort((a, b) =>
      sortBy === "oldest"
        ? +new Date(a.created_at) - +new Date(b.created_at)
        : sortBy === "newest"
          ? +new Date(b.created_at) - +new Date(a.created_at)
          : a.week_no - b.week_no,
    );
    return list;
  }, [items, q, sortBy]);

  function toggleSelect(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  async function approveSelected() {
    if (!selected.size) return;
    setBulkBusy(true);
    const ids = [...selected];
    for (const id of ids) await review(id, "approved", "");
    setBulkBusy(false);
    setSelected(new Set());
    setSelectMode(false);
    toast.success(`${ids.length} ${ids.length === 1 ? "proof" : "proofs"} approved`, {
      description: "Points awarded · participants notified.",
    });
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading queue…
      </div>
    );
  }

  if (error) {
    return (
      <SectionCard>
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <X className="h-6 w-6 text-destructive" />
          <p className="text-sm font-medium text-foreground">Couldn’t load reviews</p>
          <p className="max-w-sm text-xs text-muted-foreground">{error}</p>
          <Button variant="outline" size="sm" className="mt-1 rounded-lg" onClick={() => reload()}>
            Retry
          </Button>
        </div>
      </SectionCard>
    );
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon={Inbox}
        eyebrow="Queue is clear"
        title="No proofs waiting"
        description="When participants submit their weekly proof, it lands here for you to approve."
        hint="Updates in real time"
      />
    );
  }

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[160px] flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search participant…"
            className="h-9 rounded-lg pl-9"
          />
        </div>
        <button
          type="button"
          onClick={() =>
            setSortBy((s) => (s === "oldest" ? "newest" : s === "newest" ? "week" : "oldest"))
          }
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowDownUp className="h-4 w-4" />
          {sortBy === "oldest" ? "Oldest first" : sortBy === "newest" ? "Newest first" : "By week"}
        </button>
        <button
          type="button"
          onClick={() => {
            setSelectMode((v) => !v);
            setSelected(new Set());
          }}
          className={cn(
            "inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition-colors",
            selectMode
              ? "border-transparent bg-gradient-navy text-primary-foreground"
              : "border-border bg-card text-muted-foreground hover:text-foreground",
          )}
        >
          <ListChecks className="h-4 w-4" /> Select
        </button>
      </div>

      {/* Bulk action bar */}
      <AnimatePresence>
        {selectMode && selected.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="flex items-center justify-between gap-3 rounded-xl border border-[#10b981]/40 bg-[#10b981]/[0.06] px-3 py-2"
          >
            <p className="text-sm font-medium text-foreground">
              {selected.size} selected — only approve proofs you’ve actually checked.
            </p>
            <Button
              size="sm"
              onClick={approveSelected}
              disabled={bulkBusy}
              className="rounded-lg bg-[#10b981] text-white hover:opacity-90"
            >
              {bulkBusy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              Approve {selected.size}
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {visible.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No proofs match your search.
        </p>
      ) : (
        <AnimatePresence initial={false}>
          {visible.map((p) => (
            <ProofCard
              key={p.id}
              item={p}
              review={review}
              requestChanges={requestChanges}
              unreview={unreview}
              selectMode={selectMode}
              selected={selected.has(p.id)}
              onToggleSelect={() => toggleSelect(p.id)}
            />
          ))}
        </AnimatePresence>
      )}
    </div>
  );
}

function ProofCard({
  item,
  review,
  requestChanges,
  unreview,
  selectMode,
  selected,
  onToggleSelect,
}: {
  item: PendingProof;
  review: ReviewFn;
  requestChanges: RequestChangesFn;
  unreview: (id: string) => Promise<void>;
  selectMode: boolean;
  selected: boolean;
  onToggleSelect: () => void;
}) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmReject, setConfirmReject] = useState(false);
  const week = weekByNumber(item.week_no);
  const hasEvidence = !!item.proof_url || item.proof_files.length > 0;

  // SLA aging — >48h amber, >72h red, with an "oldest waiting" cue.
  const hoursWaiting = (Date.now() - +new Date(item.created_at)) / 3.6e6;
  const sla = hoursWaiting > 72 ? "red" : hoursWaiting > 48 ? "amber" : "ok";
  const slaClass =
    sla === "red"
      ? "text-destructive"
      : sla === "amber"
        ? "text-[oklch(0.5_0.13_70)]"
        : "text-muted-foreground";

  async function approve() {
    setBusy(true);
    await review(item.id, "approved", note);
    const pts = item.week_no >= 1 && item.week_no <= 14 ? "+250 pts · " : "";
    toast.success("Proof approved", {
      description: `${pts}participant notified.`,
      action: { label: "Undo", onClick: () => void unreview(item.id) },
    });
  }

  async function reject() {
    if (!note.trim()) {
      toast.error("Add a reason", { description: "It’s sent to the participant." });
      return;
    }
    if (!confirmReject) {
      setConfirmReject(true);
      return;
    }
    setBusy(true);
    await review(item.id, "rejected", note);
    toast("Proof rejected", { description: "Participant notified to resubmit." });
  }

  async function reqChanges() {
    if (!note.trim()) {
      toast.error("Add a note", { description: "Describe the changes you need." });
      return;
    }
    setBusy(true);
    await requestChanges(item, note);
    setBusy(false);
    setNote("");
    toast("Changes requested", { description: "Sent — the proof stays in your queue." });
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 40 }}
    >
      <SectionCard className={cn(selected && "ring-2 ring-[#10b981]")}>
        <div className="flex items-start gap-3">
          {selectMode && (
            <button
              type="button"
              onClick={onToggleSelect}
              aria-label="Select"
              className="mt-1 shrink-0 text-muted-foreground hover:text-foreground"
            >
              {selected ? (
                <CheckSquare className="h-5 w-5 text-[#10b981]" />
              ) : (
                <Square className="h-5 w-5" />
              )}
            </button>
          )}
          <AvatarBadge name={item.name} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-lg font-semibold leading-tight text-foreground">{item.name}</p>
              <Link
                to="/coach/participant/$userId"
                params={{ userId: item.user_id }}
                className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-muted-foreground hover:text-foreground"
              >
                <User className="h-3 w-3" /> Profile
              </Link>
              {!hasEvidence && (
                <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive">
                  No evidence attached
                </span>
              )}
            </div>
            <p className={cn("mt-0.5 flex items-center gap-1 text-xs", slaClass)}>
              <Clock className="h-3 w-3 shrink-0" />
              Week {item.week_no}
              {week ? ` · ${week.topic}` : ""} · waiting{" "}
              {formatDistanceToNowStrict(new Date(item.created_at))}
              {sla !== "ok" && (
                <span className="font-semibold">· {sla === "red" ? "overdue" : "ageing"}</span>
              )}
            </p>
            {week && (
              <p className="mt-1 text-xs text-muted-foreground">
                Proof required: <span className="text-foreground">{week.proof}</span>
              </p>
            )}
          </div>
        </div>

        {item.proof_note && (
          <p className="mt-3 rounded-xl bg-secondary/60 px-3 py-2 text-sm text-foreground">
            “{item.proof_note}”
          </p>
        )}

        {safeHref(item.proof_url) && (
          <a
            href={safeHref(item.proof_url)}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-[#3b6fb0] hover:underline"
          >
            <ExternalLink className="h-4 w-4" /> Open proof link
          </a>
        )}

        {item.proof_files.length > 0 && (
          <div className="mt-3">
            <ProofAttachments files={item.proof_files} />
          </div>
        )}

        {/* Quick feedback chips — tap to fill the note, then approve/reject. */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {(note && REJECT_NOTES.includes(note)
            ? APPROVE_NOTES
            : [...APPROVE_NOTES, ...REJECT_NOTES]
          )
            .slice(0, 5)
            .map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setNote(n)}
                className="rounded-full border border-dashed border-border bg-card px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:border-gold/50 hover:text-foreground"
              >
                {n}
              </button>
            ))}
        </div>

        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Feedback / reason (sent to the participant)…"
          className="mt-2 min-h-[56px] w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />

        {confirmReject ? (
          <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
            <p className="mr-auto text-sm font-medium text-foreground">
              Reject this proof? The participant is notified to resubmit.
            </p>
            <Button
              variant="ghost"
              className="h-11 rounded-xl"
              onClick={() => setConfirmReject(false)}
            >
              Cancel
            </Button>
            <Button
              className="h-11 rounded-xl bg-destructive text-white hover:opacity-90"
              disabled={busy}
              onClick={reject}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
              Confirm reject
            </Button>
          </div>
        ) : (
          <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
            <Button
              variant="outline"
              className="h-11 rounded-xl border-[oklch(0.7_0.13_80)]/50 text-[oklch(0.5_0.12_70)] hover:bg-gold/10"
              disabled={busy}
              onClick={reqChanges}
            >
              <MessageSquare className="h-4 w-4" /> Request changes
            </Button>
            <Button
              variant="outline"
              className="h-11 rounded-xl border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
              disabled={busy}
              onClick={reject}
            >
              <X className="h-4 w-4" /> Reject
            </Button>
            <Button
              className="h-11 rounded-xl bg-[#10b981] text-white hover:opacity-90"
              disabled={busy}
              onClick={approve}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Approve
            </Button>
          </div>
        )}
      </SectionCard>
    </motion.div>
  );
}

function HabitFeed({ feed }: { feed: ReturnType<typeof useHabitProofFeed> }) {
  return (
    <SectionCard
      title="Daily habit proofs"
      subtitle="Latest evidence participants attached when marking habits done — read-only."
    >
      {feed.loading ? (
        <p className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </p>
      ) : feed.items.length === 0 ? (
        <p className="py-4 text-sm text-muted-foreground">No habit proofs submitted yet.</p>
      ) : (
        <div className="space-y-4">
          {feed.items.map((h) => (
            <HabitProofRow key={h.id} item={h} />
          ))}
        </div>
      )}
    </SectionCard>
  );
}

function HabitProofRow({ item }: { item: HabitProofItem }) {
  const habit = HABIT_BY_ID[item.habit_id];
  const Icon = habit?.icon;
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="mb-2 flex items-center gap-2">
        {Icon && habit && (
          <span
            className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-white"
            style={{ background: `linear-gradient(135deg, ${habit.from}, ${habit.to})` }}
          >
            <Icon className="h-4 w-4" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">
            {item.name}
            <span className="text-muted-foreground"> · {habit?.name ?? item.habit_id}</span>
          </p>
          <p className="text-[11px] text-muted-foreground">
            Day {item.day_no} ·{" "}
            {formatDistanceToNowStrict(new Date(item.created_at), { addSuffix: true })}
          </p>
        </div>
      </div>
      <ProofAttachments files={item.files} />
    </div>
  );
}
