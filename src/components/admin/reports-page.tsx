import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import {
  FileBarChart,
  Search,
  FileSpreadsheet,
  FileText,
  User,
  Layers3,
  UsersRound,
  GraduationCap,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/vkm/page-header";
import { SectionCard } from "@/components/vkm/section-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  usePeopleSearch,
  usePickerLists,
  useIndividualReport,
  useBatchReport,
  useCoachReport,
  useMentorReport,
  fmtDate,
  daysAgo,
  type RosterRow,
} from "@/components/admin/reports-data";
import { exportReportExcel, exportReportPdf, type ReportExportSpec } from "@/lib/vkm/report-export";

type Tab = "individual" | "batch" | "coach" | "mentor";

const RANGE_PRESETS = [
  { label: "7d", days: 6 },
  { label: "30d", days: 29 },
  { label: "90d", days: 89 },
];

export function ReportsPage() {
  const [tab, setTab] = useState<Tab>("individual");
  const [from, setFrom] = useState(daysAgo(29));
  const [to, setTo] = useState(fmtDate(new Date()));
  const [query, setQuery] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [personId, setPersonId] = useState("");
  const [personName, setPersonName] = useState("");
  const [batchId, setBatchId] = useState("");
  const [coachId, setCoachId] = useState("");
  const [mentorId, setMentorId] = useState("");
  const [exporting, setExporting] = useState<"excel" | "pdf" | null>(null);

  const { batches, coaches, mentors } = usePickerLists();
  const { people } = usePeopleSearch(query);

  const individual = useIndividualReport(personId, from, to);
  const batchR = useBatchReport(batchId, from, to);
  const coachR = useCoachReport(coachId, from, to);
  const mentorR = useMentorReport(mentorId, from, to);

  function drillInto(userId: string, name: string | null) {
    setPersonId(userId);
    setPersonName(name ?? "");
    setQuery(name ?? "");
    setTab("individual");
  }

  function setPreset(days: number) {
    setFrom(daysAgo(days));
    setTo(fmtDate(new Date()));
  }

  const currentSpec = useMemo<ReportExportSpec | null>(() => {
    const meta = [
      { label: "Range", value: `${from} → ${to}` },
      { label: "Generated", value: new Date().toLocaleString() },
    ];
    if (tab === "individual" && individual.data?.profile) {
      const d = individual.data;
      return {
        title: `Individual Report — ${d.profile!.full_name ?? "Participant"}`,
        subtitle: (d.profile!.roles ?? []).join(", "),
        meta: [...meta, { label: "Email", value: d.profile!.email ?? "—" }],
        kpis: [
          { label: "Points (range)", value: d.kpis.points_range },
          { label: "Weeks approved", value: d.kpis.weeks_approved },
          { label: "Weeks pending", value: d.kpis.weeks_pending },
          { label: "Avg habit completion", value: `${d.kpis.habit_completion_avg_pct}%` },
          { label: "Days active", value: d.kpis.days_active_range },
          { label: "Tickets raised", value: d.kpis.tickets_raised_range },
        ],
        tables: [
          {
            title: "Habit trend",
            columns: ["Date", "Habits done (of 6)", "Completion %"],
            rows: d.habit_trend.map((r) => [r.date, r.done, `${r.pct}%`]),
          },
          {
            title: "Proof history",
            columns: ["Week", "Status", "Points", "Reviewed"],
            rows: d.proof_history.map((r) => [r.week_no, r.proof_status, r.points, r.updated_at?.slice(0, 10) ?? "—"]),
          },
        ],
      };
    }
    if (tab === "batch" && batchR.data?.batch) {
      const d = batchR.data;
      return {
        title: `Batch Report — ${d.batch!.name}`,
        subtitle: `Status: ${d.batch!.status}`,
        meta,
        kpis: [
          { label: "Participants", value: d.kpis.participant_count },
          { label: "Avg completion", value: `${d.kpis.avg_completion_pct}%` },
          { label: "Points (range)", value: d.kpis.points_range },
        ],
        tables: [
          {
            title: "Roster",
            columns: ["Name", "Week", "Weeks approved", "Completion % (range)", "Points (range)", "At risk"],
            rows: d.roster.map((r) => [
              r.full_name ?? "—",
              r.current_week,
              r.weeks_approved,
              `${r.completion_pct_range}%`,
              r.points_range,
              r.at_risk ? "Yes" : "No",
            ]),
          },
        ],
      };
    }
    if (tab === "coach" && coachR.data?.coach) {
      const d = coachR.data;
      return {
        title: `Coach Report — ${d.coach!.full_name ?? "Coach"}`,
        subtitle: "Coach → participants performance",
        meta,
        kpis: [
          { label: "Participants", value: d.kpis.participant_count },
          { label: "Avg completion", value: `${d.kpis.avg_completion_pct}%` },
          { label: "Points awarded (range)", value: d.kpis.points_awarded_range },
        ],
        tables: [
          {
            title: "Participants",
            columns: ["Name", "Week", "Weeks approved", "Completion % (range)", "Points (range)", "At risk"],
            rows: d.roster.map((r) => [
              r.full_name ?? "—",
              r.current_week,
              r.weeks_approved,
              `${r.completion_pct_range}%`,
              r.points_range,
              r.at_risk ? "Yes" : "No",
            ]),
          },
        ],
      };
    }
    if (tab === "mentor" && mentorR.data?.mentor) {
      const d = mentorR.data;
      return {
        title: `Mentor Report — ${d.mentor!.full_name ?? "Mentor"}`,
        subtitle: "Oversight activity",
        meta,
        kpis: [
          { label: "Proofs reviewed", value: d.kpis.proofs_reviewed_range },
          { label: "Tickets resolved", value: d.kpis.tickets_resolved_range },
        ],
        tables: [
          {
            title: "Recent reviews",
            columns: ["Type", "Detail", "When"],
            rows: d.recent_reviews.map((r) => [r.kind, r.label, r.ts?.slice(0, 16).replace("T", " ")]),
          },
        ],
      };
    }
    return null;
  }, [tab, individual.data, batchR.data, coachR.data, mentorR.data, from, to]);

  async function onExport(kind: "excel" | "pdf") {
    if (!currentSpec) {
      toast.error("Pick a report to export first.");
      return;
    }
    setExporting(kind);
    try {
      const filename = currentSpec.title.replace(/[^\w.-]+/g, "_");
      if (kind === "excel") await exportReportExcel(currentSpec, filename);
      else await exportReportPdf(currentSpec, filename);
      toast.success(`Exported ${kind === "excel" ? "Excel" : "PDF"}`);
    } catch (e) {
      toast.error("Export failed", { description: (e as Error).message });
    } finally {
      setExporting(null);
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
        eyebrow="Admin · VK"
        title="Reports"
        description="One-on-one, batch-wise, and coach/mentor behaviour reports — drill down and export to Excel or PDF."
        icon={FileBarChart}
        actions={
          <>
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() => onExport("excel")}
              disabled={!currentSpec || exporting !== null}
            >
              {exporting === "excel" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
              Excel
            </Button>
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() => onExport("pdf")}
              disabled={!currentSpec || exporting !== null}
            >
              {exporting === "pdf" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              PDF
            </Button>
          </>
        }
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList>
          <TabsTrigger value="individual"><User className="h-3.5 w-3.5" /> Individual</TabsTrigger>
          <TabsTrigger value="batch"><Layers3 className="h-3.5 w-3.5" /> Batch</TabsTrigger>
          <TabsTrigger value="coach"><UsersRound className="h-3.5 w-3.5" /> Coach</TabsTrigger>
          <TabsTrigger value="mentor"><GraduationCap className="h-3.5 w-3.5" /> Mentor</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Filter bar */}
      <SectionCard>
        <div className="flex flex-wrap items-end gap-3">
          {tab === "individual" && (
            <div className="relative min-w-[240px] flex-1 space-y-1.5">
              <Label>Person</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setShowResults(true);
                  }}
                  onFocus={() => setShowResults(true)}
                  onBlur={() => setTimeout(() => setShowResults(false), 150)}
                  placeholder="Search by name…"
                  className="h-10 rounded-xl pl-9"
                />
              </div>
              {showResults && people.length > 0 && (
                <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-border bg-card shadow-vkm-float">
                  {people.map((p) => (
                    <button
                      key={p.user_id}
                      type="button"
                      onMouseDown={() => {
                        setPersonId(p.user_id);
                        setPersonName(p.full_name ?? "");
                        setQuery(p.full_name ?? "");
                        setShowResults(false);
                      }}
                      className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-secondary/60"
                    >
                      <img
                        src={p.avatar_url || "/icon-512.png"}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="h-6 w-6 shrink-0 rounded-full border border-border object-cover"
                      />
                      <span className="min-w-0 flex-1 truncate text-foreground">{p.full_name ?? "—"}</span>
                      <span className="shrink-0 text-[11px] text-muted-foreground">{p.roles.join(", ")}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === "batch" && (
            <div className="min-w-[220px] flex-1 space-y-1.5">
              <Label>Batch</Label>
              <Select value={batchId} onValueChange={setBatchId}>
                <SelectTrigger className="h-10 rounded-xl">
                  <SelectValue placeholder="Choose a batch" />
                </SelectTrigger>
                <SelectContent>
                  {batches.map((b) => (
                    <SelectItem key={b.batch_id} value={b.batch_id}>
                      {b.name} · {b.status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {tab === "coach" && (
            <div className="min-w-[220px] flex-1 space-y-1.5">
              <Label>Coach</Label>
              <Select value={coachId} onValueChange={setCoachId}>
                <SelectTrigger className="h-10 rounded-xl">
                  <SelectValue placeholder="Choose a coach" />
                </SelectTrigger>
                <SelectContent>
                  {coaches.map((c) => (
                    <SelectItem key={c.coach_id} value={c.coach_id}>
                      {c.full_name ?? "—"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {tab === "mentor" && (
            <div className="min-w-[220px] flex-1 space-y-1.5">
              <Label>Mentor</Label>
              <Select value={mentorId} onValueChange={setMentorId}>
                <SelectTrigger className="h-10 rounded-xl">
                  <SelectValue placeholder="Choose a mentor" />
                </SelectTrigger>
                <SelectContent>
                  {mentors.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-muted-foreground">No mentors yet</div>
                  ) : (
                    mentors.map((m) => (
                      <SelectItem key={m.mentor_id} value={m.mentor_id}>
                        {m.full_name ?? "—"}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex items-end gap-2">
            <div className="space-y-1.5">
              <Label>From</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-10 rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label>To</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-10 rounded-xl" />
            </div>
            <div className="flex gap-1.5 pb-0.5">
              {RANGE_PRESETS.map((p) => (
                <Button key={p.label} type="button" variant="outline" size="sm" className="rounded-lg" onClick={() => setPreset(p.days)}>
                  {p.label}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </SectionCard>

      {/* Report bodies */}
      {tab === "individual" && (
        <IndividualBody loading={individual.loading} data={individual.data} personName={personName} />
      )}
      {tab === "batch" && <BatchBody loading={batchR.loading} data={batchR.data} onDrill={drillInto} />}
      {tab === "coach" && <CoachBody loading={coachR.loading} data={coachR.data} onDrill={drillInto} />}
      {tab === "mentor" && <MentorBody loading={mentorR.loading} data={mentorR.data} />}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------

function Kpi({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border bg-secondary/30 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-bold tabular-nums text-foreground">{value}</p>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <SectionCard>
      <p className="py-10 text-center text-sm text-muted-foreground">{text}</p>
    </SectionCard>
  );
}

function IndividualBody({
  loading,
  data,
  personName,
}: {
  loading: boolean;
  data: ReturnType<typeof useIndividualReport>["data"];
  personName: string;
}) {
  if (!personName) return <EmptyState text="Search for a participant, coach, or mentor above to generate their report." />;
  if (loading && !data) return <EmptyState text="Loading report…" />;
  if (!data?.profile) return <EmptyState text="No data found for this person." />;

  const chart = data.habit_trend.map((d) => ({ label: d.date.slice(5), pct: d.pct }));

  return (
    <div className="space-y-4">
      <SectionCard title={data.profile.full_name ?? "Participant"} subtitle={data.profile.roles.join(", ")}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
          <Kpi label="Points (range)" value={data.kpis.points_range} />
          <Kpi label="Weeks approved" value={data.kpis.weeks_approved} />
          <Kpi label="Weeks pending" value={data.kpis.weeks_pending} />
          <Kpi label="Avg completion" value={`${data.kpis.habit_completion_avg_pct}%`} />
          <Kpi label="Days active" value={data.kpis.days_active_range} />
          <Kpi label="Tickets raised" value={data.kpis.tickets_raised_range} />
        </div>
      </SectionCard>

      <SectionCard title="Habit completion trend">
        <div className="h-[220px] w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chart} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
              <defs>
                <linearGradient id="ind-area" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0B2545" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#0B2545" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="0" vertical={false} stroke="oklch(0.9 0.01 90)" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} />
              <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tickLine={false} axisLine={false} width={32} tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v: number) => [`${v}%`, "Completion"]} contentStyle={{ borderRadius: 12, fontSize: 12 }} />
              <Area type="monotone" dataKey="pct" stroke="#0B2545" strokeWidth={2} fill="url(#ind-area)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </SectionCard>

      <SectionCard title="Proof history" subtitle={`${data.proof_history.length} in range`}>
        {data.proof_history.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">No proof submissions in this range.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">Week</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2 pr-3 font-medium">Points</th>
                  <th className="py-2 font-medium">Reviewed</th>
                </tr>
              </thead>
              <tbody>
                {data.proof_history.map((p, i) => (
                  <tr key={i} className="border-b border-border/60 last:border-0">
                    <td className="py-2.5 pr-3 text-foreground">Week {p.week_no}</td>
                    <td className="py-2.5 pr-3 capitalize text-foreground">{p.proof_status}</td>
                    <td className="py-2.5 pr-3 tabular-nums text-foreground">{p.points}</td>
                    <td className="py-2.5 text-muted-foreground">{p.updated_at?.slice(0, 10) ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}

function RosterTable({ rows, onDrill }: { rows: RosterRow[]; onDrill: (id: string, name: string | null) => void }) {
  if (rows.length === 0) return <p className="py-6 text-center text-sm text-muted-foreground">No participants.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-sm">
        <thead>
          <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
            <th className="py-2 pr-3 font-medium">Participant</th>
            <th className="py-2 pr-3 font-medium">Week</th>
            <th className="py-2 pr-3 font-medium">Weeks approved</th>
            <th className="py-2 pr-3 font-medium">Completion (range)</th>
            <th className="py-2 pr-3 font-medium">Points (range)</th>
            <th className="py-2 font-medium">At risk</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.user_id}
              className="cursor-pointer border-b border-border/60 last:border-0 hover:bg-secondary/40"
              onClick={() => onDrill(r.user_id, r.full_name)}
              title="View individual report"
            >
              <td className="py-2.5 pr-3 font-medium text-foreground">{r.full_name ?? "—"}</td>
              <td className="py-2.5 pr-3 tabular-nums text-foreground">{r.current_week}</td>
              <td className="py-2.5 pr-3 tabular-nums text-foreground">{r.weeks_approved}</td>
              <td className="py-2.5 pr-3 tabular-nums text-foreground">{r.completion_pct_range}%</td>
              <td className="py-2.5 pr-3 tabular-nums text-foreground">{r.points_range}</td>
              <td className="py-2.5">
                {r.at_risk ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-600">
                    <AlertTriangle className="h-3 w-3" /> At risk
                  </span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BatchBody({
  loading,
  data,
  onDrill,
}: {
  loading: boolean;
  data: ReturnType<typeof useBatchReport>["data"];
  onDrill: (id: string, name: string | null) => void;
}) {
  if (!data?.batch && !loading) return <EmptyState text="Choose a batch above to generate its report." />;
  if (loading && !data) return <EmptyState text="Loading report…" />;
  if (!data?.batch) return <EmptyState text="No data for this batch." />;

  const chart = data.habit_trend.map((d) => ({ label: d.date.slice(5), pct: d.avg_completion_pct }));

  return (
    <div className="space-y-4">
      <SectionCard title={data.batch.name} subtitle={`Status: ${data.batch.status}`}>
        <div className="grid grid-cols-3 gap-3">
          <Kpi label="Participants" value={data.kpis.participant_count} />
          <Kpi label="Avg completion" value={`${data.kpis.avg_completion_pct}%`} />
          <Kpi label="Points (range)" value={data.kpis.points_range} />
        </div>
      </SectionCard>
      <SectionCard title="Batch habit completion trend">
        <div className="h-[220px] w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chart} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
              <defs>
                <linearGradient id="batch-area" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#C9A227" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#C9A227" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="0" vertical={false} stroke="oklch(0.9 0.01 90)" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} />
              <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tickLine={false} axisLine={false} width={32} tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v: number) => [`${v}%`, "Avg completion"]} contentStyle={{ borderRadius: 12, fontSize: 12 }} />
              <Area type="monotone" dataKey="pct" stroke="#C9A227" strokeWidth={2} fill="url(#batch-area)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </SectionCard>
      <SectionCard title="Roster" subtitle="Click a participant to open their individual report">
        <RosterTable rows={data.roster} onDrill={onDrill} />
      </SectionCard>
    </div>
  );
}

function CoachBody({
  loading,
  data,
  onDrill,
}: {
  loading: boolean;
  data: ReturnType<typeof useCoachReport>["data"];
  onDrill: (id: string, name: string | null) => void;
}) {
  if (!data?.coach && !loading) return <EmptyState text="Choose a coach above to generate their report." />;
  if (loading && !data) return <EmptyState text="Loading report…" />;
  if (!data?.coach) return <EmptyState text="No data for this coach." />;

  const chart = data.habit_trend.map((d) => ({ label: d.date.slice(5), pct: d.avg_completion_pct }));

  return (
    <div className="space-y-4">
      <SectionCard title={data.coach.full_name ?? "Coach"} subtitle="Coach → participants">
        <div className="grid grid-cols-3 gap-3">
          <Kpi label="Participants" value={data.kpis.participant_count} />
          <Kpi label="Avg completion" value={`${data.kpis.avg_completion_pct}%`} />
          <Kpi label="Points awarded (range)" value={data.kpis.points_awarded_range} />
        </div>
      </SectionCard>
      <SectionCard title="Cohort habit completion trend">
        <div className="h-[220px] w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chart} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
              <defs>
                <linearGradient id="coach-area" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0ea5e9" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="0" vertical={false} stroke="oklch(0.9 0.01 90)" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} />
              <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tickLine={false} axisLine={false} width={32} tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v: number) => [`${v}%`, "Avg completion"]} contentStyle={{ borderRadius: 12, fontSize: 12 }} />
              <Area type="monotone" dataKey="pct" stroke="#0ea5e9" strokeWidth={2} fill="url(#coach-area)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </SectionCard>
      <SectionCard title="Participants" subtitle="Click a participant to open their individual report">
        <RosterTable rows={data.roster} onDrill={onDrill} />
      </SectionCard>
    </div>
  );
}

function MentorBody({ loading, data }: { loading: boolean; data: ReturnType<typeof useMentorReport>["data"] }) {
  if (!data?.mentor && !loading) return <EmptyState text="Choose a mentor above to generate their report." />;
  if (loading && !data) return <EmptyState text="Loading report…" />;
  if (!data?.mentor) return <EmptyState text="No data for this mentor." />;

  const chart = data.review_trend.map((d) => ({ label: d.date.slice(5), reviews: d.reviews }));

  return (
    <div className="space-y-4">
      <SectionCard title={data.mentor.full_name ?? "Mentor"} subtitle="Oversight activity">
        <div className="grid grid-cols-2 gap-3">
          <Kpi label="Proofs reviewed" value={data.kpis.proofs_reviewed_range} />
          <Kpi label="Tickets resolved" value={data.kpis.tickets_resolved_range} />
        </div>
      </SectionCard>
      <SectionCard title="Review activity trend">
        <div className="h-[220px] w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chart} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
              <defs>
                <linearGradient id="mentor-area" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0B2545" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#0B2545" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="0" vertical={false} stroke="oklch(0.9 0.01 90)" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} />
              <YAxis tickLine={false} axisLine={false} width={28} tick={{ fontSize: 10 }} allowDecimals={false} />
              <Tooltip formatter={(v: number) => [v, "Reviews"]} contentStyle={{ borderRadius: 12, fontSize: 12 }} />
              <Area type="monotone" dataKey="reviews" stroke="#0B2545" strokeWidth={2} fill="url(#mentor-area)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </SectionCard>
      <SectionCard title="Recent reviews">
        {data.recent_reviews.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">No reviews in this range.</p>
        ) : (
          <div className="space-y-2">
            {data.recent_reviews.map((r, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 px-3 py-2 text-sm">
                <span className="text-foreground">{r.label}</span>
                <span className="text-xs text-muted-foreground">{r.ts?.slice(0, 16).replace("T", " ")}</span>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
