-- =========================================================
-- HABIT + STEP TRACKING (90-day OMM tracker)
-- Stored per participant; readable by their coach / mentor / super_admin.
-- =========================================================

-- 1. Daily habit ticks ------------------------------------------------------
CREATE TABLE public.habit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  habit_id text NOT NULL,
  day_no int NOT NULL CHECK (day_no BETWEEN 1 AND 90),
  log_date date NOT NULL,
  points int NOT NULL DEFAULT 3,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, habit_id, day_no)
);
CREATE INDEX habit_logs_user_idx ON public.habit_logs (user_id);
CREATE INDEX habit_logs_user_day_idx ON public.habit_logs (user_id, day_no);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.habit_logs TO authenticated;
GRANT ALL ON public.habit_logs TO service_role;
ALTER TABLE public.habit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "habit_logs_select_own_or_staff" ON public.habit_logs
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'coach')
    OR public.has_role(auth.uid(), 'mentor')
    OR public.has_role(auth.uid(), 'super_admin')
  );
CREATE POLICY "habit_logs_insert_own" ON public.habit_logs
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "habit_logs_delete_own" ON public.habit_logs
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- 2. Daily step counts (from the in-app pedometer) --------------------------
CREATE TABLE public.daily_steps (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  log_date date NOT NULL,
  day_no int,
  steps int NOT NULL DEFAULT 0 CHECK (steps >= 0),
  goal int NOT NULL DEFAULT 4000,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, log_date)
);
CREATE INDEX daily_steps_user_idx ON public.daily_steps (user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_steps TO authenticated;
GRANT ALL ON public.daily_steps TO service_role;
ALTER TABLE public.daily_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "daily_steps_select_own_or_staff" ON public.daily_steps
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'coach')
    OR public.has_role(auth.uid(), 'mentor')
    OR public.has_role(auth.uid(), 'super_admin')
  );
CREATE POLICY "daily_steps_insert_own" ON public.daily_steps
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "daily_steps_update_own" ON public.daily_steps
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TRIGGER daily_steps_updated_at BEFORE UPDATE ON public.daily_steps
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. Realtime — let the participant's own UI and staff dashboards update live
ALTER PUBLICATION supabase_realtime ADD TABLE public.habit_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.daily_steps;
