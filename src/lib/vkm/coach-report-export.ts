import { format, parseISO } from "date-fns";
import type { ReportExportSpec } from "@/lib/vkm/report-export";
import {
  DIM_LABELS,
  type CoachReport,
  type ParticipantInteraction,
  type CoachDailyActivity,
  type CoachBatchRow,
  type ScoreDims,
} from "@/components/coach/coach-performance-data";

const fmtDate = (iso: string | null) => (iso ? format(parseISO(iso), "MMM d, yyyy") : "—");
const tat = (h: number | null) => (h == null ? "—" : h < 24 ? `${Math.round(h)}h` : `${(h / 24).toFixed(1)}d`);
const dimRows = (dims: ScoreDims): [string, number][] =>
  (Object.keys(DIM_LABELS) as (keyof ScoreDims)[]).map((k) => [DIM_LABELS[k], dims[k]]);

// Full report for ONE coach — the "judge this coach" packet.
export function buildCoachReportSpec(
  coach: CoachReport,
  participants: ParticipantInteraction[],
  daily: CoachDailyActivity[],
  batches: CoachBatchRow[],
): ReportExportSpec {
  const activeDaysInWindow = daily.filter((d) => d.total > 0).length;
  return {
    title: `Coach Report — ${coach.name}`,
    subtitle: `Overall score ${coach.score}/100 · ${coach.scoreLabel} · generated ${format(new Date(), "MMM d, yyyy")}`,
    meta: [
      { label: "Coach", value: coach.name },
      { label: "Participants", value: String(coach.participants) },
      { label: "Last login", value: fmtDate(coach.lastLoginAt) },
      { label: "Active days (30d)", value: String(coach.activeDays30) },
    ],
    kpis: [
      { label: "Overall score", value: `${coach.score}/100` },
      { label: "Approval rate", value: `${coach.approvalRate}%` },
      { label: "Avg turnaround", value: tat(coach.avgTurnaroundH) },
      { label: "Coverage (7d)", value: `${coach.coveragePct}%` },
      { label: "Avg progress", value: `${coach.avgProgressPct}%` },
      { label: "At-risk", value: String(coach.atRiskCount) },
    ],
    tables: [
      {
        title: "Score breakdown",
        columns: ["Dimension", "Score /100"],
        rows: dimRows(coach.dims),
      },
      {
        title: "Delivery & engagement",
        columns: ["Metric", "Value"],
        rows: [
          ["Reviews (total)", coach.reviews],
          ["Approved / Rejected", `${coach.approved} / ${coach.rejected}`],
          ["Caseload doing daily habits (3d)", `${coach.caseloadActive3dPct}%`],
          ["Reviews last 7d", coach.reviews7d],
          ["Reviews last 30d", coach.reviews30d],
          ["Coaching notes", coach.notesCount],
          ["Meetings", coach.meetingsCount],
          ["Chat messages", coach.chatMessages],
          ["Notifications sent", coach.notifsCount],
          ["Field visits", coach.visitsCount],
          ["Active days (30d)", coach.activeDays30],
          ["Login days (30d)", coach.loginDays30],
          ["Active days in export window", activeDaysInWindow],
        ],
      },
      {
        title: "Batch-wise",
        columns: ["Batch", "Participants", "Reviews", "Approval %", "Avg progress %", "At-risk"],
        rows: batches
          .filter((b) => b.coachId === coach.id)
          .map((b) => [b.batchName, b.participants, b.reviewsTotal, b.approvalRate, b.avgProgressPct, b.atRiskCount]),
      },
      {
        title: "Participants",
        columns: ["Participant", "Batch", "Weeks ✓", "Points", "Reviews", "Notes", "Last contact"],
        rows: participants
          .filter((p) => p.coachId === coach.id)
          .map((p) => [
            p.participantName,
            p.batchName,
            `${p.weeksApproved}/${p.totalWeeks}`,
            p.totalPoints,
            p.reviewsReceived,
            p.coachingNotes,
            p.daysSinceContact != null ? `${p.daysSinceContact}d ago` : "Never",
          ]),
      },
    ],
  };
}

// Whole-team scoreboard export.
export function buildScoreboardSpec(coaches: CoachReport[]): ReportExportSpec {
  const totalReviews = coaches.reduce((n, c) => n + c.reviews, 0);
  const totalAtRisk = coaches.reduce((n, c) => n + c.atRiskCount, 0);
  const avgScore = coaches.length ? Math.round(coaches.reduce((n, c) => n + c.score, 0) / coaches.length) : 0;
  return {
    title: "Coach Performance Scoreboard",
    subtitle: `${coaches.length} coaches · generated ${format(new Date(), "MMM d, yyyy")}`,
    meta: [
      { label: "Coaches", value: String(coaches.length) },
      { label: "Total reviews", value: String(totalReviews) },
      { label: "Avg score", value: `${avgScore}/100` },
      { label: "Participants at risk", value: String(totalAtRisk) },
    ],
    kpis: [
      { label: "Coaches", value: coaches.length },
      { label: "Total reviews", value: totalReviews },
      { label: "Avg score", value: `${avgScore}/100` },
      { label: "At risk", value: totalAtRisk },
    ],
    tables: [
      {
        title: "Scoreboard",
        columns: [
          "Coach", "Score", "Grade", "Participants", "Reviews", "Approval %", "Turnaround",
          "Active days", "Coverage %", "Avg progress %", "At-risk", "Last login",
        ],
        rows: [...coaches]
          .sort((a, b) => b.score - a.score)
          .map((c) => [
            c.name, c.score, c.scoreLabel, c.participants, c.reviews, c.approvalRate, tat(c.avgTurnaroundH),
            c.activeDays30, c.coveragePct, c.avgProgressPct, c.atRiskCount, fmtDate(c.lastLoginAt),
          ]),
      },
      {
        title: "Score dimensions",
        columns: ["Coach", "Quality", "Responsiveness", "Consistency", "Coverage", "Outcomes"],
        rows: [...coaches]
          .sort((a, b) => b.score - a.score)
          .map((c) => [c.name, c.dims.quality, c.dims.responsiveness, c.dims.consistency, c.dims.coverage, c.dims.outcomes]),
      },
    ],
  };
}
