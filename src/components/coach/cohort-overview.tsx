import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "@tanstack/react-router";
import {
  Users,
  AlertTriangle,
  ArrowUpDown,
  Loader2,
  Activity,
  CheckCircle2,
  ArrowRight,
  Search,
  ShieldAlert,
} from "lucide-react";
import { useCohort, type CohortRow } from "@/components/coach/cohort-data";
import { PageHeader } from "@/components/vkm/page-header";
import { SectionCard } from "@/components/vkm/section-card";
import { AvatarBadge } from "@/components/vkm/avatar-badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { inrShort } from "@/components/participant/vision-data";

type SortKey =
  | "name"
  | "batch"
  | "week"
  | "points"
  | "weeks"
  | "lastProof"
  | "today"
  | "mrr"
  | "risk";

const COLUMNS: { key: SortKey; label: string; align?: "right" }[] = [
  { key: "name", label: "Participant" },
  { key: "batch", label: "Batch" },
  { key: "week", label: "Week" },
  { key: "points", label: "Points", align: "right" },
  { key: "weeks", label: "Approved", align: "right" },
  { key: "lastProof", label: "Last proof" },
  { key: "today", label: "Today" },
  { key: "mrr", label: "MRR", align: "right" },
  { key: "risk", label: "Status" },
];

function sortValue(r: CohortRow, key: SortKey): number | string {
  switch (key) {
    case "name":
      return r.name.toLowerCase();
    case "batch":
      return (r.batch_name ?? "").toLowerCase();
    case "week":
      return r.currentWeek;
    case "points":
      return Number(r.points);
    case "weeks":
      return Number(r.weeks_approved);
    case "lastProof":
      return r.lastProofDays == null ? Infinity : r.lastProofDays;
    case "today":
      return Number(r.focus_minutes_today) + Number(r.actions_done);
    case "mrr":
      return r.mrr_inr ?? -1;
    case "risk":
      return r.atRisk ? 1 : 0;
  }
}

export function CohortOverview({ portal = "coach" }: { portal?: "coach" | "mentor" }) {
  const { rows, loading, error } = useCohort();
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "risk", dir: -1 });
  // Global filter bar — show everything by default, then scope down.
  const [batch, setBatch] = useState<string>("all");
  const [atRiskOnly, setAtRiskOnly] = useState(false);
  const [q, setQ] = useState("");

  const batches = useMemo(() => {
    const m = new Map<string, string>();
    rows.forEach((r) => {
      if (r.batch_id) m.set(r.batch_id, r.batch_name ?? "Batch");
    });
    return [...m.entries()].map(([id, name]) => ({ id, name }));
  }, [rows]);

  const filtered = useMemo(
    () =>
      rows.filter(
        (r) =>
          (batch === "all" || r.batch_id === batch) &&
          (!atRiskOnly || r.atRisk) &&
          (!q.trim() ||
            `${r.name} ${r.business_name ?? ""}`.toLowerCase().includes(q.toLowerCase())),
      ),
    [rows, batch, atRiskOnly, q],
  );

  const sorted = useMemo(() => {
    const list = [...filtered];
    list.sort((a, b) => {
      const va = sortValue(a, sort.key);
      const vb = sortValue(b, sort.key);
      if (va < vb) return -1 * sort.dir;
      if (va > vb) return 1 * sort.dir;
      return 0;
    });
    return list;
  }, [filtered, sort]);

  // Aggregate KPI strip — reflects the filtered scope, across all batches by default.
  const agg = useMemo(() => {
    const n = filtered.length;
    return {
      n,
      atRisk: filtered.filter((r) => r.atRisk).length,
      pending: filtered.reduce((s, r) => s + Number(r.pending_proofs), 0),
      points: filtered.reduce((s, r) => s + Number(r.points), 0),
      activeToday: filtered.filter(
        (r) => Number(r.focus_minutes_today) > 0 || Number(r.actions_done) > 0,
      ).length,
      completion: n
        ? Math.round(
            filtered.reduce(
              (s, r) => s + (Number(r.weeks_approved) / (r.total_weeks || 16)) * 100,
              0,
            ) / n,
          )
        : 0,
    };
  }, [filtered]);

  function toggleSort(key: SortKey) {
    setSort((s) => (s.key === key ? { key, dir: (s.dir * -1) as 1 | -1 } : { key, dir: -1 }));
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-5"
    >
      <PageHeader
        eyebrow="Coach"
        title="Cohort Command Center"
        description="Every participant you coach — across all batches and every metric — in one place. Filter down by batch, risk or search; the totals react to your scope."
        icon={Users}
      />

      {/* Global filter bar */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-2.5 shadow-vkm">
        <Select value={batch} onValueChange={setBatch}>
          <SelectTrigger className="h-9 w-[180px] rounded-lg">
            <SelectValue placeholder="All batches" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All batches</SelectItem>
            {batches.map((b) => (
              <SelectItem key={b.id} value={b.id}>
                {b.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <button
          type="button"
          onClick={() => setAtRiskOnly((v) => !v)}
          className={cn(
            "inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition-colors",
            atRiskOnly
              ? "border-transparent bg-destructive/10 text-destructive"
              : "border-border bg-card text-muted-foreground hover:text-foreground",
          )}
        >
          <ShieldAlert className="h-4 w-4" /> At-risk only
        </button>

        <div className="relative ml-auto min-w-[160px] flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name or business…"
            className="h-9 rounded-lg pl-9"
          />
        </div>
      </div>

      {/* Aggregate KPI strip — reacts to the filter above */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Participants" value={String(agg.n)} />
        <Stat label="At risk" value={String(agg.atRisk)} tone={agg.atRisk ? "danger" : "ok"} />
        <Stat label="Proofs pending" value={String(agg.pending)} />
        <Stat label="Avg completion" value={`${agg.completion}%`} />
        <Stat label="Total points" value={agg.points.toLocaleString("en-IN")} />
        <Stat label="Active today" value={`${agg.activeToday}/${agg.n || 0}`} />
      </div>

      <SectionCard
        title="Participants"
        subtitle={
          batch === "all"
            ? `${filtered.length} of ${rows.length} shown`
            : `${filtered.length} in ${batches.find((b) => b.id === batch)?.name ?? "batch"}`
        }
        bodyClassName="p-0"
      >
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-2 px-5 py-12 text-center">
            <AlertTriangle className="h-6 w-6 text-destructive" />
            <p className="text-sm font-medium text-foreground">Couldn’t load your cohort</p>
            <p className="max-w-sm text-xs text-muted-foreground">{error}</p>
          </div>
        ) : rows.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-muted-foreground">
            No participants assigned to your batches yet.
          </p>
        ) : sorted.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-muted-foreground">
            No participants match these filters.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[940px] text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  {COLUMNS.map((c) => (
                    <th
                      key={c.key}
                      className={cn("px-4 py-2.5", c.align === "right" && "text-right")}
                    >
                      <button
                        type="button"
                        onClick={() => toggleSort(c.key)}
                        className={cn(
                          "inline-flex min-h-9 items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground",
                          c.align === "right" && "flex-row-reverse",
                        )}
                      >
                        {c.label}
                        <ArrowUpDown
                          className={cn("h-3 w-3", sort.key === c.key ? "text-gold" : "opacity-40")}
                        />
                      </button>
                    </th>
                  ))}
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {sorted.map((r) => (
                  <tr
                    key={r.user_id}
                    className={cn(
                      "border-b border-border/60 transition-colors hover:bg-secondary/40",
                      r.atRisk && "bg-destructive/[0.04]",
                    )}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <AvatarBadge name={r.name} src={r.avatar_url} size="sm" />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-foreground">{r.name}</p>
                          <p className="truncate text-[11px] text-muted-foreground">
                            {r.business_name ?? "—"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex max-w-[120px] truncate rounded-full bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground">
                        {r.batch_name ?? "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      {r.started ? (
                        `${r.currentWeek}/${r.total_weeks}`
                      ) : (
                        <span className="text-muted-foreground">Not started</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums">{r.points}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {r.weeks_approved}
                      {r.behind >= 2 && (
                        <span className="ml-1 text-[11px] font-medium text-destructive">
                          −{r.behind}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 text-xs",
                          r.lastProofDays == null
                            ? "text-muted-foreground"
                            : r.lastProofDays > 7
                              ? "text-destructive"
                              : "text-foreground",
                        )}
                      >
                        {r.lastProofDays == null
                          ? "—"
                          : r.lastProofDays === 0
                            ? "Today"
                            : `${r.lastProofDays}d ago`}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {Number(r.focus_minutes_today) > 0 || Number(r.actions_total) > 0 ? (
                        <span className="inline-flex items-center gap-1.5 text-xs text-foreground">
                          <Activity className="h-3 w-3 text-[oklch(0.45_0.13_160)]" />
                          {Number(r.focus_minutes_today)}m · {Number(r.actions_done)}/
                          {Number(r.actions_total)}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {r.mrr_inr != null ? inrShort(r.mrr_inr) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {r.atRisk ? (
                        <span
                          title={r.reasons.join(" · ")}
                          className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive"
                        >
                          <AlertTriangle className="h-3 w-3" /> At risk
                        </span>
                      ) : r.habit_active_3d ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[oklch(0.93_0.06_160)] px-2 py-0.5 text-[11px] font-medium text-[oklch(0.35_0.12_160)]">
                          <CheckCircle2 className="h-3 w-3" /> On track
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                          <Activity className="h-3 w-3" /> Idle
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        to={
                          portal === "mentor"
                            ? "/mentor/participant/$userId"
                            : "/coach/participant/$userId"
                        }
                        params={{ userId: r.user_id }}
                        className="app-press inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
                      >
                        Open <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <p className="px-1 text-[11px] text-muted-foreground">
        At-risk = 2+ weeks behind on approvals, no habit activity in 3 days, or no proof submitted
        in the last week. You only see participants in your assigned batches.
      </p>
    </motion.div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "danger" | "ok" }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-vkm">
      <p
        className={cn(
          "text-2xl font-bold tabular-nums",
          tone === "danger" && "text-destructive",
          tone === "ok" && "text-[oklch(0.45_0.13_160)]",
        )}
      >
        {value}
      </p>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  );
}
