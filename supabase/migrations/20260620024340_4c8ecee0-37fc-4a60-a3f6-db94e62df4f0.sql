-- Tighten weekly_progress UPDATE WITH CHECK
DROP POLICY IF EXISTS "wp_own_update" ON public.weekly_progress;
CREATE POLICY "wp_own_update" ON public.weekly_progress
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid()
    OR public.has_role(auth.uid(),'coach')
    OR public.has_role(auth.uid(),'mentor')
    OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (user_id = auth.uid()
    OR public.has_role(auth.uid(),'coach')
    OR public.has_role(auth.uid(),'mentor')
    OR public.has_role(auth.uid(),'super_admin'));

-- Switch helpers to SECURITY INVOKER (RLS on points_ledger enforces access)
CREATE OR REPLACE FUNCTION public.points_total(uid UUID)
RETURNS INTEGER LANGUAGE SQL STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT COALESCE(SUM(points), 0)::int FROM public.points_ledger WHERE user_id = uid;
$$;

CREATE OR REPLACE FUNCTION public.current_stage(uid UUID)
RETURNS TEXT LANGUAGE SQL STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT CASE
    WHEN public.points_total(uid) >= 1151 THEN 'Growth Champion'
    WHEN public.points_total(uid) >= 901  THEN 'Closer'
    WHEN public.points_total(uid) >= 601  THEN 'Operator'
    WHEN public.points_total(uid) >= 301  THEN 'Builder'
    ELSE 'Starter'
  END;
$$;
