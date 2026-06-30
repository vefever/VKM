-- =========================================================
-- WATER EVENTS — per-glass audit trail (anti-fraud)
-- Each logged glass is a row; glasses logged inside the 30-min cooldown
-- require a reason and are flagged `rapid`. Staff can read everything.
-- =========================================================

CREATE TABLE public.water_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  log_date date NOT NULL,
  day_no int,
  ml int NOT NULL,                 -- +250 add, -250 remove
  reason text,                     -- why it was logged back-to-back
  rapid boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX water_events_user_idx ON public.water_events (user_id, created_at DESC);

GRANT SELECT, INSERT ON public.water_events TO authenticated;
GRANT ALL ON public.water_events TO service_role;
ALTER TABLE public.water_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "water_events_select_own_or_staff" ON public.water_events
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'coach')
    OR public.has_role(auth.uid(), 'mentor')
    OR public.has_role(auth.uid(), 'super_admin')
  );
CREATE POLICY "water_events_insert_own" ON public.water_events
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

ALTER PUBLICATION supabase_realtime ADD TABLE public.water_events;
