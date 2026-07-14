import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { format, formatDistanceToNowStrict } from "date-fns";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Download,
  Phone,
  CalendarDays,
  Briefcase,
  Trophy,
  Flame,
  Footprints,
  Droplets,
  Dumbbell,
  CheckCircle2,
  Loader2,
  Star,
  Check,
  X,
  ExternalLink,
  Plus,
  Trash2,
  NotebookPen,
  Bell,
  Send,
  Users,
  LogIn,
  ShieldAlert,
  Copy,
  LayoutDashboard,
  Activity,
  Compass,
  FolderOpen,
  Video,
  FileSpreadsheet,
  FileText,
  type LucideIcon,
} from "lucide-react";
import { SectionCard } from "@/components/vkm/section-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/use-auth";
import { addCoachTask, notifyParticipant } from "@/components/coach/coach-tasks-data";
import { cn } from "@/lib/utils";
import { safeHref } from "@/lib/safe-url";
import {
  VKM_WEEKS,
  VKM_MILESTONES,
  isOfflineWeek,
  stageFor,
  type ProgramWeek,
} from "@/lib/vkm/program";
import { useParticipantProfile, useParticipantTeam, type WeekRow } from "@/components/coach/coach-data";
import { staffLoginAsParticipant } from "@/lib/vkm/admin-users.functions";
import { useParticipantHabits, HABITS, TRACKER_HABITS, dateForDay } from "@/components/habits/habit-tracker";
import { HabitGrid } from "@/components/habits/habit-grid";
import { ProofAttachments } from "@/components/participant/proof-attachments";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ParticipantBusinessTab } from "@/components/coach/participant-business-tab";
import { ParticipantVisionTab } from "@/components/coach/participant-vision-tab";
import { ParticipantFilesTab } from "@/components/coach/participant-files-tab";
import { MemberSessionsManager } from "@/components/coach/member-sessions-manager";
import { exportReportPdf, exportReportExcel, type ReportExportSpec } from "@/lib/vkm/report-export";

const inr = (n: number | null | undefined) =>
  n == null ? "—" : `₹${Number(n).toLocaleString("en-IN")}`;

const STATUS: Record<string, string> = {
  approved: "bg-[oklch(0.93_0.06_160)] text-[oklch(0.35_0.12_160)]",
  pending: "bg-gold/15 text-[oklch(0.45_0.1_85)]",
  rejected: "bg-[oklch(0.93_0.06_25)] text-[oklch(0.45_0.16_25)]",
  none: "bg-muted text-muted-foreground",
};

// Builds the full export spec on demand (not kept eagerly in state) — the
// business-snapshot and vision-goal history live in their own lazily-mounted
// tabs, so a one-off fetch here keeps the export complete without forcing
// those tables to load just because the profile page opened.
async function buildExportSpec(args: {
  name: string;
  profile: { phone: string | null; created_at: string | null } | null;
  brain: { business_name: string | null } | null;
  weeks: WeekRow[];
  points: number;
  stage: string;
  weeksDone: number;
  attended: number;
  userId: string;
}): Promise<ReportExportSpec> {
  const { name, profile, brain, weeks, points, stage, weeksDone, attended, userId } = args;

  const [{ data: snaps }, { data: goals }] = await Promise.all([
    supabase
      .from("business_snapshots")
      .select("month, revenue_inr, mrr_inr, leads, deals, closing_rate_pct, status")
      .eq("user_id", userId)
      .order("month", { ascending: true }),
    supabase
      .from("vision_goals")
      .select("year, title, category, status")
      .eq("user_id", userId)
      .order("year")
      .order("sort_order"),
  ]);

  return {
    title: `Participant Profile — ${name}`,
    subtitle: brain?.business_name ? `${brain.business_name} · Batch 16` : "Batch 16",
    meta: [
      {
        label: "Joined",
        value: profile?.created_at ? format(new Date(profile.created_at), "d MMM yyyy") : "—",
      },
      { label: "Generated", value: new Date().toLocaleString() },
    ],
    kpis: [
      { label: "Weeks approved", value: `${weeksDone}/16` },
      { label: "Attendance", value: `${attended}/16` },
      { label: "Total points", value: points },
      { label: "Stage", value: stage },
    ],
    tables: [
      {
        title: "Weekly Progress",
        columns: ["Week", "Status", "Points", "Reviewed"],
        rows: [...weeks]
          .sort((a, b) => a.week_no - b.week_no)
          .map((w) => [
            w.week_no,
            w.proof_status,
            w.points,
            w.reviewed_at ? format(new Date(w.reviewed_at), "d MMM yyyy") : "—",
          ]),
      },
      {
        title: "Business Snapshots",
        columns: ["Month", "Revenue", "MRR", "Leads", "Deals", "Closing %", "Status"],
        rows: (snaps ?? []).map((s) => [
          format(new Date(`${s.month}T00:00:00`), "MMM yyyy"),
          inr(s.revenue_inr),
          inr(s.mrr_inr),
          s.leads ?? "—",
          s.deals ?? "—",
          s.closing_rate_pct != null ? `${s.closing_rate_pct}%` : "—",
          s.status,
        ]),
      },
      {
        title: "Vision Goals",
        columns: ["Year", "Goal", "Category", "Status"],
        rows: (goals ?? []).map((g) => [g.year, g.title, g.category, g.status]),
      },
    ],
  };
}

// Staff "log in as participant" — mints a one-time link (coach: assigned only;
// mentor / admin: any participant) and opens it in a new / private window.
function LoginAsParticipant({ participantId, name }: { participantId: string; name: string }) {
  const loginAs = useServerFn(staffLoginAsParticipant);
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  async function generate() {
    setBusy(true);
    setLink(null);
    try {
      const r = await loginAs({ data: { participantId } });
      setLink(r.actionLink);
      setOpen(true);
    } catch (e) {
      toast.error("Couldn't create login link", { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button variant="outline" className="rounded-full" onClick={generate} disabled={busy}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />} Login as
        participant
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LogIn className="h-4 w-4" /> Log in as {name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="flex items-start gap-1.5 rounded-xl border border-amber-400/40 bg-amber-50/50 p-3 text-xs text-muted-foreground dark:bg-amber-950/10">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              This one-time link signs you in <span className="font-medium">as {name}</span>. Open it
              in a private/incognito window so it doesn't replace your own session. The link expires
              shortly.
            </p>
            {link && (
              <div className="flex gap-2">
                <Input value={link} readOnly className="h-10 rounded-xl font-mono text-xs" />
                <Button
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => {
                    navigator.clipboard.writeText(link);
                    toast.success("Login link copied");
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <Button
                  className="rounded-xl bg-gradient-navy text-primary-foreground hover:opacity-90"
                  onClick={() => window.open(link, "_blank", "noopener")}
                >
                  <LogIn className="h-4 w-4" /> Open
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Daily habit proofs — coach/mentor picks any day; shows every completed habit,
// including tracker habits (water / steps) which auto-complete with no file.
function DailyHabitProofs({ habits }: { habits: ReturnType<typeof useParticipantHabits> }) {
  const maxDay = Math.max(1, habits.programDay || 1);
  const [day, setDay] = useState(maxDay);
  useEffect(() => {
    setDay((d) => Math.min(Math.max(1, d), maxDay));
  }, [maxDay]);

  const rows = HABITS.map((h) => ({
    habit: h,
    done: habits.isDone(day, h.id),
    files: habits.proofsFor(day, h.id),
  })).filter((r) => r.done || r.files.length > 0);

  const dateLabel = habits.startedAt
    ? format(dateForDay(day, habits.startedAt), "EEE, MMM d")
    : `Day ${day}`;

  return (
    <SectionCard
      title="Daily habit proofs"
      subtitle={`Day ${day} · ${dateLabel}`}
      action={
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setDay((d) => Math.max(1, d - 1))}
            disabled={day <= 1}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground disabled:opacity-40"
            aria-label="Previous day"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <select
            value={day}
            onChange={(e) => setDay(Number(e.target.value))}
            className="h-8 rounded-lg border border-border bg-card px-2 text-sm text-foreground"
            aria-label="Select day"
          >
            {Array.from({ length: maxDay }, (_, i) => maxDay - i).map((d) => (
              <option key={d} value={d}>
                Day {d}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setDay((d) => Math.min(maxDay, d + 1))}
            disabled={day >= maxDay}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground disabled:opacity-40"
            aria-label="Next day"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      }
    >
      {rows.length === 0 ? (
        <p className="py-3 text-sm text-muted-foreground">No habits completed on day {day}.</p>
      ) : (
        <div className="space-y-4">
          {rows.map(({ habit, done, files }) => {
            const Icon = habit.icon;
            return (
              <div key={habit.id}>
                <div className="mb-1.5 flex items-center gap-2">
                  <span
                    className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-white"
                    style={{ background: `linear-gradient(135deg, ${habit.from}, ${habit.to})` }}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="text-sm font-medium text-foreground">{habit.name}</span>
                  {done && <Check className="h-3.5 w-3.5 text-[#10b981]" />}
                </div>
                {files.length > 0 ? (
                  <ProofAttachments files={files} />
                ) : (
                  <p className="rounded-lg bg-secondary/40 px-3 py-2 text-xs text-muted-foreground">
                    {TRACKER_HABITS.has(habit.id)
                      ? "Auto-completed from the in-app tracker — no file attached."
                      : "Marked done — no file attached."}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </SectionCard>
  );
}

export function ParticipantDetail({
  userId,
  eyebrow,
  backTo,
}: {
  userId: string;
  eyebrow: string;
  backTo: string;
}) {
  const { profile, brain, weeks, points, milestones, loading, reviewWeek } =
    useParticipantProfile(userId);
  const habits = useParticipantHabits(userId);
  const [exporting, setExporting] = useState<"pdf" | "excel" | null>(null);

  const name = profile?.full_name ?? "Participant";
  const weeksDone = weeks.filter((w) => w.proof_status === "approved").length;
  const attended = weeks.filter((w) => w.attended).length;
  const stage = stageFor(points).name;
  const pct = Math.round((weeksDone / 16) * 100);
  const byWeek = new Map(weeks.map((w) => [w.week_no, w]));

  async function onExport(kind: "pdf" | "excel") {
    setExporting(kind);
    try {
      const spec = await buildExportSpec({ name, profile, brain, weeks, points, stage, weeksDone, attended, userId });
      const filename = `${name.replace(/[^\w.-]+/g, "_")}_profile`;
      if (kind === "pdf") await exportReportPdf(spec, filename);
      else await exportReportExcel(spec, filename);
      toast.success(`Exported ${kind === "pdf" ? "PDF" : "Excel"}`);
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
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" className="rounded-full" asChild>
          <Link to={backTo}>
            <ChevronLeft className="h-4 w-4" /> Participants
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          <LoginAsParticipant participantId={userId} name={name} />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="rounded-full bg-gradient-navy shadow-vkm" disabled={exporting !== null}>
                {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onExport("excel")}>
                <FileSpreadsheet className="h-4 w-4" /> Excel · XLSX
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onExport("pdf")}>
                <FileText className="h-4 w-4" /> PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="space-y-5">
        {/* Header / progress card */}
        <div className="overflow-hidden rounded-3xl bg-gradient-navy p-6 text-primary-foreground shadow-vkm-float">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary-foreground/70">
            {eyebrow} · Progress Card
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-4">
            <span className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-gold text-xl font-bold text-navy">
              {name
                .split(" ")
                .map((s) => s[0])
                .slice(0, 2)
                .join("")
                .toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-semibold leading-tight">{name}</h1>
              <p className="text-sm text-primary-foreground/70">
                {brain?.business_name ? `${brain.business_name} · ` : ""}Batch 16 · {stage}
              </p>
            </div>
            <div className="relative h-20 w-20 shrink-0">
              <svg viewBox="0 0 80 80" className="h-20 w-20 -rotate-90">
                <circle
                  cx="40"
                  cy="40"
                  r="34"
                  fill="none"
                  stroke="oklch(1 0 0 / 0.15)"
                  strokeWidth="7"
                />
                <motion.circle
                  cx="40"
                  cy="40"
                  r="34"
                  fill="none"
                  stroke="oklch(0.78 0.13 85)"
                  strokeWidth="7"
                  strokeLinecap="round"
                  initial={{ strokeDasharray: `0 ${2 * Math.PI * 34}` }}
                  animate={{
                    strokeDasharray: `${(pct / 100) * 2 * Math.PI * 34} ${2 * Math.PI * 34}`,
                  }}
                  transition={{ duration: 1, ease: "easeOut" }}
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-sm font-bold">
                {pct}%
              </span>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <HeroStat label="Weeks done" value={`${weeksDone}/16`} />
            <HeroStat label="Total points" value={String(points)} />
            <HeroStat label="Stage" value={stage} />
            <HeroStat label="Attendance" value={`${attended}/16`} />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading record…
          </div>
        ) : (
          <Tabs defaultValue="overview">
            <TabsList className="no-print flex h-auto flex-wrap gap-1 bg-transparent p-0">
              <TabsTrigger value="overview" className="gap-1.5 rounded-full border border-border bg-card px-3.5 py-1.5 data-[state=active]:border-transparent data-[state=active]:bg-gradient-navy data-[state=active]:text-primary-foreground data-[state=active]:shadow-vkm">
                <LayoutDashboard className="h-3.5 w-3.5" /> Overview
              </TabsTrigger>
              <TabsTrigger value="program" className="gap-1.5 rounded-full border border-border bg-card px-3.5 py-1.5 data-[state=active]:border-transparent data-[state=active]:bg-gradient-navy data-[state=active]:text-primary-foreground data-[state=active]:shadow-vkm">
                <Activity className="h-3.5 w-3.5" /> Program &amp; Habits
              </TabsTrigger>
              <TabsTrigger value="business" className="gap-1.5 rounded-full border border-border bg-card px-3.5 py-1.5 data-[state=active]:border-transparent data-[state=active]:bg-gradient-navy data-[state=active]:text-primary-foreground data-[state=active]:shadow-vkm">
                <Briefcase className="h-3.5 w-3.5" /> Business
              </TabsTrigger>
              <TabsTrigger value="vision" className="gap-1.5 rounded-full border border-border bg-card px-3.5 py-1.5 data-[state=active]:border-transparent data-[state=active]:bg-gradient-navy data-[state=active]:text-primary-foreground data-[state=active]:shadow-vkm">
                <Compass className="h-3.5 w-3.5" /> Vision Board
              </TabsTrigger>
              <TabsTrigger value="sessions" className="gap-1.5 rounded-full border border-border bg-card px-3.5 py-1.5 data-[state=active]:border-transparent data-[state=active]:bg-gradient-navy data-[state=active]:text-primary-foreground data-[state=active]:shadow-vkm">
                <Video className="h-3.5 w-3.5" /> Sessions
              </TabsTrigger>
              <TabsTrigger value="files" className="gap-1.5 rounded-full border border-border bg-card px-3.5 py-1.5 data-[state=active]:border-transparent data-[state=active]:bg-gradient-navy data-[state=active]:text-primary-foreground data-[state=active]:shadow-vkm">
                <FolderOpen className="h-3.5 w-3.5" /> Files
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-5">
              {/* Coach actions — set a reminder or notify this participant */}
              <CoachActions userId={userId} name={name} />

              {/* Personal */}
              <SectionCard title="Personal information">
                <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <Field icon={Phone} label="Phone" value={profile?.phone ?? "—"} />
                  <Field
                    icon={CalendarDays}
                    label="Joined"
                    value={
                      profile?.created_at ? format(new Date(profile.created_at), "d MMM yyyy") : "—"
                    }
                  />
                  <Field icon={Trophy} label="Current stage" value={stage} />
                </dl>
              </SectionCard>

              {/* Team roster — read-only view of the participant's own team */}
              <TeamCard userId={userId} reportedSize={brain?.team_size ?? null} />

              {/* Today's engagement (Focus) */}
              <ParticipantToday userId={userId} />

              {/* Coaching log (1:1 notes — staff only) */}
              <CoachingLog userId={userId} />

              {/* Milestones */}
              <SectionCard title="Milestones" subtitle="Goal Setter → Growth Champion">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {VKM_MILESTONES.map((m) => {
                    const unlocked = milestones.includes(m.code);
                    return (
                      <div
                        key={m.code}
                        className={cn(
                          "flex items-center gap-3 rounded-2xl border p-3",
                          unlocked ? "border-gold/40 bg-gold/[0.06]" : "border-border bg-card",
                        )}
                      >
                        <span
                          className={cn(
                            "inline-flex h-10 w-10 items-center justify-center rounded-xl",
                            unlocked
                              ? "bg-gradient-gold text-navy"
                              : "bg-muted text-muted-foreground",
                          )}
                        >
                          <Star className="h-5 w-5" />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">{m.name}</p>
                          <p className="text-xs text-muted-foreground">Week {m.unlockWeek}</p>
                        </div>
                        <Badge
                          variant={unlocked ? "default" : "outline"}
                          className="ml-auto rounded-full"
                        >
                          {unlocked ? "Unlocked" : "Locked"}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </SectionCard>
            </TabsContent>

            <TabsContent value="program" className="space-y-5">
              {/* 16-week program — expandable per-week proof review */}
              <SectionCard
                title="16-Week Program"
                subtitle={`${weeksDone} of 16 approved · tap a week to see the proof & decide`}
              >
                <div className="space-y-1.5">
                  {VKM_WEEKS.map((wk) => (
                    <WeekReviewRow
                      key={wk.week}
                      wk={wk}
                      row={byWeek.get(wk.week)}
                      onReview={reviewWeek}
                    />
                  ))}
                </div>
              </SectionCard>

              {/* Habits & activity */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5 sm:gap-4">
                <MiniStat
                  icon={CheckCircle2}
                  color="#10b981"
                  label="Habits today"
                  value={`${habits.todayDone}/${HABITS.length}`}
                />
                <MiniStat icon={Flame} color="#f59e0b" label="Streak" value={`${habits.streak}d`} />
                <MiniStat
                  icon={Footprints}
                  color="#10b981"
                  label="Steps"
                  value={String(habits.steps)}
                />
                <MiniStat
                  icon={Droplets}
                  color="#0ea5e9"
                  label="Water"
                  value={`${(habits.waterMl / 1000).toFixed(1)}L`}
                />
                <MiniStat
                  icon={Dumbbell}
                  color="#ef4444"
                  label="Workout"
                  value={`${habits.workoutMinutes}m`}
                />
              </div>
              {!habits.loading && (
                <HabitGrid
                  config={habits.config}
                  dayState={habits.dayState}
                  title="Habit tracker"
                  isDone={habits.isDone}
                  proofsFor={habits.proofsFor}
                />
              )}

              {/* Daily habit proofs — pick any day, includes tracker habits (water/steps) */}
              {!habits.loading && <DailyHabitProofs habits={habits} />}
            </TabsContent>

            <TabsContent value="business">
              <ParticipantBusinessTab userId={userId} brain={brain} brainLoading={loading} />
            </TabsContent>

            <TabsContent value="vision">
              <ParticipantVisionTab userId={userId} />
            </TabsContent>

            <TabsContent value="sessions" className="space-y-5">
              {/* Per-member 1-on-1 session videos, by week — staff add here, the
                  member sees them on their own "My Sessions" page. */}
              <MemberSessionsManager userId={userId} memberName={name} />
            </TabsContent>

            <TabsContent value="files">
              <ParticipantFilesTab userId={userId} weeks={weeks} habits={habits} />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </motion.div>
  );
}

// Coaching log — private 1:1 notes (staff-only RLS). Tracks the coaching itself.
type CoachingNote = {
  id: string;
  summary: string;
  next_step: string | null;
  occurred_at: string;
  coach_id: string;
};

function CoachingLog({ userId }: { userId: string }) {
  const { user } = useAuth();
  const [notes, setNotes] = useState<CoachingNote[]>([]);
  const [authors, setAuthors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState("");
  const [nextStep, setNextStep] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("coaching_notes")
      .select("id, summary, next_step, occurred_at, coach_id")
      .eq("participant_id", userId)
      .order("occurred_at", { ascending: false });
    const rows = (data ?? []) as CoachingNote[];
    setNotes(rows);
    const ids = [...new Set(rows.map((n) => n.coach_id))];
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", ids);
      const m: Record<string, string> = {};
      (profs ?? []).forEach((p) => (m[p.id] = p.full_name ?? "Coach"));
      setAuthors(m);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function add() {
    if (!summary.trim() || !user) return;
    setBusy(true);
    const { error } = await supabase.from("coaching_notes").insert({
      participant_id: userId,
      coach_id: user.id,
      summary: summary.trim(),
      next_step: nextStep.trim() || null,
    });
    setBusy(false);
    if (error) return toast.error("Could not save note", { description: error.message });
    setSummary("");
    setNextStep("");
    toast.success("1:1 logged");
    void load();
  }

  async function remove(id: string) {
    setNotes((n) => n.filter((x) => x.id !== id));
    await supabase.from("coaching_notes").delete().eq("id", id);
  }

  return (
    <SectionCard
      className="no-print"
      title={
        <span className="flex items-center gap-2">
          <NotebookPen className="h-4 w-4 text-navy" /> Coaching log
        </span>
      }
      subtitle="Private 1:1 notes — visible to staff only, never the participant"
    >
      <div className="space-y-2">
        <Textarea
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          placeholder="What did you cover in the 1:1? Wins, blockers, decisions…"
          className="min-h-[72px] rounded-lg"
        />
        <Input
          value={nextStep}
          onChange={(e) => setNextStep(e.target.value)}
          placeholder="Next step / commitment (optional)"
          className="rounded-lg"
        />
        <div className="flex justify-end">
          <Button
            onClick={add}
            disabled={busy || !summary.trim()}
            className="rounded-lg bg-gradient-navy text-primary-foreground hover:opacity-90"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Log
            1:1
          </Button>
        </div>
      </div>

      <div className="mt-4 space-y-2.5">
        {loading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : notes.length === 0 ? (
          <p className="py-2 text-center text-xs text-muted-foreground">
            No 1:1s logged yet — record your first session above.
          </p>
        ) : (
          notes.map((n) => (
            <div key={n.id} className="rounded-xl border border-border bg-card p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] text-muted-foreground">
                  {format(new Date(n.occurred_at), "d MMM yyyy")} ·{" "}
                  {n.coach_id === user?.id ? "You" : (authors[n.coach_id] ?? "Coach")}
                </p>
                {n.coach_id === user?.id && (
                  <button
                    type="button"
                    onClick={() => remove(n.id)}
                    className="app-press inline-flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:text-destructive"
                    aria-label="Delete note"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{n.summary}</p>
              {n.next_step && (
                <p className="mt-1.5 text-xs font-medium text-[oklch(0.45_0.1_85)]">
                  → {n.next_step}
                </p>
              )}
            </div>
          ))
        )}
      </div>
    </SectionCard>
  );
}

// Coach actions — a reminder for yourself (shows on your dashboard) or a
// notification to the participant. Interactive, so excluded from the printed report.
function CoachActions({ userId, name }: { userId: string; name: string }) {
  const { user } = useAuth();
  const first = name.split(" ")[0];
  const [task, setTask] = useState("");
  const [due, setDue] = useState("");
  const [savingTask, setSavingTask] = useState(false);
  const [notifyOpen, setNotifyOpen] = useState(false);

  async function addTask() {
    if (!task.trim() || !user) return;
    setSavingTask(true);
    try {
      await addCoachTask({
        coachId: user.id,
        participantId: userId,
        title: task.trim(),
        due_on: due || null,
      });
      setTask("");
      setDue("");
      toast.success("Reminder added", { description: "It’s on your dashboard." });
    } catch (e) {
      toast.error("Could not add", { description: (e as Error).message });
    } finally {
      setSavingTask(false);
    }
  }

  return (
    <SectionCard
      className="no-print"
      title="Coach actions"
      subtitle="Set yourself a reminder about this participant, or send them a notification."
    >
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Input
            value={task}
            onChange={(e) => setTask(e.target.value)}
            placeholder={`Reminder about ${first}…`}
            className="h-10 min-w-[180px] flex-1 rounded-lg"
          />
          <Input
            type="date"
            value={due}
            onChange={(e) => setDue(e.target.value)}
            className="h-10 w-[150px] rounded-lg"
            aria-label="Due date"
          />
          <Button
            onClick={addTask}
            disabled={savingTask || !task.trim()}
            className="h-10 rounded-lg bg-gradient-navy text-primary-foreground hover:opacity-90"
          >
            {savingTask ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}{" "}
            Add reminder
          </Button>
        </div>
        <Button variant="outline" className="rounded-lg" onClick={() => setNotifyOpen(true)}>
          <Bell className="h-4 w-4" /> Send {first} a notification
        </Button>
      </div>
      <NotifyDialog open={notifyOpen} onOpenChange={setNotifyOpen} userId={userId} name={name} />
    </SectionCard>
  );
}

function NotifyDialog({
  open,
  onOpenChange,
  userId,
  name,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  userId: string;
  name: string;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  async function send() {
    if (!title.trim()) return;
    setBusy(true);
    try {
      await notifyParticipant({
        userId,
        title: title.trim(),
        body: body.trim() || undefined,
        link: "/participant",
      });
      toast.success("Notification sent", { description: `${name} will see it in their bell.` });
      onOpenChange(false);
      setTitle("");
      setBody("");
    } catch (e) {
      toast.error("Couldn’t send", { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-gold" /> Notify {name}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title — e.g. Great week, keep going!"
            className="rounded-lg"
          />
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Message (optional)…"
            className="min-h-[80px] rounded-lg"
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={send}
            disabled={busy || !title.trim()}
            className="bg-gradient-navy text-primary-foreground hover:opacity-90"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}{" "}
            Send
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Today's Focus engagement — focus_sessions + daily_actions have staff-read RLS.
function ParticipantToday({ userId }: { userId: string }) {
  const [data, setData] = useState<{
    minutes: number;
    sessions: number;
    done: number;
    total: number;
  } | null>(null);

  useEffect(() => {
    let active = true;
    const today = new Date();
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(
      today.getDate(),
    ).padStart(2, "0")}`;
    void (async () => {
      const [{ data: fs }, { data: da }] = await Promise.all([
        supabase
          .from("focus_sessions")
          .select("minutes")
          .eq("user_id", userId)
          .gte("created_at", `${dateStr}T00:00:00`),
        supabase
          .from("daily_actions")
          .select("done")
          .eq("user_id", userId)
          .eq("action_date", dateStr),
      ]);
      if (!active) return;
      const sessions = fs ?? [];
      const actions = da ?? [];
      setData({
        minutes: sessions.reduce((n, r) => n + (r.minutes ?? 0), 0),
        sessions: sessions.length,
        done: actions.filter((a) => a.done).length,
        total: actions.length,
      });
    })();
    return () => {
      active = false;
    };
  }, [userId]);

  return (
    <SectionCard title="Today's engagement" subtitle="Deep work & daily actions, live from the app">
      <div className="grid grid-cols-3 gap-3">
        <MiniStat
          icon={Flame}
          color="#f59e0b"
          label="Deep work"
          value={data ? `${data.minutes}m` : "—"}
        />
        <MiniStat
          icon={Trophy}
          color="#3b6fb0"
          label="Sessions"
          value={data ? String(data.sessions) : "—"}
        />
        <MiniStat
          icon={CheckCircle2}
          color="#10b981"
          label="Actions"
          value={data ? `${data.done}/${data.total}` : "—"}
        />
      </div>
    </SectionCard>
  );
}

// Full vision board detail now lives in its own tab (ParticipantVisionTab,
// backed by useVisionFor) — the old inline mini-widget was removed in favor
// of that dedicated, more complete view.

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/5 p-3">
      <p className="text-[11px] uppercase tracking-wider text-primary-foreground/60">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}

function Field({
  icon: Icon,
  label,
  value,
  className,
}: {
  icon?: LucideIcon;
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {Icon && <Icon className="h-3.5 w-3.5" />} {label}
      </dt>
      <dd className="mt-0.5 text-sm text-foreground">{value}</dd>
    </div>
  );
}

function TeamCard({ userId, reportedSize }: { userId: string; reportedSize: number | null }) {
  const { members, loading } = useParticipantTeam(userId);
  const active = members.filter((m) => m.status === "active").length;
  const payroll = members.reduce((n, m) => n + (m.monthly_salary_inr ?? 0), 0);
  return (
    <SectionCard
      title="Team"
      subtitle={
        loading
          ? "Loading…"
          : `${members.length} member${members.length === 1 ? "" : "s"}` +
            ` · ${active} active` +
            (payroll ? ` · ${inr(payroll)}/mo payroll` : "") +
            (reportedSize != null && reportedSize !== members.length ? ` · reported size ${reportedSize}` : "")
      }
    >
      {loading ? (
        <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : members.length === 0 ? (
        <p className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
          <Users className="h-4 w-4" /> No team members added yet.
        </p>
      ) : (
        <div className="space-y-1.5">
          {members.map((m) => (
            <div key={m.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{m.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {[m.role, m.department].filter(Boolean).join(" · ") || "—"}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {m.monthly_salary_inr != null && (
                  <span className="text-xs tabular-nums text-muted-foreground">{inr(m.monthly_salary_inr)}/mo</span>
                )}
                <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium",
                  m.status === "active" ? "bg-[oklch(0.93_0.06_160)] text-[oklch(0.35_0.12_160)]" : "bg-muted text-muted-foreground")}>
                  {m.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

function MiniStat({
  icon: Icon,
  color,
  label,
  value,
}: {
  icon: LucideIcon;
  color: string;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3.5 shadow-vkm">
      <Icon className="h-5 w-5" style={{ color }} />
      <p className="mt-1.5 text-xl font-bold tabular-nums text-foreground">{value}</p>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Per-week expandable proof review (coach / mentor / admin act here).
// ---------------------------------------------------------------------------
function WeekReviewRow({
  wk,
  row,
  onReview,
}: {
  wk: ProgramWeek;
  row?: WeekRow;
  onReview: (id: string, status: "approved" | "rejected", note: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const status = row?.proof_status ?? "none";
  const submitted = !!row?.task_done;

  async function act(s: "approved" | "rejected") {
    if (!row) return;
    setBusy(true);
    await onReview(row.id, s, note || row.coach_note || "");
    setBusy(false);
    const pts = row.week_no >= 1 && row.week_no <= 14 ? "+250 pts · " : "";
    if (s === "approved")
      toast.success("Proof approved", { description: `${pts}participant notified.` });
    else toast("Changes requested", { description: "Participant notified." });
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-secondary/40"
      >
        <span className="w-6 shrink-0 text-sm font-bold tabular-nums text-foreground">
          {wk.week}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">{wk.topic}</p>
          <p className="text-[11px] text-muted-foreground">
            {wk.mode}
            {isOfflineWeek(wk.week) ? " 📍" : ""}
            {submitted
              ? ` · submitted ${formatDistanceToNowStrict(new Date(row!.created_at), { addSuffix: true })}`
              : ""}
          </p>
        </div>
        {submitted && status === "pending" && (
          <span className="hidden rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-semibold text-[oklch(0.45_0.1_85)] sm:inline">
            needs review
          </span>
        )}
        <span
          className={cn(
            "inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize",
            STATUS[status],
          )}
        >
          {status === "none" ? "not started" : status}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-border"
          >
            <div className="space-y-3 px-3 py-3">
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Task:</span> {wk.task} ·{" "}
                <span className="font-medium text-foreground">Proof:</span> {wk.proof}
              </p>

              {submitted ? (
                <>
                  {safeHref(row?.proof_url) && (
                    <a
                      href={safeHref(row?.proof_url)}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-[#3b6fb0] hover:underline"
                    >
                      <ExternalLink className="h-4 w-4" /> Open submitted proof link
                    </a>
                  )}
                  {row?.proof_files && row.proof_files.length > 0 && (
                    <ProofAttachments files={row.proof_files} />
                  )}
                  {row?.proof_note && (
                    <p className="rounded-xl bg-secondary/60 px-3 py-2 text-sm text-foreground">
                      “{row.proof_note}”
                    </p>
                  )}
                  {row?.coach_note && status !== "pending" && (
                    <p className="text-xs text-muted-foreground">Coach note: {row.coach_note}</p>
                  )}
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder={
                      row?.coach_note
                        ? `Previous: ${row.coach_note}`
                        : "Feedback / reason (sent to participant)…"
                    }
                    className="min-h-[52px] w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={() => act("rejected")}
                      className={cn(
                        "rounded-xl border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive",
                        status === "rejected" && "bg-destructive/10",
                      )}
                    >
                      <X className="h-4 w-4" /> Reject
                    </Button>
                    <Button
                      disabled={busy}
                      onClick={() => act("approved")}
                      className="rounded-xl bg-[#10b981] text-white hover:opacity-90"
                    >
                      {busy ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="h-4 w-4" />
                      )}
                      {status === "approved" ? "Approved (+40)" : "Approve (+40)"}
                    </Button>
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Awaiting the participant's proof for this week.
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
