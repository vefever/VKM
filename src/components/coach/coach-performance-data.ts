import { useEffect, useState } from "react";
import { differenceInCalendarDays } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { weekFromStart } from "@/components/participant/enrollment-data";

// ─── Types ────────────────────────────────────────────────────────────────────
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
  lastReviewAt: string | null;
  lastNoteAt: string | null;
  score: number;
  scoreLabel: ScoreLabel;
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
};

// ─── Score ────────────────────────────────────────────────────────────────────
function computeScore(c: {
  approval_rate: number;
  avg_turnaround_h: number | null;
  notes_count: number;
  meetings_count: number;
  participant_count: number;
  reviews_total: number;
}): { score: number; label: ScoreLabel } {
  if (Number(c.reviews_total) === 0 && Number(c.notes_count) === 0) {
    return { score: 0, label: "Inactive" };
  }

  const participants = Math.max(1, Number(c.participant_count));

  // Review quality 0–35
  const reviewQuality = (Number(c.approval_rate) / 100) * 35;

  // Speed score 0–30 (lower turnaround = better)
  const tat = c.avg_turnaround_h != null ? Number(c.avg_turnaround_h) : null;
  const speedScore =
    tat == null ? 18
    : tat <= 12 ? 30
    : tat <= 24 ? 25
    : tat <= 48 ? 18
    : tat <= 72 ? 10
    : 4;

  // Engagement depth 0–35 (notes + meetings per participant, capped)
  const notesPerPart = Number(c.notes_count) / participants;
  const mtgsPerPart = Number(c.meetings_count) / participants;
  const engagementScore = Math.min(35, Math.min(20, notesPerPart * 8) + Math.min(15, mtgsPerPart * 6));

  const score = Math.min(100, Math.round(reviewQuality + speedScore + engagementScore));
  const label: ScoreLabel =
    score >= 80 ? "Excellent"
    : score >= 60 ? "Good"
    : score >= 40 ? "Developing"
    : score > 0 ? "Low"
    : "Inactive";

  return { score, label };
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
        last_review_at: string | null;
        last_note_at: string | null;
      }[];

      const mapped: CoachReport[] = rows.map((r) => {
        const { score, label } = computeScore(r);
        return {
          id: r.coach_id,
          name: r.coach_name,
          avatar: r.coach_avatar,
          participants: Number(r.participant_count),
          reviews: Number(r.reviews_total),
          approved: Number(r.reviews_approved),
          rejected: Number(r.reviews_rejected),
          approvalRate: Number(r.approval_rate),
          avgTurnaroundH: r.avg_turnaround_h != null ? Number(r.avg_turnaround_h) : null,
          notesCount: Number(r.notes_count),
          meetingsCount: Number(r.meetings_count),
          notifsCount: Number(r.notifs_sent),
          visitsCount: Number(r.visits_count),
          lastReviewAt: r.last_review_at,
          lastNoteAt: r.last_note_at,
          score,
          scoreLabel: label,
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
