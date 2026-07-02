import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import {
  Activity,
  Flame,
  CheckCircle2,
  Footprints,
  Trophy,
  Loader2,
  Droplets,
  Dumbbell,
  AlertTriangle,
  Layers3,
  ChevronRight,
  ChevronLeft,
  Search,
  LayoutGrid,
  List as ListIcon,
} from "lucide-react";
import { PageHeader } from "@/components/vkm/page-header";
import { SectionCard } from "@/components/vkm/section-card";
import { AvatarBadge } from "@/components/vkm/avatar-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { HABITS, useParticipantHabits } from "@/components/habits/habit-tracker";
import { HabitGrid } from "@/components/habits/habit-grid";
import { useParticipantsOverview, type ParticipantRow } from "@/components/coach/coach-data";

const NO_BATCH = "__none";
const VIEW_KEY = "vkm.habits.view";
type Sort = "name" | "points" | "progress";

function batchNum(name: string): number | null {
  const m = name.match(/(\d+)\s*$/);
  return m ? Number(m[1]) : null;
}

type BatchGroup = { key: string; name: string; rows: ParticipantRow[] };

export function ParticipantHabitsViewer({ eyebrow = "Coach" }: { eyebrow?: string }) {
  const { rows, loading } = useParticipantsOverview();
  const [batchKey, setBatchKey] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [view, setView] = useState<"grid" | "list">(() =>
    typeof window === "undefined" ? "grid" : (localStorage.getItem(VIEW_KEY) as "grid" | "list") || "grid",
  );
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("name");
  const [onlyRisk, setOnlyRisk] = useState(false);

  function setViewPersist(v: "grid" | "list") {
    setView(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      /* ignore */
    }
  }

  const groups = useMemo<BatchGroup[]>(() => {
    const m = new Map<string, BatchGroup>();
    for (const p of rows) {
      const key = p.batchId ?? NO_BATCH;
      if (!m.has(key)) m.set(key, { key, name: p.batchName ?? "Unassigned", rows: [] });
      m.get(key)!.rows.push(p);
    }
    return [...m.values()].sort((a, b) => {
      if (a.key === NO_BATCH) return 1;
      if (b.key === NO_BATCH) return -1;
      const na = batchNum(a.name);
      const nb = batchNum(b.name);
      if (na != null && nb != null) return nb - na;
      return a.name.localeCompare(b.name);
    });
  }, [rows]);

  const activeBatch = groups.find((g) => g.key === batchKey) ?? null;
  const selectedPerson = rows.find((p) => p.id === userId) ?? null;

  const filtered = useMemo(() => {
    if (!activeBatch) return [];
    let r = activeBatch.rows;
    if (onlyRisk) r = r.filter((p) => p.atRisk);
    if (q.trim()) r = r.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()));
    return [...r].sort((a, b) => {
      if (sort === "points") return b.points - a.points;
      if (sort === "progress") return b.weeksDone - a.weeksDone;
      return a.name.localeCompare(b.name);
    });
  }, [activeBatch, q, sort, onlyRisk]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-5"
    >
      <PageHeader
        eyebrow={eyebrow}
        title="Participant Habits"
        description="Browse by batch, then open any participant's live 90-day habit & step tracker."
        icon={Activity}
      />

      {loading ? (
        <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading participants…
        </div>
      ) : rows.length === 0 ? (
        <SectionCard>
          <p className="py-8 text-center text-sm text-muted-foreground">
            No participants yet — they appear here once assigned to you.
          </p>
        </SectionCard>
      ) : selectedPerson ? (
        // ── Level 3: one participant's habit detail ──
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => setUserId(null)}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" /> {activeBatch?.name ?? "Participants"}
          </button>
          <HabitDetail key={selectedPerson.id} userId={selectedPerson.id} name={selectedPerson.name} />
        </div>
      ) : !activeBatch ? (
        // ── Level 1: batch cards ──
        <BatchPicker groups={groups} onPick={setBatchKey} />
      ) : (
        // ── Level 2: participants in the batch (grid / list) ──
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="rounded-full"
              onClick={() => {
                setBatchKey(null);
                setQ("");
                setOnlyRisk(false);
              }}
            >
              <ChevronLeft className="h-4 w-4" /> Batches
            </Button>
            <div>
              <h2 className="text-base font-semibold text-foreground">{activeBatch.name}</h2>
              <p className="text-[11px] text-muted-foreground">{activeBatch.rows.length} participants</p>
            </div>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search…"
                  className="h-9 w-36 rounded-full pl-8"
                />
              </div>
              <Select value={sort} onValueChange={(v) => setSort(v as Sort)}>
                <SelectTrigger className="h-9 w-32 rounded-full text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Name</SelectItem>
                  <SelectItem value="points">Points</SelectItem>
                  <SelectItem value="progress">Progress</SelectItem>
                </SelectContent>
              </Select>
              <button
                type="button"
                onClick={() => setOnlyRisk((v) => !v)}
                className={cn(
                  "inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors",
                  onlyRisk
                    ? "border-transparent bg-destructive/15 text-destructive"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                <AlertTriangle className="h-3.5 w-3.5" /> At risk
              </button>
              <div className="flex rounded-full border border-border p-0.5">
                <ViewBtn active={view === "grid"} onClick={() => setViewPersist("grid")} label="Grid">
                  <LayoutGrid className="h-4 w-4" />
                </ViewBtn>
                <ViewBtn active={view === "list"} onClick={() => setViewPersist("list")} label="List">
                  <ListIcon className="h-4 w-4" />
                </ViewBtn>
              </div>
            </div>
          </div>

          {filtered.length === 0 ? (
            <SectionCard>
              <p className="py-10 text-center text-sm text-muted-foreground">No matches.</p>
            </SectionCard>
          ) : view === "grid" ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((p) => (
                <PersonCard key={p.id} p={p} onOpen={() => setUserId(p.id)} />
              ))}
            </div>
          ) : (
            <SectionCard bodyClassName="p-0">
              <ul className="divide-y divide-border">
                {filtered.map((p) => (
                  <PersonRow key={p.id} p={p} onOpen={() => setUserId(p.id)} />
                ))}
              </ul>
            </SectionCard>
          )}
        </div>
      )}
    </motion.div>
  );
}

function ViewBtn({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors",
        active ? "bg-gradient-navy text-primary-foreground" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

function BatchPicker({ groups, onPick }: { groups: BatchGroup[]; onPick: (key: string) => void }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {groups.map((g) => {
        const atRisk = g.rows.filter((r) => r.atRisk).length;
        return (
          <button
            key={g.key}
            type="button"
            onClick={() => onPick(g.key)}
            className="group flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 text-left transition-all hover:-translate-y-0.5 hover:border-gold/40 hover:shadow-vkm"
          >
            <div className="flex items-center gap-3">
              <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-navy text-primary-foreground">
                <Layers3 className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">{g.name}</p>
                <p className="text-[11px] text-muted-foreground">{g.rows.length} participants</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex -space-x-2">
                {g.rows.slice(0, 5).map((p) => (
                  <AvatarBadge key={p.id} name={p.name} src={p.avatar_url} size="sm" className="ring-2 ring-card" />
                ))}
                {g.rows.length > 5 && (
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-secondary text-[10px] font-semibold text-muted-foreground ring-2 ring-card">
                    +{g.rows.length - 5}
                  </span>
                )}
              </div>
              {atRisk > 0 && (
                <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-semibold text-destructive">
                  {atRisk} at risk
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function PersonCard({ p, onOpen }: { p: ParticipantRow; onOpen: () => void }) {
  const pct = Math.round((p.weeksDone / 16) * 100);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 text-left transition-all hover:-translate-y-0.5 hover:border-gold/40 hover:shadow-vkm"
    >
      <div className="flex items-center gap-3">
        <AvatarBadge name={p.name} src={p.avatar_url} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{p.name}</p>
          <p className="truncate text-[11px] text-muted-foreground">{p.batchName ?? "Unassigned"}</p>
        </div>
        {p.atRisk && (
          <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-semibold text-destructive">
            At risk
          </span>
        )}
      </div>
      <div>
        <div className="mb-1 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>Week progress</span>
          <span className="tabular-nums">{p.weeksDone}/16</span>
        </div>
        <Progress value={pct} className="h-1.5" />
      </div>
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#2D8CFF] transition-colors group-hover:text-navy">
        <Activity className="h-3.5 w-3.5" /> View habit tracker
      </span>
    </button>
  );
}

function PersonRow({ p, onOpen }: { p: ParticipantRow; onOpen: () => void }) {
  const pct = Math.round((p.weeksDone / 16) * 100);
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-center gap-4 px-4 py-3.5 text-left transition-colors hover:bg-secondary/50 sm:px-5"
      >
        <AvatarBadge name={p.name} src={p.avatar_url} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">{p.name}</p>
          <div className="mt-1.5 flex items-center gap-2">
            <Progress value={pct} className="h-1.5 max-w-[160px] flex-1" />
            <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
              {p.weeksDone}/16
            </span>
          </div>
        </div>
        {p.atRisk && (
          <span className="hidden shrink-0 rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-semibold text-destructive sm:inline">
            At risk
          </span>
        )}
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
      </button>
    </li>
  );
}

// ── One participant's full habit tracker ─────────────────────────────────────
function HabitDetail({ userId, name }: { userId: string; name: string }) {
  const t = useParticipantHabits(userId);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4 lg:grid-cols-7">
        <Stat icon={CheckCircle2} accent="text-[#10b981]" label="Today" value={`${t.todayDone}/${HABITS.length}`} />
        <Stat icon={Flame} accent="text-[#f59e0b]" label="Streak" value={`${t.streak}d`} />
        <Stat icon={Activity} accent="text-[#3b82f6]" label="Days done" value={`${t.completedDays}`} />
        <Stat icon={Trophy} accent="text-[oklch(0.5_0.11_80)]" label="Points" value={`${t.points}`} />
        <Stat icon={Footprints} accent="text-[#10b981]" label="Steps" value={`${t.steps}`} />
        <Stat icon={Droplets} accent="text-[#0ea5e9]" label="Water" value={`${(t.waterMl / 1000).toFixed(1)}L`} />
        <Stat icon={Dumbbell} accent="text-[#ef4444]" label="Workout" value={`${t.workoutMinutes}m`} />
      </div>

      {t.loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading {name}'s tracker…
        </div>
      ) : (
        <>
          <HabitGrid
            config={t.config}
            dayState={t.dayState}
            title={`${name} · Habit Tracker`}
            subtitle="Tap any day to see that date's proofs & completions"
            isDone={t.isDone}
            proofsFor={t.proofsFor}
            anchor={t.startedAt ?? undefined}
            defaultOpen
          />
          {t.waterEvents.length > 0 && (
            <SectionCard
              title="Water log · today"
              subtitle="Each glass is timestamped · ⚠ flags rapid logs"
            >
              <ul className="divide-y divide-border">
                {t.waterEvents.map((e) => (
                  <li key={e.id} className="flex items-start gap-3 py-2.5">
                    <span
                      className={cn(
                        "mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white",
                        e.ml > 0 ? "bg-[#0ea5e9]" : "bg-muted-foreground/40",
                      )}
                    >
                      <Droplets className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-foreground">
                        {e.ml > 0 ? "+" : ""}
                        {e.ml} ml
                        {e.rapid && (
                          <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                            <AlertTriangle className="h-3 w-3" /> rapid
                          </span>
                        )}
                      </p>
                      {e.reason && <p className="text-xs text-muted-foreground">“{e.reason}”</p>}
                    </div>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {format(new Date(e.created_at), "h:mm a")}
                    </span>
                  </li>
                ))}
              </ul>
            </SectionCard>
          )}
        </>
      )}
    </div>
  );
}

function Stat({
  icon: Icon,
  accent,
  label,
  value,
}: {
  icon: typeof Activity;
  accent: string;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3.5 shadow-vkm">
      <Icon className={cn("h-5 w-5", accent)} />
      <p className="mt-1.5 text-xl font-bold tabular-nums text-foreground">{value}</p>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
    </div>
  );
}
