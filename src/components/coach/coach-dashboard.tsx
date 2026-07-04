import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "@tanstack/react-router";
import { format, parseISO } from "date-fns";
import {
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Circle,
  ArrowRight,
  Loader2,
  ChevronRight,
  Plus,
  Trash2,
  Video,
  Clock,
  CalendarDays,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { PageHeader } from "@/components/vkm/page-header";
import { SectionCard } from "@/components/vkm/section-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AvatarBadge } from "@/components/vkm/avatar-badge";
import { cn } from "@/lib/utils";
import { VKM_COACH_PLAYBOOK } from "@/lib/vkm/program";
import { useProofQueue } from "@/components/coach/coach-data";
import { useCohort, type CohortRow } from "@/components/coach/cohort-data";
import { useCoachTasks, type CoachTask } from "@/components/coach/coach-tasks-data";
import { useMeetings, type Meeting } from "@/components/meetings/meetings-data";
import { ZoomMeetingModal } from "@/components/meetings/zoom-meeting-modal";

// A clarity-first coach home: lead with "what needs you today", a few big
// status signals, the people who need action (with plain-language reasons),
// then a calm "on track" summary. Detail lives in the Cohort Command Center.
export function CoachDashboard() {
  const { profile } = useAuth();
  const name = profile?.full_name?.split(" ")[0] ?? "Coach";
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const { items: pending, loading: pendingLoading } = useProofQueue();
  const { rows, loading, error } = useCohort();

  const atRisk = rows.filter((r) => r.atRisk);
  const onTrack = Math.max(0, rows.length - atRisk.length);
  const needs = pending.length + atRisk.length;
  const busy = loading || pendingLoading;

  function scrollToAttention() {
    document
      .getElementById("needs-attention")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="mx-auto w-full max-w-[1100px] space-y-6"
    >
      <PageHeader
        eyebrow="Coach"
        title={`${greeting}, ${name}.`}
        description="Start here — this shows what needs you today. Everything else is on track."
      />

      {/* What needs you today */}
      <div className="overflow-hidden rounded-3xl bg-gradient-navy p-6 text-primary-foreground shadow-vkm-float sm:p-7">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/60">
          Needs you today
        </p>
        {busy ? (
          <div className="mt-4 flex items-center gap-2 text-white/70">
            <Loader2 className="h-5 w-5 animate-spin" /> Checking your cohort…
          </div>
        ) : needs === 0 ? (
          <div className="mt-3 flex items-center gap-3">
            <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10">
              <CheckCircle2 className="h-7 w-7 text-[#7ee0b0]" />
            </span>
            <div>
              <p className="text-2xl font-bold">You’re all caught up.</p>
              <p className="text-sm text-white/70">
                No proofs to review, and no one’s falling behind right now.
              </p>
            </div>
          </div>
        ) : (
          <div className="mt-4 space-y-2.5">
            {pending.length > 0 && (
              <Link to="/coach/approve" className="block">
                <ActionRow
                  icon={ShieldCheck}
                  tone="gold"
                  title={`${pending.length} ${pending.length === 1 ? "proof is" : "proofs are"} waiting for your review`}
                  cta="Review now"
                />
              </Link>
            )}
            {atRisk.length > 0 && (
              <button type="button" onClick={scrollToAttention} className="block w-full text-left">
                <ActionRow
                  icon={AlertTriangle}
                  tone="warn"
                  title={`${atRisk.length} ${atRisk.length === 1 ? "participant is" : "participants are"} falling behind`}
                  cta="See who"
                />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Three big signals, framed by status */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <BigStat
          n={atRisk.length}
          label="Need attention"
          hint="falling behind"
          tone="danger"
          busy={busy}
        />
        <BigStat
          n={pending.length}
          label="To review"
          hint="proofs waiting"
          tone="gold"
          busy={busy}
        />
        <BigStat n={onTrack} label="On track" hint="nothing needed" tone="ok" busy={busy} />
      </div>

      {/* Who needs attention — the actionable heart */}
      <div id="needs-attention" className="scroll-mt-20">
        <SectionCard
          title="Who needs attention"
          subtitle="The only people you need to act on right now — and why."
          bodyClassName="p-0"
        >
          {busy ? (
            <p className="px-5 py-10 text-center">
              <Loader2 className="mx-auto h-4 w-4 animate-spin text-muted-foreground" />
            </p>
          ) : error ? (
            <div className="flex flex-col items-center gap-2 px-5 py-10 text-center">
              <AlertTriangle className="h-6 w-6 text-destructive" />
              <p className="text-sm font-medium text-foreground">Couldn’t load your cohort</p>
              <p className="max-w-sm text-xs text-muted-foreground">{error}</p>
            </div>
          ) : atRisk.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-5 py-10 text-center">
              <CheckCircle2 className="h-7 w-7 text-[oklch(0.55_0.14_160)]" />
              <p className="text-sm font-medium text-foreground">No one needs attention.</p>
              <p className="text-xs text-muted-foreground">
                Everyone’s keeping up — check back later.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {atRisk.map((r) => (
                <AttentionRow key={r.user_id} r={r} />
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      {/* Productivity row — your tasks + your meetings */}
      <div className="grid gap-5 lg:grid-cols-2">
        <CoachTasksCard />
        <TodayMeetingsCard />
      </div>

      {/* On track — calm summary */}
      {!busy && onTrack > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 shadow-vkm">
          <p className="flex items-center gap-2 text-sm text-foreground">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-[oklch(0.55_0.14_160)]" />
            <span>
              <span className="font-semibold">{onTrack}</span>{" "}
              {onTrack === 1 ? "participant is" : "participants are"} on track — nothing needed.
            </span>
          </p>
          <Button variant="outline" size="sm" className="rounded-full" asChild>
            <Link to="/coach/cohort">
              See everyone <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      )}

      {/* Weekly 1:1 structure — reference, kept but secondary */}
      <SectionCard
        title="Your weekly 1:1 structure"
        subtitle="Run this with each participant — Review · Connect · Apply · Assign · Commit"
      >
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {VKM_COACH_PLAYBOOK.weekly_1on1.map((b) => (
            <div
              key={b.block}
              className="flex items-start gap-3 rounded-xl bg-secondary/50 px-3 py-2.5"
            >
              <span className="inline-flex h-6 shrink-0 items-center rounded-md bg-card px-1.5 text-[11px] font-semibold text-navy">
                {b.mins}m
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{b.block}</p>
                <p className="text-xs text-muted-foreground">{b.what}</p>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </motion.div>
  );
}

function ActionRow({
  icon: Icon,
  title,
  cta,
  tone,
}: {
  icon: LucideIcon;
  title: string;
  cta: string;
  tone: "gold" | "warn";
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white/10 px-4 py-3 ring-1 ring-white/15 transition-colors hover:bg-white/15">
      <span
        className={cn(
          "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
          tone === "gold" ? "bg-gradient-gold text-navy" : "bg-[#f59e0b] text-navy",
        )}
      >
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1 text-sm font-semibold">{title}</span>
      <span className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-white/90">
        {cta} <ChevronRight className="h-4 w-4" />
      </span>
    </div>
  );
}

function BigStat({
  n,
  label,
  hint,
  tone,
  busy,
}: {
  n: number;
  label: string;
  hint: string;
  tone: "danger" | "gold" | "ok";
  busy: boolean;
}) {
  const color =
    tone === "danger"
      ? "text-destructive"
      : tone === "gold"
        ? "text-[oklch(0.5_0.11_80)]"
        : "text-[oklch(0.45_0.13_160)]";
  // A zero count for a "bad" signal is good news → show it neutral, not alarming.
  const numClass = !busy && n === 0 && tone !== "ok" ? "text-foreground" : color;
  return (
    <div className="rounded-2xl border border-border bg-card p-4 text-center shadow-vkm sm:p-5">
      <p className={cn("text-4xl font-bold tabular-nums sm:text-5xl", numClass)}>
        {busy ? "—" : n}
      </p>
      <p className="mt-1 text-sm font-semibold text-foreground">{label}</p>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function AttentionRow({ r }: { r: CohortRow }) {
  return (
    <li className="flex items-center gap-3 px-5 py-3">
      <AvatarBadge name={r.name} src={r.avatar_url} size="md" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium text-foreground">{r.name}</p>
          {r.batch_name && (
            <span className="hidden shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground sm:inline">
              {r.batch_name}
            </span>
          )}
        </div>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {r.reasons.map((reason) => (
            <span
              key={reason}
              className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive"
            >
              <AlertTriangle className="h-3 w-3" /> {reason}
            </span>
          ))}
        </div>
      </div>
      <Button size="sm" variant="outline" className="shrink-0 rounded-lg" asChild>
        <Link to="/coach/participant/$userId" params={{ userId: r.user_id }}>
          Open
        </Link>
      </Button>
    </li>
  );
}

// ---- Productivity: tasks/reminders -----------------------------------------
function CoachTasksCard() {
  const { tasks, loading, add, toggle, remove } = useCoachTasks();
  const [draft, setDraft] = useState("");
  const open = tasks.filter((t) => !t.done);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    await add({ title: draft });
    setDraft("");
  }

  return (
    <SectionCard
      title="My tasks & reminders"
      subtitle="Your personal to-dos — add one in a tap; tie tasks to a participant from their page."
    >
      <form onSubmit={submit} className="mb-3 flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add a task or reminder…"
          className="h-10 rounded-lg"
        />
        <Button
          type="submit"
          disabled={!draft.trim()}
          className="h-10 rounded-lg bg-gradient-navy text-primary-foreground hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> Add
        </Button>
      </form>

      {loading ? (
        <p className="py-6 text-center">
          <Loader2 className="mx-auto h-4 w-4 animate-spin text-muted-foreground" />
        </p>
      ) : open.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          No open tasks — you’re clear. ✓
        </p>
      ) : (
        <ul className="space-y-1.5">
          {open.map((t) => (
            <TaskRow
              key={t.id}
              t={t}
              onToggle={() => toggle(t.id, true)}
              onRemove={() => remove(t.id)}
            />
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

function TaskRow({
  t,
  onToggle,
  onRemove,
}: {
  t: CoachTask;
  onToggle: () => void;
  onRemove: () => void;
}) {
  const today = format(new Date(), "yyyy-MM-dd");
  const overdue = t.due_on != null && t.due_on < today;
  const dueToday = t.due_on === today;
  return (
    <li className="group flex items-center gap-2.5 rounded-xl border border-border bg-card px-3 py-2">
      <button
        type="button"
        onClick={onToggle}
        aria-label="Mark done"
        className="shrink-0 text-muted-foreground transition-colors hover:text-[oklch(0.55_0.14_160)]"
      >
        <Circle className="h-5 w-5" />
      </button>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-foreground">{t.title}</p>
        {(t.participantName || t.due_on) && (
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
            {t.participantName && t.participant_id && (
              <Link
                to="/coach/participant/$userId"
                params={{ userId: t.participant_id }}
                className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted-foreground hover:text-foreground"
              >
                {t.participantName}
              </Link>
            )}
            {t.due_on && (
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
                  overdue
                    ? "bg-destructive/10 text-destructive"
                    : dueToday
                      ? "bg-gold/15 text-[oklch(0.45_0.1_85)]"
                      : "bg-secondary text-muted-foreground",
                )}
              >
                <Clock className="h-2.5 w-2.5" />
                {overdue ? "Overdue" : dueToday ? "Today" : format(parseISO(t.due_on), "d MMM")}
              </span>
            )}
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={onRemove}
        aria-label="Delete task"
        className="app-press shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </li>
  );
}

// ---- Productivity: meetings -------------------------------------------------
function TodayMeetingsCard() {
  const { profile } = useAuth();
  const userName = profile?.full_name?.split(" ")[0] ?? "Coach";
  const { meetings, loading } = useMeetings();
  const [joining, setJoining] = useState<Meeting | null>(null);
  const now = new Date();
  const upcoming = meetings
    .filter(
      (m) =>
        m.status !== "cancelled" &&
        new Date(parseISO(m.start_time).getTime() + m.duration_min * 60000) > now,
    )
    .slice(0, 5);

  return (
    <SectionCard
      title="Your meetings"
      subtitle="Upcoming Zoom calls — join right here."
      action={
        <Button size="sm" variant="ghost" className="rounded-full" asChild>
          <Link to="/coach/calendar">
            Calendar <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
      }
    >
      {loading ? (
        <p className="py-6 text-center">
          <Loader2 className="mx-auto h-4 w-4 animate-spin text-muted-foreground" />
        </p>
      ) : upcoming.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <CalendarDays className="h-6 w-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No upcoming meetings.</p>
          <Button size="sm" variant="outline" className="rounded-lg" asChild>
            <Link to="/coach/calendar">Schedule one</Link>
          </Button>
        </div>
      ) : (
        <ul className="space-y-2">
          {upcoming.map((m) => (
            <li
              key={m.id}
              className="flex items-center gap-3 rounded-xl border border-border bg-card p-2.5"
            >
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#2D8CFF]/15 text-[#2D8CFF]">
                <Video className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{m.topic}</p>
                <p className="truncate text-xs text-muted-foreground">
                  with {m.participantName} · {format(parseISO(m.start_time), "EEE d MMM, h:mm a")}
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => setJoining(m)}
                className="shrink-0 rounded-lg bg-[#2D8CFF] text-white hover:bg-[#2D8CFF]/90"
              >
                <Video className="h-4 w-4" /> Join
              </Button>
            </li>
          ))}
        </ul>
      )}

      <AnimatePresence>
        {joining && (
          <ZoomMeetingModal
            meetingId={joining.id}
            topic={joining.topic}
            userName={userName}
            joinUrl={joining.join_url}
            onClose={() => setJoining(null)}
          />
        )}
      </AnimatePresence>
    </SectionCard>
  );
}
