import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Users,
  UserCog,
  GraduationCap,
  Loader2,
  AlertTriangle,
  Activity,
  Trophy,
  Clock3,
  ArrowRight,
  TrendingUp,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { SectionCard } from "@/components/vkm/section-card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { useAnalyticsBatches } from "@/components/admin/analytics-data";
import {
  useBatchAnalytics,
  type BatchAnalytics,
  type BatchParticipant,
  type BatchCoach,
  type BatchMentor,
} from "@/components/admin/batch-analytics-data";
import { AreaTrend, BarTrend, TrendCard, GOLD, SKY } from "@/components/admin/trend-charts";

// Sentinel for "participants who belong to no batch" (the RPC takes null).
const NO_BATCH = "__none__";
type Group = "participants" | "coaches" | "mentors";

function initials(name?: string | null) {
  return (name ?? "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}
function ago(ts?: string | null) {
  if (!ts) return "never";
  try {
    return `${formatDistanceToNow(new Date(ts))} ago`;
  } catch {
    return "—";
  }
}

/**
 * Batch-scoped drill-down: pick a batch → pick a group (participants / coaches
 * / mentors) → pick one person to see their detail. Nothing org-wide is shown,
 * and nothing but the selectors renders until a group is chosen.
 */
export function BatchInsights({
  showTrends = true,
  /** When provided, an outer page owns the batch choice and the picker is hidden. */
  controlledBatchKey,
  hidePicker = false,
}: {
  showTrends?: boolean;
  controlledBatchKey?: string | null;
  hidePicker?: boolean;
} = {}) {
  const { batches, loading: batchesLoading } = useAnalyticsBatches();
  const [innerKey, setInnerKey] = useState<string | null>(null);
  const [group, setGroup] = useState<Group>("participants");
  const [personId, setPersonId] = useState<string | null>(null);

  const batchKey = hidePicker ? (controlledBatchKey ?? null) : innerKey;
  const setBatchKey = setInnerKey;

  // Default to the first (most relevant) batch rather than "everyone".
  useEffect(() => {
    if (!hidePicker && innerKey === null && batches.length > 0) setInnerKey(batches[0].batch_id);
  }, [batches, innerKey, hidePicker]);

  const batchId = batchKey === NO_BATCH ? null : batchKey;
  const { data, loading } = useBatchAnalytics(batchId, batchKey !== null);

  // Selecting a different batch or group clears the chosen person.
  useEffect(() => {
    setPersonId(null);
  }, [batchKey, group]);

  const batchLabel =
    batchKey === NO_BATCH
      ? "No batch"
      : (batches.find((b) => b.batch_id === batchKey)?.name ?? "—");

  return (
    <div className="space-y-5">
      {/* 1 — Batch */}
      {!hidePicker && (
        <SectionCard
          title={<span className="text-sm font-semibold">Batch</span>}
          subtitle="Everything below is scoped to this batch only"
        >
          <Select value={batchKey ?? undefined} onValueChange={(v) => setBatchKey(v)}>
            <SelectTrigger className="h-10 w-full rounded-xl sm:w-80">
              <SelectValue placeholder={batchesLoading ? "Loading batches…" : "Select a batch"} />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Batches</SelectLabel>
                {batches.map((b) => (
                  <SelectItem key={b.batch_id} value={b.batch_id}>
                    {b.name} · {b.participant_count} participants
                  </SelectItem>
                ))}
                <SelectItem value={NO_BATCH}>No batch (unassigned)</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </SectionCard>
      )}

      {batchKey === null || (loading && !data) ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !data ? null : (
        <>
          {/* 2 — Batch summary tiles */}
          <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <Tile label="Members" value={data.summary.members} icon={Users} />
            <Tile
              label="Active · 7d"
              value={data.summary.active_7d}
              icon={Activity}
              accent="live"
            />
            <Tile
              label="Avg progress"
              value={data.summary.avg_progress_pct}
              suffix="%"
              icon={TrendingUp}
              accent="gold"
            />
            <Tile
              label="At risk"
              value={data.summary.at_risk}
              icon={AlertTriangle}
              accent="danger"
            />
            <Tile
              label="Pending proofs"
              value={data.summary.pending_proofs}
              icon={Clock3}
              accent="warning"
            />
            <Tile label="Points" value={data.summary.total_points} icon={Trophy} accent="gold" />
          </section>

          {/* 3 — Group */}
          <SectionCard
            title={<span className="text-sm font-semibold">Who do you want to see?</span>}
            subtitle={`${batchLabel} · pick a group, then a person`}
          >
            <div className="flex flex-wrap gap-2">
              <GroupTab
                active={group === "participants"}
                onClick={() => setGroup("participants")}
                icon={Users}
                label="Participants"
                count={data.participants.length}
              />
              <GroupTab
                active={group === "coaches"}
                onClick={() => setGroup("coaches")}
                icon={UserCog}
                label="Coaches"
                count={data.coaches.length}
              />
              <GroupTab
                active={group === "mentors"}
                onClick={() => setGroup("mentors")}
                icon={GraduationCap}
                label="Mentors"
                count={data.mentors.length}
              />
            </div>

            {/* 4 — Person picker for the chosen group */}
            <div className="mt-4">
              <PersonPicker data={data} group={group} value={personId} onChange={setPersonId} />
            </div>
          </SectionCard>

          {/* 5 — Detail (or the scoped list until one is picked) */}
          <PersonDetail data={data} group={group} personId={personId} onPick={setPersonId} />

          {showTrends && (
            <section className="grid gap-4 lg:grid-cols-2">
              <TrendCard title="Habit completion · 14 days" subtitle={`${batchLabel} only`}>
                <AreaTrend
                  data={data.trends.habit_14d.map((d) => ({ label: d.date.slice(5), v: d.pct }))}
                  id="bi-habit"
                  color={GOLD}
                  pct
                />
              </TrendCard>
              <TrendCard title="Points awarded · 30 days" subtitle={`${batchLabel} only`}>
                <BarTrend
                  data={data.trends.points_30d.map((d) => ({
                    label: d.date.slice(5),
                    v: d.points,
                  }))}
                  id="bi-points"
                  color={SKY}
                />
              </TrendCard>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function PersonPicker({
  data,
  group,
  value,
  onChange,
}: {
  data: BatchAnalytics;
  group: Group;
  value: string | null;
  onChange: (v: string) => void;
}) {
  const items = useMemo(() => {
    if (group === "participants")
      return data.participants.map((p) => ({ id: p.user_id, name: p.full_name }));
    if (group === "coaches")
      return data.coaches.map((c) => ({ id: c.coach_id, name: c.full_name }));
    return data.mentors.map((m) => ({ id: m.mentor_id, name: m.full_name }));
  }, [data, group]);

  const label = group === "participants" ? "participant" : group === "coaches" ? "coach" : "mentor";

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">No {label}s in this batch.</p>;
  }

  return (
    <Select value={value ?? undefined} onValueChange={onChange}>
      <SelectTrigger className="h-10 w-full rounded-xl sm:w-80">
        <SelectValue placeholder={`Select a ${label}…`} />
      </SelectTrigger>
      <SelectContent>
        {items.map((i) => (
          <SelectItem key={i.id} value={i.id}>
            {i.name ?? "Unnamed"}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function PersonDetail({
  data,
  group,
  personId,
  onPick,
}: {
  data: BatchAnalytics;
  group: Group;
  personId: string | null;
  onPick: (id: string) => void;
}) {
  if (group === "participants") {
    const p = data.participants.find((x) => x.user_id === personId);
    return p ? (
      <ParticipantCard p={p} mentors={data.mentors} />
    ) : (
      <MiniList
        title="Participants in this batch"
        rows={data.participants.map((x) => ({
          id: x.user_id,
          name: x.full_name,
          avatar: x.avatar_url,
          meta: `Week ${x.my_week}/${x.total_weeks} · ${x.weeks_done} approved · ${x.points} pts`,
          flag: x.at_risk,
        }))}
        onPick={onPick}
      />
    );
  }
  if (group === "coaches") {
    const c = data.coaches.find((x) => x.coach_id === personId);
    return c ? (
      <CoachCard c={c} data={data} onPick={onPick} />
    ) : (
      <MiniList
        title="Coaches serving this batch"
        rows={data.coaches.map((x) => ({
          id: x.coach_id,
          name: x.full_name,
          avatar: x.avatar_url,
          meta: `${x.participants} participants · ${x.reviews_30d} reviews (30d)`,
          flag: x.at_risk > 0,
        }))}
        onPick={onPick}
      />
    );
  }
  const m = data.mentors.find((x) => x.mentor_id === personId);
  return m ? (
    <MentorCard m={m} />
  ) : (
    <MiniList
      title="Mentors"
      subtitle="Numbers below cover this batch only"
      rows={data.mentors.map((x) => ({
        id: x.mentor_id,
        name: x.full_name,
        avatar: x.avatar_url,
        meta: `${x.reviews_30d} proof reviews · ${x.habit_reviews_30d} habit reviews (30d)`,
        flag: false,
      }))}
      onPick={onPick}
    />
  );
}

// A participant: their own numbers, plus their coaches and the batch's mentors.
function ParticipantCard({ p, mentors }: { p: BatchParticipant; mentors: BatchMentor[] }) {
  const pct = Math.round((p.weeks_done / Math.max(p.total_weeks, 1)) * 100);
  return (
    <div className="space-y-4">
      <SectionCard
        title={
          <span className="flex items-center gap-2.5">
            <Avatar className="h-8 w-8">
              <AvatarImage src={p.avatar_url ?? undefined} />
              <AvatarFallback className="text-xs">{initials(p.full_name)}</AvatarFallback>
            </Avatar>
            <span className="text-sm font-semibold">{p.full_name ?? "Unnamed"}</span>
            {p.at_risk && (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold text-red-600">
                <AlertTriangle className="h-3 w-3" /> At risk
              </span>
            )}
          </span>
        }
        subtitle={`Last active ${ago(p.last_active_at)}`}
      >
        <div className="space-y-4">
          <div>
            <div className="mb-1 flex items-center justify-between text-xs font-medium">
              <span className="text-muted-foreground">Program progress</span>
              <span className="text-foreground">
                {p.weeks_done} / {p.total_weeks} weeks approved
              </span>
            </div>
            <Progress value={pct} className="h-2" />
            <p className="mt-1 text-[11px] text-muted-foreground">Currently on week {p.my_week}</p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MiniStat label="Points" value={String(p.points)} />
            <MiniStat label="Habits today" value={`${p.habits_today}/6`} />
            <MiniStat label="Pending proofs" value={String(p.pending_proofs)} />
            <MiniStat label="Week" value={`${p.my_week}/${p.total_weeks}`} />
          </div>

          <Button variant="outline" className="rounded-xl" asChild>
            <Link to="/admin/participant/$userId" params={{ userId: p.user_id }}>
              Open full profile <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </SectionCard>

      <SectionCard
        title={<span className="text-sm font-semibold">Their coaches</span>}
        subtitle={
          p.coaches.length === 0
            ? "No coach assigned"
            : `${p.coaches.length} assigned · reviews are for this participant`
        }
      >
        {p.coaches.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            This participant has no coach assigned yet.
          </p>
        ) : (
          <div className="space-y-2">
            {p.coaches.map((c) => (
              <div
                key={c.coach_id}
                className="flex items-center gap-3 rounded-xl border border-border bg-card p-2.5"
              >
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="text-xs">{initials(c.full_name)}</AvatarFallback>
                </Avatar>
                <p className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                  {c.full_name ?? "Unnamed"}
                </p>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {c.reviews_30d} reviews · 30d
                </span>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard
        title={<span className="text-sm font-semibold">Their mentors</span>}
        subtitle="Activity shown for this batch only"
      >
        {mentors.length === 0 ? (
          <p className="text-sm text-muted-foreground">No mentors.</p>
        ) : (
          <div className="space-y-2">
            {mentors.map((m) => (
              <div
                key={m.mentor_id}
                className="flex items-center gap-3 rounded-xl border border-border bg-card p-2.5"
              >
                <Avatar className="h-8 w-8">
                  <AvatarImage src={m.avatar_url ?? undefined} />
                  <AvatarFallback className="text-xs">{initials(m.full_name)}</AvatarFallback>
                </Avatar>
                <p className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                  {m.full_name ?? "Unnamed"}
                </p>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {m.reviews_30d} proof · {m.habit_reviews_30d} habit
                </span>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

function CoachCard({
  c,
  data,
  onPick,
}: {
  c: BatchCoach;
  data: BatchAnalytics;
  onPick: (id: string) => void;
}) {
  const theirs = data.participants.filter((p) => p.coaches.some((x) => x.coach_id === c.coach_id));
  return (
    <div className="space-y-4">
      <SectionCard
        title={
          <span className="flex items-center gap-2.5">
            <Avatar className="h-8 w-8">
              <AvatarImage src={c.avatar_url ?? undefined} />
              <AvatarFallback className="text-xs">{initials(c.full_name)}</AvatarFallback>
            </Avatar>
            <span className="text-sm font-semibold">{c.full_name ?? "Unnamed"}</span>
          </span>
        }
        subtitle={`Last active ${ago(c.last_active_at)} · numbers are for this batch`}
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MiniStat label="Participants" value={String(c.participants)} />
          <MiniStat label="Reviews · 30d" value={String(c.reviews_30d)} />
          <MiniStat label="At risk" value={String(c.at_risk)} />
          <MiniStat label="Avg habits today" value={String(c.avg_habits_today)} />
        </div>
      </SectionCard>

      <MiniList
        title={`Their participants in this batch (${theirs.length})`}
        rows={theirs.map((p) => ({
          id: p.user_id,
          name: p.full_name,
          avatar: p.avatar_url,
          meta: `Week ${p.my_week}/${p.total_weeks} · ${p.weeks_done} approved · ${p.points} pts`,
          flag: p.at_risk,
        }))}
        onPick={onPick}
      />
    </div>
  );
}

function MentorCard({ m }: { m: BatchMentor }) {
  return (
    <SectionCard
      title={
        <span className="flex items-center gap-2.5">
          <Avatar className="h-8 w-8">
            <AvatarImage src={m.avatar_url ?? undefined} />
            <AvatarFallback className="text-xs">{initials(m.full_name)}</AvatarFallback>
          </Avatar>
          <span className="text-sm font-semibold">{m.full_name ?? "Unnamed"}</span>
        </span>
      }
      subtitle={`Last active ${ago(m.last_active_at)} · numbers are for this batch only`}
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <MiniStat label="Proof reviews · 30d" value={String(m.reviews_30d)} />
        <MiniStat label="Habit reviews · 30d" value={String(m.habit_reviews_30d)} />
      </div>
    </SectionCard>
  );
}

function MiniList({
  title,
  subtitle,
  rows,
  onPick,
}: {
  title: string;
  subtitle?: string;
  rows: { id: string; name: string | null; avatar?: string | null; meta: string; flag?: boolean }[];
  onPick: (id: string) => void;
}) {
  return (
    <SectionCard
      title={<span className="text-sm font-semibold">{title}</span>}
      subtitle={subtitle ?? "Select one to see their detail"}
    >
      {rows.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">Nobody here yet.</p>
      ) : (
        <div className="space-y-1.5">
          {rows.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => onPick(r.id)}
              className="flex w-full items-center gap-3 rounded-xl border border-border bg-card p-2.5 text-left transition-colors hover:bg-secondary/50"
            >
              <Avatar className="h-8 w-8">
                <AvatarImage src={r.avatar ?? undefined} />
                <AvatarFallback className="text-xs">{initials(r.name)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {r.name ?? "Unnamed"}
                </p>
                <p className="truncate text-[11px] text-muted-foreground">{r.meta}</p>
              </div>
              {r.flag && <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />}
              <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </button>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

function GroupTab({
  active,
  onClick,
  icon: Icon,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-all",
        active
          ? "border-transparent bg-gradient-navy text-primary-foreground shadow-vkm"
          : "border-border bg-card text-foreground hover:bg-secondary/50",
      )}
    >
      <Icon className="h-3.5 w-3.5" /> {label}
      <span
        className={cn(
          "rounded-full px-1.5 text-[10px] font-bold",
          active ? "bg-white/20" : "bg-secondary text-muted-foreground",
        )}
      >
        {count}
      </span>
    </button>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-2.5">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-lg font-bold tabular-nums text-foreground">{value}</p>
    </div>
  );
}

const ACCENT: Record<string, string> = {
  navy: "text-navy",
  gold: "text-gold",
  danger: "text-red-500",
  warning: "text-amber-500",
  live: "text-[oklch(0.6_0.16_150)]",
};

function Tile({
  label,
  value,
  suffix,
  icon: Icon,
  accent = "navy",
}: {
  label: string;
  value: number;
  suffix?: string;
  icon: React.ComponentType<{ className?: string }>;
  accent?: keyof typeof ACCENT | string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3.5">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
        <Icon className={cn("h-4 w-4", ACCENT[accent] ?? ACCENT.navy)} />
      </div>
      <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">
        {value.toLocaleString()}
        {suffix}
      </p>
    </div>
  );
}
