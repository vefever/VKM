-- =========================================================
-- COACH PROOF REVIEWS — feedback note + resubmission flow
-- =========================================================

ALTER TABLE public.weekly_progress ADD COLUMN IF NOT EXISTS coach_note text;
CREATE INDEX IF NOT EXISTS weekly_progress_status_idx ON public.weekly_progress (proof_status);

-- Update the integrity guard so a participant can SUBMIT / RESUBMIT a proof
-- (status → pending) but can never self-approve, edit the coach note, or change
-- review fields. Once a week is APPROVED it locks.
CREATE OR REPLACE FUNCTION public.guard_weekly_progress()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_staff BOOLEAN := public.has_role(auth.uid(), 'coach')
    OR public.has_role(auth.uid(), 'mentor')
    OR public.has_role(auth.uid(), 'super_admin');
BEGIN
  IF is_staff THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.attended := false;
    NEW.proof_status := 'pending';
    NEW.coach_id := NULL;
    NEW.reviewed_at := NULL;
    NEW.coach_note := NULL;
  ELSE
    -- review-controlled columns are never editable by the participant
    NEW.attended := OLD.attended;
    NEW.coach_id := OLD.coach_id;
    NEW.reviewed_at := OLD.reviewed_at;
    NEW.coach_note := OLD.coach_note;
    IF OLD.proof_status = 'approved' THEN
      NEW.proof_status := OLD.proof_status; -- locked once approved
    ELSE
      NEW.proof_status := 'pending'; -- (re)submission goes back to the queue
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
