import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "@tanstack/react-router";
import {
  Users,
  Activity,
  Loader2,
  ChevronRight,
  ChevronLeft,
  AlertTriangle,
  LayoutGrid,
  List as ListIcon,
  Search,
  Layers3,
} from "lucide-react";
import { PageHeader } from "@/components/vkm/page-header";
import { AvatarBadge } from "@/components/vkm/avatar-badge";
import { SectionCard } from "@/components/vkm/section-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { useParticipantsOverview, type ParticipantRow } from "@/components/coach/coach-data";

const NO_BATCH = "__none";
const VIEW_KEY = "vkm.participants.view";

type BatchGroup = { key: string; id: string | null; name: string; rows: ParticipantRow[] };

// Trailing number from a batch name ("Batch 16" → 16) so we can sort newest first.
function batchNum(name: string): number | null {
  const m = name.match(/(\d+)\s*$/);
  return m ? Number(m[1]) : null;
}

export function ParticipantsList({
  eyebrow = "Coach",
  detailBase,
  habitsTo,
}: {
  eyebrow?: string;
  detailBase: string;
  habitsTo?: string;
}) {
  const { rows, loading, error } = useParticipantsOverview();
  const [selected, setSelected] = useState<string | null>(null);
  const [view, setView] = useState<"grid" | "list">(() => {
    if (typeof window === "undefined") return "grid";
    return (localStorage.getItem(VIEW_KEY) as "grid" | "list") || "grid";
  });
  const [q, setQ] = useState("");

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
      if (!m.has(key))
        m.set(key, { key, id: p.batchId, name: p.batchName ?? "Unassigned", rows: [] });
      m.get(key)!.rows.push(p);
    }
    return [...m.values()].sort((a, b) => {
      if (a.key === NO_BATCH) return 1;
      if (b.key === NO_BATCH) return -1;
      const na = batchNum(a.name);
      const nb = batchNum(b.name);
      if (na != null && nb != null) return nb - na; // newest batch first
      return a.name.localeCompare(b.name);
    });
  }, [rows]);

  const active = groups.find((g) => g.key === selected) ?? null;
  const filtered = useMemo(() => {
    if (!active) return [];
    if (!q.trim()) return active.rows;
    const s = q.toLowerCase();
    return active.rows.filter((p) => p.name.toLowerCase().includes(s));
  }, [active, q]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-5"
    >
      <PageHeader
        eyebrow={eyebrow}
        title="Participants"
        description="Browse by batch, then open any participant's full progress card."
        icon={Users}
        actions={
          habitsTo ? (
            <Button variant="outline" className="rounded-full" asChild>
              <Link to={habitsTo}>
                <Activity className="h-4 w-4" /> Habit tracking
              </Link>
            </Button>
          ) : undefined
        }
      />

      {loading ? (
        <SectionCard bodyClassName="p-0">
          <p className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading participants…
          </p>
        </SectionCard>
      ) : error ? (
        <SectionCard bodyClassName="p-0">
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <AlertTriangle className="h-6 w-6 text-destructive" />
            <p className="text-sm font-medium text-foreground">Couldn't load participants</p>
            <p className="max-w-sm text-xs text-muted-foreground">{error}</p>
          </div>
        </SectionCard>
      ) : rows.length === 0 ? (
        <SectionCard bodyClassName="p-0">
          <p className="py-12 text-center text-sm text-muted-foreground">
            No participants yet — they appear once invited.
          </p>
        </SectionCard>
      ) : !active ? (
        <BatchPicker groups={groups} onPick={setSelected} />
      ) : (
        <div className="space-y-4">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="rounded-full"
              onClick={() => {
                setSelected(null);
                setQ("");
              }}
            >
              <ChevronLeft className="h-4 w-4" /> Batches
            </Button>
            <div>
              <h2 className="text-base font-semibold text-foreground">{active.name}</h2>
              <p className="text-[11px] text-muted-foreground">{active.rows.length} participants</p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search…"
                  className="h-9 w-40 rounded-full pl-8"
                />
              </div>
              <div className="flex rounded-full border border-border p-0.5">
                <ViewToggle active={view === "grid"} onClick={() => setViewPersist("grid")} label="Grid">
                  <LayoutGrid className="h-4 w-4" />
                </ViewToggle>
                <ViewToggle active={view === "list"} onClick={() => setViewPersist("list")} label="List">
                  <ListIcon className="h-4 w-4" />
                </ViewToggle>
              </div>
            </div>
          </div>

          {filtered.length === 0 ? (
            <SectionCard bodyClassName="p-0">
              <p className="py-10 text-center text-sm text-muted-foreground">No matches.</p>
            </SectionCard>
          ) : view === "grid" ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((p) => (
                <ParticipantCard key={p.id} p={p} detailBase={detailBase} />
              ))}
            </div>
          ) : (
            <SectionCard bodyClassName="p-0">
              <ul className="divide-y divide-border">
                {filtered.map((p) => (
                  <ParticipantRowItem key={p.id} p={p} detailBase={detailBase} />
                ))}
              </ul>
            </SectionCard>
          )}
        </div>
      )}
    </motion.div>
  );
}

function ViewToggle({
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

// ── Level 1: batch cards ─────────────────────────────────────────────────────
function BatchPicker({ groups, onPick }: { groups: BatchGroup[]; onPick: (key: string) => void }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {groups.map((g) => {
        const atRisk = g.rows.filter((r) => r.atRisk).length;
        const pending = g.rows.reduce((n, r) => n + r.pending, 0);
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
              <div className="flex gap-1.5">
                {pending > 0 && (
                  <span className="rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-semibold text-[oklch(0.45_0.1_85)]">
                    {pending} pending
                  </span>
                )}
                {atRisk > 0 && (
                  <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-semibold text-destructive">
                    {atRisk} at risk
                  </span>
                )}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ── Level 2a: participant grid card ──────────────────────────────────────────
function ParticipantCard({ p, detailBase }: { p: ParticipantRow; detailBase: string }) {
  const pct = Math.round((p.weeksDone / 16) * 100);
  return (
    <Link
      to={`${detailBase}/${p.id}` as string}
      className="group flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-gold/40 hover:shadow-vkm"
    >
      <div className="flex items-center gap-3">
        <AvatarBadge name={p.name} src={p.avatar_url} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{p.name}</p>
          <p className="truncate text-[11px] text-muted-foreground">{p.batchName ?? "Unassigned"}</p>
        </div>
        <Badge variant={p.atRisk ? "destructive" : "outline"} className="shrink-0 rounded-full">
          {p.atRisk ? "At risk" : "On track"}
        </Badge>
      </div>
      <div>
        <div className="mb-1 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>Week progress</span>
          <span className="tabular-nums">{p.weeksDone}/16</span>
        </div>
        <Progress value={pct} className="h-1.5" />
      </div>
      <div className="flex items-center justify-between text-[11px]">
        <span className="font-bold tabular-nums text-foreground">
          {p.points} <span className="font-normal text-muted-foreground">points</span>
        </span>
        {p.pending > 0 && (
          <span className="rounded-full bg-gold/15 px-2 py-0.5 font-semibold text-[oklch(0.45_0.1_85)]">
            {p.pending} pending
          </span>
        )}
      </div>
    </Link>
  );
}

// ── Level 2b: participant list row (same details) ────────────────────────────
function ParticipantRowItem({ p, detailBase }: { p: ParticipantRow; detailBase: string }) {
  const pct = Math.round((p.weeksDone / 16) * 100);
  return (
    <li>
      <Link
        to={`${detailBase}/${p.id}` as string}
        className="flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-secondary/50 sm:px-5"
      >
        <AvatarBadge name={p.name} src={p.avatar_url} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-medium text-foreground">{p.name}</p>
            {p.pending > 0 && (
              <span className="rounded-full bg-gold/15 px-1.5 py-0.5 text-[10px] font-semibold text-[oklch(0.45_0.1_85)]">
                {p.pending} pending
              </span>
            )}
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <Progress value={pct} className="h-1.5 max-w-[160px] flex-1" />
            <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
              {p.weeksDone}/16
            </span>
          </div>
        </div>
        <span className="hidden shrink-0 text-right sm:block">
          <span className="block text-sm font-bold tabular-nums text-foreground">{p.points}</span>
          <span className="text-[11px] text-muted-foreground">points</span>
        </span>
        <Badge variant={p.atRisk ? "destructive" : "outline"} className="shrink-0 rounded-full">
          {p.atRisk ? "At risk" : "On track"}
        </Badge>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
      </Link>
    </li>
  );
}
