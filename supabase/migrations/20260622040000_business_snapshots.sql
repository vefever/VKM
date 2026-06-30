-- Monthly business metrics owners self-report. Profile (slow-changing) stays in
-- business_brains; this is the fast-changing "Metrics layer", keyed by month.
-- Self-reported → pending coach review before it counts toward points/leaderboard.

CREATE TABLE IF NOT EXISTS public.business_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month date NOT NULL, -- first day of the month
  revenue_inr numeric CHECK (revenue_inr >= 0),
  mrr_inr numeric CHECK (mrr_inr >= 0),
  leads int CHECK (leads >= 0),
  deals int CHECK (deals >= 0),
  pipeline_inr numeric CHECK (pipeline_inr >= 0),
  avg_deal_inr numeric CHECK (avg_deal_inr >= 0),
  closing_rate_pct numeric CHECK (closing_rate_pct BETWEEN 0 AND 100),
  followup_pct numeric CHECK (followup_pct BETWEEN 0 AND 100),
  nps int CHECK (nps BETWEEN -100 AND 100),
  note text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  coach_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, month)
);

CREATE INDEX IF NOT EXISTS business_snapshots_user_idx ON public.business_snapshots (user_id);
CREATE INDEX IF NOT EXISTS business_snapshots_status_idx ON public.business_snapshots (status);

GRANT SELECT, INSERT, UPDATE ON public.business_snapshots TO authenticated;
GRANT ALL ON public.business_snapshots TO service_role;
ALTER TABLE public.business_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "snap_select_own_or_staff" ON public.business_snapshots
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_staff());

CREATE POLICY "snap_insert_own_or_staff" ON public.business_snapshots
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.is_staff());

CREATE POLICY "snap_update_own_or_staff" ON public.business_snapshots
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_staff())
  WITH CHECK (user_id = auth.uid() OR public.is_staff());

-- Owners can self-report numbers but never self-approve; any owner edit returns
-- the row to the review queue. Staff (coach/mentor/admin) control the status.
CREATE OR REPLACE FUNCTION public.guard_business_snapshot()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  IF public.is_staff() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.status := 'pending';
    NEW.reviewed_by := NULL;
    NEW.reviewed_at := NULL;
    NEW.coach_note := NULL;
  ELSE
    NEW.reviewed_by := OLD.reviewed_by;
    NEW.reviewed_at := OLD.reviewed_at;
    NEW.coach_note := OLD.coach_note;
    NEW.status := 'pending'; -- re-edited numbers go back for review
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_business_snapshot ON public.business_snapshots;
CREATE TRIGGER guard_business_snapshot
  BEFORE INSERT OR UPDATE ON public.business_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.guard_business_snapshot();
