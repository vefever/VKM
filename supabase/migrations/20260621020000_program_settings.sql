-- =========================================================
-- PROGRAM SETTINGS (admin-editable) + staff can list participants
-- =========================================================

-- 1. Singleton settings row the admin panel edits; everyone reads it.
CREATE TABLE public.program_settings (
  id int PRIMARY KEY DEFAULT 1,
  habit_weeks int NOT NULL DEFAULT 16 CHECK (habit_weeks BETWEEN 1 AND 52),
  habit_days_per_week int NOT NULL DEFAULT 7 CHECK (habit_days_per_week BETWEEN 1 AND 7),
  habit_points_per_tick int NOT NULL DEFAULT 3 CHECK (habit_points_per_tick BETWEEN 0 AND 100),
  step_goal int NOT NULL DEFAULT 4000 CHECK (step_goal BETWEEN 100 AND 100000),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT program_settings_singleton CHECK (id = 1)
);
INSERT INTO public.program_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

GRANT SELECT ON public.program_settings TO authenticated;
GRANT ALL ON public.program_settings TO service_role;
ALTER TABLE public.program_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "program_settings_read_all" ON public.program_settings
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "program_settings_admin_update" ON public.program_settings
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER program_settings_updated_at BEFORE UPDATE ON public.program_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE public.program_settings;

-- 2. Let staff (coach/mentor/admin) read user_roles so they can list the
--    participants whose habit data they're allowed to view. (Participants still
--    only see their own role — no peer enumeration.)
DROP POLICY IF EXISTS "user_roles_select_self_or_admin" ON public.user_roles;
CREATE POLICY "user_roles_select_self_or_staff" ON public.user_roles
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'coach')
    OR public.has_role(auth.uid(), 'mentor')
    OR public.has_role(auth.uid(), 'super_admin')
  );
