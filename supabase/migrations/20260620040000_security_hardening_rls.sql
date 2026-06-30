-- =========================================================
-- SECURITY HARDENING — data-leakage & integrity fixes
-- =========================================================
-- Findings addressed:
--   CRITICAL: user_invites exposed token + temp_password to anon/authenticated
--   HIGH:     profiles leaked phone of every user to every authenticated user
--   MEDIUM:   weekly_progress let participants self-approve proofs / self-award points
--   MEDIUM:   user_roles readable by everyone (admin enumeration)
--   LOW:      has_role granted to anon (role-probing oracle)
-- =========================================================

-- ---------------------------------------------------------
-- CRITICAL 1: Lock down user_invites
-- The client never reads this table directly — all access goes through
-- service-role server functions (getInviteByToken, listInvites, etc.).
-- The anon/authenticated read policy leaked token + temp_password (plaintext).
-- ---------------------------------------------------------
DROP POLICY IF EXISTS "Anyone can read pending invite to claim" ON public.user_invites;
REVOKE SELECT ON public.user_invites FROM anon;
-- The remaining "Admins manage invites" policy (super_admin only) governs all
-- authenticated access — non-admins now match no policy row and see nothing.
-- Authenticated GRANTs are kept intact: the admin UI's revoke/list/resend server
-- functions act through the user-scoped client and rely on those grants + policy.

-- ---------------------------------------------------------
-- HIGH 2: Restrict profiles SELECT to self + staff
-- Protects phone numbers and any other PII from peer enumeration.
-- When public leaderboards need names/avatars, expose them through a
-- SECURITY DEFINER view that selects ONLY (id, full_name, avatar_url) —
-- never phone.
-- ---------------------------------------------------------
DROP POLICY IF EXISTS "profiles_select_authenticated" ON public.profiles;
CREATE POLICY "profiles_select_self_or_staff" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR public.has_role(auth.uid(), 'coach')
    OR public.has_role(auth.uid(), 'mentor')
    OR public.has_role(auth.uid(), 'super_admin')
  );

-- ---------------------------------------------------------
-- MEDIUM 3: Restrict user_roles SELECT to self + admin
-- has_role() is SECURITY DEFINER, so role checks elsewhere are unaffected.
-- ---------------------------------------------------------
DROP POLICY IF EXISTS "user_roles_select_authenticated" ON public.user_roles;
CREATE POLICY "user_roles_select_self_or_admin" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin'));

-- ---------------------------------------------------------
-- MEDIUM 4: weekly_progress integrity guard
-- RLS cannot restrict columns, so a participant editing their own row could set
-- proof_status='approved', points, coach_id, reviewed_at. Freeze those columns
-- for non-staff on both INSERT and UPDATE.
-- ---------------------------------------------------------
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
    -- Participants may only create their own pending, unscored rows.
    NEW.proof_status := 'pending';
    NEW.points       := 0;
    NEW.coach_id     := NULL;
    NEW.reviewed_at  := NULL;
  ELSE
    -- Participants may update proof_url/proof_note/attended/task_done only;
    -- review-controlled columns retain their stored values.
    NEW.proof_status := OLD.proof_status;
    NEW.points       := OLD.points;
    NEW.coach_id     := OLD.coach_id;
    NEW.reviewed_at  := OLD.reviewed_at;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.guard_weekly_progress() FROM anon, authenticated, PUBLIC;

DROP TRIGGER IF EXISTS weekly_progress_guard ON public.weekly_progress;
CREATE TRIGGER weekly_progress_guard
  BEFORE INSERT OR UPDATE ON public.weekly_progress
  FOR EACH ROW EXECUTE FUNCTION public.guard_weekly_progress();

-- ---------------------------------------------------------
-- LOW 5: Remove the anon role-probing oracle
-- anon code paths use the service-role server client, not has_role().
-- ---------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
