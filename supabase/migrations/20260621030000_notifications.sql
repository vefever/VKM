-- =========================================================
-- NOTIFICATIONS — real, per-user, realtime, role-aware
-- =========================================================

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, -- recipient
  type text NOT NULL DEFAULT 'system',
  title text NOT NULL,
  body text,
  link text,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user_idx ON public.notifications (user_id, created_at DESC);

GRANT SELECT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Recipients read / mark-read / dismiss their own; inserts happen only through
-- SECURITY DEFINER functions + triggers below (no direct insert by clients).
CREATE POLICY "notifications_select_own" ON public.notifications
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "notifications_update_own" ON public.notifications
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "notifications_delete_own" ON public.notifications
  FOR DELETE TO authenticated USING (user_id = auth.uid());

ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- ---------------------------------------------------------
-- Broadcast helper — staff (coach / mentor / super_admin) push a
-- notification to every participant. Used for "new LMS video / workbook /
-- download / announcement" etc.
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_participants(
  _type text, _title text, _body text, _link text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE n integer;
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'coach')
    OR public.has_role(auth.uid(), 'mentor')
    OR public.has_role(auth.uid(), 'super_admin')
  ) THEN
    RAISE EXCEPTION 'Forbidden: only staff can broadcast';
  END IF;

  INSERT INTO public.notifications (user_id, type, title, body, link, actor_id)
  SELECT ur.user_id, _type, _title, _body, _link, auth.uid()
  FROM public.user_roles ur
  WHERE ur.role = 'participant';

  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.notify_participants(text, text, text, text) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.notify_participants(text, text, text, text) TO authenticated;

-- ---------------------------------------------------------
-- Trigger: weekly_progress — staff assigns a task (INSERT) or reviews a
-- proof (UPDATE proof_status). Notifies the participant.
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_weekly_progress()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.user_id <> auth.uid() THEN -- assigned by a coach/mentor, not self-started
      INSERT INTO public.notifications (user_id, type, title, body, link, actor_id)
      VALUES (NEW.user_id, 'assignment', 'New weekly task assigned',
        'Week ' || NEW.week_no || ' has been assigned to you.',
        '/participant/weekly-tasks', auth.uid());
    END IF;
  ELSIF TG_OP = 'UPDATE' AND NEW.proof_status IS DISTINCT FROM OLD.proof_status THEN
    IF NEW.proof_status = 'approved' THEN
      INSERT INTO public.notifications (user_id, type, title, body, link, actor_id)
      VALUES (NEW.user_id, 'proof', 'Proof approved ✅',
        'Your Week ' || NEW.week_no || ' proof was approved (+40 pts).',
        '/participant/progress', COALESCE(NEW.coach_id, auth.uid()));
    ELSIF NEW.proof_status = 'rejected' THEN
      INSERT INTO public.notifications (user_id, type, title, body, link, actor_id)
      VALUES (NEW.user_id, 'proof', 'Proof needs changes',
        'Your Week ' || NEW.week_no || ' proof was sent back — check your coach''s notes.',
        '/participant/proof', COALESCE(NEW.coach_id, auth.uid()));
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS weekly_progress_notify ON public.weekly_progress;
CREATE TRIGGER weekly_progress_notify
  AFTER INSERT OR UPDATE OF proof_status ON public.weekly_progress
  FOR EACH ROW EXECUTE FUNCTION public.notify_weekly_progress();

-- ---------------------------------------------------------
-- Trigger: milestone_awards — staff awards a milestone.
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_milestone_award()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, title, body, link, actor_id)
  VALUES (NEW.user_id, 'milestone', 'Milestone unlocked 🏆',
    'You unlocked the "' || NEW.milestone_code || '" milestone.',
    '/participant/milestones', COALESCE(NEW.awarded_by, auth.uid()));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS milestone_awards_notify ON public.milestone_awards;
CREATE TRIGGER milestone_awards_notify
  AFTER INSERT ON public.milestone_awards
  FOR EACH ROW EXECUTE FUNCTION public.notify_milestone_award();
