import { useEffect, useState } from "react";
import { differenceInCalendarDays } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { weekFromStart } from "@/components/participant/enrollment-data";

// ─── Types ────────────────────────────────────────────────────────────────────
export type ScoreDims = {
  quality: number;        // review approval rate
  responsiveness: number; // turnaround speed + login recency
  consistency: number;    // active days / login days over 30d
  coverage: number;       // % of caseload contacted in last 7d
  outcomes: number;       // participant progress + low at-risk + activity
};

export type CoachReport = {
  id: string;
  name: string;
  avatar: string | null;
  participants: number;
  reviews: number;
  approved: number;
  rejected: number;
  approvalRate: number;
  avgTurnaroundH: number | null;
  notesCount: number;
  meetingsCount: number;
  notifsCount: number;
  visitsCount: number;
  chatMessages: number;
  reviews7d: number;
  reviews30d: number;
  activeDays30: number;
  loginDays30: number;
  atRiskCount: number;
  avgProgressPct: number;
  caseloadActive3dPct: number;
  contacted7d: number;
  coveragePct: number;
  lastReviewAt: string | null;
  lastNoteAt: string | null;
  lastMessageAt: string | null;
  lastLoginAt: string | null;
  score: number;
  scoreLabel: ScoreLabel;
  dims: ScoreDims;
};

export type ScoreLabel = "Excellent" | "Good" | "Developing" | "Low" | "Inactive";

export type ParticipantInteraction = {
  participantId: string;
  participantName: string;
  participantAvatar: string | null;
  batchId: string | null;
  batchName: string;
  coachId: string | null;
  coachName: string;
  weeksApproved: number;
  weeksPending: number;
  totalPoints: number;
  reviewsReceived: number;
  coachingNotes: number;
  meetingsCount: number;
  lastReviewAt: string | null;
  lastNoteAt: string | null;
  lastMeetingAt: string | null;
  lastInteractionAt: string | null;
  startedAt: string | null;
  totalWeeks: number;
  currentWeek: number;
  atRisk: boolean;
  daysSinceContact: number | null;
  habitActive3d: boolean;
  habitsToday: number;
};

export type CoachDailyActivity = {
  day: string;
  reviews: number;
  notes: number;
  meetings: number;
  messages: number;
  logins: number;
  total: number;
};

export type CoachBatchRow = {
  coachId: string;
  coachName: string;
  batchId: string | null;
  batchName: string;
  participants: number;
  reviewsTotal: number;
  approvalRate: number;
  avgProgressPct: number;
  atRiskCount: number;
};

// ─── Score ────────────────────────────────────────────────────────────────────
// Balanced 5-dimension score (each dimension 0–100, equally weighted). Every
// dimension is a real, defensible signal so a coach can be judged on *why* they
// scored what they did — not a single opaque number.
export const SCORE_WEIGHTS: Record<keyof ScoreDims, number> = {
  quality: 0.2,
  responsiveness: 0.2,
  consistency: 0.2,
  coverage: 0.2,
  outcomes: 0.2,
};

export const DIM_LABELS: Record<keyof ScoreDims, string> = {
  quality: "Quality",
  responsiveness: "Responsiveness",
  consistency: "Consistency",
  coverage: "Coverage",
  outcomes: "Outcomes",
};

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

export function computeScore(c: {
  approvalRate: number;
  avgTurnaroundH: number | null;
  activeDays30: number;
  loginDays30: number;
  participants: number;
  reviews: number;
  notesCount: number;
  chatMessages: number;
  contacted7d: number;
  avgProgressPct: number;
  atRiskCount: number;
  caseloadActive3dPct: number;
  lastLoginAt: string | null;
}): { score: number; label: ScoreLabel; dims: ScoreDims } {
  const totallyInactive =
    c.reviews === 0 && c.notesCount === 0 && c.chatMessages === 0 && c.activeDays30 === 0;
  if (totallyInactive) {
    const zero: ScoreDims = { quality: 0, responsiveness: 0, consistency: 0, coverage: 0, outcomes: 0 };
    return { score: 0, label: "Inactive", dims: zero };
  }

  const participants = Math.max(1, c.participants);

  // Quality — review approval rate (0–100).
  const quality = clamp(c.approvalRate);

  // Responsiveness — 70% turnaround, 30% login recency.
  const tat = c.avgTurnaroundH;
  const tatScore =
    tat == null ? 50
    : tat <= 12 ? 100
    : tat <= 24 ? 85
    : tat <= 48 ? 60
    : tat <= 72 ? 35
    : 15;
  const daysSinceLogin = c.lastLoginAt
    ? differenceInCalendarDays(new Date(), new Date(c.lastLoginAt))
    : null;
  const loginScore =
    daysSinceLogin == null ? 30
    : daysSinceLogin <= 1 ? 100
    : daysSinceLogin <= 3 ? 80
    : daysSinceLogin <= 7 ? 50
    : daysSinceLogin <= 14 ? 25
    : 5;
  const responsiveness = clamp(tatScore * 0.7 + loginScore * 0.3);

  // Consistency — active days out of ~20 working days in 30 (+ a nudge from
  // real login days once the heartbeat has history).
  const activeScore = Math.min(100, (c.activeDays30 / 20) * 100);
  const loginDaysScore = Math.min(100, (c.loginDays30 / 20) * 100);
  const consistency = clamp(c.loginDays30 > 0 ? activeScore * 0.7 + loginDaysScore * 0.3 : activeScore);

  // Coverage — share of caseload contacted in the last 7 days.
  const coverage = clamp((c.contacted7d / participants) * 100);

  // Outcomes — participant results: progress, few at-risk, staying active.
  const atRiskRate = (c.atRiskCount / participants) * 100;
  const outcomes = clamp(
    c.avgProgressPct * 0.5 + (100 - atRiskRate) * 0.3 + c.caseloadActive3dPct * 0.2,
  );

  const dims: ScoreDims = { quality, responsiveness, consistency, coverage, outcomes };
  const score = clamp(
    (Object.keys(dims) as (keyof ScoreDims)[]).reduce((sum, k) => sum + dims[k] * SCORE_WEIGHTS[k], 0),
  );
  const label: ScoreLabel =
    score >= 80 ? "Excellent"
    : score >= 60 ? "Good"
    : score >= 40 ? "Developing"
    : score > 0 ? "Low"
    : "Inactive";

  return { score, label, dims };
}

// ─── Coach Performance Report hook ───────────────────────────────────────────
export function useCoachReport() {
  const [coaches, setCoaches] = useState<CoachReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    void (supabase.rpc as any)("coach_performance_report").then(({ data, error: err }: { data: unknown; error: { message: string } | null }) => {
      if (!alive) return;
      if (err) {
        setError(err.message);
        setLoading(false);
        return;
      }
      const rows = ((data ?? []) as unknown) as {
        coach_id: string;
        coach_name: string;
        coach_avatar: string | null;
        participant_count: number;
        reviews_total: number;
        reviews_approved: number;
        reviews_rejected: number;
        approval_rate: number;
        avg_turnaround_h: number | null;
        notes_count: number;
        meetings_count: number;
        notifs_sent: number;
        visits_count: number;
        chat_messages: number;
        reviews_7d: number;
        reviews_30d: number;
        active_days_30: number;
        login_days_30: number;
        at_risk_count: number;
        avg_progress_pct: number;
        caseload_active_3d_pct: number;
        contacted_7d: number;
        last_review_at: string | null;
        last_note_at: string | null;
        last_message_at: string | null;
        last_login_at: string | null;
      }[];

      const mapped: CoachReport[] = rows.map((r) => {
        const participants = Number(r.participant_count);
        const contacted7d = Number(r.contacted_7d);
        const base = {
          approvalRate: Number(r.approval_rate),
          avgTurnaroundH: r.avg_turnaround_h != null ? Number(r.avg_turnaround_h) : null,
          activeDays30: Number(r.active_days_30),
          loginDays30: Number(r.login_days_30),
          participants,
          reviews: Number(r.reviews_total),
          notesCount: Number(r.notes_count),
          chatMessages: Number(r.chat_messages),
          contacted7d,
          avgProgressPct: Number(r.avg_progress_pct),
          atRiskCount: Number(r.at_risk_count),
          caseloadActive3dPct: Number(r.caseload_active_3d_pct),
          lastLoginAt: r.last_login_at,
        };
        const { score, label, dims } = computeScore(base);
        return {
          id: r.coach_id,
          name: r.coach_name,
          avatar: r.coach_avatar,
          participants,
          reviews: Number(r.reviews_total),
          approved: Number(r.reviews_approved),
          rejected: Number(r.reviews_rejected),
          approvalRate: Number(r.approval_rate),
          avgTurnaroundH: r.avg_turnaround_h != null ? Number(r.avg_turnaround_h) : null,
          notesCount: Number(r.notes_count),
          meetingsCount: Number(r.meetings_count),
          notifsCount: Number(r.notifs_sent),
          visitsCount: Number(r.visits_count),
          chatMessages: Number(r.chat_messages),
          reviews7d: Number(r.reviews_7d),
          reviews30d: Number(r.reviews_30d),
          activeDays30: Number(r.active_days_30),
          loginDays30: Number(r.login_days_30),
          atRiskCount: Number(r.at_risk_count),
          avgProgressPct: Number(r.avg_progress_pct),
          caseloadActive3dPct: Number(r.caseload_active_3d_pct),
          contacted7d,
          coveragePct: participants > 0 ? Math.round((contacted7d / participants) * 100) : 0,
          lastReviewAt: r.last_review_at,
          lastNoteAt: r.last_note_at,
          lastMessageAt: r.last_message_at,
          lastLoginAt: r.last_login_at,
          score,
          scoreLabel: label,
          dims,
        };
      });
      setCoaches(mapped);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, []);

  return { coaches, loading, error };
}

// ─── Per-coach 30-day daily activity (for the heatmap) ────────────────────────
export function useCoachDailyActivity(coachId: string | null, days = 30) {
  const [rows, setRows] = useState<CoachDailyActivity[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!coachId) {
      setRows([]);
      return;
    }
    let alive = true;
    setLoading(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    void (supabase.rpc as any)("coach_daily_activity", { _coach_id: coachId, _days: days }).then(
      ({ data, error }: { data: unknown; error: { message: string } | null }) => {
        if (!alive) return;
        if (error) {
          setRows([]);
          setLoading(false);
          return;
        }
        const mapped: CoachDailyActivity[] = ((data ?? []) as unknown as {
          day: string; reviews: number; notes: number; meetings: number; messages: number; logins: number;
        }[]).map((d) => {
          const reviews = Number(d.reviews), notes = Number(d.notes), meetings = Number(d.meetings), messages = Number(d.messages), logins = Number(d.logins);
          return { day: d.day, reviews, notes, meetings, messages, logins, total: reviews + notes + meetings + messages };
        });
        setRows(mapped);
        setLoading(false);
      },
    );
    return () => {
      alive = false;
    };
  }, [coachId, days]);

  return { rows, loading };
}

// ─── Coach × batch breakdown ──────────────────────────────────────────────────
export function useCoachBatchBreakdown() {
  const [rows, setRows] = useState<CoachBatchRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    void (supabase.rpc as any)("coach_batch_breakdown").then(
      ({ data, error }: { data: unknown; error: { message: string } | null }) => {
        if (!alive) return;
        if (error) {
          setRows([]);
          setLoading(false);
          return;
        }
        const mapped: CoachBatchRow[] = ((data ?? []) as unknown as {
          coach_id: string; coach_name: string; batch_id: string | null; batch_name: string;
          participants: number; reviews_total: number; approval_rate: number; avg_progress_pct: number; at_risk_count: number;
        }[]).map((r) => ({
          coachId: r.coach_id,
          coachName: r.coach_name,
          batchId: r.batch_id,
          batchName: r.batch_name,
          participants: Number(r.participants),
          reviewsTotal: Number(r.reviews_total),
          approvalRate: Number(r.approval_rate),
          avgProgressPct: Number(r.avg_progress_pct),
          atRiskCount: Number(r.at_risk_count),
        }));
        setRows(mapped);
        setLoading(false);
      },
    );
    return () => {
      alive = false;
    };
  }, []);

  return { rows, loading };
}

// ─── Login/activity heartbeat ─────────────────────────────────────────────────
// Fire-and-forget: records that this staff member was active today. Builds the
// real daily-login history that powers login streaks + the consistency score.
export function coachPing() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  void (supabase.rpc as any)("coach_ping").then(() => {}, () => {});
}

// ─── Participant-coach interaction map hook ───────────────────────────────────
export function useParticipantInteractions() {
  const [rows, setRows] = useState<ParticipantInteraction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    void (supabase.rpc as any)("participant_coach_interactions").then(({ data, error: err }: { data: unknown; error: { message: string } | null }) => {
      if (!alive) return;
      if (err) {
        setError(err.message);
        setLoading(false);
        return;
      }
      const now = new Date();
      const mapped: ParticipantInteraction[] = ((data ?? []) as unknown as {
        participant_id: string;
        participant_name: string;
        participant_avatar: string | null;
        batch_id: string | null;
        batch_name: string;
        primary_coach_id: string | null;
        primary_coach_name: string;
        weeks_approved: number;
        weeks_pending: number;
        total_points: number;
        reviews_received: number;
        coaching_notes: number;
        meetings_count: number;
        last_review_at: string | null;
        last_note_at: string | null;
        last_meeting_at: string | null;
        started_at: string | null;
        total_weeks: number;
        habit_active_3d: boolean;
        habits_today: number;
      }[]).map((r) => {
        const startedAt = r.started_at ? new Date(r.started_at) : null;
        const currentWeek = weekFromStart(startedAt, Number(r.total_weeks));
        const weeksApproved = Number(r.weeks_approved);
        const atRisk = startedAt != null && weeksApproved < currentWeek - 2;

        // Last interaction = most recent of review, note, meeting
        const candidates = [r.last_review_at, r.last_note_at, r.last_meeting_at]
          .filter(Boolean)
          .map((s) => new Date(s!).getTime());
        const lastInteractionTs = candidates.length ? Math.max(...candidates) : null;
        const lastInteractionAt = lastInteractionTs ? new Date(lastInteractionTs).toISOString() : null;
        const daysSinceContact = lastInteractionAt
          ? differenceInCalendarDays(now, new Date(lastInteractionAt))
          : null;

        return {
          participantId: r.participant_id,
          participantName: r.participant_name,
          participantAvatar: r.participant_avatar,
          batchId: r.batch_id,
          batchName: r.batch_name,
          coachId: r.primary_coach_id,
          coachName: r.primary_coach_name,
          weeksApproved,
          weeksPending: Number(r.weeks_pending),
          totalPoints: Number(r.total_points),
          reviewsReceived: Number(r.reviews_received),
          coachingNotes: Number(r.coaching_notes),
          meetingsCount: Number(r.meetings_count),
          lastReviewAt: r.last_review_at,
          lastNoteAt: r.last_note_at,
          lastMeetingAt: r.last_meeting_at,
          lastInteractionAt,
          startedAt: r.started_at,
          totalWeeks: Number(r.total_weeks),
          currentWeek,
          atRisk,
          daysSinceContact,
          habitActive3d: Boolean(r.habit_active_3d),
          habitsToday: Number(r.habits_today),
        };
      });
      setRows(mapped);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, []);

  return { rows, loading, error };
}
