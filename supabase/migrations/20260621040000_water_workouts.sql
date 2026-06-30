-- =========================================================
-- HYDRATION + WORKOUTS (daily habits, staff-visible)
-- =========================================================

-- 1. Daily water intake (ml) ------------------------------------------------
CREATE TABLE public.daily_water (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  log_date date NOT NULL,
  day_no int,
  ml int NOT NULL DEFAULT 0 CHECK (ml >= 0),
  goal_ml int NOT NULL DEFAULT 4000 CHECK (goal_ml BETWEEN 250 AND 20000),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, log_date)
);
CREATE INDEX daily_water_user_idx ON public.daily_water (user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_water TO authenticated;
GRANT ALL ON public.daily_water TO service_role;
ALTER TABLE public.daily_water ENABLE ROW LEVEL SECURITY;

CREATE POLICY "daily_water_select_own_or_staff" ON public.daily_water
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'coach')
    OR public.has_role(auth.uid(), 'mentor')
    OR public.has_role(auth.uid(), 'super_admin')
  );
CREATE POLICY "daily_water_insert_own" ON public.daily_water
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "daily_water_update_own" ON public.daily_water
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TRIGGER daily_water_updated_at BEFORE UPDATE ON public.daily_water
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2. Workout / gym sessions -------------------------------------------------
CREATE TABLE public.workout_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  log_date date NOT NULL,
  day_no int,
  kind text NOT NULL DEFAULT 'gym',
  minutes int NOT NULL DEFAULT 0 CHECK (minutes BETWEEN 0 AND 600),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX workout_logs_user_idx ON public.workout_logs (user_id, log_date);

GRANT SELECT, INSERT, DELETE ON public.workout_logs TO authenticated;
GRANT ALL ON public.workout_logs TO service_role;
ALTER TABLE public.workout_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workout_logs_select_own_or_staff" ON public.workout_logs
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'coach')
    OR public.has_role(auth.uid(), 'mentor')
    OR public.has_role(auth.uid(), 'super_admin')
  );
CREATE POLICY "workout_logs_insert_own" ON public.workout_logs
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "workout_logs_delete_own" ON public.workout_logs
  FOR DELETE TO authenticated USING (user_id = auth.uid());

ALTER PUBLICATION supabase_realtime ADD TABLE public.daily_water;
ALTER PUBLICATION supabase_realtime ADD TABLE public.workout_logs;
